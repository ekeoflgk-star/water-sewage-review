# Phase 2: KDS RAG 검토 엔진 + 인허가 자동 판단 — Design Document

> **Summary**: KDS pgvector 임베딩 + RAG 검색 + 설계 검토/인허가 판단 엔진의 상세 설계
>
> **Project**: water-sewage-review
> **Version**: 0.1.0
> **Author**: AI 설계 검토 팀
> **Date**: 2026-03-24
> **Status**: Draft
> **Planning Doc**: [phase2-rag-review.plan.md](../../01-plan/features/phase2-rag-review.plan.md)

---

## 1. Overview

### 1.1 Design Goals

1. KDS 원문을 벡터화하여 **정확한 조항 인용** (hallucination 방지)
2. 설계값 vs 기준값을 구조적으로 비교하여 **자동 판정**
3. **ReviewCard/PermitCard** 형태의 구조화된 검토 결과 UI 제공
4. 전체 비용 $0 유지 (Gemini 무료 API + Supabase 무료 플랜)

### 1.2 Design Principles

- **Naive RAG**: 복잡한 파이프라인 지양, 단순한 벡터 검색 + LLM 조합
- **규칙 우선**: 수치 비교(유속, 관경 등)는 코드 규칙으로 처리, AI는 해석/설명 담당
- **점진적 확장**: 관로시설 45항목 우선 구현 → 나머지 분야 확장
- **기존 코드 최대 활용**: 이미 구현된 타입(ReviewCard, PermitCard), 컴포넌트 활용

---

## 2. Architecture

### 2.1 Component Diagram

```
┌───────────────────────────────────────────────────────────────────────┐
│                        Client (Next.js Browser)                       │
│                                                                       │
│  FilePanel       ChatPanel                     LawPanel              │
│  (기존)          (기존 + ReviewCard/PermitCard)  (Phase 3)            │
│    │                    │                                             │
└────┼────────────────────┼─────────────────────────────────────────────┘
     │                    │
     ▼                    ▼
┌─────────────┐   ┌──────────────────────────────────────────────┐
│ /api/parse  │   │ /api/review (NEW)                            │
│ (기존)      │   │                                              │
│ PDF→텍스트   │   │  1. extractDesignValues() — Gemini           │
│             │   │  2. searchKnowledge() — pgvector RAG          │
│             │   │  3. compareValues() — 규칙 엔진               │
│             │   │  4. generateReview() — Gemini 종합 판정       │
│             │   │  5. checkPermits() — 인허가 키워드 매칭        │
└──────┬──────┘   └──────────────────┬───────────────────────────┘
       │                             │
       ▼                             ▼
┌──────────────┐   ┌─────────────────────────────────────────────┐
│ /api/embed   │   │ Supabase (PostgreSQL + pgvector)            │
│ (NEW)        │   │                                             │
│ 업로드문서   │──▶│  knowledge_base (Layer 1 — KDS 영구)        │
│ →임시벡터화  │   │  project_documents (Layer 2 — 업로드 임시)  │
└──────────────┘   └─────────────────────────────────────────────┘
                             ▲
                             │
                   ┌─────────┴──────────┐
                   │ scripts/embed-kds   │
                   │ (CLI — 사전 임베딩)  │
                   └────────────────────┘
```

### 2.2 Data Flow

#### A. 사전 임베딩 (1회성, CLI)
```
KDS PDF 파일
  → parsePDF() (기존 lib/parsers)
  → splitIntoChunks() (lib/rag/chunker.ts)
  → embedTexts() (lib/embedding.ts — Gemini Embedding)
  → Supabase knowledge_base INSERT
```

#### B. 사용자 문서 임베딩 (업로드 시)
```
사용자 파일 업로드
  → /api/parse (기존)
  → /api/embed (NEW)
  → splitIntoChunks()
  → embedTexts()
  → Supabase project_documents INSERT (session_id 포함)
```

#### C. 설계 검토 요청
```
사용자 "검토 시작" 입력
  → /api/review
  → Step 1: extractDesignValues(fileContent) — Gemini로 설계값 JSON 추출
  → Step 2: searchKnowledge(query, sessionId) — Layer 1+2 벡터 검색
  → Step 3: compareValues(designValues, kdsResults) — 규칙 기반 비교
  → Step 4: generateReviewCards(comparisons, kdsContext) — Gemini로 설명 생성
  → Step 5: checkPermits(fileContent) — 인허가 키워드 매칭
  → Response: { reviewCards: ReviewCard[], permitCards: PermitCard[] }
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| lib/embedding.ts | @google/generative-ai | Gemini Embedding API 래퍼 |
| lib/rag/index.ts | lib/supabase.ts, lib/embedding.ts | pgvector 벡터 검색 |
| lib/rag/chunker.ts | (none) | 텍스트 청크 분할 |
| lib/rag/reviewer.ts | lib/rag/index.ts, lib/gemini.ts | 설계값 추출 + 비교 판정 |
| lib/rag/permit.ts | lib/gemini.ts | 인허가 트리거 키워드 매칭 |
| /api/review | lib/rag/*, lib/gemini.ts | 검토 API 엔드포인트 |
| /api/embed | lib/rag/chunker.ts, lib/embedding.ts | 사용자 문서 임베딩 |
| scripts/embed-kds.ts | lib/parsers, lib/rag/chunker.ts, lib/embedding.ts | KDS CLI 임베딩 |

---

## 3. Data Model

### 3.1 Entity Definition

```typescript
// 기존 types/index.ts에 이미 정의됨 — 추가 필드만 기재

/** 벡터 검색 쿼리 파라미터 */
interface RAGSearchParams {
  query: string;             // 검색 쿼리 텍스트
  sessionId?: string;        // Layer 2 검색 시 세션 ID
  topK?: number;             // 반환 결과 수 (기본 5)
  threshold?: number;        // 최소 유사도 (기본 0.7)
  sourceFilter?: string;     // 특정 KDS만 검색 (예: 'KDS 61 40')
}

/** 설계값 추출 결과 */
interface DesignValue {
  itemName: string;          // 항목명 (예: '오수관 유속')
  value: string;             // 설계값 (예: '0.8 m/s')
  unit: string;              // 단위
  location: string;          // 문서 내 위치 (예: '수리계산서 p.12')
  category: ReviewCategory;  // 검토 분야
}

/** 규칙 기반 비교 결과 */
interface ComparisonResult {
  designValue: DesignValue;
  standardValue: string;     // KDS 기준값
  standardRef: string;       // KDS 조문 참조
  verdict: ReviewVerdict;    // pass / fail / check
  reason: string;            // 판정 사유
}
```

### 3.2 Entity Relationships

```
[knowledge_base] 1 ──── N [RAG Search Results]
       │
       └── source: KDS 코드로 필터링

[project_documents] 1 ──── N [RAG Search Results]
       │
       └── session_id: 세션별 격리

[DesignValue] N ──── 1 [ComparisonResult] ──── 1 [ReviewCard]
```

### 3.3 Database Schema

```sql
-- pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- Layer 1: KDS 사전 임베딩 DB (영구)
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,                    -- 'KDS 61 40 00' 등
  section TEXT,                            -- '§3.2 관거의 유속' 등
  page INTEGER,
  content TEXT NOT NULL,                   -- 청크 텍스트 (500~1000자)
  embedding VECTOR(768) NOT NULL,          -- Gemini embedding
  metadata JSONB DEFAULT '{}',             -- { chapter, subsection, keywords[] }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Layer 2: 사용자 업로드 문서 (임시)
CREATE TABLE project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,                -- 세션/프로젝트 구분
  file_name TEXT NOT NULL,
  page INTEGER,
  content TEXT NOT NULL,
  embedding VECTOR(768) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 벡터 검색 인덱스 (IVFFlat — 데이터 100+ 행 이후 생성 권장)
CREATE INDEX idx_knowledge_embedding ON knowledge_base
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_project_doc_embedding ON project_documents
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- 메타데이터 검색용 인덱스
CREATE INDEX idx_knowledge_source ON knowledge_base (source);
CREATE INDEX idx_project_doc_session ON project_documents (session_id);

-- Supabase RPC: 벡터 유사도 검색 함수
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding VECTOR(768),
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.7,
  source_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  source TEXT,
  section TEXT,
  page INTEGER,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.source,
    kb.section,
    kb.page,
    kb.content,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM knowledge_base kb
  WHERE
    (source_filter IS NULL OR kb.source ILIKE source_filter || '%')
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION search_project_docs(
  query_embedding VECTOR(768),
  p_session_id TEXT,
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id UUID,
  file_name TEXT,
  page INTEGER,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pd.id,
    pd.file_name,
    pd.page,
    pd.content,
    1 - (pd.embedding <=> query_embedding) AS similarity
  FROM project_documents pd
  WHERE
    pd.session_id = p_session_id
    AND 1 - (pd.embedding <=> query_embedding) > match_threshold
  ORDER BY pd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## 4. API Specification

### 4.1 Endpoint List

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /api/chat | 자유 채팅 (기존) | - |
| POST | /api/parse | 파일 파싱 (기존) | - |
| POST | /api/review | **설계 검토 + 인허가 판단** (NEW) | - |
| POST | /api/embed | **사용자 문서 임베딩** (NEW) | - |

### 4.2 `POST /api/review` — 설계 검토 API

**Request:**
```json
{
  "fileContent": "수리계산서 텍스트 내용...",
  "fileName": "김천시_수리계산서.pdf",
  "fileGroup": "hydraulic-calculation",
  "sessionId": "session-uuid",
  "reviewScope": "sewer-pipeline"
}
```

**Response (200 OK):**
```json
{
  "reviewCards": [
    {
      "id": "uuid",
      "category": "sewer-pipeline",
      "itemName": "오수관 최소 유속",
      "verdict": "pass",
      "finding": "오수관 유속 0.8m/s로 최소 기준 0.6m/s를 충족합니다.",
      "reference": "KDS 61 40 10 §3.2.1",
      "designValue": "0.8 m/s",
      "standardValue": "0.6 ~ 3.0 m/s"
    }
  ],
  "permitCards": [
    {
      "id": "uuid",
      "permitName": "도로 점용 허가",
      "verdict": "required",
      "legalBasis": "도로법 §61",
      "triggerCondition": "도로 하부 관로 매설",
      "explanation": "설계설명서에 '국도 하부 매설' 기술이 있어 도로 점용 허가가 필수입니다."
    }
  ],
  "ragSources": [
    {
      "source": "KDS 61 40 10",
      "section": "§3.2.1 유속",
      "similarity": 0.92
    }
  ]
}
```

**Error Responses:**
- `400`: fileContent 누락
- `500`: Gemini/Supabase API 오류
- `503`: Supabase 미설정 (환경변수 누락)

### 4.3 `POST /api/embed` — 사용자 문서 임베딩 API

**Request:**
```json
{
  "content": "파싱된 텍스트 내용...",
  "fileName": "김천시_기본계획.pdf",
  "sessionId": "session-uuid"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "chunksCreated": 45,
  "message": "45개 청크 임베딩 완료"
}
```

---

## 5. Module Design

### 5.1 `lib/embedding.ts` — Gemini Embedding 래퍼

```typescript
// 주요 함수
export async function embedText(text: string): Promise<number[]>
export async function embedTexts(texts: string[]): Promise<number[][]>

// 구현 사항
// - model: 'text-embedding-004' (768차원, 무료)
// - 배치 처리: 최대 100개씩 묶어서 요청
// - 에러 시 재시도 (1회, 3초 대기)
// - 빈 텍스트 필터링
```

### 5.2 `lib/rag/chunker.ts` — 텍스트 청크 분할

```typescript
interface Chunk {
  content: string;      // 청크 텍스트
  page?: number;        // 원본 페이지 번호
  section?: string;     // 섹션 제목 (있으면)
  index: number;        // 청크 순서
}

// 주요 함수
export function splitIntoChunks(
  text: string,
  options?: {
    maxChunkSize?: number;    // 기본 800자
    overlap?: number;         // 기본 100자 (겹침)
    respectSections?: boolean; // 조항 경계 존중 (기본 true)
  }
): Chunk[]

// 분할 전략
// 1. '\n## ', '\n### ', '\n제X조', '\n§' 등 조항 경계를 먼저 인식
// 2. 경계 내에서 maxChunkSize 초과 시 문단('\n\n') 단위로 재분할
// 3. 인접 청크에 overlap만큼 중복 포함 (문맥 유지)
```

### 5.3 `lib/rag/index.ts` — RAG 검색 엔진

```typescript
// 주요 함수
export async function searchKnowledge(params: RAGSearchParams): Promise<KnowledgeResult[]>

// 구현 사항
// 1. 쿼리 텍스트 → embedText()로 벡터화
// 2. Supabase RPC search_knowledge() 호출 (Layer 1)
// 3. sessionId 있으면 search_project_docs() 추가 호출 (Layer 2)
// 4. 두 결과 병합 → similarity 기준 정렬
// 5. 출처 태그 생성: [KDS 61 40 10 §3.2] 또는 [업로드: 파일명 p.X]
// 6. 상위 topK개 반환
```

### 5.4 `lib/rag/reviewer.ts` — 설계 검토 로직

```typescript
// 주요 함수
export async function extractDesignValues(
  fileContent: string,
  category: ReviewCategory
): Promise<DesignValue[]>

export function compareWithStandard(
  designValues: DesignValue[],
  kdsResults: KnowledgeResult[]
): ComparisonResult[]

export async function generateReviewCards(
  comparisons: ComparisonResult[],
  kdsContext: string
): Promise<ReviewCard[]>

// extractDesignValues 구현
// - Gemini에 프롬프트 전송:
//   "다음 문서에서 설계 수치를 JSON으로 추출하세요"
//   { items: [{ itemName, value, unit, location }] }
// - 응답 JSON 파싱 + 검증

// compareWithStandard 구현
// - 관로시설 주요 규칙 (Phase 2 우선 구현):
//   - 오수관 유속: 0.6~3.0 m/s → pass/fail
//   - 우수관 유속: 0.8~3.0 m/s → pass/fail
//   - 최소관경: 오수 200mm↑, 우수 250mm↑
//   - 최소토피: 차도 1.0m↑, 보도 0.6m↑
//   - 맨홀간격: 관경 600mm미만→75m, 600mm이상→150m
//   - 충만도: 오수≤0.8, 우수≤1.0
//   - Manning 조도계수: 관종별 기준값
// - 수치 비교 가능한 항목 → 코드로 자동 판정
// - 수치 비교 불가한 항목 → Gemini에 KDS 컨텍스트와 함께 판정 요청

// generateReviewCards 구현
// - ComparisonResult[]를 ReviewCard[] 형태로 변환
// - 코드 판정 결과에 Gemini로 설명(finding) 생성
```

### 5.5 `lib/rag/permit.ts` — 인허가 판단 로직

```typescript
// 인허가 15종 트리거 규칙 (하드코딩)
const PERMIT_RULES: PermitRule[] = [
  {
    permitName: '공공하수도 설치인가',
    legalBasis: '하수도법 §16',
    keywords: ['하수도', '하수관로', '처리시설'],
    condition: 'always', // 모든 하수도 사업에 필수
  },
  {
    permitName: '도로 점용 허가',
    legalBasis: '도로법 §61',
    keywords: ['도로', '국도', '지방도', '시도', '도로 하부'],
    condition: 'keyword-match',
  },
  {
    permitName: '환경영향평가',
    legalBasis: '환경영향평가법 §22',
    keywords: ['처리용량', '처리시설'],
    condition: 'numeric', // 10만m³/일 이상
    threshold: { field: '처리용량', operator: '>=', value: 100000, unit: 'm³/일' },
  },
  // ... 나머지 12종
];

// 주요 함수
export async function checkPermits(fileContent: string): Promise<PermitCard[]>

// 구현 사항
// 1. fileContent에서 키워드 존재 여부 체크
// 2. condition === 'always' → 무조건 'required'
// 3. condition === 'keyword-match' → 키워드 발견 시 'required'
// 4. condition === 'numeric' → Gemini로 수치 추출 후 threshold 비교
// 5. 키워드 미발견 → 'not-applicable'
// 6. 수치 불확실 → 'scale-review' 또는 'conditional'
```

---

## 6. UI/UX Design

### 6.1 검토 흐름 변경

기존 채팅 흐름에 검토 모드를 추가:

```
사용자: "검토 시작" 입력
  → 시스템: "업로드된 N개 파일을 기반으로 설계 검토를 시작합니다..."
  → Loading UI (검토 중 프로그레스)
  → ReviewCard[] 렌더링 (카드 형태)
  → PermitCard[] 렌더링 (카드 형태)
  → 시스템: "추가 질문이 있으시면 입력하세요"
```

### 6.2 ChatPanel 확장

```
메시지 유형:
1. 일반 메시지 (기존) — 텍스트 + 마크다운
2. ReviewCard 메시지 (NEW) — 카드 UI (components/chat/ReviewCard.tsx 활용)
3. PermitCard 메시지 (NEW) — 카드 UI (components/chat/PermitCard.tsx 활용)
4. 시스템 메시지 (기존) — 에러/안내
```

### 6.3 검토 결과 표시 UI

```
┌──────────────────────────────────────────┐
│ 🔍 설계 검토 결과 — 하수도 관로시설       │
│ 검토 항목: 12개 | 🟢 8 | 🔴 2 | 🟡 2    │
├──────────────────────────────────────────┤
│ 🟢 적합 — 오수관 최소 유속               │
│ 설계값: 0.8 m/s | 기준값: 0.6~3.0 m/s   │
│ KDS 61 40 10 §3.2.1                     │
│ 오수관 유속이 기준 범위 내에 있습니다.     │
├──────────────────────────────────────────┤
│ 🔴 부적합 — 최소 토피                    │
│ 설계값: 0.7 m | 기준값: 차도 1.0m↑       │
│ KDS 61 40 10 §4.5                       │
│ 차도 구간 토피가 기준 미달입니다.          │
├──────────────────────────────────────────┤
│ ...                                      │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ ⚖️ 인허가 자동 판단 결과 — 5개 항목      │
├──────────────────────────────────────────┤
│ ✅ 필수 — 공공하수도 설치인가             │
│ 하수도법 §16 | 모든 하수도 사업 필수      │
├──────────────────────────────────────────┤
│ ✅ 필수 — 도로 점용 허가                  │
│ 도로법 §61 | '국도 하부 매설' 기술 발견    │
├──────────────────────────────────────────┤
│ ...                                      │
└──────────────────────────────────────────┘
```

### 6.4 Component 변경 목록

| Component | Action | 변경 내용 |
|-----------|--------|----------|
| MessageList.tsx | UPDATE | reviewCards/permitCards 메시지 감지 → 카드 렌더링 |
| ReviewCard.tsx | 기존 활용 | 변경 없음 (이미 구현됨) |
| PermitCard.tsx | 기존 활용 | 변경 없음 (이미 구현됨) |
| ChatPanel.tsx | UPDATE | "검토 시작" 버튼 또는 감지 로직 추가 |
| page.tsx | UPDATE | handleReview() 핸들러 추가, /api/review 호출 |

---

## 7. Error Handling

### 7.1 Error Code Definition

| Code | Message | Cause | Handling |
|------|---------|-------|----------|
| 400 | 검토할 문서가 없습니다 | 파일 미업로드 | 파일 업로드 안내 토스트 |
| 500 | Gemini API 오류 | Embedding/Chat 실패 | 재시도 안내 |
| 503 | Supabase 미설정 | 환경변수 누락 | 설정 안내 메시지 |
| 429 | 무료 한도 초과 | Gemini 분당 10회 초과 | 대기 안내 (60초) |
| 413 | 문서가 너무 큼 | 청크 수 초과 | 문서 분할 안내 |

### 7.2 Fallback 전략

| 상황 | Fallback |
|------|----------|
| Supabase 미연결 | RAG 없이 Gemini 직접 검토 (기존 채팅 방식) |
| Embedding 실패 | 해당 청크 건너뛰기, 로그 기록 |
| RAG 결과 0건 | Gemini에 직접 질문 (RAG 없이) |
| 설계값 추출 실패 | 해당 항목 'check' (확인필요) 판정 |

---

## 8. Security Considerations

- [x] 사내 전용 (인증 없음, Phase 4에서 NextAuth 추가)
- [x] Supabase Service Key 서버 전용 (.env.local)
- [x] 파일 업로드 크기 제한 (50MB, 기존)
- [x] SQL Injection 방지 (Supabase RPC 파라미터 바인딩)
- [ ] Layer 2 임시 데이터 TTL (24시간) — 구현 예정

---

## 9. Clean Architecture Layer Assignment

| Component | Layer | Location |
|-----------|-------|----------|
| ReviewCard, PermitCard | Presentation | `components/chat/` |
| ChatPanel, MessageList | Presentation | `components/layout/`, `components/chat/` |
| reviewHandler, embedHandler | Application | `app/api/review/`, `app/api/embed/` |
| ReviewCard, PermitCard, KnowledgeResult types | Domain | `types/index.ts` |
| embedding.ts, rag/*.ts | Infrastructure | `lib/embedding.ts`, `lib/rag/` |
| supabase.ts | Infrastructure | `lib/supabase.ts` |

---

## 10. Coding Convention Reference

### 10.1 This Feature's Conventions

| Item | Convention |
|------|-----------|
| 파일명 | camelCase.ts (유틸), PascalCase.tsx (컴포넌트) |
| 함수명 | camelCase (searchKnowledge, embedText 등) |
| 타입명 | PascalCase (RAGSearchParams, DesignValue 등) |
| 에러 메시지 | 한국어, 사용자 친화적 |
| 주석 | 한국어 (CLAUDE.md 규칙) |
| API | App Router (route.ts) |
| 환경변수 | NEXT_PUBLIC_ 접두사 (클라이언트), 없으면 서버 전용 |

---

## 11. Implementation Guide

### 11.1 File Structure (최종)

```
lib/
├── gemini.ts              # 기존 유지
├── embedding.ts           # NEW — Gemini Embedding API 래퍼
├── supabase.ts            # 기존 유지
├── parsers/index.ts       # 기존 유지
└── rag/
    ├── index.ts           # NEW — RAG 검색 엔진
    ├── chunker.ts         # NEW — 텍스트 청크 분할
    ├── reviewer.ts        # NEW — 설계 검토 로직
    └── permit.ts          # NEW — 인허가 판단 로직

app/api/
├── chat/route.ts          # 기존 유지
├── parse/route.ts         # 기존 유지
├── review/route.ts        # UPDATE — 검토 엔진 구현
└── embed/route.ts         # NEW — 사용자 문서 임베딩

scripts/
└── embed-kds.ts           # NEW — KDS 임베딩 CLI

types/
└── index.ts               # UPDATE — RAGSearchParams, DesignValue 등 추가
```

### 11.2 Implementation Order (Do Phase 가이드)

#### Step 1: 기반 인프라 (1~2일)
1. [ ] Supabase 프로젝트 생성 + .env.local 키 등록
2. [ ] pgvector 확장 + 테이블 생성 (SQL 실행)
3. [ ] Supabase RPC 함수 생성
4. [ ] lib/supabase.ts 연결 확인

#### Step 2: Embedding 모듈 (1일)
5. [ ] lib/embedding.ts — embedText(), embedTexts() 구현
6. [ ] 단위 테스트: 짧은 텍스트 임베딩 확인 (768차원 벡터)

#### Step 3: 청크 분할 (1일)
7. [ ] lib/rag/chunker.ts — splitIntoChunks() 구현
8. [ ] 테스트: KDS 텍스트 샘플로 청크 분할 확인

#### Step 4: KDS 임베딩 (2~3일)
9. [ ] scripts/embed-kds.ts — CLI 스크립트
10. [ ] KDS 관로시설 (61 40 00) PDF 임베딩 실행
11. [ ] Supabase 데이터 확인 (행 수, 벡터 유효성)
12. [ ] 나머지 KDS 4개 순차 임베딩

#### Step 5: RAG 검색 (1일)
13. [ ] lib/rag/index.ts — searchKnowledge() 구현
14. [ ] 테스트: "오수관 유속 기준" 검색 → KDS 조항 반환 확인

#### Step 6: 설계 검토 엔진 (2~3일)
15. [ ] lib/rag/reviewer.ts — extractDesignValues() 구현
16. [ ] lib/rag/reviewer.ts — compareWithStandard() 구현 (관로 규칙)
17. [ ] lib/rag/reviewer.ts — generateReviewCards() 구현
18. [ ] app/api/review/route.ts — 전체 파이프라인 연결

#### Step 7: 인허가 판단 (1일)
19. [ ] lib/rag/permit.ts — PERMIT_RULES 정의 (15종)
20. [ ] lib/rag/permit.ts — checkPermits() 구현
21. [ ] /api/review에 인허가 판단 통합

#### Step 8: UI 연동 (1~2일)
22. [ ] types/index.ts — RAGSearchParams, DesignValue 등 타입 추가
23. [ ] MessageList.tsx — reviewCards/permitCards 메시지 렌더링
24. [ ] page.tsx — handleReview() 핸들러, /api/review 호출
25. [ ] ChatPanel.tsx — 검토 시작 트리거 연동

#### Step 9: Layer 2 임베딩 (1일)
26. [ ] app/api/embed/route.ts — 사용자 문서 임베딩
27. [ ] DropZone.tsx — 파일 업로드 후 자동 임베딩 호출

#### Step 10: 통합 테스트 + 빌드 (1일)
28. [ ] 수리계산서 샘플 PDF로 전체 흐름 테스트
29. [ ] npm run build 성공 확인
30. [ ] 에러 시나리오 확인 (Supabase 미연결, API 한도 등)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-03-24 | Initial draft | AI 설계 검토 팀 |
