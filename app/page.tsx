import Link from 'next/link';

const FEATURES = [
  {
    href: '/review',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    title: '설계검토',
    subtitle: 'AI 자동 검토 + 인허가 판단',
    description: '설계문서(PDF, DOCX, XLSX, DXF)를 업로드하면 법령과 KDS 설계기준을 자동 대조하여 적합/부적합을 판정합니다.',
    items: ['유속·관경·토피·경사 자동 검토', '인허가 15종 자동 판단', 'DXF 레이어 분석', '검토의견서 다운로드'],
    color: 'blue',
  },
  {
    href: '/reference',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
    title: '참고문서',
    subtitle: '법령 · 시방서 · 설계기준 탐색',
    description: '법제처 Open API로 상하수도 관련 법령을 실시간 검색하고, 조문 항/호/목을 계층적으로 탐색합니다.',
    items: ['법률 → 시행령 → 시행규칙 3단비교', '상하수도 시방서 14종', 'KDS 설계기준 (임베딩 검색)', '조문 항·호·목 계층 표시'],
    color: 'emerald',
  },
] as const;

export default function HomePage() {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white px-6">
      {/* 히어로 */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-200/50">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          상하수도 설계 검토 플랫폼
        </h1>
        <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
          설계 성과품을 업로드하면 법령·KDS 설계기준과 자동 대조하여<br />
          적합/부적합을 판정하는 AI 검토 도구입니다.
        </p>
      </div>

      {/* 기능 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full">
        {FEATURES.map((feature) => (
          <Link
            key={feature.href}
            href={feature.href}
            className={`group relative bg-white border-2 rounded-2xl p-6 transition-all duration-200 hover:shadow-lg ${
              feature.color === 'blue'
                ? 'border-blue-100 hover:border-blue-300 hover:shadow-blue-100/50'
                : 'border-emerald-100 hover:border-emerald-300 hover:shadow-emerald-100/50'
            }`}
          >
            {/* 아이콘 */}
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-colors ${
              feature.color === 'blue'
                ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'
                : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100'
            }`}>
              {feature.icon}
            </div>

            {/* 제목 */}
            <h2 className="text-lg font-bold text-slate-800 mb-1">{feature.title}</h2>
            <p className={`text-xs font-medium mb-3 ${
              feature.color === 'blue' ? 'text-blue-500' : 'text-emerald-500'
            }`}>
              {feature.subtitle}
            </p>

            {/* 설명 */}
            <p className="text-sm text-slate-500 leading-relaxed mb-4">
              {feature.description}
            </p>

            {/* 기능 목록 */}
            <ul className="space-y-1.5">
              {feature.items.map((item) => (
                <li key={item} className="flex items-center gap-2 text-xs text-slate-600">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    feature.color === 'blue' ? 'bg-blue-400' : 'bg-emerald-400'
                  }`} />
                  {item}
                </li>
              ))}
            </ul>

            {/* 화살표 */}
            <div className={`absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity ${
              feature.color === 'blue' ? 'text-blue-400' : 'text-emerald-400'
            }`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {/* 푸터 */}
      <p className="mt-8 text-[11px] text-slate-400">
        Powered by Google Gemini 2.5 Flash · 법제처 Open API · KDS 임베딩 검색
      </p>
    </div>
  );
}
