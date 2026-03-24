'use client';

import { useState, useCallback } from 'react';
import type { ReviewCard, PermitCard } from '@/types';

interface ReportButtonProps {
  reviewCards: ReviewCard[];
  permitCards: PermitCard[];
  projectName?: string;
  fileName?: string;
}

/**
 * 검토 보고서 PDF 다운로드 버튼
 * - /api/report 호출하여 PDF 바이너리를 받아 다운로드 트리거
 */
export function ReportButton({
  reviewCards,
  permitCards,
  projectName,
  fileName,
}: ReportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewCards,
          permitCards,
          projectName: projectName || '상하수도 설계 프로젝트',
          fileName: fileName || '(파일명 미지정)',
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.error || `PDF 생성 실패 (${response.status})`);
      }

      // PDF blob 다운로드 처리
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      const safeName = (projectName || '검토보고서').replace(/[^가-힣a-zA-Z0-9_\- ]/g, '');
      link.href = url;
      link.download = `설계검토보고서_${safeName}.pdf`;
      document.body.appendChild(link);
      link.click();

      // 정리
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PDF 다운로드 중 오류 발생';
      setError(message);
      console.error('[ReportButton] 다운로드 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, [reviewCards, permitCards, projectName, fileName]);

  const hasResults = reviewCards.length > 0 || permitCards.length > 0;

  if (!hasResults) return null;

  return (
    <div className="mt-3">
      <button
        onClick={handleDownload}
        disabled={isLoading}
        className={`
          inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium
          transition-all duration-200
          ${
            isLoading
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm hover:shadow'
          }
        `}
      >
        {isLoading ? (
          <>
            {/* 로딩 스피너 */}
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>PDF 생성 중...</span>
          </>
        ) : (
          <>
            {/* 다운로드 아이콘 */}
            <svg
              className="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            <span>검토 보고서 다운로드</span>
          </>
        )}
      </button>

      {/* 에러 표시 */}
      {error && (
        <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
          <span>!</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
