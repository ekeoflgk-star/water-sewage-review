'use client';

/**
 * 클라이언트 사이드 파일 파싱
 * - Vercel Hobby 플랜 4.5MB body 제한 우회
 * - PDF: pdfjs-dist (브라우저에서 직접 텍스트 추출)
 * - XLSX: SheetJS (브라우저에서 직접 파싱)
 * - DOCX/DXF: 서버 API fallback (보통 4.5MB 이하)
 */

import * as XLSX from 'xlsx';

/** 파싱 결과 타입 */
export interface ClientParseResult {
  content: string;
  pageCount?: number;
  sheetNames?: string[];
  isDxf?: boolean;
}

/** 파일 확장자 추출 */
function getExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() || '';
}

/** 클라이언트에서 파싱 가능한 파일 타입인지 확인 */
export function canParseOnClient(fileName: string): boolean {
  const ext = getExt(fileName);
  return ['pdf', 'xlsx', 'xls'].includes(ext);
}

/**
 * PDF 파일을 브라우저에서 직접 파싱
 * - pdfjs-dist 사용 (Web Worker 불필요, 메인 스레드에서 실행)
 */
async function parsePDFClient(file: File): Promise<ClientParseResult> {
  const pdfjs = await import('pdfjs-dist');

  // Worker 비활성화 (간단한 텍스트 추출용)
  pdfjs.GlobalWorkerOptions.workerSrc = '';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .filter((item): item is { str: string; dir: string; width: number; height: number; transform: number[]; fontName: string; hasEOL: boolean } => 'str' in item)
      .map((item) => item.str)
      .join(' ');
    if (pageText.trim()) {
      pages.push(pageText);
    }
  }

  return {
    content: pages.join('\n\n'),
    pageCount: pdf.numPages,
  };
}

/**
 * XLSX 파일을 브라우저에서 직접 파싱
 * - SheetJS 사용 (이미 설치됨)
 */
async function parseXLSXClient(file: File): Promise<ClientParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetNames = workbook.SheetNames;
  const contents: string[] = [];

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim()) {
      contents.push(`[시트: ${sheetName}]\n${csv}`);
    }
  }

  return {
    content: contents.join('\n\n---\n\n'),
    sheetNames,
  };
}

/**
 * 클라이언트 사이드 파일 파싱 (메인 엔트리)
 * - PDF, XLSX: 브라우저에서 직접 파싱 (4.5MB 제한 없음)
 * - DOCX, DXF: 서버 API로 fallback
 */
export async function parseFileOnClient(
  file: File,
  onProgress?: (percent: number) => void
): Promise<ClientParseResult> {
  const ext = getExt(file.name);

  onProgress?.(10);

  try {
    switch (ext) {
      case 'pdf': {
        onProgress?.(20);
        const result = await parsePDFClient(file);
        onProgress?.(100);

        // 텍스트가 비어있으면 서버 fallback (스캔 PDF 등)
        if (!result.content.trim()) {
          throw new Error('CLIENT_EMPTY');
        }

        // 100K자 제한 (Gemini 컨텍스트 고려)
        const maxLength = 100_000;
        if (result.content.length > maxLength) {
          result.content = result.content.slice(0, maxLength) +
            '\n\n[... 이하 생략 (문서가 너무 깁니다)]';
        }
        return result;
      }

      case 'xlsx':
      case 'xls': {
        onProgress?.(30);
        const result = await parseXLSXClient(file);
        onProgress?.(100);
        return result;
      }

      default:
        throw new Error('CLIENT_UNSUPPORTED');
    }
  } catch (error) {
    // CLIENT_EMPTY, CLIENT_UNSUPPORTED은 서버 fallback으로
    if (error instanceof Error &&
        (error.message === 'CLIENT_EMPTY' || error.message === 'CLIENT_UNSUPPORTED')) {
      throw error;
    }
    // 기타 에러도 서버 fallback 시도
    console.warn(`클라이언트 파싱 실패 (${file.name}), 서버 fallback:`, error);
    throw new Error('CLIENT_FALLBACK');
  }
}
