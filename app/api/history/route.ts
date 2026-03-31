import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * GET /api/history — 검토 이력 목록 조회
 *   ?page=1&limit=20
 *   ?id=uuid — 특정 이력 상세 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // 단건 조회
    if (id) {
      const { data, error } = await supabaseAdmin
        .from('review_history')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }

    // 목록 조회 (최신순, 상세 카드 제외하여 경량화)
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabaseAdmin
      .from('review_history')
      .select('id, file_name, file_size, total_items, pass_count, fail_count, check_count, total_permits, required_permits, memo, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return NextResponse.json({
      items: data || [],
      totalCount: count || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('[History API] 조회 오류:', error);
    return NextResponse.json(
      { error: '이력 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/history — 검토 결과 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, fileSize, reviewCards, permitCards, memo } = body;

    if (!fileName) {
      return NextResponse.json(
        { error: '파일명이 필요합니다.' },
        { status: 400 }
      );
    }

    const reviewList = reviewCards || [];
    const permitList = permitCards || [];

    const row = {
      file_name: fileName,
      file_size: fileSize || null,
      total_items: reviewList.length,
      pass_count: reviewList.filter((c: { verdict: string }) => c.verdict === 'pass').length,
      fail_count: reviewList.filter((c: { verdict: string }) => c.verdict === 'fail').length,
      check_count: reviewList.filter((c: { verdict: string }) => c.verdict === 'check').length,
      total_permits: permitList.length,
      required_permits: permitList.filter((c: { verdict: string }) => c.verdict === 'required').length,
      review_cards: JSON.stringify(reviewList),
      permit_cards: JSON.stringify(permitList),
      memo: memo || null,
    };

    const { data, error } = await supabaseAdmin
      .from('review_history')
      .insert([row])
      .select('id, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      id: data.id,
      createdAt: data.created_at,
    });
  } catch (error) {
    console.error('[History API] 저장 오류:', error);
    return NextResponse.json(
      { error: '이력 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/history?id=uuid — 이력 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('review_history')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[History API] 삭제 오류:', error);
    return NextResponse.json(
      { error: '이력 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
