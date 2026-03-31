'use client';

import { useState } from 'react';
import type { ReferenceAnnotation } from '@/types';

interface DocumentCompareProps {
  references: ReferenceAnnotation[];
  onClose: () => void;
}

/** 근거 문서 비교 모달 — 좌/우 나란히 비교 */
export function DocumentCompare({ references, onClose }: DocumentCompareProps) {
  // 좌측/우측에 표시할 근거 선택
  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(Math.min(1, references.length - 1));

  if (references.length < 2) {
    return null;
  }

  const left = references[leftIdx];
  const right = references[rightIdx];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <h3 className="text-sm font-semibold text-slate-800">근거 문서 비교</h3>
            <span className="text-xs text-slate-400">{references.length}개 근거</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg px-2"
          >
            ✕
          </button>
        </div>

        {/* 비교 영역 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 좌측 */}
          <ComparePane
            reference={left}
            allReferences={references}
            selectedIdx={leftIdx}
            onSelect={setLeftIdx}
            side="left"
          />

          {/* 구분선 */}
          <div className="w-px bg-slate-200 flex-shrink-0" />

          {/* 우측 */}
          <ComparePane
            reference={right}
            allReferences={references}
            selectedIdx={rightIdx}
            onSelect={setRightIdx}
            side="right"
          />
        </div>

        {/* 하단 — 차이점 요약 */}
        <div className="px-4 py-2 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>💡</span>
            <span>
              {left.source === right.source
                ? '동일 출처의 다른 섹션을 비교하고 있습니다.'
                : `"${left.source}" vs "${right.source}" — 서로 다른 출처의 근거를 비교합니다.`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ComparePaneProps {
  reference: ReferenceAnnotation;
  allReferences: ReferenceAnnotation[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  side: 'left' | 'right';
}

function ComparePane({ reference, allReferences, selectedIdx, onSelect, side }: ComparePaneProps) {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* 탭 선택 */}
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
        <select
          value={selectedIdx}
          onChange={(e) => onSelect(Number(e.target.value))}
          className="text-xs w-full px-2 py-1 border border-slate-200 rounded bg-white focus:border-blue-400 focus:outline-none"
        >
          {allReferences.map((ref, idx) => (
            <option key={ref.id} value={idx}>
              {side === 'left' ? '◀ ' : '▶ '}
              {ref.source}{ref.page ? ` (p.${ref.page})` : ''}
              {ref.similarity ? ` — ${Math.round(ref.similarity * 100)}%` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* 메타 정보 */}
      <div className="px-3 py-2 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-slate-700">{reference.source}</span>
          {reference.page && (
            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              p.{reference.page}
            </span>
          )}
          {reference.similarity && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              reference.similarity > 0.8
                ? 'bg-green-50 text-green-600'
                : reference.similarity > 0.6
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-red-50 text-red-600'
            }`}>
              유사도 {Math.round(reference.similarity * 100)}%
            </span>
          )}
        </div>
        {reference.section && (
          <p className="text-[10px] text-slate-500">{reference.section}</p>
        )}
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto p-3">
        <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
          {reference.content}
        </p>
      </div>
    </div>
  );
}
