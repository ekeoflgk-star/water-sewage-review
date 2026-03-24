import { NextRequest, NextResponse } from 'next/server';

/**
 * Phase 2에서 구현 예정:
 * 1. 업로드된 문서에서 수치·항목 추출
 * 2. pgvector 벡터 검색으로 관련 KDS/법령 조항 조회
 * 3. Gemini에 문서 내용 + 기준 조항 전달 → 판정 생성
 * 4. ReviewCard / PermitCard 형태로 구조화된 응답 반환
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      message: 'Phase 2에서 구현 예정입니다.',
      status: 'not-implemented',
    },
    { status: 501 }
  );
}
