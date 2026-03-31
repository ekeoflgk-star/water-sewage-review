'use client';

import { useState, useCallback, useRef } from 'react';

// ============================================================
// 타입 정의
// ============================================================

/** 법령 검색 결과 아이템 */
interface LawItem {
  id: number | string;
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

/** 3단비교 조항 (법률 → 시행령 → 시행규칙 대응) */
interface ThreeWayArticle {
  lawTitle?: string;        // 법률 조문 제목
  lawArticle?: string;      // 법률 조문 내용
  decreeTitle?: string;     // 시행령 조문 제목
  decreeArticle?: string;   // 시행령 조문 내용
  ruleTitle?: string;       // 시행규칙 조문 제목
  ruleArticle?: string;     // 시행규칙 조문 내용
}

/** 3단비교 결과 */
interface ThreeWayResult {
  lawName: string;
  decreeName: string;
  ruleName: string;
  articles: ThreeWayArticle[];
}

/** 컴포넌트 뷰 상태 */
type ViewState = 'search' | 'articles' | 'article-detail' | 'three-way';

/** 우측 패널 탭 */
type PanelTab = 'law' | 'specification' | 'design-standard';

// ============================================================
// 법제처 API 직접 호출
// ============================================================
const LAW_API_BASE = 'http://www.law.go.kr/DRF';
const LAW_OC = process.env.NEXT_PUBLIC_LAW_API_OC || 'jonghyeon';

interface LawSearchRaw {
  법령ID?: string;
  법령명한글?: string;
  법령약칭명?: string;
  시행일자?: string;
  공포일자?: string;
  법령구분명?: string;
  소관부처명?: string;
  lId?: string;
  lNm?: string;
  efYd?: string;
}

interface ArticlesRaw {
  조문단위?: RawArticle[] | RawArticle;
  ArticleUnit?: RawArticle[] | RawArticle;
}

interface LawDetailRaw {
  기본정보?: Record<string, string | number>;
  BasicInfo?: Record<string, string | number>;
  조문?: ArticlesRaw;
  Articles?: ArticlesRaw;
}

interface RawArticle {
  조문번호?: string;
  조문여부?: string;
  조문제목?: string;
  조문내용?: string;
  조문시행일자?: string;
  항?: RawParagraph | RawParagraph[];
}

interface RawParagraph {
  항번호?: string;
  항내용?: string;
}

/** 법제처 직접 검색 */
async function directSearchLaws(query: string, page: number = 1): Promise<{ totalCount: number; laws: LawItem[] }> {
  const url = new URL(`${LAW_API_BASE}/lawSearch.do`);
  url.searchParams.set('OC', LAW_OC);
  url.searchParams.set('target', 'law');
  url.searchParams.set('type', 'JSON');
  url.searchParams.set('query', query);
  url.searchParams.set('display', '20');
  url.searchParams.set('page', String(page));

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`법제처 API 오류: ${res.status}`);

  const data = await res.json();
  const lawSearch = data?.LawSearch || data?.lawSearch || data;
  const totalCnt = lawSearch?.totalCnt || lawSearch?.TotalCnt || 0;
  const rawLaws: LawSearchRaw[] = Array.isArray(lawSearch?.law || lawSearch?.Law)
    ? (lawSearch?.law || lawSearch?.Law)
    : (lawSearch?.law || lawSearch?.Law) ? [lawSearch.law || lawSearch.Law] : [];

  const laws: LawItem[] = rawLaws.map((item) => ({
    id: item.법령ID || item.lId || 0,
    name: item.법령명한글 || item.lNm || '(법령명 없음)',
    abbreviation: item.법령약칭명 || '',
    enforcementDate: item.시행일자 || item.efYd || '',
    type: item.법령구분명 || '',
    department: item.소관부처명 || '',
  }));

  return { totalCount: parseInt(String(totalCnt), 10) || 0, laws };
}

/** 법제처 직접 조문 조회 */
async function directFetchLawDetail(lawId: string | number): Promise<LawDetail> {
  const url = new URL(`${LAW_API_BASE}/lawService.do`);
  url.searchParams.set('OC', LAW_OC);
  url.searchParams.set('target', 'law');
  url.searchParams.set('type', 'JSON');
  url.searchParams.set('ID', String(lawId));

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`법제처 API 오류: ${res.status}`);

  const data = await res.json();
  const lawData: LawDetailRaw = data?.법령 || data?.Law || {};
  const basicInfo = lawData?.기본정보 || lawData?.BasicInfo || {};
  const articlesSection = lawData?.조문 || lawData?.Articles || {};
  const rawArticles = articlesSection?.조문단위 || articlesSection?.ArticleUnit || [];
  const articleList: RawArticle[] = Array.isArray(rawArticles) ? rawArticles : rawArticles ? [rawArticles] : [];

  const info = {
    id: basicInfo?.법령ID || lawId,
    name: (basicInfo?.법령명_한글 || basicInfo?.법령명한글 || '(법령명 없음)') as string,
    enforcementDate: (basicInfo?.시행일자 || '') as string,
    department: (basicInfo?.소관부처명 || '') as string,
    type: (basicInfo?.법령구분명 || '') as string,
  };

  const articles: ArticleItem[] = articleList
    .filter((a) => a.조문여부 === 'Y' || a.조문내용)
    .map((a) => ({
      number: a.조문번호 || '',
      title: a.조문제목 || '',
      content: a.조문내용 || '',
      enforcementDate: a.조문시행일자 || '',
      paragraphs: parseParagraphs(a.항),
    }));

  return { info, articles };
}

/** 항 파싱 */
function parseParagraphs(data: RawParagraph | RawParagraph[] | undefined): Array<{ number: string; content: string }> {
  if (!data) return [];
  const items = Array.isArray(data) ? data : [data];
  return items.map((p) => ({ number: p?.항번호 || '', content: p?.항내용 || '' }));
}

/**
 * 법제처 3단비교 API 호출
 *
 * 실제 응답 구조 (ThdCmpLawXService):
 *   기본정보: { 법령명, 시행령명, 시행규칙명, ... }
 *   인용조문삼단비교 (knd=1) 또는 위임조문삼단비교 (knd=2):
 *     법률조문: [
 *       { 조제목, 조내용, 조번호,
 *         시행령조문목록?: { 시행령조문: {...} | [{...}] },
 *         시행규칙조문목록?: { 시행규칙조문: {...} | [{...}] }
 *       }, ...
 *     ]
 */
async function directFetchThreeWay(lawId: string | number, knd: 1 | 2 = 1): Promise<ThreeWayResult> {
  const url = new URL(`${LAW_API_BASE}/lawService.do`);
  url.searchParams.set('OC', LAW_OC);
  url.searchParams.set('target', 'thdCmp');
  url.searchParams.set('type', 'JSON');
  url.searchParams.set('ID', String(lawId));
  url.searchParams.set('knd', String(knd));

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`3단비교 API 오류: ${res.status}`);

  const data = await res.json();

  // 루트 키가 knd에 따라 다름
  //   knd=1(인용조문): ThdCmpLawXService
  //   knd=2(위임조문): LspttnThdCmpLawXService
  const root = data?.ThdCmpLawXService || data?.LspttnThdCmpLawXService || data || {};
  const basicInfo = root?.기본정보 || {};
  const lawName = (basicInfo?.법령명 || '법률') as string;
  const decreeName = (basicInfo?.시행령명 || '시행령') as string;
  const ruleName = (basicInfo?.시행규칙명 || '시행규칙') as string;

  // knd=1: 인용조문삼단비교, knd=2: 위임조문삼단비교
  const compareSection = root?.인용조문삼단비교 || root?.위임조문삼단비교 || {};

  // 법률조문 배열 추출
  const rawLawArticles = compareSection?.법률조문 || [];
  const lawArticleList = Array.isArray(rawLawArticles) ? rawLawArticles : rawLawArticles ? [rawLawArticles] : [];

  // 중첩 조문 추출 헬퍼
  // knd=1: 시행령조문목록.시행령조문 (한 단계 중첩)
  // knd=2: 시행령조문 (직접 키)
  const extractNested = (parent: Record<string, unknown>, listKey: string, itemKey: string, directKey: string) => {
    // 먼저 직접 키 확인 (knd=2 위임조문 방식)
    const directVal = parent?.[directKey];
    if (directVal) {
      const arr = Array.isArray(directVal) ? directVal : [directVal];
      return arr as Record<string, string>[];
    }
    // 중첩 키 확인 (knd=1 인용조문 방식)
    const listObj = parent?.[listKey] as Record<string, unknown> | undefined;
    if (!listObj) return [];
    const raw = listObj[itemKey];
    return raw ? (Array.isArray(raw) ? raw : [raw]) as Record<string, string>[] : [];
  };

  // 각 법률조문에서 시행령·시행규칙 대응 조문 추출
  const articles: ThreeWayArticle[] = lawArticleList
    .filter((item: Record<string, unknown>) => item?.조내용)
    .map((item: Record<string, unknown>) => {
      const lawTitle = (item?.조제목 || '') as string;
      const lawContent = (item?.조내용 || '') as string;

      // 시행령 조문 추출 (knd=1: 중첩, knd=2: 직접)
      const decreeArr = extractNested(item, '시행령조문목록', '시행령조문', '시행령조문');
      const decreeTitle = decreeArr.map((d) => d?.조제목 || '').filter(Boolean).join(' / ');
      const decreeContent = decreeArr.map((d) => d?.조내용 || '').filter(Boolean).join('\n\n');

      // 시행규칙 조문 추출 (knd=1: 중첩, knd=2: 직접)
      const ruleArr = extractNested(item, '시행규칙조문목록', '시행규칙조문', '시행규칙조문');
      const ruleTitle = ruleArr.map((r) => r?.조제목 || '').filter(Boolean).join(' / ');
      const ruleContent = ruleArr.map((r) => r?.조내용 || '').filter(Boolean).join('\n\n');

      return {
        lawTitle,
        lawArticle: lawContent,
        decreeTitle,
        decreeArticle: decreeContent,
        ruleTitle,
        ruleArticle: ruleContent,
      } as ThreeWayArticle;
    });

  return { lawName, decreeName, ruleName, articles };
}

// ============================================================
// 바로가기 법령 목록
// ============================================================
const QUICK_LAWS = [
  { label: '수도법', query: '수도법' },
  { label: '하수도법', query: '하수도법' },
  { label: '물환경보전법', query: '물환경보전법' },
  { label: '환경영향평가법', query: '환경영향평가법' },
  { label: '건설기술진흥법', query: '건설기술진흥법' },
  { label: '하수도사용조례', query: '하수도 사용 조례', isOrdinance: true },
  { label: '도로굴착복구', query: '도로 굴착 복구', isOrdinance: true },
  { label: '수도급수조례', query: '수도 급수 조례', isOrdinance: true },
];

// ============================================================
// 시방서 목록
// ============================================================
const SPECIFICATIONS = [
  // ── 상수도 직접 관련 ──
  { label: '상수도공사 표준시방서', description: '취수·정수·송배수·급수 시설 시공', query: '상수도공사 표준시방서', category: '상수도' },
  { label: '수도용 자재·제품 시방서', description: '수도관·밸브·이음관 자재 기준', query: '수도용 자재 위생안전기준', category: '상수도' },
  { label: '상수관로 갱생공사 시방서', description: '노후관 세척·라이닝·갱생 기준', query: '상수관로 갱생공사 시방서', category: '상수도' },
  // ── 하수도 직접 관련 ──
  { label: '하수도공사 표준시방서', description: '하수관로·맨홀·우수시설 시공', query: '하수도공사 표준시방서', category: '하수도' },
  { label: '하수관로 비굴착공사 시방서', description: '추진·관삽입·반전경화 비굴착 공법', query: '하수관로 비굴착 보수공사', category: '하수도' },
  { label: '하수관로 정비사업 시방서', description: '하수관로 조사·진단·보수·보강', query: '하수관로 정비사업 시방서', category: '하수도' },
  { label: '하수처리시설 표준시방서', description: '하수처리장·슬러지처리 시공', query: '하수처리시설 표준시방서', category: '하수도' },
  { label: '물재이용시설 시방서', description: '중수도·빗물이용·하수재이용 시설', query: '물재이용시설 설치 기준', category: '하수도' },
  // ── 상하수도 공통 (토목·구조) ──
  { label: '토목공사 표준시방서', description: '토공·기초·포장 등 토목 일반', query: '토목공사 표준시방서', category: '공통' },
  { label: '콘크리트 표준시방서', description: '콘크리트 배합·타설·양생 기준', query: '콘크리트 표준시방서', category: '공통' },
  { label: '건설공사 표준시방서', description: '건설공사 일반 시공 기준', query: '건설공사 표준시방서', category: '공통' },
  { label: '도로공사 표준시방서', description: '도로 복구·포장·부대시설', query: '도로공사 표준시방서', category: '공통' },
  { label: '터널공사 표준시방서', description: '개착·추진 터널 (관로 횡단)', query: '터널공사 표준시방서', category: '공통' },
  { label: '가시설 안전기준 시방서', description: '흙막이·가물막이·가설구조물', query: '가시설 안전기준', category: '공통' },
];

// ============================================================
// 설계기준 (KDS) 목록
// ============================================================
const DESIGN_STANDARDS = [
  { label: 'KDS 61 40 10', description: '하수도시설 관로시설 설계기준', query: 'KDS 61 40 10 하수도 관로' },
  { label: 'KDS 61 40 20', description: '하수도시설 펌프장시설 설계기준', query: 'KDS 61 40 20 하수도 펌프장' },
  { label: 'KDS 61 40 30', description: '하수도시설 수처리시설 설계기준', query: 'KDS 61 40 30 하수도 수처리' },
  { label: 'KDS 61 40 40', description: '하수도시설 슬러지처리 설계기준', query: 'KDS 61 40 40 하수도 슬러지' },
  { label: 'KDS 61 30 10', description: '상수도시설 취정수시설 설계기준', query: 'KDS 61 30 10 상수도 취정수' },
  { label: 'KDS 61 30 20', description: '상수도시설 송배수시설 설계기준', query: 'KDS 61 30 20 상수도 송배수' },
  { label: 'KDS 61 30 30', description: '상수도시설 급수시설 설계기준', query: 'KDS 61 30 30 상수도 급수' },
  { label: 'KDS 14 20 00', description: '콘크리트 구조 설계기준', query: 'KDS 14 20 00 콘크리트 구조' },
  { label: 'KDS 11 50 05', description: '기초구조 설계기준', query: 'KDS 11 50 05 기초구조' },
];

// ============================================================
// LawNavigator 컴포넌트
// ============================================================
export function LawNavigator() {
  // 탭 상태
  const [activeTab, setActiveTab] = useState<PanelTab>('law');

  // 상태 관리 — 모든 탭에서 공유
  const [viewState, setViewState] = useState<ViewState>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LawItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false); // 검색 실행 여부 (0건 결과 구분)

  // 법령 상세 상태
  const [lawDetail, setLawDetail] = useState<LawDetail | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<ArticleItem | null>(null);

  // 3단비교 상태
  const [threeWayResult, setThreeWayResult] = useState<ThreeWayResult | null>(null);
  const [threeWayCompareKnd, setThreeWayCompareKnd] = useState<1 | 2>(1);

  // 검색 출처 추적 (어느 탭에서 검색을 시작했는지)
  const [searchOriginTab, setSearchOriginTab] = useState<PanelTab>('law');

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
      const data = await directSearchLaws(query.trim(), page);
      setSearchResults(data.laws);
      setTotalCount(data.totalCount);
      setHasSearched(true);
      setViewState('search');
    } catch {
      try {
        const res = await fetch(`/api/law?q=${encodeURIComponent(query.trim())}&page=${page}`);
        if (!res.ok) throw new Error(`검색 실패 (${res.status})`);
        const data = await res.json();
        setSearchResults(data.laws || []);
        setTotalCount(data.totalCount || 0);
        setHasSearched(true);
        setViewState('search');
      } catch (err2) {
        setError(err2 instanceof Error ? err2.message : '검색 중 오류가 발생했습니다.');
        setSearchResults([]);
        setHasSearched(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --------------------------------------------------------
  // 법령 조문 상세 조회
  // --------------------------------------------------------
  const handleSelectLaw = useCallback(async (lawId: number | string, lawName: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await directFetchLawDetail(lawId);
      if (data.info && (!data.info.name || data.info.name === '(법령명 없음)')) {
        data.info.name = lawName;
      }
      setLawDetail(data);
      setSelectedArticle(null);
      setViewState('articles');
    } catch {
      try {
        const res = await fetch(`/api/law?id=${lawId}`);
        if (!res.ok) throw new Error(`조문 조회 실패 (${res.status})`);
        const data: LawDetail = await res.json();
        if (data.info && (!data.info.name || data.info.name === '(법령명 없음)')) {
          data.info.name = lawName;
        }
        setLawDetail(data);
        setSelectedArticle(null);
        setViewState('articles');
      } catch (err2) {
        setError(err2 instanceof Error ? err2.message : '조문 조회 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --------------------------------------------------------
  // 3단비교 새 창으로 열기
  // --------------------------------------------------------
  const openThreeWayPopup = useCallback((result: ThreeWayResult, lawName: string) => {
    const escapeHtml = (str: string) =>
      str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const articleRows = result.articles.map((art, idx) => `
      <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td class="col-law">
          ${art.lawTitle ? `<div class="art-title law-title">${escapeHtml(art.lawTitle)}</div>` : ''}
          <div class="art-content">${art.lawArticle ? escapeHtml(art.lawArticle) : '<span class="empty">-</span>'}</div>
        </td>
        <td class="col-decree">
          ${art.decreeTitle ? `<div class="art-title decree-title">${escapeHtml(art.decreeTitle)}</div>` : ''}
          <div class="art-content">${art.decreeArticle ? escapeHtml(art.decreeArticle) : '<span class="empty">\u2014</span>'}</div>
        </td>
        <td class="col-rule">
          ${art.ruleTitle ? `<div class="art-title rule-title">${escapeHtml(art.ruleTitle)}</div>` : ''}
          <div class="art-content">${art.ruleArticle ? escapeHtml(art.ruleArticle) : '<span class="empty">\u2014</span>'}</div>
        </td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>3단비교 — ${escapeHtml(lawName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #334155; }
  .header { background: linear-gradient(135deg, #4338ca, #6366f1); color: white; padding: 20px 28px; }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header p { font-size: 13px; opacity: 0.8; margin-top: 4px; }
  .header .meta { font-size: 12px; opacity: 0.6; margin-top: 8px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead th { position: sticky; top: 0; z-index: 10; padding: 12px 16px; font-size: 13px; font-weight: 700; text-align: center; border-bottom: 2px solid #e2e8f0; }
  .th-law { background: #eff6ff; color: #1d4ed8; }
  .th-decree { background: #f0fdf4; color: #15803d; }
  .th-rule { background: #fffbeb; color: #b45309; }
  td { padding: 14px 16px; vertical-align: top; border-bottom: 1px solid #e2e8f0; }
  .col-law { background: rgba(239,246,255,0.3); }
  .col-decree { background: rgba(240,253,244,0.3); }
  .col-rule { background: rgba(255,251,235,0.3); }
  .row-even td { }
  .row-odd td { background-blend-mode: multiply; }
  .art-title { font-size: 13px; font-weight: 700; margin-bottom: 6px; }
  .law-title { color: #1d4ed8; }
  .decree-title { color: #15803d; }
  .rule-title { color: #b45309; }
  .art-content { font-size: 14px; line-height: 1.8; white-space: pre-wrap; word-break: break-word; }
  .empty { color: #cbd5e1; }
  .footer { padding: 16px 28px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  @media print {
    .header { background: #4338ca !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    thead th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="header">
    <h1>📊 법령 3단비교</h1>
    <p>${escapeHtml(lawName)}</p>
    <div class="meta">조문 ${result.articles.length}개 · 생성: ${new Date().toLocaleString('ko-KR')}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="th-law">${escapeHtml(result.lawName || '법률')}</th>
        <th class="th-decree">${escapeHtml(result.decreeName || '시행령')}</th>
        <th class="th-rule">${escapeHtml(result.ruleName || '시행규칙')}</th>
      </tr>
    </thead>
    <tbody>${articleRows}</tbody>
  </table>
  <div class="footer">상하수도 설계 검토 AI — 법제처 Open API 3단비교</div>
</body>
</html>`;

    const popup = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
    if (popup) {
      popup.document.write(html);
      popup.document.close();
    }
  }, []);

  // --------------------------------------------------------
  // 3단비교 조회
  // --------------------------------------------------------
  const handleThreeWayCompare = useCallback(async (lawId: string | number, knd: 1 | 2 = 1) => {
    setIsLoading(true);
    setError(null);
    setThreeWayCompareKnd(knd);

    try {
      const result = await directFetchThreeWay(lawId, knd);
      setThreeWayResult(result);
      setViewState('three-way');
    } catch {
      try {
        const res = await fetch(`/api/law?id=${lawId}&target=thdCmp&knd=${knd}`);
        if (!res.ok) throw new Error(`3단비교 조회 실패 (${res.status})`);
        const result: ThreeWayResult = await res.json();
        setThreeWayResult(result);
        setViewState('three-way');
      } catch (err2) {
        setError(err2 instanceof Error ? err2.message : '3단비교 조회 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --------------------------------------------------------
  // 시방서/설계기준 탭에서 검색 시작
  // --------------------------------------------------------
  const handleTabSearch = useCallback((query: string, fromTab: PanelTab) => {
    setSearchOriginTab(fromTab);
    setSearchQuery(query);
    handleSearch(query);
    // 탭은 그대로 유지! 법령 탭으로 전환하지 않음
  }, [handleSearch]);

  // --------------------------------------------------------
  // 검색 폼 제출
  // --------------------------------------------------------
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchOriginTab('law');
    handleSearch(searchQuery);
  };

  // --------------------------------------------------------
  // 뒤로가기
  // --------------------------------------------------------
  const handleBack = () => {
    if (viewState === 'three-way') {
      setThreeWayResult(null);
      setViewState('articles');
    } else if (viewState === 'article-detail') {
      setSelectedArticle(null);
      setViewState('articles');
    } else if (viewState === 'articles') {
      setViewState('search');
    } else if (viewState === 'search' && hasSearched) {
      // 검색 결과에서 목록으로 돌아갈 때 — 원래 탭으로 복귀
      handleBackToTabHome();
    }
  };

  // --------------------------------------------------------
  // 전체 뒤로가기 (탭 원래 상태로 복귀)
  // --------------------------------------------------------
  const handleBackToTabHome = () => {
    setViewState('search');
    setSearchResults([]);
    setSearchQuery('');
    setHasSearched(false);
    setLawDetail(null);
    setSelectedArticle(null);
    setThreeWayResult(null);
    setError(null);
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

  // 현재 뷰가 탭 초기 상태인지 (검색 전)
  const isAtTabHome = viewState === 'search' && !hasSearched && !error;
  // 뒤로가기 표시 여부 — 검색결과/조문/상세/3단비교 어느 탭에서든
  const showBackButton = !isAtTabHome;

  // 뒤로가기 라벨
  const getBackLabel = () => {
    if (viewState === 'three-way') return '조문 목록';
    if (viewState === 'article-detail') return '조문 목록';
    if (viewState === 'articles') return '검색 결과';
    if (viewState === 'search' && hasSearched) {
      // 시방서/설계기준에서 검색한 경우
      if (searchOriginTab === 'specification') return '시방서 목록';
      if (searchOriginTab === 'design-standard') return '설계기준 목록';
      return '검색 초기화';
    }
    return '뒤로';
  };

  // ============================================================
  // 공통 검색 결과 + 상세 뷰 렌더링 (모든 탭에서 공유)
  // ============================================================
  const renderSearchAndDetail = () => (
    <>
      {/* 검색바 (법령 탭에서만 표시) */}
      {activeTab === 'law' && (
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
      )}

      {/* 뒤로가기 버튼 — 모든 탭에서 공통 */}
      {showBackButton && (
        <button
          onClick={viewState === 'search' && hasSearched ? handleBackToTabHome : handleBack}
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-600 hover:text-blue-800
                     hover:bg-blue-50 transition-colors border-b border-slate-200 w-full text-left"
        >
          <span>&#8592;</span>
          <span>{getBackLabel()}</span>
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
          {/* 검색 결과 0건 */}
          {viewState === 'search' && hasSearched && searchResults.length === 0 && !error && (
            <div className="p-4 text-center">
              <div className="text-2xl mb-2 opacity-30">🔍</div>
              <p className="text-xs text-slate-500 mb-1">
                &ldquo;{searchQuery}&rdquo;에 대한 검색 결과가 없습니다.
              </p>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                {searchOriginTab === 'design-standard'
                  ? 'KDS 설계기준은 법제처 법령이 아닌 국가건설기준센터(KCSC)에서 관리합니다. 관련 법률명으로 검색해보세요.'
                  : searchOriginTab === 'specification'
                  ? '표준시방서는 법제처에 등록되지 않을 수 있습니다. 관련 법률명으로 검색해보세요.'
                  : '다른 키워드로 검색해보세요.'}
              </p>
            </div>
          )}

          {/* 검색 결과 목록 */}
          {viewState === 'search' && searchResults.length > 0 && (
            <div>
              <div className="px-3 py-2 text-[10px] text-slate-500 border-b border-slate-100">
                {searchOriginTab !== 'law' && (
                  <span className="text-blue-500 mr-1">
                    {searchOriginTab === 'specification' ? '📋 시방서' : '📐 설계기준'} &gt;
                  </span>
                )}
                검색 결과 총 {totalCount}건
              </div>
              <ul className="divide-y divide-slate-100">
                {searchResults.map((law) => (
                  <li key={law.id}>
                    <button
                      onClick={() => handleSelectLaw(law.id, law.name)}
                      className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="flex items-start gap-1.5">
                        {law.type && (
                          <span className={`shrink-0 px-1.5 py-0.5 text-[10px] rounded ${getTypeBadgeColor(law.type)}`}>
                            {law.type}
                          </span>
                        )}
                        <span className="text-xs font-medium text-slate-800 group-hover:text-blue-700 leading-snug">
                          {law.name}
                        </span>
                      </div>
                      {law.abbreviation && (
                        <p className="text-[10px] text-slate-400 mt-0.5 ml-0.5">약칭: {law.abbreviation}</p>
                      )}
                      <div className="flex gap-3 mt-1 ml-0.5">
                        {law.enforcementDate && (
                          <span className="text-[10px] text-slate-400">시행 {formatDate(law.enforcementDate)}</span>
                        )}
                        {law.department && (
                          <span className="text-[10px] text-slate-400">{law.department}</span>
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
                  <span className="text-[10px] text-slate-500">{currentPage} / {Math.ceil(totalCount / 20)}</span>
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

          {/* 조문 목록 뷰 */}
          {viewState === 'articles' && lawDetail && (
            <div>
              <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200">
                <h3 className="text-xs font-semibold text-slate-800">{lawDetail.info.name}</h3>
                <div className="flex gap-2 mt-1">
                  {lawDetail.info.type && (
                    <span className={`px-1.5 py-0.5 text-[10px] rounded ${getTypeBadgeColor(lawDetail.info.type)}`}>
                      {lawDetail.info.type}
                    </span>
                  )}
                  {lawDetail.info.enforcementDate && (
                    <span className="text-[10px] text-slate-500">시행 {formatDate(lawDetail.info.enforcementDate)}</span>
                  )}
                </div>
                {lawDetail.info.department && (
                  <p className="text-[10px] text-slate-400 mt-0.5">소관: {lawDetail.info.department}</p>
                )}
              </div>

              {/* 3단비교 버튼 + 조문 수 */}
              <div className="px-3 py-2 flex items-center justify-between border-b border-slate-100">
                <span className="text-xs text-slate-500">조문 {lawDetail.articles.length}개</span>
                <button
                  onClick={() => handleThreeWayCompare(lawDetail.info.id)}
                  disabled={isLoading}
                  className="text-sm px-4 py-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors font-semibold disabled:opacity-50 shadow-sm"
                  title="법률 ↔ 시행령 ↔ 시행규칙 3단비교"
                >
                  📊 3단비교
                </button>
              </div>

              {lawDetail.articles.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">조문 정보가 없습니다.</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {lawDetail.articles.map((article, idx) => (
                    <li key={`${article.number}-${idx}`}>
                      <button
                        onClick={() => { setSelectedArticle(article); setViewState('article-detail'); }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors group"
                      >
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[10px] text-blue-600 font-mono shrink-0">제{article.number}조</span>
                          {article.title && (
                            <span className="text-xs text-slate-700 group-hover:text-blue-700 truncate">{article.title}</span>
                          )}
                        </div>
                        {article.content && (
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                            {article.content.slice(0, 80)}{article.content.length > 80 ? '...' : ''}
                          </p>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* 조문 상세 뷰 — 긴 조문 접기/펼치기 지원 */}
          {viewState === 'article-detail' && selectedArticle && (
            <ArticleDetailView article={selectedArticle} lawName={lawDetail?.info.name} />
          )}

          {/* 3단비교 뷰 */}
          {viewState === 'three-way' && threeWayResult && (
            <div className="flex flex-col h-full">
              <div className="px-3 py-2.5 bg-indigo-50 border-b border-indigo-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-indigo-800">📊 법령 3단비교</h3>
                    <p className="text-xs text-indigo-500 mt-0.5">{lawDetail?.info.name || ''}</p>
                  </div>
                  {/* 새 창으로 열기 버튼 */}
                  <button
                    onClick={() => openThreeWayPopup(threeWayResult, lawDetail?.info.name || '')}
                    className="text-sm px-3 py-2 rounded-lg bg-white text-indigo-600 border border-indigo-300 hover:bg-indigo-100 transition-colors font-semibold shadow-sm"
                    title="넓은 화면에서 3단비교 보기"
                  >
                    🔎 새 창
                  </button>
                </div>
                <div className="flex gap-2 mt-2.5">
                  <button
                    onClick={() => lawDetail && handleThreeWayCompare(lawDetail.info.id, 1)}
                    className={`text-sm px-4 py-1.5 rounded-lg transition-colors font-semibold ${
                      threeWayCompareKnd === 1
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white text-indigo-600 border border-indigo-300 hover:bg-indigo-100'
                    }`}
                  >
                    인용조문
                  </button>
                  <button
                    onClick={() => lawDetail && handleThreeWayCompare(lawDetail.info.id, 2)}
                    className={`text-sm px-4 py-1.5 rounded-lg transition-colors font-semibold ${
                      threeWayCompareKnd === 2
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white text-indigo-600 border border-indigo-300 hover:bg-indigo-100'
                    }`}
                  >
                    위임조문
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-px bg-slate-200 text-sm font-semibold">
                <div className="bg-blue-50 text-blue-700 px-2 py-2.5 text-center">{threeWayResult.lawName || '법률'}</div>
                <div className="bg-green-50 text-green-700 px-2 py-2.5 text-center">{threeWayResult.decreeName || '시행령'}</div>
                <div className="bg-amber-50 text-amber-700 px-2 py-2.5 text-center">{threeWayResult.ruleName || '시행규칙'}</div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {threeWayResult.articles.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-400">
                    3단비교 데이터가 없습니다.
                    <br />
                    <span className="text-xs">법률이 아닌 시행령/시행규칙의 경우 비교가 제공되지 않을 수 있습니다.</span>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {threeWayResult.articles.map((art, idx) => (
                      <div key={idx} className="grid grid-cols-3 gap-px bg-slate-100">
                        {/* 법률 */}
                        <div className="bg-blue-50/30 px-3 py-3">
                          {art.lawTitle && (
                            <span className="text-xs text-blue-600 font-semibold block mb-1.5">{art.lawTitle}</span>
                          )}
                          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap break-words">
                            {art.lawArticle || '-'}
                          </p>
                        </div>
                        {/* 시행령 */}
                        <div className="bg-green-50/30 px-3 py-3">
                          {art.decreeTitle && (
                            <span className="text-xs text-green-600 font-semibold block mb-1.5">{art.decreeTitle}</span>
                          )}
                          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap break-words">
                            {art.decreeArticle || <span className="text-slate-300">—</span>}
                          </p>
                        </div>
                        {/* 시행규칙 */}
                        <div className="bg-amber-50/30 px-3 py-3">
                          {art.ruleTitle && (
                            <span className="text-xs text-amber-600 font-semibold block mb-1.5">{art.ruleTitle}</span>
                          )}
                          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap break-words">
                            {art.ruleArticle || <span className="text-slate-300">—</span>}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );

  // ============================================================
  // 렌더링
  // ============================================================
  return (
    <div className="flex flex-col h-full">
      {/* 탭 버튼 */}
      <div className="flex border-b border-slate-200">
        {(['law', 'specification', 'design-standard'] as PanelTab[]).map((key) => {
          const labels: Record<PanelTab, { label: string; icon: string }> = {
            law: { label: '법령', icon: '⚖️' },
            specification: { label: '시방서', icon: '📋' },
            'design-standard': { label: '설계기준', icon: '📐' },
          };
          const tab = labels[key];
          return (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key);
                // 탭 전환 시 상태 초기화
                handleBackToTabHome();
              }}
              className={`flex-1 px-2 py-2 text-xs font-medium transition-colors
                ${activeTab === key
                  ? 'text-blue-700 border-b-2 border-blue-500 bg-blue-50/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 시방서 탭 — 목록 (검색 전) */}
      {activeTab === 'specification' && isAtTabHome && (
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs font-medium text-slate-600 mb-2">상하수도 관련 시방서</p>
          <p className="text-[10px] text-slate-400 mb-3">클릭하면 법제처에서 관련 법령을 검색합니다.</p>
          {/* 카테고리별 그룹 */}
          {(['상수도', '하수도', '공통'] as const).map((cat) => {
            const items = SPECIFICATIONS.filter((s) => s.category === cat);
            const colorMap = {
              '상수도': { border: 'border-blue-200', text: 'text-blue-700', hover: 'hover:border-blue-300 hover:bg-blue-50/60', badge: 'bg-blue-100 text-blue-600' },
              '하수도': { border: 'border-teal-200', text: 'text-teal-700', hover: 'hover:border-teal-300 hover:bg-teal-50/60', badge: 'bg-teal-100 text-teal-600' },
              '공통':   { border: 'border-slate-200', text: 'text-slate-600', hover: 'hover:border-slate-300 hover:bg-slate-50/80', badge: 'bg-slate-200 text-slate-600' },
            };
            const c = colorMap[cat];
            const iconMap = { '상수도': '💧', '하수도': '🔄', '공통': '🔧' };
            return (
              <div key={cat} className="mb-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-xs">{iconMap[cat]}</span>
                  <p className={`text-[11px] font-semibold ${c.text}`}>{cat}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${c.badge}`}>{items.length}</span>
                </div>
                <div className="space-y-1">
                  {items.map((spec) => (
                    <button
                      key={spec.label}
                      onClick={() => handleTabSearch(spec.query, 'specification')}
                      className={`w-full text-left px-3 py-2 bg-white border ${c.border} rounded-lg
                                 ${c.hover} transition-colors group`}
                    >
                      <p className={`text-[11px] font-medium text-slate-700 group-hover:${c.text}`}>{spec.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{spec.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 시방서 탭 — 검색결과/조문 (검색 후) */}
      {activeTab === 'specification' && !isAtTabHome && renderSearchAndDetail()}

      {/* 설계기준 탭 — 목록 (검색 전) */}
      {activeTab === 'design-standard' && isAtTabHome && (
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs font-medium text-slate-600 mb-3">KDS 설계기준 (국가건설기준)</p>
          <div className="space-y-2">
            {DESIGN_STANDARDS.map((std) => (
              <button
                key={std.label}
                onClick={() => handleTabSearch(std.query, 'design-standard')}
                className="w-full text-left px-3 py-2.5 bg-white border border-slate-200 rounded-lg
                           hover:border-green-300 hover:bg-green-50/50 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-mono shrink-0">
                    {std.label}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{std.description}</p>
              </button>
            ))}
          </div>
          <p className="mt-4 text-[10px] text-slate-400 leading-relaxed">
            설계기준을 클릭하면 법제처에서 관련 기준을 검색합니다.
          </p>
        </div>
      )}

      {/* 설계기준 탭 — 검색결과/조문 (검색 후) */}
      {activeTab === 'design-standard' && !isAtTabHome && renderSearchAndDetail()}

      {/* 법령 탭 — 초기 상태 (바로가기) */}
      {activeTab === 'law' && isAtTabHome && (
        <>
          {renderSearchAndDetail()}
          <div className="p-3">
            <p className="text-xs font-medium text-slate-600 mb-2">주요 법령 바로가기</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_LAWS.map((law) => (
                <button
                  key={law.query}
                  onClick={() => {
                    setSearchOriginTab('law');
                    setSearchQuery(law.query);
                    handleSearch(law.query);
                  }}
                  className={`px-2.5 py-1.5 text-xs rounded-full transition-colors ${
                    (law as { isOrdinance?: boolean }).isOrdinance
                      ? 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-300'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700'
                  }`}
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
        </>
      )}

      {/* 법령 탭 — 검색 후 */}
      {activeTab === 'law' && !isAtTabHome && renderSearchAndDetail()}
    </div>
  );
}

// ============================================================
// 조문 상세 뷰 (긴 조문 접기/펼치기 지원)
// ============================================================

const CONTENT_COLLAPSE_THRESHOLD = 300; // 300자 이상이면 접기 가능
const PARAGRAPH_COLLAPSE_THRESHOLD = 5; // 5개 이상 항이면 접기 가능

function ArticleDetailView({ article, lawName }: { article: ArticleItem; lawName?: string }) {
  const [contentExpanded, setContentExpanded] = useState(false);
  const [parasExpanded, setParasExpanded] = useState(false);
  const isLongContent = article.content.length > CONTENT_COLLAPSE_THRESHOLD;
  const hasManyParas = article.paragraphs && article.paragraphs.length > PARAGRAPH_COLLAPSE_THRESHOLD;
  const visibleParas = parasExpanded || !hasManyParas
    ? article.paragraphs
    : article.paragraphs.slice(0, 3);

  return (
    <div className="p-3">
      <div className="mb-3">
        <h4 className="text-xs font-semibold text-slate-800">
          제{article.number}조
          {article.title && <span className="ml-1 font-normal">({article.title})</span>}
        </h4>
        {lawName && <p className="text-[10px] text-slate-400 mt-0.5">{lawName}</p>}
      </div>

      {/* 조문 본문 — 긴 경우 접기/펼치기 */}
      <div className="relative">
        <div
          className={`text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words transition-all duration-200 ${
            isLongContent && !contentExpanded ? 'max-h-[120px] overflow-hidden' : ''
          }`}
        >
          {article.content}
        </div>
        {isLongContent && !contentExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent" />
        )}
        {isLongContent && (
          <button
            onClick={() => setContentExpanded(!contentExpanded)}
            className="mt-1 text-[11px] text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            {contentExpanded ? '▲ 접기' : `▼ 더 보기 (${article.content.length}자)`}
          </button>
        )}
      </div>

      {/* 항 목록 — 많으면 접기/펼치기 */}
      {article.paragraphs && article.paragraphs.length > 0 && (
        <div className="mt-3 space-y-2">
          {visibleParas.map((para, idx) => (
            <div key={`para-${idx}`} className="pl-3 border-l-2 border-slate-200">
              {para.number && <span className="text-[10px] text-blue-500 font-mono">[{para.number}항]</span>}
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{para.content}</p>
            </div>
          ))}
          {hasManyParas && (
            <button
              onClick={() => setParasExpanded(!parasExpanded)}
              className="ml-3 text-[11px] text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              {parasExpanded
                ? '▲ 항 접기'
                : `▼ 나머지 ${article.paragraphs.length - 3}개 항 보기`}
            </button>
          )}
        </div>
      )}

      {article.enforcementDate && (
        <p className="mt-3 text-[10px] text-slate-400">조문 시행일: {formatDate(article.enforcementDate)}</p>
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
  if (dateStr.includes('.') || dateStr.includes('-')) return dateStr;
  return `${dateStr.slice(0, 4)}.${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}`;
}
