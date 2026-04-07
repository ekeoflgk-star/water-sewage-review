/** 문서 카테고리 */
export type DocCategory = 'kds' | 'kcs' | 'kwcs';

/** 분야 */
export type DocField = '상수도' | '하수도' | '공통';

/** 목차 항목 */
export interface TocItem {
  id: string;           // 고유 ID: "kds-57-10-00" 또는 "sec-1-1"
  title: string;        // "1.1 목적"
  page: number;         // PDF 기준 페이지 번호
  level: 1 | 2 | 3;    // 1=편/장, 2=절, 3=항
  children?: TocItem[];
}

/** 문서 엔트리 */
export interface DocEntry {
  id: string;             // "kds-57", "kcs-57-10-05"
  category: DocCategory;
  code: string;           // "KDS 57 00 00"
  title: string;          // "상수도설계기준"
  shortTitle: string;     // "상수도설계"
  field: DocField;
  version: string;        // "2024"
  totalPages: number;
  imageBasePath: string;  // (레거시) Supabase Storage URL prefix
  pdfPath: string;        // public/ 폴더 기준 PDF 경로 (예: "/kds/상수도설계기준_2022_통합본.pdf")
  toc: TocItem[];
}

/** 뷰어 상태 */
export interface DocViewerState {
  isOpen: boolean;
  activeDocId: string | null;
  currentPage: number;
  zoomLevel: number;         // 0.75 | 1.0 | 1.25 | 1.5
  activeTocId: string | null;
  tocCollapsed: boolean;
}
