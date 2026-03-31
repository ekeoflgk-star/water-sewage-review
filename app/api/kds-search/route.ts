import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/kds-search?q=하수도+관로&source=하수도설계기준
 *
 * knowledge_base 테이블에서 KDS 설계기준 텍스트 검색
 * (임베딩 유사도 검색이 아닌 단순 텍스트 매칭 — API 키 불필요)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const source = searchParams.get('source') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    if (!query && !source) {
      return NextResponse.json(
        { error: '검색어(q) 또는 출처(source)를 입력하세요.' },
        { status: 400 }
      );
    }

    // Supabase 연결 확인
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Supabase가 설정되지 않았습니다.' },
        { status: 503 }
      );
    }

    // knowledge_base에서 텍스트 검색
    let queryBuilder = supabaseAdmin
      .from('knowledge_base')
      .select('id, source, section, page, content')
      .order('page', { ascending: true });

    // 출처(source) 필터 — "상수도" or "하수도" 등
    if (source) {
      queryBuilder = queryBuilder.ilike('source', `%${source}%`);
    }

    // 텍스트 검색 — content 또는 section에 키워드 포함
    if (query) {
      queryBuilder = queryBuilder.or(
        `content.ilike.%${query}%,section.ilike.%${query}%`
      );
    }

    const { data, error } = await queryBuilder.limit(limit);

    if (error) {
      console.error('[KDS Search] 오류:', error);
      return NextResponse.json(
        { error: `검색 오류: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      results: data || [],
      totalCount: data?.length || 0,
      query,
      source,
    });
  } catch (error) {
    console.error('[KDS Search] API 오류:', error);
    return NextResponse.json(
      { error: '설계기준 검색 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
