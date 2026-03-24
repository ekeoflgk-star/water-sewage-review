import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** 클라이언트 사이드 Supabase (익명 키) */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** 서버 사이드 Supabase (서비스 키 — 관리자 권한) */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Phase 2에서 사용할 테이블 구조 (참고용 주석)
 *
 * -- 사전 임베딩 DB (Layer 1)
 * CREATE TABLE knowledge_base (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   source TEXT NOT NULL,          -- 출처 (예: KDS 61 40 10)
 *   section TEXT,                  -- 섹션명
 *   page INTEGER,                  -- 페이지 번호
 *   content TEXT NOT NULL,         -- 텍스트 청크
 *   embedding VECTOR(768),         -- Gemini embedding 벡터
 *   metadata JSONB,                -- 추가 메타데이터
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- 사용자 업로드 문서 (Layer 2)
 * CREATE TABLE project_documents (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   project_id TEXT NOT NULL,      -- 프로젝트/세션 ID
 *   file_name TEXT NOT NULL,
 *   source TEXT NOT NULL,
 *   section TEXT,
 *   page INTEGER,
 *   content TEXT NOT NULL,
 *   embedding VECTOR(768),
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- pgvector 인덱스
 * CREATE INDEX ON knowledge_base
 *   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
 * CREATE INDEX ON project_documents
 *   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
 */
