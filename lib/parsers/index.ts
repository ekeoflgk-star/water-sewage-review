import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { parseDXF as parseDxfFile, isDxfFile } from './dxf';

/** 파싱 결과 */
export interface ParseResult {
  content: string;       // 추출된 텍스트
  pageCount?: number;    // 페이지 수 (PDF)
  sheetNames?: string[]; // 시트명 (XLSX)
  isDxf?: boolean;       // DXF 파일 여부
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
 * DXF 파일 파싱
 * - dxf-parser 라이브러리 사용
 * - 레이어/엔티티 정보를 텍스트로 요약
 */
export async function parseDXF(buffer: Buffer): Promise<ParseResult> {
  const content = buffer.toString('utf-8');
  const result = parseDxfFile(content);

  // 레이어 목록을 텍스트로 요약
  const layerNames = Object.keys(result.layers);
  const summary = [
    `[DXF 파일 요약]`,
    `레이어 수: ${layerNames.length}`,
    `엔티티 수: ${result.entityCount}`,
    `폴리라인: ${result.polylines.length}개`,
    `텍스트: ${result.texts.length}개`,
    ``,
    `[레이어 목록]`,
    ...layerNames.map(n => `- ${n}`),
    ``,
    `[텍스트 내용]`,
    ...result.texts.slice(0, 200).map(t => `- [${t.layer}] ${t.text}`),
  ].join('\n');

  return { content: summary, isDxf: true };
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
    case 'dxf':
      return parseDXF(buffer);
    default:
      throw new Error(`지원하지 않는 파일 형식: .${ext}`);
  }
}
