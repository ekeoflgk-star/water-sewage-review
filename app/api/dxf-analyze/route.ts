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

    // 파일 읽기
    const arrayBuffer = await file.arrayBuffer();
    const content = Buffer.from(arrayBuffer).toString('utf-8');

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
