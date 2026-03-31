import { NextRequest, NextResponse } from 'next/server';
import { parseDXF } from '@/lib/parsers/dxf';
import { analyzeDxfForPermits } from '@/lib/dxf/permit-mapper';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '파일이 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 확장자 확인
    if (!file.name.toLowerCase().endsWith('.dxf')) {
      return NextResponse.json(
        { success: false, error: 'DXF 파일이 아닙니다. .dxf 확장자 파일을 업로드해주세요.' },
        { status: 400 }
      );
    }

    // 크기 확인
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: '파일 크기가 50MB를 초과합니다. PURGE 명령으로 불필요한 데이터 제거 후 다시 시도해주세요.',
        },
        { status: 413 }
      );
    }

    // 파일 읽기 (UTF-8 우선, 실패 시 EUC-KR/CP949 시도)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let content: string;

    try {
      // UTF-8 디코딩 시도 (BOM 제거)
      content = buffer.toString('utf-8').replace(/^\uFEFF/, '');
      // UTF-8 대체 문자(�)가 많으면 다른 인코딩일 가능성
      const replacementCount = (content.match(/\uFFFD/g) || []).length;
      if (replacementCount > content.length * 0.01) {
        // EUC-KR(CP949) 디코딩 시도
        const decoder = new TextDecoder('euc-kr', { fatal: false });
        const eucContent = decoder.decode(buffer);
        const eucReplacementCount = (eucContent.match(/\uFFFD/g) || []).length;
        if (eucReplacementCount < replacementCount) {
          content = eucContent;
          console.log(`[DXF] ${file.name}: EUC-KR 인코딩 감지 (UTF-8 대체문자 ${replacementCount}개 → EUC-KR ${eucReplacementCount}개)`);
        }
      }
    } catch {
      // UTF-8 완전 실패 시 latin1 폴백 (바이너리 안전)
      content = buffer.toString('latin1');
      console.warn(`[DXF] ${file.name}: UTF-8 디코딩 실패, latin1 폴백 사용`);
    }

    // DXF 파싱
    const parseResult = parseDXF(content);

    // 옵션 파싱
    const cadastralLayer = formData.get('cadastralLayer') as string | null;
    const cadastralTextLayer = formData.get('cadastralTextLayer') as string | null;

    // 인허가 분석
    const result = analyzeDxfForPermits(parseResult, file.name, {
      cadastralLayerName: cadastralLayer || undefined,
      cadastralTextLayerName: cadastralTextLayer || undefined,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('DXF 분석 오류:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'DXF 분석 중 알 수 없는 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
