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

/** 목(目) — 호 하위 */
interface SubItemData {
  number: string;
  content: string;
}

/** 호(號) — 항 하위 */
interface ItemData {
  number: string;
  content: string;
  subItems: SubItemData[];
}

/** 조문 아이템 */
interface ArticleItem {
  number: string;
  title: string;
  content: string;
  enforcementDate: string;
  paragraphs: Array<{ number: string; content: string; items: ItemData[] }>;
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

/** 글꼴 크기 */
type FontSize = 'small' | 'medium' | 'large';

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

interface RawSubItem {
  목번호?: string;
  목내용?: string;
}

interface RawItem {
  호번호?: string;
  호내용?: string;
  목?: RawSubItem | RawSubItem[];
}

interface RawParagraph {
  항번호?: string;
  항내용?: string;
  호?: RawItem | RawItem[];
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

/** 목 파싱 */
function parseSubItems(data: RawSubItem | RawSubItem[] | undefined): SubItemData[] {
  if (!data) return [];
  const arr = Array.isArray(data) ? data : [data];
  return arr.map((m) => ({ number: m?.목번호 || '', content: m?.목내용 || '' }));
}

/** 호 파싱 */
function parseItems(data: RawItem | RawItem[] | undefined): ItemData[] {
  if (!data) return [];
  const arr = Array.isArray(data) ? data : [data];
  return arr.map((h) => ({ number: h?.호번호 || '', content: h?.호내용 || '', subItems: parseSubItems(h?.목) }));
}

/** 항 파싱 (호/목 포함) */
function parseParagraphs(data: RawParagraph | RawParagraph[] | undefined): Array<{ number: string; content: string; items: ItemData[] }> {
  if (!data) return [];
  const arr = Array.isArray(data) ? data : [data];
  return arr.map((p) => ({ number: p?.항번호 || '', content: p?.항내용 || '', items: parseItems(p?.호) }));
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
// 바로가기 법령 목록 — 상하수도 설계 필수 법령
// ============================================================
interface QuickLawGroup {
  label: string;
  category: '상수도' | '하수도' | '공통' | '인허가' | '조례';
  sub: Array<{ label: string; query: string }>;
}

const QUICK_LAW_GROUPS: QuickLawGroup[] = [
  // ── 상수도 ──
  {
    label: '수도법',
    category: '상수도',
    sub: [
      { label: '수도법', query: '수도법' },
      { label: '수도법 시행령', query: '수도법 시행령' },
      { label: '수도법 시행규칙', query: '수도법 시행규칙' },
    ],
  },
  // ── 하수도 ──
  {
    label: '하수도법',
    category: '하수도',
    sub: [
      { label: '하수도법', query: '하수도법' },
      { label: '하수도법 시행령', query: '하수도법 시행령' },
      { label: '하수도법 시행규칙', query: '하수도법 시행규칙' },
    ],
  },
  // ── 환경 ──
  {
    label: '물환경보전법',
    category: '공통',
    sub: [
      { label: '물환경보전법', query: '물환경보전법' },
      { label: '물환경보전법 시행령', query: '물환경보전법 시행령' },
      { label: '물환경보전법 시행규칙', query: '물환경보전법 시행규칙' },
    ],
  },
  {
    label: '물의 재이용',
    category: '공통',
    sub: [
      { label: '물의 재이용 촉진 및 지원에 관한 법률', query: '물의 재이용 촉진 및 지원에 관한 법률' },
      { label: '동법 시행령', query: '물의 재이용 촉진 및 지원에 관한 법률 시행령' },
      { label: '동법 시행규칙', query: '물의 재이용 촉진 및 지원에 관한 법률 시행규칙' },
    ],
  },
  // ── 인허가 관련 ──
  {
    label: '환경영향평가법',
    category: '인허가',
    sub: [
      { label: '환경영향평가법', query: '환경영향평가법' },
      { label: '환경영향평가법 시행령', query: '환경영향평가법 시행령' },
      { label: '환경영향평가법 시행규칙', query: '환경영향평가법 시행규칙' },
    ],
  },
  {
    label: '건설기술진흥법',
    category: '인허가',
    sub: [
      { label: '건설기술 진흥법', query: '건설기술 진흥법' },
      { label: '건설기술 진흥법 시행령', query: '건설기술 진흥법 시행령' },
      { label: '건설기술 진흥법 시행규칙', query: '건설기술 진흥법 시행규칙' },
    ],
  },
  {
    label: '도로법',
    category: '인허가',
    sub: [
      { label: '도로법', query: '도로법' },
      { label: '도로법 시행령', query: '도로법 시행령' },
      { label: '도로법 시행규칙', query: '도로법 시행규칙' },
    ],
  },
  {
    label: '하천법',
    category: '인허가',
    sub: [
      { label: '하천법', query: '하천법' },
      { label: '하천법 시행령', query: '하천법 시행령' },
      { label: '하천법 시행규칙', query: '하천법 시행규칙' },
    ],
  },
  {
    label: '농지법',
    category: '인허가',
    sub: [
      { label: '농지법', query: '농지법' },
      { label: '농지법 시행령', query: '농지법 시행령' },
      { label: '농지법 시행규칙', query: '농지법 시행규칙' },
    ],
  },
  {
    label: '산지관리법',
    category: '인허가',
    sub: [
      { label: '산지관리법', query: '산지관리법' },
      { label: '산지관리법 시행령', query: '산지관리법 시행령' },
      { label: '산지관리법 시행규칙', query: '산지관리법 시행규칙' },
    ],
  },
  {
    label: '소하천정비법',
    category: '인허가',
    sub: [
      { label: '소하천정비법', query: '소하천정비법' },
      { label: '소하천정비법 시행령', query: '소하천정비법 시행령' },
      { label: '소하천정비법 시행규칙', query: '소하천정비법 시행규칙' },
    ],
  },
  {
    label: '공유수면법',
    category: '인허가',
    sub: [
      { label: '공유수면 관리 및 매립에 관한 법률', query: '공유수면 관리 및 매립에 관한 법률' },
      { label: '동법 시행령', query: '공유수면 관리 및 매립에 관한 법률 시행령' },
      { label: '동법 시행규칙', query: '공유수면 관리 및 매립에 관한 법률 시행규칙' },
    ],
  },
  {
    label: '국토계획법',
    category: '인허가',
    sub: [
      { label: '국토의 계획 및 이용에 관한 법률', query: '국토의 계획 및 이용에 관한 법률' },
      { label: '동법 시행령', query: '국토의 계획 및 이용에 관한 법률 시행령' },
      { label: '동법 시행규칙', query: '국토의 계획 및 이용에 관한 법률 시행규칙' },
    ],
  },
  {
    label: '토지보상법',
    category: '인허가',
    sub: [
      { label: '공익사업을 위한 토지 등의 취득 및 보상에 관한 법률', query: '공익사업을 위한 토지 등의 취득 및 보상에 관한 법률' },
      { label: '동법 시행령', query: '공익사업을 위한 토지 등의 취득 및 보상에 관한 법률 시행령' },
      { label: '동법 시행규칙', query: '공익사업을 위한 토지 등의 취득 및 보상에 관한 법률 시행규칙' },
    ],
  },
  {
    label: '사방사업법',
    category: '인허가',
    sub: [
      { label: '사방사업법', query: '사방사업법' },
      { label: '사방사업법 시행령', query: '사방사업법 시행령' },
      { label: '사방사업법 시행규칙', query: '사방사업법 시행규칙' },
    ],
  },
  {
    label: '초지법',
    category: '인허가',
    sub: [
      { label: '초지법', query: '초지법' },
      { label: '초지법 시행령', query: '초지법 시행령' },
      { label: '초지법 시행규칙', query: '초지법 시행규칙' },
    ],
  },
  {
    label: '산림보호법',
    category: '인허가',
    sub: [
      { label: '산림보호법', query: '산림보호법' },
      { label: '산림보호법 시행령', query: '산림보호법 시행령' },
      { label: '산림보호법 시행규칙', query: '산림보호법 시행규칙' },
    ],
  },
  {
    label: '자연공원법',
    category: '인허가',
    sub: [
      { label: '자연공원법', query: '자연공원법' },
      { label: '자연공원법 시행령', query: '자연공원법 시행령' },
      { label: '자연공원법 시행규칙', query: '자연공원법 시행규칙' },
    ],
  },
  {
    label: '문화재보호법',
    category: '인허가',
    sub: [
      { label: '문화재보호법', query: '문화재보호법' },
      { label: '문화재보호법 시행령', query: '문화재보호법 시행령' },
      { label: '문화재보호법 시행규칙', query: '문화재보호법 시행규칙' },
    ],
  },
  {
    label: '개발제한구역법',
    category: '인허가',
    sub: [
      { label: '개발제한구역의 지정 및 관리에 관한 특별조치법', query: '개발제한구역의 지정 및 관리에 관한 특별조치법' },
      { label: '동법 시행령', query: '개발제한구역의 지정 및 관리에 관한 특별조치법 시행령' },
      { label: '동법 시행규칙', query: '개발제한구역의 지정 및 관리에 관한 특별조치법 시행규칙' },
    ],
  },
  {
    label: '군사시설보호법',
    category: '인허가',
    sub: [
      { label: '군사기지 및 군사시설 보호법', query: '군사기지 및 군사시설 보호법' },
      { label: '동법 시행령', query: '군사기지 및 군사시설 보호법 시행령' },
      { label: '동법 시행규칙', query: '군사기지 및 군사시설 보호법 시행규칙' },
    ],
  },
  {
    label: '도시공원법',
    category: '인허가',
    sub: [
      { label: '도시공원 및 녹지 등에 관한 법률', query: '도시공원 및 녹지 등에 관한 법률' },
      { label: '동법 시행령', query: '도시공원 및 녹지 등에 관한 법률 시행령' },
      { label: '동법 시행규칙', query: '도시공원 및 녹지 등에 관한 법률 시행규칙' },
    ],
  },
  {
    label: '장사법',
    category: '인허가',
    sub: [
      { label: '장사 등에 관한 법률', query: '장사 등에 관한 법률' },
      { label: '동법 시행령', query: '장사 등에 관한 법률 시행령' },
      { label: '동법 시행규칙', query: '장사 등에 관한 법률 시행규칙' },
    ],
  },
  {
    label: '건설산업기본법',
    category: '인허가',
    sub: [
      { label: '건설산업기본법', query: '건설산업기본법' },
      { label: '건설산업기본법 시행령', query: '건설산업기본법 시행령' },
      { label: '건설산업기본법 시행규칙', query: '건설산업기본법 시행규칙' },
    ],
  },
  {
    label: '산업안전보건법',
    category: '인허가',
    sub: [
      { label: '산업안전보건법', query: '산업안전보건법' },
      { label: '산업안전보건법 시행령', query: '산업안전보건법 시행령' },
      { label: '산업안전보건법 시행규칙', query: '산업안전보건법 시행규칙' },
    ],
  },
  // ── 조례 ──
  {
    label: '주요 조례',
    category: '조례',
    sub: [
      { label: '하수도 사용 조례', query: '하수도 사용 조례' },
      { label: '수도 급수 조례', query: '수도 급수 조례' },
      { label: '도로 굴착 복구', query: '도로 굴착 복구' },
    ],
  },
];

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  '상수도': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-400' },
  '하수도': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-400' },
  '공통':   { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' },
  '인허가': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
  '조례':   { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-400' },
};

// ============================================================
// 시방서 목록
// ============================================================
const SPECIFICATIONS = [
  // ── 상수도 직접 관련 ──
  { label: '상수도공사 표준시방서', description: '취수·정수·송배수·급수 시설 시공', category: '상수도',
    relatedLaws: ['수도법', '수도법 시행령', '수도시설의 청소 및 위생관리 등에 관한 규칙'],
    publisher: '환경부', note: '상수도 시설 설치·유지관리 시공기준' },
  { label: '수도용 자재·제품 시방서', description: '수도관·밸브·이음관 자재 기준', category: '상수도',
    relatedLaws: ['수도법', '수도용 자재와 제품의 위생안전기준 인증 등에 관한 규칙'],
    publisher: '환경부', note: '수도 자재 품질·위생안전 기준' },
  { label: '상수관로 갱생공사 시방서', description: '노후관 세척·라이닝·갱생 기준', category: '상수도',
    relatedLaws: ['수도법', '수도법 시행규칙'],
    publisher: '환경부', note: '노후 상수관 갱생 공법 시공기준' },
  // ── 하수도 직접 관련 ──
  { label: '하수도공사 표준시방서', description: '하수관로·맨홀·우수시설 시공', category: '하수도',
    relatedLaws: ['하수도법', '하수도법 시행령', '하수도법 시행규칙'],
    publisher: '환경부', note: '하수관로·맨홀 시공 표준' },
  { label: '하수관로 비굴착공사 시방서', description: '추진·관삽입·반전경화 비굴착 공법', category: '하수도',
    relatedLaws: ['하수도법', '하수도법 시행령'],
    publisher: '환경부', note: '비굴착 보수·보강 공법 기준' },
  { label: '하수관로 정비사업 시방서', description: '하수관로 조사·진단·보수·보강', category: '하수도',
    relatedLaws: ['하수도법', '하수도법 시행규칙'],
    publisher: '환경부', note: '하수관로 정비 조사·진단 기준' },
  { label: '하수처리시설 표준시방서', description: '하수처리장·슬러지처리 시공', category: '하수도',
    relatedLaws: ['하수도법', '물환경보전법'],
    publisher: '환경부', note: '하수처리장 시설 시공기준' },
  { label: '물재이용시설 시방서', description: '중수도·빗물이용·하수재이용 시설', category: '하수도',
    relatedLaws: ['물의 재이용 촉진 및 지원에 관한 법률'],
    publisher: '환경부', note: '중수도·빗물이용 시설 설치기준' },
  // ── 상하수도 공통 (토목·구조) ──
  { label: '토목공사 표준시방서', description: '토공·기초·포장 등 토목 일반', category: '공통',
    relatedLaws: ['건설기술 진흥법', '건설기술 진흥법 시행령'],
    publisher: '국토교통부', note: '토목 일반 시공 표준' },
  { label: '콘크리트 표준시방서', description: '콘크리트 배합·타설·양생 기준', category: '공통',
    relatedLaws: ['건설기술 진흥법'],
    publisher: '국토교통부', note: '콘크리트 구조물 시공 표준' },
  { label: '건설공사 표준시방서', description: '건설공사 일반 시공 기준', category: '공통',
    relatedLaws: ['건설기술 진흥법', '건설산업기본법'],
    publisher: '국토교통부', note: '건설공사 시공 일반 기준' },
  { label: '도로공사 표준시방서', description: '도로 복구·포장·부대시설', category: '공통',
    relatedLaws: ['도로법', '도로법 시행령'],
    publisher: '국토교통부', note: '도로 시공·복구 기준' },
  { label: '터널공사 표준시방서', description: '개착·추진 터널 (관로 횡단)', category: '공통',
    relatedLaws: ['시설물의 안전 및 유지관리에 관한 특별법'],
    publisher: '국토교통부', note: '터널 시공·안전 기준' },
  { label: '가시설 안전기준 시방서', description: '흙막이·가물막이·가설구조물', category: '공통',
    relatedLaws: ['산업안전보건법', '산업안전보건기준에 관한 규칙'],
    publisher: '고용노동부', note: '가시설 안전 설치·해체 기준' },
];

// ============================================================
// 설계기준 (KDS) 목록 — 실제 국가건설기준 코드 체계
// ============================================================
interface DesignStandard {
  label: string;
  code: string;
  description: string;
  query: string;
  sourceFilter: string;  // knowledge_base source 필터
  category: '상수도' | '하수도' | '공통';
  docId?: string;        // DocViewerModal 연동용 문서 ID
}

const DESIGN_STANDARDS: DesignStandard[] = [
  // ── 상수도 (KDS 57) ──
  { label: 'KDS 57 00 00', code: 'KDS 57', description: '상수도설계기준 (통합본, 2024)', query: '적용범위', sourceFilter: '상수도설계기준', category: '상수도', docId: 'kds-57' },
  { label: 'KDS 57 10 00', code: 'KDS 57 10', description: '상수도설계 일반사항', query: '일반사항', sourceFilter: '상수도설계기준', category: '상수도', docId: 'kds-57' },
  { label: 'KDS 57 17 00', code: 'KDS 57 17', description: '상수도 내진설계', query: '내진', sourceFilter: '상수도설계기준', category: '상수도', docId: 'kds-57' },
  { label: 'KDS 57 20 00', code: 'KDS 57 20', description: '취수시설', query: '취수', sourceFilter: '상수도설계기준', category: '상수도', docId: 'kds-57' },
  { label: 'KDS 57 30 00', code: 'KDS 57 30', description: '도수·송수·배수시설', query: '송수', sourceFilter: '상수도설계기준', category: '상수도', docId: 'kds-57' },
  { label: 'KDS 57 40 00', code: 'KDS 57 40', description: '급수시설', query: '급수', sourceFilter: '상수도설계기준', category: '상수도', docId: 'kds-57' },
  { label: 'KDS 57 55 00', code: 'KDS 57 55', description: '정수시설', query: '정수', sourceFilter: '상수도설계기준', category: '상수도', docId: 'kds-57' },
  { label: 'KDS 57 60 00', code: 'KDS 57 60', description: '펌프장시설', query: '펌프', sourceFilter: '상수도설계기준', category: '상수도', docId: 'kds-57' },
  { label: 'KDS 57 70 00', code: 'KDS 57 70', description: '기타 수도시설', query: '배수지', sourceFilter: '상수도설계기준', category: '상수도', docId: 'kds-57' },

  // ── 하수도 (KDS 61) ──
  { label: 'KDS 61 00 00', code: 'KDS 61', description: '하수도설계기준 (통합본, 2022)', query: '적용범위', sourceFilter: '하수도설계기준', category: '하수도', docId: 'kds-61' },
  { label: 'KDS 61 10 00', code: 'KDS 61 10', description: '하수도설계 일반사항', query: '일반사항', sourceFilter: '하수도설계기준', category: '하수도', docId: 'kds-61' },
  { label: 'KDS 61 30 00', code: 'KDS 61 30', description: '하수관로시설', query: '관로', sourceFilter: '하수도설계기준', category: '하수도', docId: 'kds-61' },
  { label: 'KDS 61 40 00', code: 'KDS 61 40', description: '하수처리시설', query: '하수처리', sourceFilter: '하수도설계기준', category: '하수도', docId: 'kds-61' },
  { label: 'KDS 61 50 00', code: 'KDS 61 50', description: '하수 펌프장시설', query: '펌프', sourceFilter: '하수도설계기준', category: '하수도', docId: 'kds-61' },
  { label: 'KDS 61 55 00', code: 'KDS 61 55', description: '슬러지 처리시설', query: '슬러지', sourceFilter: '하수도설계기준', category: '하수도', docId: 'kds-61' },
  { label: 'KDS 61 60 00', code: 'KDS 61 60', description: '물재이용시설', query: '재이용', sourceFilter: '하수도설계기준', category: '하수도', docId: 'kds-61' },

  // ── 공통 ──
  { label: 'KDS 14 20 00', code: 'KDS 14 20', description: '콘크리트 구조 설계기준', query: '콘크리트', sourceFilter: '', category: '공통' },
  { label: 'KDS 11 50 05', code: 'KDS 11 50', description: '기초구조 설계기준', query: '기초', sourceFilter: '', category: '공통' },
];

// ============================================================
// LawNavigator 컴포넌트
// ============================================================
export function LawNavigator({ fullWidth = false, onContextChange, onOpenDocViewer }: { fullWidth?: boolean; onContextChange?: (ctx: string) => void; onOpenDocViewer?: (docId: string, page?: number) => void } = {}) {
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

  // 시방서 상세 뷰
  const [selectedSpec, setSelectedSpec] = useState<typeof SPECIFICATIONS[0] | null>(null);

  // KDS 검색 결과
  const [kdsResults, setKdsResults] = useState<Array<{ id: string; source: string; section: string | null; page: number | null; content: string }>>([]);
  const [kdsSearchQuery, setKdsSearchQuery] = useState('');
  const [isKdsLoading, setIsKdsLoading] = useState(false);

  // 법령 바로가기 아코디언 — 펼쳐진 그룹 label
  const [expandedLawGroup, setExpandedLawGroup] = useState<string | null>(null);
  const [kdsHasSearched, setKdsHasSearched] = useState(false);
  const [kdsError, setKdsError] = useState<string | null>(null);

  // 글꼴 크기 조절 (small / medium / large)
  const [fontSize, setFontSize] = useState<FontSize>('medium');

  // 조문 목차 사이드바 상태 (조문 상세 뷰에서 표시)
  const [showToc, setShowToc] = useState(true);

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
      // 컨텍스트 전달: 법령명
      onContextChange?.(`[${data.info?.type || '법령'}] ${data.info?.name || lawName}`);
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
        onContextChange?.(`[${data.info?.type || '법령'}] ${data.info?.name || lawName}`);
      } catch (err2) {
        setError(err2 instanceof Error ? err2.message : '조문 조회 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [onContextChange]);

  // --------------------------------------------------------
  // 법령 바로가기 — 검색 후 정확 매칭 법령으로 자동 이동
  // --------------------------------------------------------
  const handleDirectAccess = useCallback(async (lawName: string) => {
    setIsLoading(true);
    setError(null);
    setSearchQuery(lawName);

    try {
      const data = await directSearchLaws(lawName.trim(), 1);
      const laws = data.laws || [];

      // 정확 매칭 찾기
      const exactMatch = laws.find(
        (law) => law.name === lawName || law.name === lawName.trim()
      );

      if (exactMatch) {
        // isLoading 유지한 채 handleSelectLaw로 넘김 (로딩 스피너 끊김 방지)
        handleSelectLaw(exactMatch.id, exactMatch.name);
        return;
      }

      // 정확 매칭 실패 → 검색 결과 목록 표시 (fallback)
      setSearchResults(laws);
      setTotalCount(data.totalCount);
      setHasSearched(true);
      setViewState('search');
    } catch {
      try {
        const res = await fetch(`/api/law?q=${encodeURIComponent(lawName.trim())}&page=1`);
        if (!res.ok) throw new Error(`검색 실패`);
        const data = await res.json();
        const laws: LawItem[] = data.laws || [];
        const exactMatch = laws.find((law) => law.name === lawName.trim());

        if (exactMatch) {
          handleSelectLaw(exactMatch.id, exactMatch.name);
          return;
        }

        setSearchResults(laws);
        setTotalCount(data.totalCount || 0);
        setHasSearched(true);
        setViewState('search');
      } catch (err2) {
        setError(err2 instanceof Error ? err2.message : '법령 조회 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [handleSelectLaw]);

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
  // 시방서 → 관련 법령 검색 (법령 탭으로 전환)
  // --------------------------------------------------------
  const handleSpecLawSearch = useCallback((lawName: string) => {
    setActiveTab('law');
    setSearchOriginTab('law');
    setSearchQuery(lawName);
    handleSearch(lawName);
  }, [handleSearch]);

  // --------------------------------------------------------
  // KDS 설계기준 검색 (knowledge_base 텍스트 검색)
  // --------------------------------------------------------
  const handleKdsSearch = useCallback(async (query: string, source?: string) => {
    setIsKdsLoading(true);
    setKdsSearchQuery(query);
    setKdsError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (source) params.set('source', source);
      params.set('limit', '20');
      const res = await fetch(`/api/kds-search?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `KDS 검색 실패 (${res.status})`);
      }
      const data = await res.json();
      setKdsResults(data.results || []);
      setKdsHasSearched(true);
    } catch (err) {
      console.error('[KDS] 검색 오류:', err);
      setKdsResults([]);
      setKdsHasSearched(true);
      setKdsError(err instanceof Error ? err.message : 'KDS 검색 오류');
    } finally {
      setIsKdsLoading(false);
    }
  }, []);

  // --------------------------------------------------------
  // 시방서/설계기준 탭에서 검색 시작 (법령 탭 전용)
  // --------------------------------------------------------
  const handleTabSearch = useCallback((query: string, fromTab: PanelTab) => {
    setSearchOriginTab(fromTab);
    setSearchQuery(query);
    handleSearch(query);
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
    setSelectedSpec(null);
    setKdsResults([]);
    setKdsSearchQuery('');
    setKdsHasSearched(false);
    setKdsError(null);
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

          {/* 조문 목록 뷰 — 목차 사이드바 + 글꼴 조절 */}
          {viewState === 'articles' && lawDetail && (
            <div className="flex flex-col h-full">
              {/* 법령 헤더 */}
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

              {/* 툴바: 3단비교 + 조문 수 + 글꼴 조절 */}
              <div className="px-3 py-2 flex items-center justify-between border-b border-slate-100 gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">조문 {lawDetail.articles.length}개</span>
                  {/* 글꼴 크기 조절 */}
                  <div className="flex items-center gap-0.5 border border-slate-200 rounded-md overflow-hidden">
                    {([['small', '가', '작게'], ['medium', '가', '보통'], ['large', '가', '크게']] as const).map(([size, label, title]) => (
                      <button
                        key={size}
                        onClick={() => setFontSize(size as FontSize)}
                        className={`px-1.5 py-0.5 transition-colors ${
                          fontSize === size
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-slate-500 hover:bg-slate-100'
                        }`}
                        title={title}
                        style={{ fontSize: size === 'small' ? '10px' : size === 'medium' ? '12px' : '14px' }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleThreeWayCompare(lawDetail.info.id)}
                  disabled={isLoading}
                  className="text-xs px-3 py-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors font-semibold disabled:opacity-50 shadow-sm shrink-0"
                  title="법률 ↔ 시행령 ↔ 시행규칙 3단비교"
                >
                  📊 3단비교
                </button>
              </div>

              {lawDetail.articles.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">조문 정보가 없습니다.</div>
              ) : (
                <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
                    {lawDetail.articles.map((article, idx) => (
                      <li key={`${article.number}-${idx}`}>
                        <button
                          onClick={() => {
                            setSelectedArticle(article);
                            setViewState('article-detail');
                            const lawName = lawDetail?.info?.name || '';
                            const artText = `[${lawName}] 제${article.number}조 ${article.title || ''}\n${article.content}`;
                            const parasText = article.paragraphs?.map(p => `${p.number} ${p.content}`).join('\n') || '';
                            onContextChange?.(artText + (parasText ? '\n' + parasText : ''));
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors group"
                        >
                          <div className="flex items-baseline gap-1.5">
                            <span className={`text-blue-600 font-mono shrink-0 ${fontSize === 'small' ? 'text-[10px]' : fontSize === 'large' ? 'text-xs' : 'text-[11px]'}`}>제{article.number}조</span>
                            {article.title && (
                              <span className={`text-slate-700 group-hover:text-blue-700 truncate ${fontSize === 'small' ? 'text-[11px]' : fontSize === 'large' ? 'text-sm' : 'text-xs'}`}>{article.title}</span>
                            )}
                          </div>
                          {article.content && (
                            <p className={`text-slate-400 mt-0.5 line-clamp-2 leading-relaxed ${fontSize === 'small' ? 'text-[9px]' : fontSize === 'large' ? 'text-[11px]' : 'text-[10px]'}`}>
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

          {/* 조문 상세 뷰 — 목차 사이드바 포함 */}
          {viewState === 'article-detail' && selectedArticle && (
            <ArticleDetailView
              article={selectedArticle}
              lawName={lawDetail?.info.name}
              fontSize={fontSize}
              allArticles={lawDetail?.articles}
              onSelectArticle={(art) => {
                setSelectedArticle(art);
                const ln = lawDetail?.info?.name || '';
                const artText = `[${ln}] 제${art.number}조 ${art.title || ''}\n${art.content}`;
                const parasText = art.paragraphs?.map(p => `${p.number} ${p.content}`).join('\n') || '';
                onContextChange?.(artText + (parasText ? '\n' + parasText : ''));
              }}
              showToc={showToc}
              onToggleToc={() => setShowToc(!showToc)}
            />
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
    <div className={`flex ${fullWidth ? 'flex-row' : 'flex-col'} h-full`}>
      {/* 탭 버튼 — fullWidth: 좌측 세로 사이드바 / 기본: 상단 가로 */}
      <div className={fullWidth
        ? 'flex flex-col w-44 shrink-0 border-r border-slate-200 bg-slate-50/50 pt-3'
        : 'flex border-b border-slate-200'
      }>
        {fullWidth && (
          <div className="px-4 pb-3 mb-1 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-800">참고 문서</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">법령 · 시방서 · 설계기준</p>
          </div>
        )}
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
                handleBackToTabHome();
              }}
              className={fullWidth
                ? `w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${
                    activeTab === key
                      ? 'text-blue-700 bg-blue-50 border-r-2 border-blue-500'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  }`
                : `flex-1 px-2 py-2 text-xs font-medium transition-colors ${
                    activeTab === key
                      ? 'text-blue-700 border-b-2 border-blue-500 bg-blue-50/50'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`
              }
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden">

      {/* 시방서 탭 — 목록 */}
      {activeTab === 'specification' && !selectedSpec && (
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-sm font-bold text-slate-700 mb-1">상하수도 관련 시방서</p>
          <p className="text-xs text-slate-400 mb-4">클릭하면 시방서 정보와 관련 법령을 확인할 수 있습니다.</p>
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
              <div key={cat} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{iconMap[cat]}</span>
                  <p className={`text-sm font-bold ${c.text}`}>{cat}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.badge}`}>{items.length}</span>
                </div>
                <div className="space-y-1.5">
                  {items.map((spec) => (
                    <button
                      key={spec.label}
                      onClick={() => setSelectedSpec(spec)}
                      className={`w-full text-left px-4 py-3 bg-white border ${c.border} rounded-xl
                                 ${c.hover} transition-colors group`}
                    >
                      <p className={`text-sm font-medium text-slate-700 group-hover:${c.text}`}>{spec.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{spec.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 시방서 탭 — 상세 뷰 */}
      {activeTab === 'specification' && selectedSpec && !hasSearched && (
        <div className="flex-1 overflow-y-auto p-3">
          <button
            onClick={() => setSelectedSpec(null)}
            className="text-sm text-blue-600 hover:text-blue-800 mb-3 flex items-center gap-1 font-medium"
          >
            ← 시방서 목록
          </button>
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
            <p className="text-base font-bold text-slate-800">{selectedSpec.label}</p>
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{selectedSpec.description}</p>
            <div className="mt-3 flex gap-2 flex-wrap">
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
                {selectedSpec.category}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 font-medium">
                {selectedSpec.publisher}
              </span>
            </div>
            {selectedSpec.note && (
              <p className="text-xs text-slate-400 mt-3 leading-relaxed">{selectedSpec.note}</p>
            )}
          </div>

          {/* 관련 법령 — 시방서 탭 내에서 검색 */}
          <div className="mb-4">
            <p className="text-sm font-bold text-slate-600 mb-2">관련 법령 조회</p>
            <div className="space-y-1.5">
              {selectedSpec.relatedLaws.map((law) => (
                <button
                  key={law}
                  onClick={() => {
                    setSearchOriginTab('specification');
                    setSearchQuery(law);
                    handleSearch(law);
                  }}
                  className="w-full text-left px-4 py-3 bg-blue-50/50 border border-blue-100 rounded-xl
                             hover:bg-blue-100/60 hover:border-blue-200 transition-colors text-sm text-blue-700 font-medium
                             flex items-center justify-between"
                >
                  <span>⚖️ {law}</span>
                  <span className="text-xs text-blue-400">조문 보기 →</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-700 leading-relaxed">
              <strong>시방서 원문</strong>은 국가건설기준센터(KCSC) 또는 각 소관부처에서 확인할 수 있습니다.
              위 관련 법령을 클릭하면 <strong>이 탭 안에서</strong> 법제처 조문을 검색합니다.
            </p>
          </div>
        </div>
      )}

      {/* 시방서 탭 — 관련 법령 검색 결과 (탭 전환 없이 시방서 탭 내에서 표시) */}
      {activeTab === 'specification' && selectedSpec && hasSearched && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 pt-3 pb-1">
            <button
              onClick={() => {
                setSearchResults([]);
                setSearchQuery('');
                setHasSearched(false);
                setLawDetail(null);
                setSelectedArticle(null);
                setThreeWayResult(null);
                setViewState('search');
              }}
              className="text-sm text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1 font-medium"
            >
              ← {selectedSpec.label}
            </button>
          </div>
          {renderSearchAndDetail()}
        </div>
      )}

      {/* 설계기준 탭 — 목록 + 검색바 */}
      {activeTab === 'design-standard' && !kdsHasSearched && !isKdsLoading && (
        <div className="flex-1 overflow-y-auto">
          {/* 검색바 */}
          <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 px-3 pt-3 pb-2 border-b border-slate-100">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = (e.target as HTMLFormElement).elements.namedItem('kds-q') as HTMLInputElement;
                if (input?.value.trim()) handleKdsSearch(input.value.trim(), '');
              }}
              className="flex gap-2"
            >
              <input
                name="kds-q"
                type="text"
                placeholder="설계기준 내용 검색 (예: 관로 매설 깊이)"
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-300
                           placeholder:text-slate-400"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg
                           hover:bg-green-700 transition-colors shrink-0"
              >
                검색
              </button>
            </form>
            <p className="text-[10px] text-slate-400 mt-1.5">
              Supabase 임베딩 1,436청크에서 텍스트 검색 · 항목 클릭으로도 검색 가능
            </p>
          </div>

          {/* 카테고리별 KDS 목록 */}
          <div className="p-3 space-y-4">
            {(['상수도', '하수도', '공통'] as const).map((cat) => {
              const items = DESIGN_STANDARDS.filter((s) => s.category === cat);
              if (items.length === 0) return null;
              const colorMap = {
                '상수도': { dot: 'bg-blue-500', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', border: 'border-blue-200', hover: 'hover:border-blue-300 hover:bg-blue-50/50' },
                '하수도': { dot: 'bg-teal-500', text: 'text-teal-700', badge: 'bg-teal-100 text-teal-700', border: 'border-teal-200', hover: 'hover:border-teal-300 hover:bg-teal-50/50' },
                '공통':   { dot: 'bg-slate-400', text: 'text-slate-600', badge: 'bg-slate-200 text-slate-600', border: 'border-slate-200', hover: 'hover:border-slate-300 hover:bg-slate-50/80' },
              };
              const c = colorMap[cat];
              const iconMap = { '상수도': '💧', '하수도': '🔄', '공통': '🔧' };
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                    <span className={`text-sm font-bold ${c.text}`}>{iconMap[cat]} {cat}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.badge}`}>{items.length}</span>
                  </div>
                  <div className="space-y-1.5 ml-4">
                    {items.map((std) => (
                      <div
                        key={std.label}
                        className={`px-4 py-3 bg-white border ${c.border} rounded-xl
                                   ${c.hover} transition-colors group`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-md ${c.badge} font-mono font-bold shrink-0`}>
                            {std.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{std.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => handleKdsSearch(std.query, std.sourceFilter)}
                            className="text-[11px] px-2.5 py-1 rounded-md bg-slate-100 text-slate-600
                                       hover:bg-slate-200 transition-colors font-medium"
                          >
                            🔍 텍스트 검색
                          </button>
                          {std.docId && onOpenDocViewer && (
                            <button
                              onClick={() => onOpenDocViewer(std.docId!)}
                              className="text-[11px] px-2.5 py-1 rounded-md bg-green-100 text-green-700
                                         hover:bg-green-200 transition-colors font-medium"
                            >
                              📄 원문 열기
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 설계기준 탭 — 로딩 */}
      {activeTab === 'design-standard' && isKdsLoading && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin text-3xl mb-3">🔍</div>
            <p className="text-sm text-slate-500">KDS 설계기준 검색 중...</p>
          </div>
        </div>
      )}

      {/* 설계기준 탭 — 검색 결과 */}
      {activeTab === 'design-standard' && kdsHasSearched && !isKdsLoading && (
        <div className="flex-1 overflow-y-auto">
          {/* 상단 고정: 뒤로가기 + 재검색 */}
          <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 px-3 pt-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => { setKdsResults([]); setKdsSearchQuery(''); setKdsHasSearched(false); setKdsError(null); }}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium shrink-0"
              >
                ← 목록
              </button>
              {kdsResults.length > 0 && (
                <span className="text-xs text-slate-400">
                  &ldquo;{kdsSearchQuery}&rdquo; <strong className="text-green-600">{kdsResults.length}건</strong>
                </span>
              )}
            </div>
            {/* 재검색 바 */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = (e.target as HTMLFormElement).elements.namedItem('kds-q2') as HTMLInputElement;
                if (input?.value.trim()) handleKdsSearch(input.value.trim(), '');
              }}
              className="flex gap-2"
            >
              <input
                name="kds-q2"
                type="text"
                defaultValue={kdsSearchQuery}
                placeholder="다른 키워드로 재검색..."
                className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-300"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg
                           hover:bg-green-700 transition-colors shrink-0"
              >
                검색
              </button>
            </form>
          </div>

          <div className="p-3">
            {/* 에러 표시 */}
            {kdsError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-3">
                <p className="text-sm text-red-600 font-medium">{kdsError}</p>
                <p className="text-xs text-red-400 mt-1">Supabase 연결을 확인해주세요.</p>
              </div>
            )}

            {/* 0건 결과 */}
            {!kdsError && kdsResults.length === 0 && (
              <div className="text-center py-8">
                <div className="text-3xl mb-3 opacity-30">🔍</div>
                <p className="text-sm text-slate-500">&ldquo;{kdsSearchQuery}&rdquo;에 대한 결과가 없습니다.</p>
                <p className="text-xs text-slate-400 mt-1">다른 키워드로 검색해보세요.</p>
              </div>
            )}

            {/* 결과 카드 */}
            <div className="space-y-3">
              {kdsResults.map((item, idx) => (
                <KdsResultCard
                  key={item.id || idx}
                  item={item}
                  query={kdsSearchQuery}
                  onContextChange={onContextChange}
                  onOpenDocViewer={onOpenDocViewer}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 법령 탭 — 로딩 중 (바로가기에서 법령 진입 시) */}
      {activeTab === 'law' && isAtTabHome && isLoading && (
        <div className="flex-1 flex flex-col">
          {/* 검색바 유지 */}
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
                disabled={true}
                className="px-2.5 py-1.5 text-xs font-medium text-white bg-blue-500 rounded
                           opacity-50 cursor-not-allowed shrink-0"
              >
                ...
              </button>
            </form>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-slate-500 font-medium">{searchQuery || '법령'} 조회 중...</span>
              <span className="text-xs text-slate-400">법제처 API에서 조문을 불러오고 있습니다</span>
            </div>
          </div>
        </div>
      )}

      {/* 법령 탭 — 초기 상태 (바로가기 목록) — 로딩 중에는 숨김 */}
      {activeTab === 'law' && isAtTabHome && !isLoading && (
        <>
          {renderSearchAndDetail()}
          <div className="p-4">
            <h3 className="text-sm font-bold text-slate-800 mb-1">상하수도 설계 관련 법령</h3>
            <p className="text-xs text-slate-400 mb-4">
              법령을 클릭하면 법률·시행령·시행규칙을 바로 조회할 수 있습니다.
            </p>

            {/* 카테고리별 그룹 */}
            <div className="space-y-2">
              {(['상수도', '하수도', '공통', '인허가', '조례'] as const).map((cat) => {
                const groups = QUICK_LAW_GROUPS.filter((g) => g.category === cat);
                if (groups.length === 0) return null;
                const style = CATEGORY_STYLES[cat];
                return (
                  <div key={cat}>
                    {/* 카테고리 헤더 */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                      <span className={`text-xs font-semibold ${style.text}`}>{cat}</span>
                    </div>
                    {/* 법령 목록 */}
                    <div className="space-y-1 ml-4 mb-3">
                      {groups.map((group) => {
                        const isExpanded = expandedLawGroup === group.label;
                        return (
                          <div key={group.label}>
                            {/* 법령 그룹 헤더 — 클릭하면 펼침/접힘 */}
                            <button
                              onClick={() => setExpandedLawGroup(isExpanded ? null : group.label)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all ${
                                isExpanded
                                  ? `${style.bg} ${style.text} border ${style.border}`
                                  : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                              }`}
                            >
                              <span className="text-sm font-medium">{group.label}</span>
                              <svg
                                width="14" height="14" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                className={`transition-transform duration-200 text-slate-400 ${isExpanded ? 'rotate-180' : ''}`}
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>

                            {/* 펼쳐진 하위 법령 (법률/시행령/시행규칙) */}
                            {isExpanded && (
                              <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-slate-200 pl-3 pb-1">
                                {group.sub.map((item) => (
                                  <button
                                    key={item.query}
                                    onClick={() => {
                                      setSearchOriginTab('law');
                                      if (group.category === '조례') {
                                        // 조례는 검색 키워드로 검색
                                        setSearchQuery(item.query);
                                        handleSearch(item.query);
                                      } else {
                                        // 법령은 정확 매칭으로 바로 이동
                                        handleDirectAccess(item.label);
                                      }
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 text-sm text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors flex items-center gap-2"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 shrink-0">
                                      <path d="M9 18l6-6-6-6" />
                                    </svg>
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">
              법제처 Open API를 통해 대한민국 현행 법령을 실시간 검색합니다.
            </p>
          </div>
        </>
      )}

      {/* 법령 탭 — 검색 후 */}
      {activeTab === 'law' && !isAtTabHome && renderSearchAndDetail()}
      </div>{/* 콘텐츠 영역 닫기 */}
    </div>
  );
}

// ============================================================
// 조문 상세 뷰 — 좌측 목차 + 우측 본문 (모든 항 한번에 표시)
// ============================================================

/** 호/목 내용에서 앞에 붙은 번호 제거 (예: "1.  원수란..." → "원수란...") */
function stripLeadingNumber(content: string): string {
  return content.replace(/^\d+(?:의\d+)?\.\s*/, '').replace(/^[가-힣]\.\s*/, '');
}

function ArticleDetailView({ article, lawName, fontSize = 'medium', allArticles, onSelectArticle, showToc, onToggleToc }: {
  article: ArticleItem;
  lawName?: string;
  fontSize?: 'small' | 'medium' | 'large';
  allArticles?: ArticleItem[];
  onSelectArticle?: (art: ArticleItem) => void;
  showToc?: boolean;
  onToggleToc?: () => void;
}) {
  // 글꼴 크기 매핑
  const fs = {
    title: fontSize === 'small' ? 'text-xs' : fontSize === 'large' ? 'text-sm' : 'text-xs',
    body: fontSize === 'small' ? 'text-[11px]' : fontSize === 'large' ? 'text-sm' : 'text-xs',
    ho: fontSize === 'small' ? 'text-[10px]' : fontSize === 'large' ? 'text-[13px]' : 'text-[11px]',
    mok: fontSize === 'small' ? 'text-[10px]' : fontSize === 'large' ? 'text-[13px]' : 'text-[11px]',
    label: fontSize === 'small' ? 'text-[9px]' : fontSize === 'large' ? 'text-[11px]' : 'text-[10px]',
    meta: fontSize === 'small' ? 'text-[9px]' : fontSize === 'large' ? 'text-[11px]' : 'text-[10px]',
  };

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* 좌측 목차 사이드바 — 전체 조문 목록에서 현재 조문 하이라이트 */}
      {showToc && allArticles && allArticles.length > 0 && (
        <div className="w-40 shrink-0 border-r border-slate-200 bg-slate-50/80 overflow-y-auto custom-scrollbar flex flex-col">
          <div className="px-2 py-2 border-b border-slate-200 flex items-center justify-between">
            <p className="text-[10px] font-semibold text-slate-500">조문 목차</p>
            {onToggleToc && (
              <button onClick={onToggleToc} className="text-[10px] text-slate-400 hover:text-slate-600" title="목차 닫기">✕</button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {allArticles.map((art, idx) => {
              const isCurrent = art.number === article.number && art.title === article.title;
              return (
                <button
                  key={`toc-${art.number}-${idx}`}
                  onClick={() => onSelectArticle?.(art)}
                  className={`w-full text-left px-2 py-1 text-[10px] transition-colors truncate block leading-snug ${
                    isCurrent
                      ? 'bg-blue-100 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                  title={`제${art.number}조 ${art.title || ''}`}
                >
                  <span className="text-blue-500 font-mono">§{art.number}</span>
                  {art.title && <span className="ml-1">{art.title}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 우측 조문 본문 — 모든 항 한번에 표시 */}
      <div className="flex-1 overflow-y-auto">
        {/* 목차 토글 버튼 (목차가 닫혀있을 때) */}
        {!showToc && onToggleToc && (
          <button
            onClick={onToggleToc}
            className="mx-3 mt-2 mb-1 px-2 py-1 text-[10px] bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-md transition-colors"
          >
            ☰ 목차 열기
          </button>
        )}

        <div className="p-3">
          <div className="mb-3">
            <h4 className={`${fs.title} font-semibold text-slate-800`}>
              제{article.number}조
              {article.title && <span className="ml-1 font-normal">({article.title})</span>}
            </h4>
            {lawName && <p className={`${fs.meta} text-slate-400 mt-0.5`}>{lawName}</p>}
          </div>

          {/* 조문 본문 — 전체 표시 */}
          <div className={`${fs.body} text-slate-700 leading-relaxed whitespace-pre-wrap break-words`}>
            {article.content}
          </div>

          {/* 항 → 호 → 목 계층 렌더링 — 모든 항 한번에 표시 */}
          {article.paragraphs && article.paragraphs.length > 0 && (
            <div className="mt-3 space-y-2.5">
              {article.paragraphs.map((para, idx) => (
                <div key={`para-${idx}`} className="pl-3 border-l-2 border-blue-200">
                  {para.number && (
                    <span className={`inline-block ${fs.label} text-blue-600 font-semibold font-mono mb-0.5`}>
                      {para.number.match(/^\d+$/) ? `⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽⑾⑿⒀⒁⒂⒃⒄⒅⒆⒇`.charAt(parseInt(para.number) - 1) || `(${para.number})` : `[${para.number}항]`}
                    </span>
                  )}
                  <p className={`${fs.body} text-slate-700 leading-relaxed whitespace-pre-wrap`}>{para.content}</p>

                  {/* 호(號) */}
                  {para.items && para.items.length > 0 && (
                    <div className="mt-1.5 ml-2 space-y-1">
                      {para.items.map((item, hi) => (
                        <div key={`ho-${hi}`} className="pl-3 border-l-2 border-amber-200">
                          <div className="flex gap-1.5">
                            <span className={`${fs.label} text-amber-600 font-semibold font-mono shrink-0 mt-px`}>
                              {item.number.replace(/\.$/, '')}.
                            </span>
                            <p className={`${fs.ho} text-slate-600 leading-relaxed whitespace-pre-wrap`}>{stripLeadingNumber(item.content)}</p>
                          </div>

                          {/* 목(目) */}
                          {item.subItems && item.subItems.length > 0 && (
                            <div className="mt-1 ml-4 space-y-0.5">
                              {item.subItems.map((sub, mi) => (
                                <div key={`mok-${mi}`} className="flex gap-1.5">
                                  <span className={`${fs.label} text-purple-500 font-semibold shrink-0 mt-px`}>
                                    {sub.number.replace(/\.$/, '')}.
                                  </span>
                                  <p className={`${fs.mok} text-slate-500 leading-relaxed whitespace-pre-wrap`}>{stripLeadingNumber(sub.content)}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {article.enforcementDate && (
            <p className={`mt-3 ${fs.meta} text-slate-400`}>조문 시행일: {formatDate(article.enforcementDate)}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// KDS 검색 결과 카드 (가독성 강화)
// ============================================================

const KDS_CONTENT_MAX = 400;

function KdsResultCard({ item, query, onContextChange, onOpenDocViewer }: {
  item: { id: string; source: string; section: string | null; page: number | null; content: string };
  query: string;
  onContextChange?: (ctx: string) => void;
  onOpenDocViewer?: (docId: string, page?: number) => void;
}) {
  // source → docId 매핑
  const docId = item.source?.includes('상수도') ? 'kds-57' : item.source?.includes('하수도') ? 'kds-61' : null;
  const [expanded, setExpanded] = useState(false);
  const isLong = item.content.length > KDS_CONTENT_MAX;
  const displayContent = expanded || !isLong
    ? item.content
    : item.content.slice(0, KDS_CONTENT_MAX);

  // 키워드 하이라이트 (검색어를 <mark>로 감싸기)
  const highlightText = (text: string) => {
    if (!query || query.length < 2) return text;
    const keywords = query.split(/\s+/).filter((w) => w.length >= 2);
    if (keywords.length === 0) return text;
    const pattern = new RegExp(`(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = text.split(pattern);
    return parts.map((part, i) =>
      pattern.test(part)
        ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5 font-medium">{part}</mark>
        : part
    );
  };

  // 내용을 문단으로 나누기 (빈 줄 또는 "- 숫자 -" 패턴 기준)
  const formatContent = (text: string) => {
    // 페이지 구분자 ("- 3 -" 등) 제거
    const cleaned = text.replace(/^\s*-\s*\d+\s*-\s*$/gm, '').trim();
    // 빈 줄 기준으로 문단 분리
    const paragraphs = cleaned.split(/\n{2,}/).filter((p) => p.trim());

    if (paragraphs.length <= 1) {
      // 단일 문단 — 줄바꿈 기준으로 표시
      return (
        <div className="text-[13px] text-slate-700 leading-[1.8]">
          {highlightText(cleaned)}
        </div>
      );
    }

    return (
      <div className="space-y-2.5">
        {paragraphs.map((para, i) => (
          <p key={i} className="text-[13px] text-slate-700 leading-[1.8]">
            {highlightText(para.trim())}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* 출처 정보 헤더 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs px-2.5 py-1 rounded-md bg-green-100 text-green-700 font-mono font-bold shrink-0">
          {item.source?.replace('_', ' ')}
        </span>
        {item.section && (
          <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
            {item.section}
          </span>
        )}
        {item.page && (
          <span className="text-xs text-slate-400">
            p.{item.page}
          </span>
        )}
      </div>

      {/* 본문 — 문단 분리 + 키워드 하이라이트 */}
      <div className="relative">
        <div className={isLong && !expanded ? 'max-h-[180px] overflow-hidden' : ''}>
          {formatContent(displayContent)}
        </div>
        {isLong && !expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent" />
        )}
      </div>

      {/* 하단 액션 */}
      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100">
        {/* 더 보기 / 접기 */}
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            {expanded ? '▲ 접기' : `▼ 더 보기 (${item.content.length}자)`}
          </button>
        )}
        {/* 원문 보기 버튼 */}
        {docId && onOpenDocViewer && item.page && (
          <button
            onClick={() => onOpenDocViewer(docId, item.page!)}
            className="text-xs text-green-600 hover:text-green-800 font-medium flex items-center gap-1
                       px-2 py-1 rounded-md hover:bg-green-50 transition-colors"
          >
            📄 원문 p.{item.page}
          </button>
        )}
        {/* AI에게 질문 버튼 — 컨텍스트 전달 */}
        {onContextChange && (
          <button
            onClick={() => {
              const ctx = `[설계기준] ${item.source?.replace('_', ' ')}${item.section ? ` > ${item.section}` : ''}${item.page ? ` (p.${item.page})` : ''}\n\n${item.content.slice(0, 500)}`;
              onContextChange(ctx);
            }}
            className="ml-auto text-xs text-green-600 hover:text-green-800 font-medium flex items-center gap-1
                       px-2 py-1 rounded-md hover:bg-green-50 transition-colors"
          >
            💬 AI에게 질문
          </button>
        )}
      </div>
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
