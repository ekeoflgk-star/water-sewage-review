/**
 * 텍스트 청크 분할 모듈
 * - KDS 설계기준 문서의 조항 경계를 존중하여 분할
 * - 인접 청크에 overlap 적용으로 문맥 유지
 */

/** 청크 결과 */
export interface Chunk {
  content: string;     // 청크 텍스트
  page?: number;       // 원본 페이지 번호
  section?: string;    // 섹션 제목 (감지된 경우)
  index: number;       // 청크 순서 인덱스
}

/** 청크 분할 옵션 */
export interface ChunkOptions {
  maxChunkSize?: number;      // 최대 청크 크기 (기본 800자)
  overlap?: number;           // 겹침 크기 (기본 100자)
  respectSections?: boolean;  // 조항 경계 존중 (기본 true)
}

/** 조항/섹션 경계 패턴 (KDS, 법령) */
const SECTION_PATTERNS = [
  /^#{1,3}\s+/m,                    // 마크다운 제목
  /^제\d+조/m,                       // 제1조, 제2조 ...
  /^§\s*\d/m,                        // §3.2 ...
  /^\d+\.\d+(\.\d+)?\s+[가-힣]/m,   // 3.2.1 관거의 유속
  /^[가나다라마바사아자차카타파하]\.\s/m, // 가. 나. 다. ...
  /^제\d+장/m,                       // 제1장
  /^부록/m,                          // 부록
];

/**
 * 섹션 제목 추출 — 텍스트 앞부분에서 첫 줄이 섹션 패턴이면 반환
 */
function extractSectionTitle(text: string): string | undefined {
  const firstLine = text.split('\n')[0]?.trim();
  if (!firstLine) return undefined;

  for (const pattern of SECTION_PATTERNS) {
    if (pattern.test(firstLine)) {
      return firstLine.slice(0, 100); // 제목은 100자 제한
    }
  }
  return undefined;
}

/**
 * 텍스트를 조항 경계 기준으로 1차 분할
 */
function splitBySections(text: string): string[] {
  // 조항 경계 패턴을 합친 정규식
  const combinedPattern = /(?=^#{1,3}\s+|^제\d+조|^§\s*\d|^\d+\.\d+(?:\.\d+)?\s+[가-힣]|^제\d+장)/m;

  const parts = text.split(combinedPattern).filter((p) => p.trim().length > 0);
  return parts.length > 0 ? parts : [text];
}

/**
 * 긴 텍스트를 문단 단위로 재분할
 */
function splitByParagraphs(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) return [text];

  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxSize && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  // 문단으로도 분할이 안 되는 경우 (하나의 매우 긴 문단) → 강제 자르기
  return chunks.flatMap((chunk) => {
    if (chunk.length <= maxSize) return [chunk];
    const forced: string[] = [];
    for (let i = 0; i < chunk.length; i += maxSize) {
      forced.push(chunk.slice(i, i + maxSize));
    }
    return forced;
  });
}

/**
 * 메인 청크 분할 함수
 *
 * @param text - 분할할 전체 텍스트
 * @param options - 분할 옵션
 * @returns 청크 배열
 *
 * 분할 전략:
 * 1. respectSections=true면 조항 경계를 먼저 인식
 * 2. 경계 내에서 maxChunkSize 초과 시 문단 단위로 재분할
 * 3. 인접 청크에 overlap만큼 중복 포함 (문맥 유지)
 */
export function splitIntoChunks(
  text: string,
  options?: ChunkOptions
): Chunk[] {
  const maxChunkSize = options?.maxChunkSize ?? 800;
  const overlap = options?.overlap ?? 100;
  const respectSections = options?.respectSections ?? true;

  if (!text.trim()) return [];

  // 1단계: 섹션 분할 (옵션)
  let rawParts: string[];
  if (respectSections) {
    rawParts = splitBySections(text);
  } else {
    rawParts = [text];
  }

  // 2단계: 크기 초과 섹션을 문단 단위로 재분할
  const splitParts: string[] = [];
  for (const part of rawParts) {
    if (part.length <= maxChunkSize) {
      splitParts.push(part);
    } else {
      splitParts.push(...splitByParagraphs(part, maxChunkSize));
    }
  }

  // 3단계: overlap 적용 + Chunk 객체 생성
  const chunks: Chunk[] = [];
  for (let i = 0; i < splitParts.length; i++) {
    let content = splitParts[i];

    // 이전 청크 끝부분을 앞에 추가 (overlap)
    if (i > 0 && overlap > 0) {
      const prevText = splitParts[i - 1];
      const overlapText = prevText.slice(-overlap);
      content = overlapText + '\n' + content;
    }

    const section = extractSectionTitle(splitParts[i]);

    chunks.push({
      content: content.trim(),
      section,
      index: i,
    });
  }

  return chunks;
}

/**
 * 페이지 정보가 포함된 텍스트 분할
 * - PDF에서 페이지별로 분리된 텍스트를 처리
 * - 각 청크에 page 번호를 할당
 */
export function splitPagesIntoChunks(
  pages: Array<{ text: string; page: number }>,
  options?: ChunkOptions
): Chunk[] {
  const allChunks: Chunk[] = [];
  let globalIndex = 0;

  for (const { text, page } of pages) {
    const chunks = splitIntoChunks(text, options);
    for (const chunk of chunks) {
      allChunks.push({
        ...chunk,
        page,
        index: globalIndex++,
      });
    }
  }

  return allChunks;
}
