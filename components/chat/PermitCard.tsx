'use client';

import type { PermitCard as PermitCardType, PermitVerdict } from '@/types';
import { PERMIT_VERDICT_LABELS } from '@/types';

interface PermitCardProps {
  card: PermitCardType;
}

/** 판정별 색상 설정 */
const VERDICT_STYLES: Record<PermitVerdict, {
  bg: string;
  border: string;
  text: string;
  icon: string;
  badge: string;
}> = {
  required: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    icon: '✅',
    badge: 'bg-green-100 text-green-800',
  },
  conditional: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    icon: '⚠️',
    badge: 'bg-amber-100 text-amber-800',
  },
  'scale-review': {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    icon: 'ℹ️',
    badge: 'bg-blue-100 text-blue-800',
  },
  'not-applicable': {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-500',
    icon: '❌',
    badge: 'bg-slate-100 text-slate-600',
  },
};

export function PermitCard({ card }: PermitCardProps) {
  const style = VERDICT_STYLES[card.verdict];
  const isRequired = card.verdict === 'required';

  return (
    <div className={`rounded-lg border ${style.border} ${style.bg} p-3 my-1.5 transition-shadow hover:shadow-sm`}>
      {/* 헤더: 판정 배지 + 인허가명 */}
      <div className="flex items-start gap-2 mb-2">
        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${style.badge} flex-shrink-0`}>
          {style.icon} {PERMIT_VERDICT_LABELS[card.verdict]}
        </span>
        <span className={`text-xs font-medium ${isRequired ? 'text-green-800' : 'text-slate-700'}`}>
          {card.permitName}
        </span>
      </div>

      {/* AI 판단 설명 */}
      <p className="text-xs text-slate-700 leading-relaxed mb-2">
        {card.explanation}
      </p>

      {/* 트리거 조건 + 근거 법령 — 2열 표시 */}
      <div className="grid grid-cols-1 gap-1 text-[11px]">
        <div className="bg-white/60 rounded px-2 py-1 flex items-start gap-1">
          <span className="text-slate-400 flex-shrink-0">🎯</span>
          <span className="text-slate-600">
            <span className="font-medium text-slate-500">조건:</span> {card.triggerCondition}
          </span>
        </div>
        <div className="bg-white/60 rounded px-2 py-1 flex items-start gap-1">
          <span className="text-slate-400 flex-shrink-0">⚖️</span>
          <span className="text-slate-600">
            <span className="font-medium text-slate-500">근거:</span> {card.legalBasis}
          </span>
        </div>
      </div>
    </div>
  );
}
