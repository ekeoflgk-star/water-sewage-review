'use client';

export function LawPanel() {
  return (
    <aside className="w-law-panel flex-shrink-0 border-l border-panel-border bg-panel-bg flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-panel-border">
        <h2 className="text-sm font-semibold text-slate-800">
          법령 참조
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          관련 법령·기준 조회
        </p>
      </div>

      {/* Phase 3 플레이스홀더 */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-3xl mb-3 opacity-30">⚖️</div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Phase 3에서 구현 예정
          </p>
          <p className="text-xs text-slate-400 mt-1">
            법제처 Open API 연동
          </p>
          <div className="mt-4 space-y-2">
            {['수도법', '하수도법', 'KDS 설계기준', '지자체 조례'].map(
              (item) => (
                <div
                  key={item}
                  className="text-xs px-3 py-2 bg-white rounded border border-slate-200 text-slate-400"
                >
                  {item}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
