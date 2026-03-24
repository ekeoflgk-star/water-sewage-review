import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { ReportTemplate } from '@/lib/report/ReportTemplate';
import type { ReviewCard, PermitCard } from '@/types';

/** POST /api/report — 검토 보고서 PDF 생성 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      reviewCards,
      permitCards,
      projectName,
      fileName,
    } = body as {
      reviewCards: ReviewCard[];
      permitCards: PermitCard[];
      projectName?: string;
      fileName?: string;
    };

    // 유효성 검사
    if (!Array.isArray(reviewCards) && !Array.isArray(permitCards)) {
      return NextResponse.json(
        { error: '검토 결과 데이터가 없습니다. reviewCards 또는 permitCards를 전달하세요.' },
        { status: 400 }
      );
    }

    const safeReviewCards = Array.isArray(reviewCards) ? reviewCards : [];
    const safePermitCards = Array.isArray(permitCards) ? permitCards : [];

    if (safeReviewCards.length === 0 && safePermitCards.length === 0) {
      return NextResponse.json(
        { error: '검토 결과가 비어 있습니다. 먼저 설계 검토를 실행하세요.' },
        { status: 400 }
      );
    }

    // PDF 생성 — renderToBuffer에 타입 캐스트 (react-pdf 타입 호환 이슈 우회)
    const element = React.createElement(ReportTemplate, {
      reviewCards: safeReviewCards,
      permitCards: safePermitCards,
      projectName: projectName || '상하수도 설계 프로젝트',
      fileName: fileName || '(파일명 미지정)',
    }) as unknown as React.ReactElement;

    const pdfBuffer = await renderToBuffer(element);

    // Buffer → Uint8Array 변환 (NextResponse 호환)
    const uint8 = new Uint8Array(pdfBuffer);

    // PDF 바이너리 응답
    const safeProjectName = (projectName || '검토보고서').replace(/[^가-힣a-zA-Z0-9_\- ]/g, '');
    const downloadFileName = `설계검토보고서_${safeProjectName}.pdf`;

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(downloadFileName)}`,
        'Content-Length': String(uint8.length),
      },
    });
  } catch (error) {
    console.error('[/api/report] PDF 생성 오류:', error);

    const message =
      error instanceof Error ? error.message : 'PDF 생성 중 알 수 없는 오류가 발생했습니다.';

    return NextResponse.json(
      { error: `PDF 생성 실패: ${message}` },
      { status: 500 }
    );
  }
}
