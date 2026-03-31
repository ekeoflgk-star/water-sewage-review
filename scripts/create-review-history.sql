-- ============================================================
-- 검토 이력 테이블 (프로젝트 이력 관리)
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- 검토 이력 테이블
CREATE TABLE IF NOT EXISTS review_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 파일 정보
  file_name TEXT NOT NULL,
  file_size INTEGER,
  -- 검토 결과 요약
  total_items INTEGER DEFAULT 0,
  pass_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  check_count INTEGER DEFAULT 0,
  -- 인허가 결과 요약
  total_permits INTEGER DEFAULT 0,
  required_permits INTEGER DEFAULT 0,
  -- 상세 데이터 (JSON)
  review_cards JSONB DEFAULT '[]'::jsonb,
  permit_cards JSONB DEFAULT '[]'::jsonb,
  -- 메타데이터
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_review_history_created
  ON review_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_history_filename
  ON review_history (file_name);

-- RLS 비활성화 (사내 도구, 인증 없음)
ALTER TABLE review_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_review_history" ON review_history
  FOR ALL USING (true) WITH CHECK (true);

-- 확인
SELECT 'review_history 테이블 생성 완료!' AS result;
