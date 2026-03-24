'use client';

import type { PermitCard as PermitCardType, PermitVerdict } from '@/types';
import { PERMIT_VERDICT_LABELS } from '@/types';

interface PermitCardProps {
  card: PermitCardType;
}

/** 판정별 색상 설정 */
const VERDICT_STYLES: Record<PermitVerdict, { bg: string; text: string; icon: string }> = {
  required:       { bg: 'bg-green-50 border-green-200', text: 'text-green-700', icon: '✅' },
  conditional:    { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: '⚠️' },
  'scale-review': { bg: 'bg-blue-50 border-blue-200',   text: 'text-blue-700',  icon: 'ℹ️' },
  'not-applicable': { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-500', icon: '❌' },
};

export function PermitCard({ card }: PermitCardProps) {
  const style = VERDICT_STYLES[card.verdict];

  return (
    <div className={`rounded-lg border p-3 my-2 ${style.bg}`}>
      {/* 헤더: 판정 + 인허가명 */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">{style.icon}</span>
        <span className={`text-xs font-semibold ${style.text}`}>
          {PERMIT_VERDICT_LABELS[card.verdict]}
        </span>
        <span className="text-xs text-slate-600 font-medium">
          {card.permitName}
        </span>
      </div>

      {/* AI 판단 설명 */}
      <p className="text-xs text-slate-700 leading-relaxed mb-2">
        {card.explanation}
      </p>

      {/* 트리거 조건 */}
      <div className="text-xs text-slate-500 mb-1">
        조건: {card.triggerCondition}
      </div>

      {/* 근거 법령 */}
      <div className="text-xs text-slate-500 bg-white/60 rounded px-2 py-1">
        ⚖️ {card.legalBasis}
      </div>
    </div>
  );
}
