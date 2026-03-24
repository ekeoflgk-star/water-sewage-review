import { NextRequest, NextResponse } from 'next/server';
import { runDesignReview } from '@/lib/rag/reviewer';
import { checkPermits } from '@/lib/rag/permit';
import { isSupabaseConfigured } from '@/lib/rag/index';
import type { ReviewCard, PermitCard } from '@/types';

/**
 * POST /api/review — 설계 검토 + 인허가 판단 API
 *
 * Request:
 *   { fileContent, fileName, fileGroup, sessionId, reviewScope }
 *
 * Response:
 *   { reviewCards, permitCards, ragSources, summary }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      fileContent,
      fileName,
      sessionId,
      reviewScope,
    } = body;

    // 유효성 검사
    if (!fileContent || typeof fileContent !== 'string') {
      return NextResponse.json(
        { error: '검토할 문서 내용이 없습니다. 파일을 먼저 업로드하세요.' },
        { status: 400 }
      );
    }

    // Supabase 연결 상태 확인
    const supabaseReady = isSupabaseConfigured();
    if (!supabaseReady) {
      console.warn('[Review] Supabase 미설정 — RAG 없이 직접 검토 모드');
    }

    // 설계 검토 (reviewer.ts)
    const reviewCards: ReviewCard[] = await runDesignReview(
      fileContent,
      sessionId,
      reviewScope || undefined
    );

    // 인허가 판단 (permit.ts)
    const permitCards: PermitCard[] = await checkPermits(fileContent);

    // 요약 통계
    const summary = {
      totalReviewItems: reviewCards.length,
      pass: reviewCards.filter((c) => c.verdict === 'pass').length,
      fail: reviewCards.filter((c) => c.verdict === 'fail').length,
      check: reviewCards.filter((c) => c.verdict === 'check').length,
      totalPermitItems: permitCards.length,
      requiredPermits: permitCards.filter((c) => c.verdict === 'required').length,
      fileName: fileName || '알 수 없음',
      supabaseConnected: supabaseReady,
    };

    console.log(`[Review] 검토 완료: ${summary.totalReviewItems}건 (적합 ${summary.pass}, 부적합 ${summary.fail}, 확인필요 ${summary.check})`);
    console.log(`[Review] 인허가: ${summary.totalPermitItems}건 (필수 ${summary.requiredPermits})`);

    return NextResponse.json({
      reviewCards,
      permitCards,
      summary,
    });
  } catch (error) {
    console.error('[Review] API 오류:', error);

    const message = error instanceof Error ? error.message : '알 수 없는 오류';

    // Gemini 레이트 리밋
    if (message.includes('429') || message.includes('quota')) {
      return NextResponse.json(
        { error: 'Gemini 무료 사용량 한도에 도달했습니다. 1분 후 다시 시도하세요.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: `검토 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
