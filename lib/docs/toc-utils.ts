import { TocItem } from './types';

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

/** 페이지 번호로 현재 해당하는 TOC 항목 찾기 */
export function findTocByPage(toc: TocItem[], page: number): TocItem | null {
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

/** TOC 항목의 부모 chain 찾기 (펼침 상태 유지용) */
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
