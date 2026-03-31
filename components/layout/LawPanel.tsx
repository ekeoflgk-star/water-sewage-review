'use client';

import { LawNavigator } from '@/components/law/LawNavigator';

export function LawPanel() {
  return (
    <aside className="w-full flex-shrink-0 border-l border-panel-border bg-panel-bg flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-3 py-2 border-b border-panel-border bg-white">
        <div className="flex items-center gap-2">
          <span className="text-sm">📚</span>
          <div>
            <h2 className="text-sm font-bold text-slate-800">참고 문서</h2>
            <p className="text-[10px] text-slate-400">법령 · 시방서 · 설계기준</p>
          </div>
        </div>
      </div>

      {/* 법령 탐색기 */}
      <div className="flex-1 overflow-hidden">
        <LawNavigator />
      </div>
    </aside>
  );
}
