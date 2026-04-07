import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// 법제처 Open API 기본 URL
const LAW_API_BASE = 'http://www.law.go.kr/DRF';
// 기관코드(OC) — 법제처 로그인 이메일 ID
const OC = process.env.LAW_API_OC || 'test';

/** 법령 검색 결과 아이템 (법제처 API 응답 구조) */
interface LawSearchItem {
  법령ID?: number;
  법령명한글?: string;
  법령약칭명?: string;
  시행일자?: string;
  공포일자?: string;
  법령구분명?: string; // 법률, 시행령, 시행규칙 등
  소관부처명?: string;
  법령상세링크?: string;
  // 법제처 API는 키 이름이 다를 수 있음 — 영문 키 지원
  lId?: number;
  lNm?: string;
  efYd?: string;
}

/** 법령 상세 내부 구조 */
interface LawDetail {
  기본정보?: BasicInfo;
  BasicInfo?: BasicInfo;
  조문?: ArticlesSection;
  Articles?: ArticlesSection;
}

interface BasicInfo {
  법령ID?: number;
  법령명_한글?: string;
  법령명한글?: string;
  시행일자?: string;
  소관부처명?: string;
  법령구분명?: string;
}

interface ArticlesSection {
  조문단위?: ArticleUnit[] | ArticleUnit;
  ArticleUnit?: ArticleUnit[] | ArticleUnit;
}

/** 조문 상세 응답 구조 */
interface LawServiceResponse {
  법령?: LawDetail;
  Law?: LawDetail;
}

interface ArticleUnit {
  조문번호?: string;
  조문여부?: string;
  조문제목?: string;
  조문내용?: string;
  조문시행일자?: string;
  항?: ParagraphData | ParagraphData[];
}

interface SubItemData {
  목번호?: string;
  목내용?: string;
}

interface ItemData {
  호번호?: string;
  호내용?: string;
  목?: SubItemData | SubItemData[];
}

interface ParagraphData {
  항번호?: string;
  항내용?: string;
  호?: ItemData | ItemData[];
}

/**
 * GET /api/law
 *
 * 쿼리 파라미터:
 *   - q: 검색어 (법령명) → 법령 목록 검색
 *   - id: 법령 ID → 조문 상세 조회
 *   - page: 페이지 번호 (기본 1)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const lawId = searchParams.get('id');
    const page = searchParams.get('page') || '1';

    // 법령 조문 상세 조회
    if (lawId) {
      return await fetchLawDetail(lawId);
    }

    // 법령 검색
    if (query) {
      return await searchLaws(query, parseInt(page, 10));
    }

    return NextResponse.json(
      { error: '검색어(q) 또는 법령ID(id) 파라미터가 필요합니다.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[법제처 API 오류]', error);
    return NextResponse.json(
      {
        error: '법제처 API 호출 중 오류가 발생했습니다.',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * 법령 검색 — 법제처 lawSearch API 호출
 */
async function searchLaws(query: string, page: number) {
  const url = new URL(`${LAW_API_BASE}/lawSearch.do`);
  url.searchParams.set('OC', OC);
  url.searchParams.set('target', 'law');
  url.searchParams.set('type', 'JSON');
  url.searchParams.set('query', query);
  url.searchParams.set('display', '20');
  url.searchParams.set('page', String(page));

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    // 10초 타임아웃
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`법제처 API 응답 오류: ${response.status}`);
  }

  const text = await response.text();

  // 법제처 API는 JSON이 아닌 경우가 있음 — 안전하게 파싱
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('법제처 API 응답을 파싱할 수 없습니다.');
  }

  // 법제처 API 응답 구조 파싱
  // LawSearch 응답: { LawSearch: { totalCnt, page, law: [...] } }
  const lawSearch = data?.LawSearch || data?.lawSearch || data;
  const totalCnt = lawSearch?.totalCnt || lawSearch?.TotalCnt || 0;
  const rawLaws = lawSearch?.law || lawSearch?.Law || [];

  // 배열이 아닌 경우 (결과 1건) 배열로 변환
  const lawList: LawSearchItem[] = Array.isArray(rawLaws)
    ? rawLaws
    : rawLaws
      ? [rawLaws]
      : [];

  // 프론트엔드용 정규화된 형식으로 변환
  const laws = lawList.map((item) => ({
    id: item.법령ID || item.lId || 0,
    name: item.법령명한글 || item.lNm || '(법령명 없음)',
    abbreviation: item.법령약칭명 || '',
    enforcementDate: item.시행일자 || item.efYd || '',
    promulgationDate: item.공포일자 || '',
    type: item.법령구분명 || '',
    department: item.소관부처명 || '',
    detailLink: item.법령상세링크 || '',
  }));

  return NextResponse.json({
    totalCount: parseInt(String(totalCnt), 10) || 0,
    page,
    laws,
  });
}

/**
 * 법령 조문 상세 — 법제처 lawService API 호출
 */
async function fetchLawDetail(lawId: string) {
  const url = new URL(`${LAW_API_BASE}/lawService.do`);
  url.searchParams.set('OC', OC);
  url.searchParams.set('target', 'law');
  url.searchParams.set('type', 'JSON');
  url.searchParams.set('ID', lawId);

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`법제처 API 응답 오류: ${response.status}`);
  }

  const text = await response.text();

  let data: LawServiceResponse;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('법제처 API 응답을 파싱할 수 없습니다.');
  }

  // 응답 구조 파싱: { 법령: { 기본정보: {...}, 조문: { 조문단위: [...] } } }
  const lawData: LawDetail = data?.법령 || data?.Law || {};
  const basicInfo: BasicInfo = lawData?.기본정보 || lawData?.BasicInfo || {};
  const articlesSection: ArticlesSection = lawData?.조문 || lawData?.Articles || {};
  const rawArticles = articlesSection?.조문단위 || articlesSection?.ArticleUnit || [];

  // 배열 정규화
  const articleList: ArticleUnit[] = Array.isArray(rawArticles)
    ? rawArticles
    : rawArticles
      ? [rawArticles]
      : [];

  // 프론트엔드용 변환
  const info = {
    id: basicInfo?.법령ID || lawId,
    name: basicInfo?.법령명_한글 || basicInfo?.법령명한글 || '(법령명 없음)',
    enforcementDate: basicInfo?.시행일자 || '',
    department: basicInfo?.소관부처명 || '',
    type: basicInfo?.법령구분명 || '',
  };

  const articles = articleList
    .filter((a) => a.조문여부 === 'Y' || a.조문내용)
    .map((a) => ({
      number: a.조문번호 || '',
      title: a.조문제목 || '',
      content: a.조문내용 || '',
      enforcementDate: a.조문시행일자 || '',
      // 항(Paragraph) 정보가 있으면 포함
      paragraphs: parseParagraphs(a.항),
    }));

  return NextResponse.json({
    info,
    articles,
  });
}

/**
 * 목(目) 파싱 헬퍼
 */
function parseSubItems(data: SubItemData | SubItemData[] | undefined): Array<{ number: string; content: string }> {
  if (!data) return [];
  const arr = Array.isArray(data) ? data : [data];
  return arr.map((m) => ({ number: m?.목번호 || '', content: m?.목내용 || '' }));
}

/**
 * 호(號) 파싱 헬퍼
 */
function parseItems(data: ItemData | ItemData[] | undefined): Array<{ number: string; content: string; subItems: Array<{ number: string; content: string }> }> {
  if (!data) return [];
  const arr = Array.isArray(data) ? data : [data];
  return arr.map((h) => ({ number: h?.호번호 || '', content: h?.호내용 || '', subItems: parseSubItems(h?.목) }));
}

/**
 * 항(Paragraph) 파싱 헬퍼 — 호/목 포함
 */
function parseParagraphs(paragraphData: ParagraphData | ParagraphData[] | undefined): Array<{ number: string; content: string; items: Array<{ number: string; content: string; subItems: Array<{ number: string; content: string }> }> }> {
  if (!paragraphData) return [];
  const arr = Array.isArray(paragraphData) ? paragraphData : [paragraphData];
  return arr.map((p) => ({ number: p?.항번호 || '', content: p?.항내용 || '', items: parseItems(p?.호) }));
}
