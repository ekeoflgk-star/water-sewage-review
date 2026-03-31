'use client';

import { useState } from 'react';
import type { ReviewCard, PermitCard } from '@/types';

interface ReviewOpinionTableProps {
  reviewCards: ReviewCard[];
  permitCards: PermitCard[];
  projectName?: string;
  onExportDocx: () => void;
  isExporting?: boolean;
}

/** 설계도서검토의견서 양식 — 채팅에서 테이블 형태로 표시 */
export function ReviewOpinionTable({
  reviewCards,
  permitCards,
  projectName,
  onExportDocx,
  isExporting,
}: ReviewOpinionTableProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 검토의견 번호 생성
  const allItems = [
    ...reviewCards.map((card, idx) => ({
      no: idx + 1,
      type: 'review' as const,
      category: getCategoryLabel(card.category),
      itemName: card.itemName,
      opinion: card.finding,
      reference: card.reference,
      verdict: card.verdict,
      designValue: card.designValue,
      standardValue: card.standardValue,
    })),
    ...permitCards.map((card, idx) => ({
      no: reviewCards.length + idx + 1,
      type: 'permit' as const,
      category: '인허가',
      itemName: card.permitName,
      opinion: card.explanation,
      reference: card.legalBasis,
      verdict: card.verdict === 'required' ? 'fail' : card.verdict === 'not-applicable' ? 'pass' : 'check',
      designValue: card.triggerCondition,
      standardValue: undefined,
    })),
  ];

  if (allItems.length === 0) return null;

  return (
    <div className="mt-3 border border-slate-300 rounded-lg overflow-hidden">
      {/* 양식 헤더 */}
      <div className="bg-slate-700 text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-white/80 hover:text-white text-xs"
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
          <span className="text-xs font-bold">설계도서 검토의견서</span>
          {projectName && (
            <span className="text-[10px] text-white/60">— {projectName}</span>
          )}
          <span className="text-[10px] text-white/50 ml-2">
            {allItems.length}건
          </span>
        </div>
        <button
          onClick={onExportDocx}
          disabled={isExporting}
          className="text-[10px] px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded transition-colors disabled:opacity-50"
        >
          {isExporting ? '생성 중...' : '📄 한글 파일 다운로드'}
        </button>
      </div>

      {/* 테이블 */}
      {!isCollapsed && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-2 py-1.5 text-center w-10 font-semibold text-slate-700">
                  번호
                </th>
                <th className="border border-slate-300 px-2 py-1.5 text-center w-16 font-semibold text-slate-700">
                  구분
                </th>
                <th className="border border-slate-300 px-2 py-1.5 text-center w-20 font-semibold text-slate-700">
                  판정
                </th>
                <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700">
                  검토항목
                </th>
                <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[200px]">
                  검토의견
                </th>
                <th className="border border-slate-300 px-2 py-1.5 text-left w-28 font-semibold text-slate-700">
                  설계값
                </th>
                <th className="border border-slate-300 px-2 py-1.5 text-left w-28 font-semibold text-slate-700">
                  기준값
                </th>
                <th className="border border-slate-300 px-2 py-1.5 text-left w-32 font-semibold text-slate-700">
                  근거
                </th>
                <th className="border border-slate-300 px-2 py-1.5 text-left min-w-[120px] font-semibold text-slate-700">
                  조치내용
                </th>
              </tr>
            </thead>
            <tbody>
              {allItems.map((item) => (
                <tr
                  key={`${item.type}-${item.no}`}
                  className={`hover:bg-slate-50 ${
                    item.verdict === 'fail' ? 'bg-red-50/30' : ''
                  }`}
                >
                  <td className="border border-slate-200 px-2 py-1.5 text-center text-slate-500">
                    {item.no}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      item.type === 'permit'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {item.category}
                    </span>
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center">
                    <VerdictBadge verdict={item.verdict as string} />
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-slate-700 font-medium">
                    {item.itemName}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-slate-600 leading-relaxed">
                    {item.opinion}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-slate-600">
                    {item.designValue || '-'}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-slate-600">
                    {item.standardValue || '-'}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-slate-500 text-[10px]">
                    {item.reference}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5">
                    {/* 조치내용 — 사용자가 직접 입력하는 영역 */}
                    <span className="text-[10px] text-slate-300 italic">미입력</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    pass: { bg: 'bg-green-100', text: 'text-green-700', label: '적합' },
    fail: { bg: 'bg-red-100', text: 'text-red-700', label: '부적합' },
    check: { bg: 'bg-amber-100', text: 'text-amber-700', label: '확인필요' },
    required: { bg: 'bg-red-100', text: 'text-red-700', label: '필수' },
    conditional: { bg: 'bg-amber-100', text: 'text-amber-700', label: '조건부' },
    'scale-review': { bg: 'bg-blue-100', text: 'text-blue-700', label: '규모검토' },
    'not-applicable': { bg: 'bg-slate-100', text: 'text-slate-500', label: '해당없음' },
  };

  const style = styles[verdict] || styles.check;

  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

function getCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    'sewer-pipeline': '관로',
    'sewer-pump': '펌프장',
    'sewer-treatment': '수처리',
    'sewer-sludge': '슬러지',
    'water-intake': '취정수',
    'water-distribution': '배급수',
    'common-structural': '구조',
  };
  return map[category] || category;
}
