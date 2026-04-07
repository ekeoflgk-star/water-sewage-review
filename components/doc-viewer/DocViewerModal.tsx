'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DocEntry } from '@/lib/docs/types';
import { DOC_CATALOG, getDocById } from '@/lib/docs/catalog';
import { findTocByPage } from '@/lib/docs/toc-utils';
import { DocToc } from './DocToc';
import { DocPageViewer } from './DocPageViewer';

interface DocViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDocId?: string | null;
  initialPage?: number;
}

const ZOOM_LEVELS = [0.75, 1.0, 1.25, 1.5];

export function DocViewerModal({ isOpen, onClose, initialDocId, initialPage }: DocViewerModalProps) {
  const [activeDoc, setActiveDoc] = useState<DocEntry | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [activeTocId, setActiveTocId] = useState<string | null>(null);
  const [tocCollapsed, setTocCollapsed] = useState(false);
  // targetPage를 { page, ts } 객체로 관리 — 같은 페이지 재클릭도 감지
  const [targetPage, setTargetPage] = useState<{ page: number; ts: number } | undefined>();
  const [mounted, setMounted] = useState(false);

  // portal 마운트
  useEffect(() => { setMounted(true); }, []);

  // 초기 문서 설정
  useEffect(() => {
    if (isOpen) {
      const doc = initialDocId ? getDocById(initialDocId) : DOC_CATALOG[0];
      if (doc) {
        setActiveDoc(doc);
        const page = initialPage || 1;
        setCurrentPage(page);
        setTargetPage({ page, ts: Date.now() });
      }
    }
  }, [isOpen, initialDocId, initialPage]);

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '[') setTocCollapsed(prev => !prev);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // 문서 선택
  const handleSelectDoc = useCallback((docId: string) => {
    const doc = getDocById(docId);
    if (doc) {
      setActiveDoc(doc);
      setCurrentPage(1);
      setTargetPage({ page: 1, ts: Date.now() });
      setActiveTocId(null);
    }
  }, []);

  // TOC 클릭 → 페이지 이동 (ts로 같은 페이지 재클릭도 감지)
  const handleSelectTocPage = useCallback((page: number) => {
    setTargetPage({ page, ts: Date.now() });
    setCurrentPage(page);
  }, []);

  // 스크롤로 현재 페이지 변경 시
  const handleCurrentPageChange = useCallback((page: number) => {
    setCurrentPage(page);
    if (activeDoc) {
      const tocItem = findTocByPage(activeDoc.toc, page);
      setActiveTocId(tocItem?.id || null);
    }
  }, [activeDoc]);

  // 줌 변경
  const handleZoomIn = () => {
    const idx = ZOOM_LEVELS.indexOf(zoomLevel);
    if (idx < ZOOM_LEVELS.length - 1) setZoomLevel(ZOOM_LEVELS[idx + 1]);
  };
  const handleZoomOut = () => {
    const idx = ZOOM_LEVELS.indexOf(zoomLevel);
    if (idx > 0) setZoomLevel(ZOOM_LEVELS[idx - 1]);
  };

  // 페이지 직접 이동
  const pageInputRef = useRef<HTMLInputElement>(null);
  const handlePageJump = () => {
    const val = parseInt(pageInputRef.current?.value || '');
    if (val && activeDoc && val >= 1 && val <= activeDoc.totalPages) {
      setTargetPage({ page: val, ts: Date.now() });
      setCurrentPage(val);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col">
      {/* ── 상단 헤더 ── */}
      <div className="h-12 border-b border-slate-200 flex items-center px-4 gap-3 shrink-0 bg-white">
        {/* 닫기 */}
        <button
          onClick={onClose}
          className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
          닫기
        </button>

        {/* 문서 제목 */}
        {activeDoc && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-mono font-bold shrink-0">
              {activeDoc.code}
            </span>
            <span className="text-sm font-semibold text-slate-700 truncate">
              {activeDoc.title}
            </span>
            <span className="text-xs text-slate-400 shrink-0">({activeDoc.version})</span>
          </div>
        )}

        <div className="flex-1" />

        {/* TOC 토글 */}
        <button
          onClick={() => setTocCollapsed(prev => !prev)}
          className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100"
          title="목차 토글 [키]"
        >
          {tocCollapsed ? '☰ 목차' : '☰'}
        </button>

        {/* 줌 */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={handleZoomOut} className="w-7 h-7 rounded hover:bg-slate-100 text-slate-500 text-sm font-bold">−</button>
          <span className="text-xs text-slate-600 w-10 text-center font-mono">{Math.round(zoomLevel * 100)}%</span>
          <button onClick={handleZoomIn} className="w-7 h-7 rounded hover:bg-slate-100 text-slate-500 text-sm font-bold">+</button>
        </div>

        {/* 페이지 이동 */}
        {activeDoc && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-slate-400">p.</span>
            <input
              ref={pageInputRef}
              type="number"
              defaultValue={currentPage}
              key={currentPage}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePageJump(); }}
              className="w-12 text-xs text-center border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
              min={1}
              max={activeDoc.totalPages}
            />
            <span className="text-xs text-slate-400">/ {activeDoc.totalPages}</span>
          </div>
        )}
      </div>

      {/* ── 본문 (TOC + 뷰어) ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* TOC 사이드바 */}
        <div
          className={`border-r border-slate-200 overflow-y-auto bg-slate-50/50 transition-all duration-300 ${
            tocCollapsed ? 'w-0 overflow-hidden' : 'w-72'
          }`}
        >
          <DocToc
            documents={DOC_CATALOG}
            activeDocId={activeDoc?.id || null}
            activeTocId={activeTocId}
            onSelectDoc={handleSelectDoc}
            onSelectTocPage={handleSelectTocPage}
          />
        </div>

        {/* 페이지 뷰어 */}
        <div className="flex-1 overflow-hidden relative">
          {activeDoc ? (
            <DocPageViewer
              doc={activeDoc}
              zoomLevel={zoomLevel}
              targetPage={targetPage?.page}
              onCurrentPageChange={handleCurrentPageChange}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              좌측 목차에서 문서를 선택하세요
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
