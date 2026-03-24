'use client';

import { useState, useCallback, useRef } from 'react';

// ============================================================
// 타입 정의
// ============================================================

/** 법령 검색 결과 아이템 */
interface LawItem {
  id: number;
  name: string;
  abbreviation: string;
  enforcementDate: string;
  type: string;       // 법률, 시행령, 시행규칙 등
  department: string;
}

/** 조문 아이템 */
interface ArticleItem {
  number: string;
  title: string;
  content: string;
  enforcementDate: string;
  paragraphs: Array<{ number: string; content: string }>;
}

/** 법령 상세 정보 */
interface LawDetail {
  info: {
    id: string | number;
    name: string;
    enforcementDate: string;
    department: string;
    type: string;
  };
  articles: ArticleItem[];
}

/** 컴포넌트 뷰 상태 */
type ViewState = 'search' | 'articles' | 'article-detail';

// ============================================================
// 바로가기 법령 목록 — 상하수도 관련 주요 법령
// ============================================================
const QUICK_LAWS = [
  { label: '수도법', query: '수도법' },
  { label: '하수도법', query: '하수도법' },
  { label: '물환경보전법', query: '물환경보전법' },
  { label: '환경영향평가법', query: '환경영향평가법' },
  { label: '건설기술진흥법', query: '건설기술진흥법' },
];

// ============================================================
// LawNavigator 컴포넌트
// ============================================================
export function LawNavigator() {
  // 상태 관리
  const [viewState, setViewState] = useState<ViewState>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LawItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 법령 상세 상태
  const [lawDetail, setLawDetail] = useState<LawDetail | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<ArticleItem | null>(null);

  // 검색 입력 ref
  const inputRef = useRef<HTMLInputElement>(null);

  // --------------------------------------------------------
  // 법령 검색
  // --------------------------------------------------------
  const handleSearch = useCallback(async (query: string, page: number = 1) => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setSearchQuery(query);
    setCurrentPage(page);

    try {
      const res = await fetch(
        `/api/law?q=${encodeURIComponent(query.trim())}&page=${page}`
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `검색 실패 (${res.status})`);
      }

      const data = await res.json();
      setSearchResults(data.laws || []);
      setTotalCount(data.totalCount || 0);
      setViewState('search');
    } catch (err) {
      setError(err instanceof Error ? err.message : '검색 중 오류가 발생했습니다.');
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --------------------------------------------------------
  // 법령 조문 상세 조회
  // --------------------------------------------------------
  const handleSelectLaw = useCallback(async (lawId: number, lawName: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/law?id=${lawId}`);

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `조문 조회 실패 (${res.status})`);
      }

      const data: LawDetail = await res.json();
      // 법령명이 비어있으면 선택한 법령명으로 보완
      if (data.info && (!data.info.name || data.info.name === '(법령명 없음)')) {
        data.info.name = lawName;
      }
      setLawDetail(data);
      setSelectedArticle(null);
      setViewState('articles');
    } catch (err) {
      setError(err instanceof Error ? err.message : '조문 조회 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --------------------------------------------------------
  // 검색 폼 제출
  // --------------------------------------------------------
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchQuery);
  };

  // --------------------------------------------------------
  // 뒤로가기
  // --------------------------------------------------------
  const handleBack = () => {
    if (viewState === 'article-detail') {
      setSelectedArticle(null);
      setViewState('articles');
    } else if (viewState === 'articles') {
      setViewState('search');
    }
  };

  // --------------------------------------------------------
  // 법령 유형 뱃지 색상
  // --------------------------------------------------------
  const getTypeBadgeColor = (type: string) => {
    if (type.includes('법률')) return 'bg-blue-100 text-blue-700';
    if (type.includes('시행령')) return 'bg-green-100 text-green-700';
    if (type.includes('시행규칙')) return 'bg-yellow-100 text-yellow-700';
    if (type.includes('고시') || type.includes('훈령')) return 'bg-purple-100 text-purple-700';
    return 'bg-slate-100 text-slate-600';
  };

  // ============================================================
  // 렌더링
  // ============================================================
  return (
    <div className="flex flex-col h-full">
      {/* 검색바 — 항상 표시 */}
      <div className="px-3 py-2 border-b border-slate-200">
        <form onSubmit={handleSubmit} className="flex gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="법령명 검색 (예: 하수도법)"
            className="flex-1 text-xs px-2.5 py-1.5 border border-slate-300 rounded
                       focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400
                       placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={isLoading || !searchQuery.trim()}
            className="px-2.5 py-1.5 text-xs font-medium text-white bg-blue-500 rounded
                       hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors shrink-0"
          >
            {isLoading ? '...' : '검색'}
          </button>
        </form>
      </div>

      {/* 뒤로가기 버튼 */}
      {viewState !== 'search' && (
        <button
          onClick={handleBack}
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-600 hover:text-blue-800
                     hover:bg-blue-50 transition-colors border-b border-slate-200"
        >
          <span>&#8592;</span>
          <span>
            {viewState === 'article-detail' ? '조문 목록' : '검색 결과'}
          </span>
        </button>
      )}

      {/* 에러 표시 */}
      {error && (
        <div className="mx-3 mt-2 px-2.5 py-2 text-xs text-red-700 bg-red-50 rounded border border-red-200">
          {error}
        </div>
      )}

      {/* 로딩 표시 */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-2">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-500">조회 중...</span>
          </div>
        </div>
      )}

      {/* 메인 콘텐츠 영역 */}
      {!isLoading && (
        <div className="flex-1 overflow-y-auto">
          {/* 검색 결과 뷰 */}
          {viewState === 'search' && (
            <>
              {/* 바로가기 — 검색 결과가 없을 때만 표시 */}
              {searchResults.length === 0 && !error && (
                <div className="p-3">
                  <p className="text-xs font-medium text-slate-600 mb-2">
                    주요 법령 바로가기
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_LAWS.map((law) => (
                      <button
                        key={law.query}
                        onClick={() => {
                          setSearchQuery(law.query);
                          handleSearch(law.query);
                        }}
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-full
                                   text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700
                                   transition-colors"
                      >
                        {law.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 text-[10px] text-slate-400 leading-relaxed">
                    법제처 Open API를 통해 대한민국 현행 법령을 실시간 검색합니다.
                    법령명이나 키워드를 입력하여 검색하세요.
                  </p>
                </div>
              )}

              {/* 검색 결과 목록 */}
              {searchResults.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-[10px] text-slate-500 border-b border-slate-100">
                    검색 결과 총 {totalCount}건
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {searchResults.map((law) => (
                      <li key={law.id}>
                        <button
                          onClick={() => handleSelectLaw(law.id, law.name)}
                          className="w-full text-left px-3 py-2.5 hover:bg-slate-50
                                     transition-colors group"
                        >
                          <div className="flex items-start gap-1.5">
                            {law.type && (
                              <span
                                className={`shrink-0 px-1.5 py-0.5 text-[10px] rounded
                                  ${getTypeBadgeColor(law.type)}`}
                              >
                                {law.type}
                              </span>
                            )}
                            <span className="text-xs font-medium text-slate-800 group-hover:text-blue-700 leading-snug">
                              {law.name}
                            </span>
                          </div>
                          {law.abbreviation && (
                            <p className="text-[10px] text-slate-400 mt-0.5 ml-0.5">
                              약칭: {law.abbreviation}
                            </p>
                          )}
                          <div className="flex gap-3 mt-1 ml-0.5">
                            {law.enforcementDate && (
                              <span className="text-[10px] text-slate-400">
                                시행 {formatDate(law.enforcementDate)}
                              </span>
                            )}
                            {law.department && (
                              <span className="text-[10px] text-slate-400">
                                {law.department}
                              </span>
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>

                  {/* 페이지네이션 */}
                  {totalCount > 20 && (
                    <div className="flex items-center justify-center gap-2 py-3 border-t border-slate-100">
                      <button
                        disabled={currentPage <= 1}
                        onClick={() => handleSearch(searchQuery, currentPage - 1)}
                        className="px-2 py-1 text-[10px] text-slate-600 border border-slate-200 rounded
                                   hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        이전
                      </button>
                      <span className="text-[10px] text-slate-500">
                        {currentPage} / {Math.ceil(totalCount / 20)}
                      </span>
                      <button
                        disabled={currentPage * 20 >= totalCount}
                        onClick={() => handleSearch(searchQuery, currentPage + 1)}
                        className="px-2 py-1 text-[10px] text-slate-600 border border-slate-200 rounded
                                   hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        다음
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* 조문 목록 뷰 */}
          {viewState === 'articles' && lawDetail && (
            <div>
              {/* 법령 기본 정보 헤더 */}
              <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200">
                <h3 className="text-xs font-semibold text-slate-800">
                  {lawDetail.info.name}
                </h3>
                <div className="flex gap-2 mt-1">
                  {lawDetail.info.type && (
                    <span className={`px-1.5 py-0.5 text-[10px] rounded ${getTypeBadgeColor(lawDetail.info.type)}`}>
                      {lawDetail.info.type}
                    </span>
                  )}
                  {lawDetail.info.enforcementDate && (
                    <span className="text-[10px] text-slate-500">
                      시행 {formatDate(lawDetail.info.enforcementDate)}
                    </span>
                  )}
                </div>
                {lawDetail.info.department && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    소관: {lawDetail.info.department}
                  </p>
                )}
              </div>

              {/* 조문 수 표시 */}
              <div className="px-3 py-1.5 text-[10px] text-slate-500 border-b border-slate-100">
                조문 {lawDetail.articles.length}개
              </div>

              {/* 조문 목록 */}
              {lawDetail.articles.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  조문 정보가 없습니다.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {lawDetail.articles.map((article, idx) => (
                    <li key={`${article.number}-${idx}`}>
                      <button
                        onClick={() => {
                          setSelectedArticle(article);
                          setViewState('article-detail');
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors group"
                      >
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[10px] text-blue-600 font-mono shrink-0">
                            제{article.number}조
                          </span>
                          {article.title && (
                            <span className="text-xs text-slate-700 group-hover:text-blue-700 truncate">
                              {article.title}
                            </span>
                          )}
                        </div>
                        {/* 조문 내용 미리보기 (첫 80자) */}
                        {article.content && (
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                            {article.content.slice(0, 80)}
                            {article.content.length > 80 ? '...' : ''}
                          </p>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* 조문 상세 뷰 */}
          {viewState === 'article-detail' && selectedArticle && (
            <div className="p-3">
              {/* 조문 제목 */}
              <div className="mb-3">
                <h4 className="text-xs font-semibold text-slate-800">
                  제{selectedArticle.number}조
                  {selectedArticle.title && (
                    <span className="ml-1 font-normal">({selectedArticle.title})</span>
                  )}
                </h4>
                {lawDetail?.info.name && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {lawDetail.info.name}
                  </p>
                )}
              </div>

              {/* 조문 본문 */}
              <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                {selectedArticle.content}
              </div>

              {/* 항 목록 */}
              {selectedArticle.paragraphs && selectedArticle.paragraphs.length > 0 && (
                <div className="mt-3 space-y-2">
                  {selectedArticle.paragraphs.map((para, idx) => (
                    <div
                      key={`para-${idx}`}
                      className="pl-3 border-l-2 border-slate-200"
                    >
                      {para.number && (
                        <span className="text-[10px] text-blue-500 font-mono">
                          [{para.number}항]
                        </span>
                      )}
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {para.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* 시행일자 */}
              {selectedArticle.enforcementDate && (
                <p className="mt-3 text-[10px] text-slate-400">
                  조문 시행일: {formatDate(selectedArticle.enforcementDate)}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 유틸리티 함수
// ============================================================

/** 날짜 문자열(YYYYMMDD) → 읽기 좋은 형식(YYYY.MM.DD)으로 변환 */
function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 8) return dateStr;
  // 이미 점(.)이 포함되어 있으면 그대로 반환
  if (dateStr.includes('.') || dateStr.includes('-')) return dateStr;
  return `${dateStr.slice(0, 4)}.${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}`;
}
