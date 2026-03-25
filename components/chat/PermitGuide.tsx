'use client';

import { useState, useCallback, useMemo } from 'react';
import type { PermitCard as PermitCardType } from '@/types';
import type { PermitAnalysisItem } from '@/types/dxf';
import {
  PERMIT_INFO_MAP,
  PERMIT_CATEGORY_LABELS,
  type PermitInfo,
  type PermitCategory,
} from '@/lib/permit-info';

interface PermitGuideProps {
  permitCards: PermitCardType[];
  /** DXF 분석에서 감지된 인허가 항목 (자동 하이라이트용) */
  dxfPermits?: PermitAnalysisItem[];
}

/** 카테고리별 아이콘 */
const CATEGORY_ICON: Record<PermitCategory, string> = {
  installation: '\uD83C\uDFD7\uFE0F',
  occupation: '\uD83D\uDEE3\uFE0F',
  conversion: '\uD83C\uDF3E',
  assessment: '\uD83D\uDCCA',
  other: '\uD83D\uDCC4',
};

/** 카테고리별 배경색 */
const CATEGORY_COLOR: Record<PermitCategory, string> = {
  installation: 'from-emerald-50 to-green-50 border-emerald-200',
  occupation: 'from-blue-50 to-cyan-50 border-blue-200',
  conversion: 'from-amber-50 to-yellow-50 border-amber-200',
  assessment: 'from-purple-50 to-violet-50 border-purple-200',
  other: 'from-slate-50 to-gray-50 border-slate-200',
};

/** 개별 인허가 설계사 가이드 항목 */
function PermitGuideItem({
  card,
  info,
  isExpanded,
  onToggle,
  dxfDetected,
}: {
  card: PermitCardType;
  info: PermitInfo;
  isExpanded: boolean;
  onToggle: () => void;
  /** DXF 분석에서 이 인허가가 감지되었는지 여부 */
  dxfDetected?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'deliverables' | 'cautions'>('tasks');
  const [checkedTasks, setCheckedTasks] = useState<Record<number, boolean>>({});
  const [checkedDeliverables, setCheckedDeliverables] = useState<Record<number, boolean>>({});

  const tasksDone = Object.values(checkedTasks).filter(Boolean).length;
  const deliverablesDone = Object.values(checkedDeliverables).filter(Boolean).length;
  const totalTasks = info.designerTasks.length;
  const totalDeliverables = info.designDeliverables.length;
  const progress = totalTasks + totalDeliverables > 0
    ? Math.round(((tasksDone + deliverablesDone) / (totalTasks + totalDeliverables)) * 100)
    : 0;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      {/* 헤더 */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
      >
        <span
          className={`text-slate-400 text-xs transition-transform duration-200 flex-shrink-0 ${
            isExpanded ? 'rotate-90' : ''
          }`}
        >
          &#x25B6;
        </span>

        <span className="text-xs font-semibold text-slate-800 flex-1">
          {info.permitName}
          {dxfDetected && (
            <span className="ml-1.5 inline-flex items-center text-[10px] font-medium bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">
              DXF
            </span>
          )}
        </span>

        {/* 진행률 바 */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 w-8 text-right">{progress}%</span>
        </div>

        {/* 소요기간 */}
        <span className="text-[10px] text-slate-400 flex-shrink-0 bg-slate-100 px-1.5 py-0.5 rounded">
          {info.estimatedDays}일
        </span>
      </button>

      {/* 상세 (접이식) */}
      {isExpanded && (
        <div className="border-t border-slate-100">
          {/* 탭 메뉴 */}
          <div className="flex border-b border-slate-100">
            {[
              { key: 'tasks' as const, label: `설계사 준비사항 (${tasksDone}/${totalTasks})` },
              { key: 'deliverables' as const, label: `납품 도서 (${deliverablesDone}/${totalDeliverables})` },
              { key: 'cautions' as const, label: `주의사항 (${info.designCautions.length})` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 text-[11px] py-2 font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 탭 내용 */}
          <div className="px-3 py-2.5">
            {activeTab === 'tasks' && (
              <div className="space-y-1.5">
                {info.designerTasks.map((task, idx) => (
                  <label key={idx} className="flex items-start gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={!!checkedTasks[idx]}
                      onChange={() => setCheckedTasks((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                      className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                    <span
                      className={`text-xs leading-relaxed transition-colors ${
                        checkedTasks[idx]
                          ? 'text-slate-400 line-through'
                          : 'text-slate-700 group-hover:text-slate-900'
                      }`}
                    >
                      {task}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {activeTab === 'deliverables' && (
              <div className="space-y-1.5">
                {info.designDeliverables.map((doc, idx) => (
                  <label key={idx} className="flex items-start gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={!!checkedDeliverables[idx]}
                      onChange={() =>
                        setCheckedDeliverables((prev) => ({ ...prev, [idx]: !prev[idx] }))
                      }
                      className="mt-0.5 rounded border-slate-300 text-green-600 focus:ring-green-500 h-3.5 w-3.5"
                    />
                    <span
                      className={`text-xs leading-relaxed transition-colors ${
                        checkedDeliverables[idx]
                          ? 'text-slate-400 line-through'
                          : 'text-slate-700 group-hover:text-slate-900'
                      }`}
                    >
                      {doc}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {activeTab === 'cautions' && (
              <div className="space-y-1.5">
                {info.designCautions.map((caution, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs">
                    <span className="text-amber-500 flex-shrink-0 mt-0.5">&#x26A0;&#xFE0F;</span>
                    <span className="text-slate-700 leading-relaxed">{caution}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 기관 정보 (항상 표시) */}
            <div className="mt-3 pt-2 border-t border-slate-100 grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="bg-slate-50 rounded px-2 py-1.5">
                <span className="text-slate-400 block">담당 기관</span>
                <span className="text-slate-700 font-medium">{info.authority}</span>
              </div>
              <div className="bg-slate-50 rounded px-2 py-1.5">
                <span className="text-slate-400 block">근거 법령</span>
                <span className="text-slate-700 font-medium">{card.legalBasis}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 인허가 설계사 가이드 메인 컴포넌트 */
export function PermitGuide({ permitCards, dxfPermits }: PermitGuideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [filterCategory, setFilterCategory] = useState<PermitCategory | 'all'>('all');

  // DXF에서 감지된 인허가명 Set
  const dxfDetectedNames = useMemo(() => {
    if (!dxfPermits || dxfPermits.length === 0) return new Set<string>();
    return new Set(dxfPermits.map(p => p.permitName));
  }, [dxfPermits]);

  // 유효한 카드만 (not-applicable 제외)
  const validCards = permitCards.filter((c) => c.verdict !== 'not-applicable');

  const toggleItem = useCallback((id: string) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  if (validCards.length === 0) return null;

  // 카테고리별 그룹화
  const grouped: Record<PermitCategory, Array<{ card: PermitCardType; info: PermitInfo }>> = {
    installation: [],
    occupation: [],
    conversion: [],
    assessment: [],
    other: [],
  };

  for (const card of validCards) {
    const info = PERMIT_INFO_MAP[card.permitName];
    if (!info) continue;
    grouped[info.category].push({ card, info });
  }

  const activeCategories = (Object.entries(grouped) as [PermitCategory, typeof grouped['installation']][])
    .filter(([, items]) => items.length > 0);

  const filteredCategories = filterCategory === 'all'
    ? activeCategories
    : activeCategories.filter(([cat]) => cat === filterCategory);

  return (
    <div className="mt-2">
      {/* 열기/닫기 버튼 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors px-2 py-1.5 rounded-lg hover:bg-indigo-50"
      >
        <span>{isOpen ? '\uD83D\uDCD0' : '\uD83D\uDCD0'}</span>
        <span>설계사 인허가 가이드 {isOpen ? '닫기' : '보기'}</span>
        <span className="text-slate-400">({validCards.length}건)</span>
      </button>

      {isOpen && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* 헤더 */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-3 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 mb-1">
              설계 성과품 인허가 반영 가이드
            </h3>
            <p className="text-[11px] text-slate-500">
              설계사가 성과품에 반영해야 할 인허가 관련 사항을 정리합니다. 인허가 신청은 발주처/시행사가 수행합니다.
            </p>

            {/* 카테고리 필터 */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => setFilterCategory('all')}
                className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                  filterCategory === 'all'
                    ? 'bg-slate-700 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                전체 ({validCards.length})
              </button>
              {activeCategories.map(([cat, items]) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilterCategory(cat)}
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                    filterCategory === cat
                      ? 'bg-slate-700 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {CATEGORY_ICON[cat]} {PERMIT_CATEGORY_LABELS[cat]} ({items.length})
                </button>
              ))}
            </div>
          </div>

          {/* 카테고리별 목록 */}
          <div className="p-3 space-y-4">
            {filteredCategories.map(([cat, items]) => (
              <div key={cat}>
                {/* 카테고리 헤더 */}
                <div className={`flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-gradient-to-r ${CATEGORY_COLOR[cat]} border`}>
                  <span className="text-sm">{CATEGORY_ICON[cat]}</span>
                  <span className="text-xs font-bold text-slate-700">
                    {PERMIT_CATEGORY_LABELS[cat]}
                  </span>
                  <span className="text-[10px] text-slate-500">({items.length}건)</span>
                </div>

                {/* 항목 목록 */}
                <div className="space-y-1.5 ml-1">
                  {items.map(({ card, info }) => (
                    <PermitGuideItem
                      key={card.id}
                      card={card}
                      info={info}
                      isExpanded={!!expandedItems[card.id]}
                      onToggle={() => toggleItem(card.id)}
                      dxfDetected={dxfDetectedNames.has(info.permitName)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 푸터 */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400">
            * 체크박스는 준비 현황 확인용이며 별도 저장되지 않습니다. 인허가 신청은 발주처/시행사가 수행하며, 설계사는 관련 도서를 성과품에 포함합니다.
          </div>
        </div>
      )}
    </div>
  );
}
