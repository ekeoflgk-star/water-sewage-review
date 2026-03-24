'use client';

import { useState, useCallback } from 'react';
import type { PermitCard as PermitCardType, PermitVerdict } from '@/types';
import { PERMIT_VERDICT_LABELS } from '@/types';
import { PERMIT_INFO_MAP, type PermitInfo } from '@/lib/permit-info';

interface PermitChecklistProps {
  permitCards: PermitCardType[];
}

/** 판정별 배지 스타일 */
const VERDICT_BADGE: Record<PermitVerdict, { icon: string; cls: string }> = {
  required: { icon: '✅', cls: 'bg-green-100 text-green-800' },
  conditional: { icon: '⚠️', cls: 'bg-amber-100 text-amber-800' },
  'scale-review': { icon: 'ℹ️', cls: 'bg-blue-100 text-blue-800' },
  'not-applicable': { icon: '❌', cls: 'bg-slate-100 text-slate-600' },
};

/** 개별 인허가 체크리스트 항목 */
function PermitChecklistItem({
  card,
  info,
  isExpanded,
  onToggle,
}: {
  card: PermitCardType;
  info: PermitInfo | undefined;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  // 서류별 체크 상태 (로컬 상태만 관리)
  const [checkedDocs, setCheckedDocs] = useState<Record<number, boolean>>({});

  const badge = VERDICT_BADGE[card.verdict];
  const totalDocs = info?.requiredDocs.length ?? 0;
  const checkedCount = Object.values(checkedDocs).filter(Boolean).length;

  const handleDocCheck = useCallback((idx: number) => {
    setCheckedDocs((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }, []);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* 헤더: 인허가명 + 판정 배지 + 서류 진행률 */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        {/* 펼치기/접기 아이콘 */}
        <span
          className={`text-slate-400 text-xs transition-transform duration-200 flex-shrink-0 ${
            isExpanded ? 'rotate-90' : ''
          }`}
        >
          ▶
        </span>

        {/* 판정 배지 */}
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}
        >
          {badge.icon} {PERMIT_VERDICT_LABELS[card.verdict]}
        </span>

        {/* 인허가명 */}
        <span className="text-xs font-medium text-slate-800 flex-1 truncate">
          {card.permitName}
        </span>

        {/* 서류 진행률 */}
        {info && totalDocs > 0 && (
          <span className="text-[11px] text-slate-400 flex-shrink-0">
            {checkedCount}/{totalDocs}
          </span>
        )}
      </button>

      {/* 상세 내용 (접이식) */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-slate-100 bg-slate-50/50">
          {/* AI 판단 설명 */}
          <p className="text-xs text-slate-600 mt-2 mb-2 leading-relaxed">
            {card.explanation}
          </p>

          {info ? (
            <>
              {/* 기관 정보 + 소요기간 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">
                <div className="bg-white rounded px-2.5 py-1.5 text-[11px]">
                  <span className="text-slate-400 block mb-0.5">담당 기관</span>
                  <span className="text-slate-700 font-medium">{info.authority}</span>
                </div>
                <div className="bg-white rounded px-2.5 py-1.5 text-[11px]">
                  <span className="text-slate-400 block mb-0.5">예상 소요기간</span>
                  <span className="text-slate-700 font-medium">{info.estimatedDays}일</span>
                </div>
                <div className="bg-white rounded px-2.5 py-1.5 text-[11px] sm:col-span-2">
                  <span className="text-slate-400 block mb-0.5">연락처/웹사이트</span>
                  <span className="text-slate-700">{info.contactInfo}</span>
                </div>
              </div>

              {/* 필요 서류 체크리스트 */}
              <div className="mb-2">
                <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                  <span>📋</span> 필요 서류 ({checkedCount}/{totalDocs})
                </div>
                <div className="space-y-1">
                  {info.requiredDocs.map((doc, idx) => (
                    <label
                      key={idx}
                      className="flex items-start gap-2 cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={!!checkedDocs[idx]}
                        onChange={() => handleDocCheck(idx)}
                        className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 h-3.5 w-3.5"
                      />
                      <span
                        className={`text-xs leading-relaxed transition-colors ${
                          checkedDocs[idx]
                            ? 'text-slate-400 line-through'
                            : 'text-slate-700 group-hover:text-slate-900'
                        }`}
                      >
                        {doc}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 근거 법령 */}
              <div className="bg-white rounded px-2.5 py-1.5 text-[11px] mb-2">
                <span className="text-slate-400">⚖️ 근거:</span>{' '}
                <span className="text-slate-600">{card.legalBasis}</span>
              </div>

              {/* 실무 참고사항 */}
              <div className="bg-amber-50 rounded px-2.5 py-1.5 text-[11px] border border-amber-100">
                <span className="text-amber-600 font-medium">💡 실무 참고:</span>{' '}
                <span className="text-amber-800 leading-relaxed">{info.notes}</span>
              </div>
            </>
          ) : (
            /* 상세 정보 없는 경우 기본 표시 */
            <div className="text-xs text-slate-500 italic">
              상세 정보가 등록되지 않은 인허가 항목입니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 인허가 원스톱 체크리스트 컴포넌트 */
export function PermitChecklist({ permitCards }: PermitChecklistProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState(false);

  // 유효한 카드만 (not-applicable 제외는 이미 permit.ts에서 처리됨)
  const cards = permitCards.filter((c) => c.verdict !== 'not-applicable');

  if (cards.length === 0) return null;

  const toggleItem = useCallback((id: string) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleAll = useCallback(() => {
    const next = !allExpanded;
    setAllExpanded(next);
    const newState: Record<string, boolean> = {};
    cards.forEach((c) => {
      newState[c.id] = next;
    });
    setExpandedItems(newState);
  }, [allExpanded, cards]);

  // 판정별 요약 카운트
  const requiredCount = cards.filter((c) => c.verdict === 'required').length;
  const conditionalCount = cards.filter((c) => c.verdict === 'conditional').length;
  const scaleCount = cards.filter((c) => c.verdict === 'scale-review').length;

  // 총 예상 소요일 (required 항목 중 최대값 기준)
  const maxDays = cards
    .filter((c) => c.verdict === 'required')
    .reduce((max, c) => {
      const info = PERMIT_INFO_MAP[c.permitName];
      return info ? Math.max(max, info.estimatedDays) : max;
    }, 0);

  return (
    <div className="mt-2">
      {/* 체크리스트 열기/닫기 버튼 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors px-2 py-1.5 rounded-lg hover:bg-blue-50"
      >
        <span>{isOpen ? '📋' : '📋'}</span>
        <span>인허가 체크리스트 {isOpen ? '닫기' : '보기'}</span>
        <span className="text-slate-400">({cards.length}건)</span>
      </button>

      {isOpen && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* 헤더 */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                📋 인허가 원스톱 체크리스트
              </h3>
              <button
                type="button"
                onClick={toggleAll}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                {allExpanded ? '전체 접기' : '전체 펼치기'}
              </button>
            </div>

            {/* 요약 배지 */}
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {requiredCount > 0 && (
                <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  ✅ 필수 {requiredCount}건
                </span>
              )}
              {conditionalCount > 0 && (
                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  ⚠️ 조건부 {conditionalCount}건
                </span>
              )}
              {scaleCount > 0 && (
                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  ℹ️ 규모검토 {scaleCount}건
                </span>
              )}
              {maxDays > 0 && (
                <span className="text-slate-500">
                  | 최대 소요기간: <span className="font-medium text-slate-700">{maxDays}일</span>
                </span>
              )}
            </div>
          </div>

          {/* 체크리스트 목록 */}
          <div className="p-3 space-y-2">
            {cards.map((card) => (
              <PermitChecklistItem
                key={card.id}
                card={card}
                info={PERMIT_INFO_MAP[card.permitName]}
                isExpanded={!!expandedItems[card.id]}
                onToggle={() => toggleItem(card.id)}
              />
            ))}
          </div>

          {/* 푸터: 안내문 */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400">
            * 체크박스는 서류 준비 현황 확인용이며, 별도 저장되지 않습니다. 소요기간은 법정 처리기간 기준이며 실제와 다를 수 있습니다.
          </div>
        </div>
      )}
    </div>
  );
}
