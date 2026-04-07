# 통합 참고문서 뷰어 — Design Document

> **Summary**: KDS 설계기준 + KCS 표준시방서 + KWCS 전문시방서를 사전 변환 이미지로 열람하고, 계층형 목차 네비게이션으로 원하는 조항에 즉시 이동하는 전체화면 뷰어의 상세 설계
>
> **Project**: water-sewage-review
> **Version**: 0.2.0
> **Author**: AI 설계 검토 팀
> **Date**: 2026-04-01
> **Status**: Draft
> **Plan Reference**: `docs/01-plan/features/kds-viewer.plan.md`

---

## 1. Type Definitions

### 1.1 문서 카탈로그 타입 (`lib/docs/types.ts` — NEW)

```typescript
/** 문서 카테고리 */
export type DocCategory = 'kds' | 'kcs' | 'kwcs';

/** 분야 */
export type DocField = '상수도' | '하수도' | '공통';

/** 목차 항목 */
export interface TocItem {
  id: string;              // 고유 ID: "kds-57-10-00" 또는 "sec-1-1"
  title: string;           // "1.1 목적" 또는 "KDS 57 10 00 상수도설계 일반사항"
  page: number;            // PDF 기준 페이지 번호
  level: 1 | 2 | 3;       // 1=편/장, 2=절, 3=항
  children?: TocItem[];    // 하위 항목
}

/** 문서 엔트리 */
export interface DocEntry {
  id: string;              // "kds-57", "kcs-57-10-05"
  category: DocCategory;   // 'kds' | 'kcs' | 'kwcs'
  code: string;            // "KDS 57 00 00"
  title: string;           // "상수도설계기준"
  shortTitle: string;      // "상수도설계"
  field: DocField;         // '상수도' | '하수도' | '공통'
  version: string;         // "2024"
  totalPages: number;      // 186
  imageBasePath: string;   // Supabase Storage URL prefix
  toc: TocItem[];          // 계층형 목차
}

/** 뷰어 상태 */
export interface DocViewerState {
  isOpen: boolean;
  activeDocId: string | null;       // 현재 열람 중인 문서
  currentPage: number;              // 현재 페이지
  zoomLevel: number;                // 0.75 | 1.0 | 1.25 | 1.5
  activeTocId: string | null;       // TOC 하이라이트 중인 항목
  searchQuery: string;              // 뷰어 내 검색어
  searchResults: SearchResult[];    // 검색 결과
  tocCollapsed: boolean;            // TOC 사이드바 접힘
}

/** 검색 결과 (Supabase 연동) */
export interface SearchResult {
  chunkId: string;
  page: number | null;
  section: string | null;
  snippet: string;         // 매칭 텍스트 미리보기 (100자)
}
```

---

## 2. Component Architecture

### 2.1 컴포넌트 트리

```
app/page.tsx
  └── ResizableLayout
        ├── ChatPanel (왼쪽)
        ├── FilePanel (가운데)
        └── LawPanel (오른쪽)
              └── LawNavigator
                    ├── 시방서 탭 → [열기] 클릭 시 ──┐
                    ├── 설계기준 탭 → [열기] 클릭 시 ─┤
                    └── KdsResultCard [원문 보기] ────┤
                                                      ▼
                    DocViewerModal ◀── 전체화면 모달 (portal)
                      ├── DocViewerHeader        ← 상단바: 제목, 탭, 줌, 검색
                      ├── DocToc                 ← 좌측: 문서선택 + 목차
                      │     ├── DocSelector      ← 문서 목록 (상수도/하수도/공통)
                      │     └── TocTree          ← 계층형 목차 트리
                      └── DocPageViewer          ← 우측: 이미지 연속 스크롤
                            └── PageImage[]      ← <img loading="lazy">
```

### 2.2 컴포넌트 상세

#### DocViewerModal.tsx (진입점)

```typescript
// components/doc-viewer/DocViewerModal.tsx
interface DocViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDocId?: string;       // 열 때 어떤 문서부터 표시
  initialPage?: number;        // 특정 페이지로 바로 이동
}

/**
 * - ReactDOM.createPortal로 document.body에 렌더링
 * - z-index: 9999 (다른 모달 위에)
 * - ESC 키로 닫기
 * - 배경 클릭 시 닫기 안 함 (문서 열람 중 실수 방지)
 * - 상태: DocViewerState를 useState로 관리
 */
```

#### DocViewerHeader.tsx (상단바)

```typescript
// components/doc-viewer/DocViewerHeader.tsx
interface DocViewerHeaderProps {
  activeDoc: DocEntry | null;
  currentPage: number;
  totalPages: number;
  zoomLevel: number;
  onClose: () => void;
  onZoomChange: (level: number) => void;
  onPageChange: (page: number) => void;
  onSearch: (query: string) => void;
  onTocToggle: () => void;
  tocCollapsed: boolean;
}

/**
 * 레이아웃:
 * [← 닫기] [문서제목 (KDS 57, 2024)] [TOC ≡] [🔍 검색] [- 100% +] [p.3/186 이동]
 *
 * - 닫기: onClose 호출
 * - TOC 토글: 사이드바 접기/펼치기
 * - 검색: Supabase API 호출 → 결과 드롭다운
 * - 줌: 75%, 100%, 125%, 150% (4단계)
 * - 페이지: 현재 페이지 표시 + 숫자 입력 → 이동
 */
```

#### DocToc.tsx (좌측 사이드바)

```typescript
// components/doc-viewer/DocToc.tsx
interface DocTocProps {
  documents: DocEntry[];         // 전체 문서 목록
  activeDocId: string | null;    // 현재 선택된 문서
  activeTocId: string | null;    // 스크롤 위치에 따른 현재 TOC 항목
  onSelectDoc: (docId: string) => void;
  onSelectToc: (tocItem: TocItem) => void;
  collapsed: boolean;
}

/**
 * 2영역 구성:
 *
 * [영역 1: 문서 선택]
 *   ▼ 상수도
 *     📐 KDS 57 상수도설계기준
 *     📋 KCS 57-10 상수도공사 일반
 *     📋 KCS 57-30 관로 부설공사
 *   ▶ 하수도
 *   ▶ 공통
 *
 * [영역 2: 선택 문서 목차]
 *   ▼ 1. 일반사항  ← level 1 (굵은 글씨)
 *     1.1 목적      ← level 2
 *     1.2 적용범위   ← level 2, 현재 위치면 bg-blue-100
 *     1.3 참고기준
 *   ▶ 2. 조사 및 계획
 *   ▶ 3. 재료
 *   ▼ 4. 설계      ← 펼쳐진 상태
 *     4.1 수원       ← level 2
 *     4.1.1 강수특성  ← level 3
 *
 * 동작:
 * - 문서 클릭: onSelectDoc → DocPageViewer가 해당 문서 이미지 로드
 * - TOC 클릭: onSelectToc → DocPageViewer가 해당 페이지로 스크롤
 * - 스크롤 시: activeTocId가 변경 → 해당 항목 하이라이트 + 자동 스크롤
 *
 * 너비: 280px (접힘 시 0px, transition 300ms)
 */
```

#### DocPageViewer.tsx (우측 이미지 스크롤)

```typescript
// components/doc-viewer/DocPageViewer.tsx
interface DocPageViewerProps {
  doc: DocEntry | null;
  zoomLevel: number;
  targetPage?: number;           // 이동할 페이지 (변경 시 scrollIntoView)
  onCurrentPageChange: (page: number) => void;  // 스크롤 위치 → 현재 페이지
  onActiveTocChange: (tocId: string | null) => void; // 스크롤 위치 → TOC 항목
}

/**
 * 렌더링:
 * - doc.totalPages 만큼 <img> 태그 생성
 * - src: `${doc.imageBasePath}/page-${NNN}.webp`
 * - loading="lazy" (네이티브 지연 로딩)
 * - 각 이미지에 id="page-{N}" 부여 → scrollIntoView 타겟
 * - 페이지 간 구분선 + 페이지 번호 라벨
 *
 * 줌:
 * - 컨테이너에 CSS transform: scale(zoomLevel) 적용
 * - transform-origin: top center
 * - 스크롤 위치 보정: 줌 변경 시 현재 보고 있던 페이지 유지
 *
 * 스크롤 추적 (IntersectionObserver):
 * - 각 페이지 <img>에 observer 연결
 * - 뷰포트 중앙에 가장 가까운 페이지 → onCurrentPageChange
 * - 해당 페이지의 TOC 매핑 → onActiveTocChange
 *
 * 페이지 이동:
 * - targetPage 변경 감지 (useEffect)
 * - document.getElementById(`page-${targetPage}`)?.scrollIntoView({ behavior: 'smooth' })
 *
 * placeholder:
 * - 이미지 로딩 전 회색 박스 (aspect-ratio: 210/297, A4 비율)
 * - 로딩 스피너 또는 페이지 번호 텍스트
 */
```

---

## 3. Data Layer

### 3.1 문서 카탈로그 (`lib/docs/catalog.ts`)

```typescript
import { DocEntry } from './types';
import { TOC_KDS_57 } from './toc-kds-57';
import { TOC_KDS_61 } from './toc-kds-61';

const SUPABASE_STORAGE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL + '/storage/v1/object/public/doc-images';

export const DOC_CATALOG: DocEntry[] = [
  // ── 설계기준 (KDS) ──
  {
    id: 'kds-57',
    category: 'kds',
    code: 'KDS 57 00 00',
    title: '상수도설계기준',
    shortTitle: '상수도설계',
    field: '상수도',
    version: '2024',
    totalPages: 186,
    imageBasePath: `${SUPABASE_STORAGE_URL}/kds-57`,
    toc: TOC_KDS_57,
  },
  {
    id: 'kds-61',
    category: 'kds',
    code: 'KDS 61 00 00',
    title: '하수도설계기준',
    shortTitle: '하수도설계',
    field: '하수도',
    version: '2022',
    totalPages: 242,
    imageBasePath: `${SUPABASE_STORAGE_URL}/kds-61`,
    toc: TOC_KDS_61,
  },
  // ── 표준시방서 (KCS) — PDF 확보 후 추가 ──
  // { id: 'kcs-57-10-05', ... },
];

/** ID로 문서 조회 */
export function getDocById(id: string): DocEntry | undefined {
  return DOC_CATALOG.find(d => d.id === id);
}

/** 분야별 문서 그룹핑 */
export function getDocsByField(): Record<DocField, DocEntry[]> {
  return {
    '상수도': DOC_CATALOG.filter(d => d.field === '상수도'),
    '하수도': DOC_CATALOG.filter(d => d.field === '하수도'),
    '공통': DOC_CATALOG.filter(d => d.field === '공통'),
  };
}

/** 카테고리별 문서 */
export function getDocsByCategory(category: DocCategory): DocEntry[] {
  return DOC_CATALOG.filter(d => d.category === category);
}
```

### 3.2 KDS 목차 예시 (`lib/docs/toc-kds-57.ts`)

```typescript
import { TocItem } from './types';

export const TOC_KDS_57: TocItem[] = [
  {
    id: 'kds-57-10-00',
    title: 'KDS 57 10 00 상수도설계 일반사항',
    page: 1,
    level: 1,
    children: [
      { id: 'sec-57-1-1', title: '1.1 목적', page: 1, level: 2 },
      { id: 'sec-57-1-2', title: '1.2 적용범위', page: 1, level: 2 },
      { id: 'sec-57-1-3', title: '1.3 참고기준', page: 2, level: 2 },
      { id: 'sec-57-1-4', title: '1.4 용어의 정의', page: 2, level: 2 },
      { id: 'sec-57-1-5', title: '1.5 기호의 정의', page: 3, level: 2 },
      { id: 'sec-57-1-6', title: '1.6 상수도시설 계획의 기본적 개념', page: 4, level: 2 },
      { id: 'sec-57-1-7', title: '1.7 시설의 개량·교체 등', page: 10, level: 2 },
    ],
  },
  {
    id: 'kds-57-17-00',
    title: 'KDS 57 17 00 상수도 내진설계',
    page: 12,
    level: 1,
    children: [
      { id: 'sec-57-17-1', title: '1.1 목적', page: 12, level: 2 },
      { id: 'sec-57-17-2', title: '1.2 적용범위', page: 12, level: 2 },
      // ...
    ],
  },
  // ... KDS 57 31 00 ~ KDS 57 70 00
];
```

### 3.3 KCS 목차 구조 (`lib/docs/toc-kcs.ts`)

```typescript
import { TocItem } from './types';

/** KCS 목차는 문서별로 export, catalog.ts에서 docId로 매핑 */
// 각 KCS 문서는 "장(chapter)" 단위로 level 1, "절(section)" 단위로 level 2

export const TOC_KCS_57_10_05: TocItem[] = [
  {
    id: 'kcs-57-10-05-ch1',
    title: '1. 일반사항',
    page: 1,
    level: 1,
    children: [
      { id: 'kcs-57-10-05-1-1', title: '1.1 적용범위', page: 1, level: 2 },
      { id: 'kcs-57-10-05-1-2', title: '1.2 참고기준', page: 1, level: 2 },
      { id: 'kcs-57-10-05-1-3', title: '1.3 용어의 정의', page: 2, level: 2 },
      { id: 'kcs-57-10-05-1-4', title: '1.4 제출물', page: 3, level: 2 },
    ],
  },
  {
    id: 'kcs-57-10-05-ch2',
    title: '2. 자재',
    page: 4,
    level: 1,
    children: [
      { id: 'kcs-57-10-05-2-1', title: '2.1 관 종류 및 규격', page: 4, level: 2 },
      // ... PDF에서 추출
    ],
  },
  // ... 나머지 장
];

// 다른 KCS도 동일 패턴:
// export const TOC_KCS_57_30_00: TocItem[] = [...];
// export const TOC_KCS_61_10_00: TocItem[] = [...];
// export const TOC_KCS_61_20_00: TocItem[] = [...];

/** KCS docId → TOC 매핑 */
export const KCS_TOC_MAP: Record<string, TocItem[]> = {
  'kcs-57-10-05': TOC_KCS_57_10_05,
  // PDF 확보 후 추가
};
```

> **참고**: KCS 목차는 HWP→PDF 변환 완료 후, 각 PDF의 목차 페이지에서 수동 추출.
> 문서당 평균 5~8개 장(level 1), 20~40개 절(level 2) 예상.

### 3.4 TOC ↔ 페이지 매핑 유틸 (`lib/docs/toc-utils.ts`)

```typescript
import { TocItem, DocEntry } from './types';

/** 페이지 번호로 현재 해당하는 TOC 항목 찾기 */
export function findTocByPage(toc: TocItem[], page: number): TocItem | null {
  // TOC를 flat하게 펼친 후, page 이하인 것 중 가장 가까운 항목
  const flat = flattenToc(toc);
  let closest: TocItem | null = null;
  for (const item of flat) {
    if (item.page <= page) {
      if (!closest || item.page > closest.page) {
        closest = item;
      }
    }
  }
  return closest;
}

/** TOC 트리를 1차원 배열로 펼치기 */
export function flattenToc(items: TocItem[]): TocItem[] {
  const result: TocItem[] = [];
  for (const item of items) {
    result.push(item);
    if (item.children) {
      result.push(...flattenToc(item.children));
    }
  }
  return result;
}

/** TOC 항목의 부모 chain 찾기 (bread crumb용) */
export function findTocParents(toc: TocItem[], targetId: string): TocItem[] {
  const path: TocItem[] = [];
  function search(items: TocItem[]): boolean {
    for (const item of items) {
      path.push(item);
      if (item.id === targetId) return true;
      if (item.children && search(item.children)) return true;
      path.pop();
    }
    return false;
  }
  search(toc);
  return path;
}
```

---

## 4. Scripts

### 4.1 PDF → WebP 변환 (`scripts/convert-doc-images.js`)

```javascript
/**
 * 사용법:
 *   node scripts/convert-doc-images.js                  # 전체 (KDS + KCS)
 *   node scripts/convert-doc-images.js data/kcs-pdf/    # KCS만
 *   node scripts/convert-doc-images.js --check          # 상태 확인
 *
 * 의존성:
 *   npm install canvas (node-canvas)
 *   또는 Python 대안: pdfplumber + Pillow
 *
 * 출력:
 *   data/doc-images/{doc-id}/page-001.webp ~ page-NNN.webp
 */

// 동작 흐름:
// 1. data/kcs-pdf/ 내 PDF 파일 목록 스캔
// 2. 파일명에서 문서 ID 추출 (KCS_57_10_05 → kcs-57-10-05)
// 3. pdfjs-dist로 각 페이지 렌더링 (node-canvas, scale 2.0)
// 4. canvas.toBuffer('image/webp', { quality: 0.85 })
// 5. data/doc-images/{doc-id}/ 디렉토리에 저장
// 6. 메타데이터 출력 (문서ID, 페이지수, 총 용량)
```

### 4.2 Supabase Storage 업로드 (`scripts/upload-doc-images.js`)

```javascript
/**
 * 사용법:
 *   node scripts/upload-doc-images.js              # 전체 업로드
 *   node scripts/upload-doc-images.js kds-57       # 특정 문서만
 *   node scripts/upload-doc-images.js --check      # 업로드 상태 확인
 *
 * 동작:
 * 1. Supabase Storage 'doc-images' 버킷 존재 확인 (없으면 생성)
 * 2. data/doc-images/ 내 폴더별 WebP 파일 업로드
 * 3. 경로: doc-images/{doc-id}/page-{NNN}.webp
 * 4. public 접근 설정
 * 5. 진행 상태 출력 + resume 지원
 */
```

---

## 5. LawNavigator 연동

### 5.1 설계기준 탭 변경

```typescript
// components/law/LawNavigator.tsx — 설계기준 탭 목록에서 변경

// 기존: DESIGN_STANDARDS 클릭 → handleKdsSearch (텍스트 검색)
// 변경: [원문 열기] 버튼 추가 → DocViewerModal 오픈

// DESIGN_STANDARDS 배열에 docId 추가
const DESIGN_STANDARDS = [
  { label: 'KDS 57 00 00', description: '상수도설계기준', docId: 'kds-57' },
  { label: 'KDS 61 00 00', description: '하수도설계기준', docId: 'kds-61' },
  // ...
];

// 목록 버튼에 [원문 열기] 아이콘 추가
// onClick → setViewerOpen(true), setViewerDocId(std.docId)
```

### 5.2 시방서 탭 변경

```typescript
// SPECIFICATIONS 배열에 docId 추가 (PDF 확보된 것만)
const SPECIFICATIONS = [
  { label: '상수도공사 표준시방서', ..., docId: 'kcs-57-10-05' },
  { label: '하수도공사 표준시방서', ..., docId: 'kcs-61-10-00' },
  // docId 없는 항목은 기존대로 메타정보만 표시
];

// 시방서 상세 뷰에 [원문 열기] 버튼 추가
// docId가 있는 경우에만 버튼 표시
```

### 5.3 kds-search API 변경 (`app/api/kds-search/route.ts`)

```typescript
// 기존 response:
// { results: [{ content, source, similarity }] }

// 변경 후 response — page 필드 추가:
// { results: [{ content, source, similarity, page: number | null, section: string | null }] }

// knowledge_base 테이블에 page 컬럼이 없으므로:
// 1. source 문자열에서 페이지 번호 추출 시도 (임베딩 시 메타데이터에 포함된 경우)
// 2. 추출 불가 시 null 반환 → 프론트에서 [원문 보기] 대신 문서 첫 페이지로 이동
//
// 향후 개선: knowledge_base 테이블에 page, section 컬럼 추가 권장
```

### 5.4 KdsResultCard 변경

```typescript
// 검색 결과 카드에 [원문 보기] 버튼 추가
// item.source에서 docId 추출: "상수도설계기준_2022_통합본" → "kds-57"
// item.page로 initialPage 전달 (null이면 1페이지)
// onClick → setViewerOpen(true), setViewerDocId(docId), setViewerPage(item.page ?? 1)
```

### 5.4 page.tsx 상태 추가

```typescript
// app/page.tsx에 뷰어 상태 추가
const [docViewerOpen, setDocViewerOpen] = useState(false);
const [docViewerDocId, setDocViewerDocId] = useState<string | null>(null);
const [docViewerPage, setDocViewerPage] = useState<number | undefined>();

// LawNavigator에 콜백 전달
<LawNavigator
  onOpenDocViewer={(docId: string, page?: number) => {
    setDocViewerDocId(docId);
    setDocViewerPage(page);
    setDocViewerOpen(true);
  }}
/>

// 모달 렌더링 (page.tsx 최하단)
<DocViewerModal
  isOpen={docViewerOpen}
  onClose={() => setDocViewerOpen(false)}
  initialDocId={docViewerDocId}
  initialPage={docViewerPage}
/>
```

---

## 6. Styling & UX

### 6.1 모달 스타일

```css
/* 전체화면 모달 */
.doc-viewer-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: white;
  display: flex;
  flex-direction: column;
}

/* 상단바 */
.doc-viewer-header {
  height: 48px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  flex-shrink: 0;
}

/* 본문 (TOC + 뷰어) */
.doc-viewer-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* TOC 사이드바 */
.doc-toc {
  width: 280px;
  border-right: 1px solid #e2e8f0;
  overflow-y: auto;
  flex-shrink: 0;
  transition: width 300ms ease;
}
.doc-toc.collapsed { width: 0; overflow: hidden; }

/* 페이지 뷰어 */
.doc-page-viewer {
  flex: 1;
  overflow-y: auto;
  background: #f1f5f9;  /* 밝은 회색 배경 (A4 느낌) */
  padding: 16px;
}

/* 개별 페이지 이미지 */
.doc-page-img {
  display: block;
  max-width: 100%;
  margin: 0 auto 8px;
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* 페이지 라벨 */
.doc-page-label {
  text-align: center;
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 16px;
}
```

### 6.2 TOC 하이라이트

```css
/* 현재 위치 TOC 항목 */
.toc-item.active {
  background: #eff6ff;        /* blue-50 */
  border-left: 3px solid #3b82f6;
  font-weight: 600;
}

/* 레벨별 들여쓰기 */
.toc-item[data-level="1"] { padding-left: 12px; font-weight: 700; }
.toc-item[data-level="2"] { padding-left: 28px; }
.toc-item[data-level="3"] { padding-left: 44px; font-size: 12px; }
```

### 6.3 줌 구현

```typescript
// CSS transform 기반 (리렌더링 없음)
const ZOOM_LEVELS = [0.75, 1.0, 1.25, 1.5];

// 뷰어 컨테이너
<div style={{
  transform: `scale(${zoomLevel})`,
  transformOrigin: 'top center',
  width: `${100 / zoomLevel}%`,  // 스크롤바 보정
}}>
  {/* 이미지들 */}
</div>
```

### 6.4 키보드 단축키

| 키 | 동작 |
|----|------|
| `ESC` | 모달 닫기 |
| `↑` / `↓` | 이전/다음 페이지 |
| `Home` / `End` | 첫/마지막 페이지 |
| `Ctrl + F` | 검색창 포커스 |
| `Ctrl + +` / `Ctrl + -` | 줌 인/아웃 |
| `[` / `]` | TOC 사이드바 토글 |

---

## 7. Performance

### 7.1 이미지 로딩 전략

```
[초기 로드]
- 현재 페이지 ± 2페이지만 즉시 로드 (5장)
- 나머지는 loading="lazy" (브라우저 네이티브)

[placeholder]
- 로딩 전: 회색 박스 (aspect-ratio: 210/297)
- 높이 사전 계산: A4 비율 기준 고정 높이
  → 스크롤 점프 방지

[캐싱]
- Supabase Storage CDN 자동 캐싱
- 브라우저 캐시: Cache-Control 헤더 활용
- 한번 로드된 이미지는 세션 동안 재요청 없음
```

### 7.2 스크롤 추적 최적화

> **Plan과의 관계**: Plan 1.3에서 기각한 IntersectionObserver는 "lazy loading 대체" 용도(전체 페이지 가시성 관리).
> 여기서 사용하는 IO는 "현재 보고 있는 페이지 번호 추적" 용도로, 목적이 다르며 구현 복잡도도 낮음.

```typescript
// IntersectionObserver (throttle 불필요 — 브라우저 최적화)
const observer = new IntersectionObserver(
  (entries) => {
    // 가장 많이 보이는 페이지를 현재 페이지로 설정
    const visible = entries
      .filter(e => e.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
    if (visible[0]) {
      const pageNum = parseInt(visible[0].target.id.replace('page-', ''));
      onCurrentPageChange(pageNum);
    }
  },
  { threshold: [0.1, 0.5] }  // 10%, 50% 가시 시 트리거
);
```

---

## 8. Implementation Order

```
[Phase A] 이미지 변환 인프라
  A-1. scripts/convert-doc-images.js 작성
  A-2. KDS PDF 변환 테스트 (상수도 186p)
  A-3. Supabase Storage 버킷 + 업로드 스크립트
  A-4. 이미지 URL 접근 확인

[Phase B] 카탈로그 + 뷰어 기본
  B-1. lib/docs/types.ts 타입 정의
  B-2. lib/docs/catalog.ts 카탈로그
  B-3. lib/docs/toc-kds-57.ts, toc-kds-61.ts 목차
  B-4. lib/docs/toc-utils.ts 유틸
  B-5. DocViewerModal.tsx 모달 골격
  B-6. DocPageViewer.tsx 이미지 스크롤
  B-7. DocToc.tsx 문서선택 + 목차

[Phase C] 네비게이션 + 연동
  C-1. TOC 클릭 → scrollIntoView
  C-2. 스크롤 → TOC 하이라이트
  C-3. DocViewerHeader.tsx 줌/검색/페이지
  C-4. LawNavigator 설계기준 탭 연동
  C-5. LawNavigator 시방서 탭 연동
  C-6. KdsResultCard [원문 보기] 연동
  C-7. page.tsx 상태 + 모달 렌더링

[Phase D] 품질
  D-1. 키보드 단축키
  D-2. 로딩 스켈레톤
  D-3. npm run build 확인
  D-4. 실사용 테스트
```

---

## 9. Test Scenarios

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| T-1 | 설계기준 탭 → KDS 57 [원문 열기] 클릭 | 모달 오픈, 상수도설계기준 1페이지 표시 |
| T-2 | TOC에서 "KDS 57 55 00 정수시설" 클릭 | **1초 이내** p.83으로 스크롤, TOC 해당 항목 하이라이트 |
| T-3 | 스크롤하여 p.50 부근으로 이동 | 상단바 "p.50/186" 표시, TOC에서 해당 편 하이라이트 |
| T-4 | 줌 150% 선택 | 이미지 확대, 스크롤 위치 유지 |
| T-5 | TOC에서 하수도 KDS 61 선택 | 문서 전환, 하수도 1페이지 표시 |
| T-6 | KDS 검색 → "관로" → [원문 보기] 클릭 | 모달 오픈, 해당 page로 자동 스크롤 |
| T-7 | 시방서 탭 → KCS 57-10-05 [원문 열기] | 모달 오픈, 상수도공사 시방서 표시 |
| T-8 | ESC 키 누르기 | 모달 닫힘 |
| T-9 | 200페이지 스크롤 | 끊김 없이 부드러운 스크롤 (lazy loading) |
| T-10 | 뷰어 내 검색 "정수" | Supabase 검색 결과 표시, 클릭 시 페이지 이동 |
| T-11 | `npm run build` 실행 | 빌드 성공, 타입 에러 없음 |
| T-12 | 모달 오픈 후 첫 5페이지 로딩 | **3초 이내** 완료 (네트워크 기준) |
| T-13 | catalog.ts에 더미 KWCS 엔트리 추가 | 뷰어에서 정상 표시, 코드 변경 없이 동작 |
