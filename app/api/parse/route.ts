import { NextRequest, NextResponse } from 'next/server';
import { parseFile } from '@/lib/parsers';

/** 파일 업로드 크기 제한 (50MB) */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: '파일이 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 파일 크기 확인
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '파일 크기가 50MB를 초과합니다.' },
        { status: 400 }
      );
    }

    // 파일 확장자 확인
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'xlsx', 'xls'].includes(ext || '')) {
      return NextResponse.json(
        { error: '지원하지 않는 파일 형식입니다. (PDF, DOCX, XLSX만 가능)' },
        { status: 400 }
      );
    }

    // 파일 → Buffer 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 파싱 실행
    const result = await parseFile(buffer, file.name);

    // 텍스트가 너무 길면 잘라내기 (Gemini 컨텍스트 제한 고려)
    const maxLength = 100_000; // ~100K 글자
    const truncated = result.content.length > maxLength;
    const content = truncated
      ? result.content.slice(0, maxLength) + '\n\n[... 이하 생략 (문서가 너무 깁니다)]'
      : result.content;

    return NextResponse.json({
      content,
      filename: file.name,
      pageCount: result.pageCount,
      sheetNames: result.sheetNames,
      truncated,
      originalLength: result.content.length,
    });
  } catch (error) {
    console.error('파일 파싱 오류:', error);

    return NextResponse.json(
      {
        error: `파일 파싱에 실패했습니다: ${
          error instanceof Error ? error.message : '알 수 없는 오류'
        }`,
      },
      { status: 500 }
    );
  }
}
