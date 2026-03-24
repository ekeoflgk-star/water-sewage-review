import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

/** 파싱 결과 */
export interface ParseResult {
  content: string;       // 추출된 텍스트
  pageCount?: number;    // 페이지 수 (PDF)
  sheetNames?: string[]; // 시트명 (XLSX)
}

/**
 * PDF 파일 파싱
 * - pdf-parse 라이브러리 사용
 * - 텍스트 추출 + 페이지 수 반환
 */
export async function parsePDF(buffer: Buffer): Promise<ParseResult> {
  const data = await pdf(buffer);

  return {
    content: data.text,
    pageCount: data.numpages,
  };
}

/**
 * DOCX 파일 파싱
 * - mammoth 라이브러리 사용
 * - HTML → 평문 텍스트 변환
 */
export async function parseDOCX(buffer: Buffer): Promise<ParseResult> {
  const result = await mammoth.extractRawText({ buffer });

  return {
    content: result.value,
  };
}

/**
 * XLSX 파일 파싱
 * - SheetJS 라이브러리 사용
 * - 모든 시트의 데이터를 텍스트로 변환
 */
export async function parseXLSX(buffer: Buffer): Promise<ParseResult> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
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
 * 파일 확장자에 따라 적절한 파서 호출
 */
export async function parseFile(
  buffer: Buffer,
  filename: string
): Promise<ParseResult> {
  const ext = filename.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'pdf':
      return parsePDF(buffer);
    case 'docx':
      return parseDOCX(buffer);
    case 'xlsx':
    case 'xls':
      return parseXLSX(buffer);
    default:
      throw new Error(`지원하지 않는 파일 형식: .${ext}`);
  }
}
