import { DocEntry, DocCategory, DocField } from './types';
import { TOC_KDS_57 } from './toc-kds-57';
import { TOC_KDS_61 } from './toc-kds-61';

const SUPABASE_STORAGE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '') + '/storage/v1/object/public/doc-images';

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
    pdfPath: '/kds/kds-57.pdf',
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
    pdfPath: '/kds/kds-61.pdf',
    toc: TOC_KDS_61,
  },
  // ── 표준시방서 (KCS) — PDF 확보 후 추가 ──
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
