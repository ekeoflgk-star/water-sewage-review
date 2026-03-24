'use client';

import { LawNavigator } from '@/components/law/LawNavigator';

export function LawPanel() {
  return (
    <aside className="w-law-panel flex-shrink-0 border-l border-panel-border bg-panel-bg flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-panel-border">
        <h2 className="text-sm font-semibold text-slate-800">
          법령 참조
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          법제처 Open API 실시간 조회
        </p>
      </div>

      {/* 법령 탐색기 */}
      <div className="flex-1 overflow-hidden">
        <LawNavigator />
      </div>
    </aside>
  );
}
