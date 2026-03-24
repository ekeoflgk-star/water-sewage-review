'use client';

import type { ReviewCard as ReviewCardType, ReviewVerdict } from '@/types';
import { REVIEW_VERDICT_LABELS } from '@/types';

interface ReviewCardProps {
  card: ReviewCardType;
}

/** 판정별 색상 설정 */
const VERDICT_STYLES: Record<ReviewVerdict, {
  bg: string;
  border: string;
  text: string;
  icon: string;
  badge: string;
}> = {
  pass: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    icon: '🟢',
    badge: 'bg-green-100 text-green-800',
  },
  fail: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    icon: '🔴',
    badge: 'bg-red-100 text-red-800',
  },
  check: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    icon: '🟡',
    badge: 'bg-amber-100 text-amber-800',
  },
};

export function ReviewCard({ card }: ReviewCardProps) {
  const style = VERDICT_STYLES[card.verdict];
  const isFail = card.verdict === 'fail';

  return (
    <div className={`rounded-lg border ${style.border} ${style.bg} p-3 my-1.5 transition-shadow hover:shadow-sm`}>
      {/* 헤더: 판정 배지 + 항목명 */}
      <div className="flex items-start gap-2 mb-2">
        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${style.badge} flex-shrink-0`}>
          {style.icon} {REVIEW_VERDICT_LABELS[card.verdict]}
        </span>
        <span className={`text-xs font-medium ${isFail ? 'text-red-800' : 'text-slate-700'}`}>
          {card.itemName}
        </span>
      </div>

      {/* 검토 의견 */}
      <p className={`text-xs leading-relaxed mb-2 ${isFail ? 'text-red-700 font-medium' : 'text-slate-700'}`}>
        {card.finding}
      </p>

      {/* 설계값 vs 기준값 — 비교 바 형태 */}
      {(card.designValue || card.standardValue) && (
        <div className={`flex items-center gap-2 text-xs mb-2 rounded-md px-2.5 py-1.5 ${isFail ? 'bg-red-100/60' : 'bg-white/60'}`}>
          {card.designValue && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500">설계값</span>
              <span className={`font-semibold ${isFail ? 'text-red-700' : 'text-slate-800'}`}>
                {card.designValue}
              </span>
            </div>
          )}
          {card.designValue && card.standardValue && (
            <span className={`text-lg leading-none ${isFail ? 'text-red-400' : 'text-slate-300'}`}>
              {isFail ? '≠' : '≈'}
            </span>
          )}
          {card.standardValue && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500">기준값</span>
              <span className="font-semibold text-slate-800">
                {card.standardValue}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 근거 조문 */}
      <div className="text-[11px] text-slate-500 bg-white/60 rounded px-2 py-1 flex items-center gap-1">
        <span>📖</span>
        <span>{card.reference}</span>
      </div>
    </div>
  );
}
