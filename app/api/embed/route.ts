import { NextRequest, NextResponse } from 'next/server';
import { splitIntoChunks } from '@/lib/rag/chunker';
import { embedTexts } from '@/lib/embedding';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/embed — 사용자 업로드 문서 임베딩 API (Layer 2)
 *
 * Request:
 *   { content, fileName, sessionId }
 *
 * Response:
 *   { success, chunksCreated, message }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, fileName, sessionId } = body;

    // 유효성 검사
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: '임베딩할 텍스트가 없습니다.' },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId가 필요합니다.' },
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

    // 1. 텍스트 청크 분할
    const chunks = splitIntoChunks(content, {
      maxChunkSize: 800,
      overlap: 100,
      respectSections: true,
    });

    if (chunks.length === 0) {
      return NextResponse.json({
        success: true,
        chunksCreated: 0,
        message: '분할 가능한 텍스트가 없습니다.',
      });
    }

    console.log(`[Embed] ${fileName}: ${chunks.length}개 청크 생성`);

    // 2. Gemini 임베딩
    const texts = chunks.map((c) => c.content);
    const embeddings = await embedTexts(texts);

    console.log(`[Embed] ${fileName}: ${embeddings.length}개 임베딩 완료`);

    // 3. Supabase project_documents INSERT (50개씩 배치)
    const rows = chunks.map((chunk, i) => ({
      project_id: sessionId,
      file_name: fileName || '알 수 없음',
      source: `업로드: ${fileName || '알 수 없음'}`,
      section: chunk.section || null,
      page: chunk.page || null,
      content: chunk.content,
      embedding: JSON.stringify(embeddings[i]),
    }));

    let insertedCount = 0;
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { error } = await supabaseAdmin.from('project_documents').insert(batch);

      if (error) {
        console.error(`[Embed] INSERT 오류:`, error.message);
        throw new Error(`데이터 저장 오류: ${error.message}`);
      }
      insertedCount += batch.length;
    }

    console.log(`[Embed] ${fileName}: ${insertedCount}개 행 저장 완료`);

    return NextResponse.json({
      success: true,
      chunksCreated: insertedCount,
      message: `${insertedCount}개 청크 임베딩 완료`,
    });
  } catch (error) {
    console.error('[Embed] API 오류:', error);
    const message = error instanceof Error ? error.message : '알 수 없는 오류';

    if (message.includes('429') || message.includes('quota')) {
      return NextResponse.json(
        { error: 'Gemini 무료 사용량 한도에 도달했습니다. 1분 후 다시 시도하세요.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: `임베딩 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
