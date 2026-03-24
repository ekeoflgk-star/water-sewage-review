/**
 * RAG 검색 엔진
 * - Layer 1 (KDS 사전 임베딩) + Layer 2 (사용자 업로드) 동시 검색
 * - Supabase pgvector 기반 유사도 검색
 */

import { supabaseAdmin } from '@/lib/supabase';
import { embedText } from '@/lib/embedding';
import type { KnowledgeResult, KnowledgeLayer } from '@/types';

/** RAG 검색 파라미터 */
export interface RAGSearchParams {
  query: string;              // 검색 쿼리 텍스트
  sessionId?: string;         // Layer 2 검색 시 세션 ID
  topK?: number;              // 반환 결과 수 (기본 5)
  threshold?: number;         // 최소 유사도 (기본 0.7)
  sourceFilter?: string;      // 특정 KDS만 검색 (예: 'KDS 61 40')
}

/**
 * Supabase 연결 상태 확인
 */
export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Layer 1 검색: knowledge_base (KDS 사전 임베딩)
 */
async function searchLayer1(
  queryEmbedding: number[],
  topK: number,
  threshold: number,
  sourceFilter?: string
): Promise<KnowledgeResult[]> {
  const { data, error } = await supabaseAdmin.rpc('search_knowledge', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: topK,
    match_threshold: threshold,
    source_filter: sourceFilter || null,
  });

  if (error) {
    console.error('[RAG] Layer 1 검색 오류:', error);
    throw new Error(`KDS 검색 오류: ${error.message}`);
  }

  return (data || []).map((row: {
    id: string;
    source: string;
    section: string | null;
    page: number | null;
    content: string;
    similarity: number;
  }) => ({
    id: row.id,
    layer: 'layer1-preset' as KnowledgeLayer,
    source: row.source,
    content: row.content,
    similarity: row.similarity,
    page: row.page ?? undefined,
    section: row.section ?? undefined,
  }));
}

/**
 * Layer 2 검색: project_documents (사용자 업로드 임시)
 */
async function searchLayer2(
  queryEmbedding: number[],
  sessionId: string,
  topK: number,
  threshold: number
): Promise<KnowledgeResult[]> {
  const { data, error } = await supabaseAdmin.rpc('search_project_docs', {
    query_embedding: JSON.stringify(queryEmbedding),
    p_session_id: sessionId,
    match_count: topK,
    match_threshold: threshold,
  });

  if (error) {
    console.error('[RAG] Layer 2 검색 오류:', error);
    // Layer 2 실패 시 빈 결과 반환 (치명적이지 않음)
    return [];
  }

  return (data || []).map((row: {
    id: string;
    file_name: string;
    page: number | null;
    content: string;
    similarity: number;
  }) => ({
    id: row.id,
    layer: 'layer2-upload' as KnowledgeLayer,
    source: `업로드: ${row.file_name}`,
    content: row.content,
    similarity: row.similarity,
    page: row.page ?? undefined,
  }));
}

/**
 * 통합 RAG 검색
 *
 * 1. 쿼리 텍스트 → embedText()로 벡터화
 * 2. Layer 1 (KDS) 검색
 * 3. sessionId 있으면 Layer 2 (사용자 문서) 추가 검색
 * 4. 결과 병합 → similarity 기준 정렬 → 상위 topK개 반환
 */
export async function searchKnowledge(
  params: RAGSearchParams
): Promise<KnowledgeResult[]> {
  const { query, sessionId, topK = 5, threshold = 0.7, sourceFilter } = params;

  // Supabase 미설정 시 빈 결과
  if (!isSupabaseConfigured()) {
    console.warn('[RAG] Supabase가 설정되지 않았습니다. RAG 검색을 건너뜁니다.');
    return [];
  }

  // 쿼리 임베딩
  const queryEmbedding = await embedText(query);

  // Layer 1 + Layer 2 동시 검색
  const [layer1Results, layer2Results] = await Promise.all([
    searchLayer1(queryEmbedding, topK, threshold, sourceFilter),
    sessionId
      ? searchLayer2(queryEmbedding, sessionId, topK, threshold)
      : Promise.resolve([]),
  ]);

  // 결과 병합 + 유사도 정렬
  const merged = [...layer1Results, ...layer2Results]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return merged;
}

/**
 * RAG 검색 결과를 프롬프트 컨텍스트 문자열로 변환
 * - 출처 태그 포함: [KDS 61 40 10 §3.2] 또는 [업로드: 파일명 p.X]
 */
export function formatRAGContext(results: KnowledgeResult[]): string {
  if (results.length === 0) return '';

  return results
    .map((r, i) => {
      const sourceTag =
        r.layer === 'layer1-preset'
          ? `[${r.source}${r.section ? ` ${r.section}` : ''}]`
          : `[${r.source}${r.page ? ` p.${r.page}` : ''}]`;

      return `### 참조 ${i + 1} ${sourceTag} (유사도: ${(r.similarity * 100).toFixed(0)}%)\n${r.content}`;
    })
    .join('\n\n---\n\n');
}
