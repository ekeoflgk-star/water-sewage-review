'use client';

import type { ReviewCard as ReviewCardType, ReviewVerdict } from '@/types';
import { REVIEW_VERDICT_LABELS } from '@/types';

interface ReviewCardProps {
  card: ReviewCardType;
}

/** 판정별 색상 설정 */
const VERDICT_STYLES: Record<ReviewVerdict, { bg: string; text: string; icon: string }> = {
  pass:  { bg: 'bg-green-50 border-green-200', text: 'text-green-700', icon: '🟢' },
  fail:  { bg: 'bg-red-50 border-red-200',     text: 'text-red-700',   icon: '🔴' },
  check: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: '🟡' },
};

export function ReviewCard({ card }: ReviewCardProps) {
  const style = VERDICT_STYLES[card.verdict];

  return (
    <div className={`rounded-lg border p-3 my-2 ${style.bg}`}>
      {/* 헤더: 판정 + 항목명 */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">{style.icon}</span>
        <span className={`text-xs font-semibold ${style.text}`}>
          {REVIEW_VERDICT_LABELS[card.verdict]}
        </span>
        <span className="text-xs text-slate-600 font-medium">
          {card.itemName}
        </span>
      </div>

      {/* 검토 의견 */}
      <p className="text-xs text-slate-700 leading-relaxed mb-2">
        {card.finding}
      </p>

      {/* 설계값 vs 기준값 */}
      {(card.designValue || card.standardValue) && (
        <div className="flex gap-4 text-xs mb-2">
          {card.designValue && (
            <span className="text-slate-600">
              설계값: <span className="font-medium">{card.designValue}</span>
            </span>
          )}
          {card.standardValue && (
            <span className="text-slate-600">
              기준값: <span className="font-medium">{card.standardValue}</span>
            </span>
          )}
        </div>
      )}

      {/* 근거 조문 */}
      <div className="text-xs text-slate-500 bg-white/60 rounded px-2 py-1">
        📖 {card.reference}
      </div>
    </div>
  );
}
