'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { DocEntry } from '@/lib/docs/types';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

interface DocPageViewerProps {
  doc: DocEntry;
  zoomLevel: number;
  targetPage?: number;
  onCurrentPageChange: (page: number) => void;
}

// PDF.js 초기화 (한 번만)
let pdfjsLib: typeof import('pdfjs-dist') | null = null;
async function getPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  const lib = await import('pdfjs-dist');
  lib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${lib.version}/pdf.worker.min.mjs`;
  pdfjsLib = lib;
  return lib;
}

/**
 * PDF 단일 페이지 뷰어 — PDF.js 캔버스 렌더링
 * 한 번에 1페이지만 렌더하여 동시성 문제 완전 회피
 */
export function DocPageViewer({ doc, zoomLevel, targetPage, onCurrentPageChange }: DocPageViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(targetPage || 1);
  const [numPages, setNumPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const currentRenderRef = useRef<number>(0); // 렌더 요청 ID (취소 추적)

  // PDF 문서 로드
  useEffect(() => {
    let cancelled = false;
    setPdfDoc(null);
    setIsLoading(true);
    setLoadError(null);
    setLoadProgress(0);
    setCurrentPage(targetPage || 1);

    (async () => {
      try {
        const pdfjs = await getPdfjs();
        const loadingTask = pdfjs.getDocument(doc.pdfPath);
        loadingTask.onProgress = (data: { loaded: number; total: number }) => {
          if (data.total > 0 && !cancelled) {
            setLoadProgress(Math.round((data.loaded / data.total) * 100));
          }
        };
        const pdf = await loadingTask.promise;
        if (!cancelled) {
          setPdfDoc(pdf);
          setNumPages(pdf.numPages);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('PDF 로드 실패:', err);
          setLoadError(`PDF를 불러올 수 없습니다.`);
          setIsLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [doc.id, doc.pdfPath, targetPage]);

  // 단일 페이지 렌더 함수
  const renderCurrentPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current) return;

    // 이전 렌더 취소
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    const renderId = ++currentRenderRef.current;
    setIsRendering(true);

    try {
      const page: PDFPageProxy = await pdfDoc.getPage(pageNum);
      // 취소 확인
      if (renderId !== currentRenderRef.current) return;

      const baseScale = 800 / 595; // A4 595pt → 800px
      const scale = baseScale * zoomLevel;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      ctx.scale(dpr, dpr);

      const renderTask = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      renderTaskRef.current = null;
      if (renderId === currentRenderRef.current) {
        setIsRendering(false);
      }
    } catch (err: unknown) {
      renderTaskRef.current = null;
      const name = err && typeof err === 'object' && 'name' in err ? (err as { name: string }).name : '';
      if (name !== 'RenderingCancelledException') {
        console.warn(`페이지 ${pageNum} 렌더 실패:`, err);
      }
      if (renderId === currentRenderRef.current) {
        setIsRendering(false);
      }
    }
  }, [pdfDoc, zoomLevel]);

  // 현재 페이지 또는 줌 변경 시 렌더
  useEffect(() => {
    if (pdfDoc && currentPage >= 1 && currentPage <= numPages) {
      renderCurrentPage(currentPage);
    }
  }, [pdfDoc, currentPage, zoomLevel, numPages, renderCurrentPage]);

  // targetPage (외부 TOC 클릭) 변경 시 페이지 이동
  useEffect(() => {
    if (targetPage && targetPage >= 1 && pdfDoc && numPages > 0) {
      const clamped = Math.max(1, Math.min(targetPage, numPages));
      setCurrentPage(clamped);
      onCurrentPageChange(clamped);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetPage]);

  // 페이지 이동 함수
  const goToPage = useCallback((page: number) => {
    const clamped = Math.max(1, Math.min(page, numPages));
    setCurrentPage(clamped);
    onCurrentPageChange(clamped);
  }, [numPages, onCurrentPageChange]);

  // 키보드 페이지 이동
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goToPage(currentPage - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goToPage(currentPage + 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentPage, goToPage]);

  // ── 로딩 중 ──
  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-600">PDF 로딩 중...</p>
          {loadProgress > 0 && loadProgress < 100 && (
            <div className="mt-2 w-48 mx-auto">
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${loadProgress}%` }} />
              </div>
              <p className="text-xs text-slate-400 mt-1">{loadProgress}%</p>
            </div>
          )}
          <p className="text-xs text-slate-400 mt-2">{doc.title}</p>
        </div>
      </div>
    );
  }

  // ── 에러 ──
  if (loadError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-sm text-red-600 font-medium">{loadError}</p>
          <p className="text-xs text-slate-400 mt-2">{doc.pdfPath}</p>
        </div>
      </div>
    );
  }

  // ── 정상 렌더 ──
  return (
    <div ref={containerRef} className="absolute inset-0 flex flex-col bg-slate-100">
      {/* 캔버스 영역 */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4">
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="bg-white shadow-lg rounded"
          />
          {/* 렌더 중 오버레이 */}
          {isRendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60">
              <div className="w-8 h-8 border-3 border-green-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* 하단 네비게이션 바 */}
      <div className="h-11 border-t border-slate-200 bg-white flex items-center justify-center gap-3 px-4 shrink-0">
        {/* 이전 */}
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-3 py-1 text-sm rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 font-medium"
        >
          ← 이전
        </button>

        {/* 페이지 표시 */}
        <span className="text-sm text-slate-500 font-mono min-w-[80px] text-center">
          {currentPage} / {numPages}
        </span>

        {/* 다음 */}
        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= numPages}
          className="px-3 py-1 text-sm rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 font-medium"
        >
          다음 →
        </button>
      </div>
    </div>
  );
}
