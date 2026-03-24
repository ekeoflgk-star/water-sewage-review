'use client';

import { useState, useMemo } from 'react';
import type { PermitCard as PermitCardType } from '@/types';
import { calculateSchedule, type PermitScheduleItem } from '@/lib/permit-schedule';

interface PermitGanttProps {
  permitCards: PermitCardType[];
}

/** 판정별 바 색상 */
const BAR_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  required:     { bg: 'bg-blue-400',  border: 'border-blue-600',  text: 'text-blue-900' },
  conditional:  { bg: 'bg-amber-400', border: 'border-amber-600', text: 'text-amber-900' },
  'scale-review': { bg: 'bg-slate-300', border: 'border-slate-500', text: 'text-slate-700' },
  'not-applicable': { bg: 'bg-slate-200', border: 'border-slate-400', text: 'text-slate-500' },
};

/** 주(week) 단위 눈금 생성 */
function generateWeekMarkers(totalDays: number): number[] {
  const markers: number[] = [];
  for (let d = 7; d <= totalDays; d += 7) {
    markers.push(d);
  }
  return markers;
}

/** 간트 바 컴포넌트 */
function GanttBar({
  item,
  totalDays,
}: {
  item: PermitScheduleItem;
  totalDays: number;
}) {
  const colors = BAR_COLORS[item.verdict] ?? BAR_COLORS.required;
  const leftPercent = (item.startDay / totalDays) * 100;
  const widthPercent = Math.max((item.duration / totalDays) * 100, 2); // 최소 2% 너비

  return (
    <div
      className={`absolute top-1 h-5 rounded ${colors.bg} ${
        item.isCriticalPath ? 'ring-2 ring-red-500 ring-offset-1' : ''
      } flex items-center justify-center overflow-hidden cursor-default transition-all hover:brightness-110`}
      style={{
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
      }}
      title={`${item.permitName}: D+${item.startDay} ~ D+${item.endDay} (${item.duration}일)${
        item.isCriticalPath ? ' [크리티컬 패스]' : ''
      }${
        item.dependencies.length > 0
          ? `\n선행: ${item.dependencies.join(', ')}`
          : ''
      }`}
    >
      <span className={`text-[9px] font-bold ${colors.text} truncate px-1`}>
        {item.duration}일
      </span>
    </div>
  );
}

/** 리스트 형태 (좁은 화면용) */
function GanttListView({
  items,
  totalDays,
}: {
  items: PermitScheduleItem[];
  totalDays: number;
}) {
  return (
    <div className="space-y-1.5">
      {items.map((item) => {
        const colors = BAR_COLORS[item.verdict] ?? BAR_COLORS.required;
        const widthPercent = Math.max((item.duration / totalDays) * 100, 8);

        return (
          <div key={item.permitName} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className={`font-medium text-slate-700 ${item.isCriticalPath ? 'text-red-700' : ''}`}>
                {item.isCriticalPath && <span className="text-red-500 mr-1">*</span>}
                {item.permitName}
              </span>
              <span className="text-slate-400 flex-shrink-0 ml-2">
                D+{item.startDay} ~ D+{item.endDay}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded h-4 relative">
              <div
                className={`h-4 rounded ${colors.bg} ${
                  item.isCriticalPath ? 'ring-1 ring-red-500' : ''
                } flex items-center`}
                style={{ width: `${widthPercent}%`, marginLeft: `${(item.startDay / totalDays) * 100}%` }}
              >
                <span className={`text-[9px] font-bold ${colors.text} px-1 truncate`}>
                  {item.duration}일
                </span>
              </div>
            </div>
            {item.dependencies.length > 0 && (
              <div className="text-[10px] text-slate-400 pl-2">
                선행: {item.dependencies.join(', ')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 인허가 간트 차트 컴포넌트 */
export function PermitGantt({ permitCards }: PermitGanttProps) {
  const [isOpen, setIsOpen] = useState(false);

  const schedule = useMemo(
    () => calculateSchedule(permitCards),
    [permitCards]
  );

  const { items, totalDays, criticalPath } = schedule;

  // 표시할 항목이 없으면 렌더링 안 함
  if (items.length === 0) return null;

  const weekMarkers = generateWeekMarkers(totalDays);
  const totalMonths = Math.ceil(totalDays / 30);

  return (
    <div className="mt-2">
      {/* 열기/닫기 버튼 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors px-2 py-1.5 rounded-lg hover:bg-indigo-50"
      >
        <span>📅</span>
        <span>일정 계획 {isOpen ? '닫기' : '보기'}</span>
        <span className="text-slate-400">
          (총 {totalDays}일, 약 {totalMonths}개월)
        </span>
      </button>

      {isOpen && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* 헤더 */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              📅 인허가 일정 계획 (간트 차트)
            </h3>
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px]">
              {/* 범례 */}
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-blue-400" /> 필수
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-amber-400" /> 조건부
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-slate-300" /> 규모검토
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded ring-2 ring-red-500 bg-white" /> 크리티컬 패스
              </span>
            </div>
          </div>

          {/* 간트 차트 본체 — 넓은 화면 */}
          <div className="hidden md:block p-3 overflow-x-auto">
            <div className="min-w-[600px]">
              {/* 시간축 헤더 */}
              <div className="flex border-b border-slate-200 pb-1 mb-1">
                {/* 좌측 라벨 영역 */}
                <div className="w-48 flex-shrink-0 text-[10px] text-slate-400 font-medium pr-2 text-right">
                  인허가 항목
                </div>
                {/* 우측 시간축 */}
                <div className="flex-1 relative h-5">
                  {/* D+0 표시 */}
                  <span className="absolute left-0 text-[9px] text-slate-400 -translate-x-1/2">
                    D+0
                  </span>
                  {/* 주 단위 눈금 */}
                  {weekMarkers.map((day) => (
                    <span
                      key={day}
                      className="absolute text-[9px] text-slate-400 -translate-x-1/2"
                      style={{ left: `${(day / totalDays) * 100}%` }}
                    >
                      {day % 30 === 0
                        ? `${day / 30}M`
                        : `${Math.floor(day / 7)}W`}
                    </span>
                  ))}
                  {/* 종료 표시 */}
                  <span className="absolute right-0 text-[9px] text-slate-500 font-medium translate-x-1/2">
                    D+{totalDays}
                  </span>
                </div>
              </div>

              {/* 각 인허가 행 */}
              {items.map((item) => (
                <div key={item.permitName} className="flex items-center group">
                  {/* 좌측: 인허가명 */}
                  <div
                    className={`w-48 flex-shrink-0 text-[11px] pr-2 text-right truncate py-1 ${
                      item.isCriticalPath
                        ? 'text-red-700 font-bold'
                        : 'text-slate-600'
                    }`}
                    title={`${item.permitName} (${item.duration}일)`}
                  >
                    {item.isCriticalPath && (
                      <span className="text-red-500 mr-0.5">*</span>
                    )}
                    {item.permitName}
                  </div>

                  {/* 우측: 바 차트 */}
                  <div className="flex-1 relative h-7 border-b border-slate-50 group-hover:bg-slate-50/50">
                    {/* 주 단위 격자선 */}
                    {weekMarkers.map((day) => (
                      <div
                        key={day}
                        className="absolute top-0 bottom-0 border-l border-slate-100"
                        style={{ left: `${(day / totalDays) * 100}%` }}
                      />
                    ))}

                    {/* 의존관계 점선 (선행 완료 → 현재 시작) */}
                    {item.dependencies.length > 0 && item.startDay > 0 && (
                      <div
                        className="absolute top-1/2 h-px border-t border-dashed border-slate-300"
                        style={{
                          left: '0%',
                          width: `${(item.startDay / totalDays) * 100}%`,
                        }}
                      />
                    )}

                    {/* 간트 바 */}
                    <GanttBar item={item} totalDays={totalDays} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 리스트 뷰 — 좁은 화면 */}
          <div className="md:hidden p-3">
            <GanttListView items={items} totalDays={totalDays} />
          </div>

          {/* 크리티컬 패스 요약 */}
          {criticalPath.length > 0 && (
            <div className="px-4 py-2 bg-red-50 border-t border-red-100">
              <div className="text-[11px] text-red-700">
                <span className="font-bold">크리티컬 패스:</span>{' '}
                {criticalPath.join(' → ')}
              </div>
            </div>
          )}

          {/* 푸터: 총 소요기간 */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              * 소요기간은 법정 처리기간 기준이며, 실제와 다를 수 있습니다.
              선후행 관계에 따라 일부 인허가는 병행 진행 가능합니다.
            </span>
            <span className="text-xs font-bold text-slate-700 flex-shrink-0 ml-3">
              총 예상 소요기간: {totalDays}일 (약 {totalMonths}개월)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
