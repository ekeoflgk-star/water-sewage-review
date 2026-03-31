'use client';

import { useState, useRef, useEffect } from 'react';
import type { ReferenceAnnotation } from '@/types';

interface ReferencePopoverProps {
  /** 단일 근거 텍스트 (기존 호환) */
  referenceText: string;
  /** 복수 근거 상세 (클릭 바로가기용) */
  references?: ReferenceAnnotation[];
  /** 근거 비교 모드 열기 */
  onCompare?: (refs: ReferenceAnnotation[]) => void;
}

/** 근거 조문 클릭 시 상세 팝오버 */
export function ReferencePopover({ referenceText, references, onCompare }: ReferencePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const hasMultipleRefs = references && references.length > 1;

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* 클릭 가능한 근거 표시 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-[11px] text-blue-600 bg-blue-50/60 hover:bg-blue-100 rounded px-2 py-1 flex items-center gap-1 transition-colors cursor-pointer border border-transparent hover:border-blue-200"
        title="클릭하여 근거 상세 보기"
      >
        <span>📖</span>
        <span className="underline decoration-dotted">{referenceText}</span>
        {hasMultipleRefs && (
          <span className="bg-blue-200 text-blue-700 text-[9px] px-1 rounded-full font-bold ml-0.5">
            +{references.length - 1}
          </span>
        )}
      </button>

      {/* 팝오버 */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 w-80 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-50">
          {/* 헤더 */}
          <div className="sticky top-0 bg-white px-3 py-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">근거 문서</span>
            <div className="flex items-center gap-1">
              {hasMultipleRefs && onCompare && (
                <button
                  onClick={() => {
                    onCompare(references);
                    setIsOpen(false);
                  }}
                  className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors"
                >
                  비교
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm px-1"
              >
                ✕
              </button>
            </div>
          </div>

          {/* 근거 목록 */}
          {references && references.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {references.map((ref, idx) => (
                <div key={ref.id} className="px-3 py-2 hover:bg-slate-50 transition-colors">
                  {/* 출처 헤더 */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-700">{ref.source}</span>
                    {ref.page && (
                      <span className="text-[10px] text-slate-400">p.{ref.page}</span>
                    )}
                    {ref.similarity && (
                      <span className="text-[10px] text-green-600 bg-green-50 px-1 rounded">
                        {Math.round(ref.similarity * 100)}%
                      </span>
                    )}
                  </div>
                  {/* 섹션명 */}
                  {ref.section && (
                    <div className="text-[10px] text-slate-500 mb-1">{ref.section}</div>
                  )}
                  {/* 근거 텍스트 */}
                  <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-4 bg-slate-50 rounded p-2">
                    {ref.content}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-3 py-3">
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded p-2">
                {referenceText}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                KDS 임베딩 완료 후 상세 근거 텍스트가 표시됩니다.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
