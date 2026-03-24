# Phase 2: KDS RAG 검토 엔진 + 인허가 자동 판단 — Planning Document

> **Summary**: KDS 설계기준을 pgvector에 임베딩하고, RAG 기반 자동 검토 + 인허가 판단 엔진을 구현한다.
>
> **Project**: water-sewage-review
> **Version**: 0.1.0
> **Author**: AI 설계 검토 팀
> **Date**: 2026-03-24
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

Phase 1에서 구축한 "파일 업로드 + Gemini 채팅" 기반 위에, **설계 성과품을 KDS 설계기준과 자동 대조**하여 적합/부적합을 판정하는 핵심 검토 엔진을 구현한다. 수리계산서를 업로드하면 KDS 조항을 인용하며 자동 판정하는 것이 Phase 2의 완료 기준이다.

### 1.2 Background

- 현재 Phase 1 완료 상태: PDF 업로드 + Gemini 자유 채팅 가능
- 문제점: Gemini가 KDS 조문을 정확히 인용하지 못함 (hallucination)
- 해결: KDS 원문을 pgvector에 임베딩 → RAG 검색으로 정확한 근거 제시
- 비용 제약: 전체 $0 (Gemini 무료 API + Supabase 무료 플랜)

### 1.3 Related Documents

- PROJECT_BRIEFING.md: 전체 프로젝트 기획 (섹션 6~8)
- PROJECT_STATUS.md: Phase 2 로드맵
- types/index.ts: ReviewCard, PermitCard, KnowledgeResult 타입 정의
- lib/supabase.ts: 테이블 스키마 주석

---

## 2. Scope

### 2.1 In Scope

- [ ] Supabase 테이블 생성 (knowledge_base, project_documents)
- [ ] KDS 문서 임베딩 파이프라인 (PDF → 청크 → 벡터)
- [ ] RAG 검색 엔진 (Layer 1 + Layer 2 동시 검색)
- [ ] 설계 검토 API (`/api/review`) — 155항목 체크리스트 기반
- [ ] ReviewCard 구조화 응답 (적합/부적합/확인필요 판정)
- [ ] 인허가 자동 판단 로직 (15종, 4단계 판정)
- [ ] PermitCard 구조화 응답
- [ ] 사용자 업로드 문서 임시 임베딩 (Layer 2)

### 2.2 Out of Scope

- 법제처 Open API 연동 (Phase 3)
- PDF 보고서 출력 (Phase 4)
- NextAuth 인증 (Phase 4)
- 지자체 조례 실시간 조회 (Phase 3)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | Supabase `knowledge_base` 테이블에 KDS 문서를 청크 단위로 벡터 저장 | High | Pending |
| FR-02 | Gemini Embedding API로 텍스트 → 768차원 벡터 변환 | High | Pending |
| FR-03 | 사용자 질문/문서 → 벡터 검색 → 관련 KDS 조항 상위 5~10개 반환 | High | Pending |
| FR-04 | 검색 결과에 출처 태그 명시 ([KDS 61 40 10 §3.2] 형식) | High | Pending |
| FR-05 | 설계값 vs 기준값 추출 및 비교 → 3단계 판정 (적합/부적합/확인필요) | High | Pending |
| FR-06 | ReviewCard JSON 구조로 검토 결과 반환 (채팅에 카드 형태 렌더링) | Medium | Pending |
| FR-07 | 인허가 트리거 키워드 추출 → 15종 인허가 4단계 판정 | Medium | Pending |
| FR-08 | PermitCard JSON 구조로 인허가 결과 반환 | Medium | Pending |
| FR-09 | 사용자 업로드 문서 → 파싱 → 청크 → 임시 벡터 저장 (Layer 2) | Medium | Pending |
| FR-10 | Layer 1 + Layer 2 동시 RAG 검색 | Medium | Pending |
| FR-11 | KDS 임베딩 스크립트 (CLI로 실행 가능) | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | RAG 검색 응답 < 3초 | 콘솔 시간 측정 |
| Cost | Gemini Embedding API 무료 한도 내 | API 호출 횟수 모니터링 |
| Storage | Supabase 무료 500MB 이내 | DB 사용량 체크 |
| Accuracy | 검토 판정 정확도 80%+ (수동 검증) | 샘플 문서 5개 교차 검증 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] KDS 문서 최소 5개 임베딩 완료 (우선순위 1~5)
- [ ] 수리계산서 업로드 → KDS 조항 인용 자동 판정 작동
- [ ] ReviewCard가 채팅에 구조화된 카드로 표시
- [ ] 인허가 검토 → PermitCard 표시 작동
- [ ] Layer 2 (사용자 문서) 임시 임베딩 + RAG 검색 작동
- [ ] npm run build 성공

### 4.2 Quality Criteria

- [ ] 타입 안전성 (TypeScript strict mode 유지)
- [ ] 에러 핸들링 (Supabase/Gemini API 오류 시 한글 메시지)
- [ ] 비용 $0 유지 (무료 티어 한도 모니터링)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Gemini Embedding API 무료 한도 초과 | High | Medium | 청크 수 제한 (KDS 5개 우선), 캐싱 적용 |
| Supabase 500MB 용량 초과 | Medium | Low | 벡터 768차원 사용, 중복 제거, 상위 20개 문서만 |
| KDS PDF 파싱 품질 저하 (표·수식) | High | High | 텍스트 위주 추출, 표는 별도 처리, 수동 보정 |
| RAG 검색 정확도 부족 | High | Medium | 청크 크기 최적화 (500~1000자), 메타데이터 필터링 |
| Gemini 스트리밍 + RAG 결합 시 지연 | Medium | Medium | RAG 선검색 후 결과를 프롬프트에 주입 |
| 155개 검토항목 전체 구현 부담 | Medium | High | 관로시설 45항목 우선 구현 → 점진 확대 |

---

## 6. Architecture Considerations

### 6.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure | Static sites | ☐ |
| **Dynamic** | Feature-based modules, BaaS integration | Web apps with backend | ☑ |
| **Enterprise** | Strict layer separation, microservices | High-traffic systems | ☐ |

### 6.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Vector DB | Supabase pgvector / Pinecone / Chroma | Supabase pgvector | 무료 플랜, PostgreSQL 통합, 서버리스 |
| Embedding Model | Gemini Embedding / OpenAI ada-002 | Gemini Embedding | 무료, 768차원, 한국어 지원 |
| Chunk Strategy | Fixed-size / Sentence / Paragraph | Paragraph (500~1000자) | KDS 조항 단위 보존 |
| RAG Pattern | Naive RAG / Advanced RAG | Naive RAG + 메타데이터 필터 | 복잡도 최소화, Phase 2 범위 |
| Review Logic | 전체 Gemini / 규칙 기반 + Gemini | 규칙 기반 + Gemini 보완 | 수치 비교는 코드로, 해석은 AI로 |

### 6.3 데이터 흐름 아키텍처

```
[사전 임베딩 파이프라인]
KDS PDF → pdf-parse → 텍스트 추출 → 청크 분할 → Gemini Embedding → Supabase pgvector (Layer 1)

[사용자 업로드 흐름]
사용자 문서 → /api/parse → 텍스트 → 청크 → Gemini Embedding → Supabase (Layer 2, 임시)

[검토 요청 흐름]
사용자 "검토 시작" → /api/review
  → 1) 업로드 문서에서 설계값 추출 (Gemini)
  → 2) 관련 KDS 조항 RAG 검색 (pgvector)
  → 3) 설계값 vs 기준값 비교 (규칙 엔진)
  → 4) Gemini로 종합 판정 + 설명 생성
  → 5) ReviewCard[] + PermitCard[] JSON 응답
```

### 6.4 Supabase 테이블 스키마

```sql
-- Layer 1: 사전 임베딩 DB (영구)
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,          -- 예: 'KDS 61 40 00'
  section TEXT,                  -- 예: '§3.2 관거의 유속'
  page INTEGER,
  content TEXT NOT NULL,
  embedding VECTOR(768),
  metadata JSONB,                -- 추가 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Layer 2: 사용자 업로드 문서 (임시)
CREATE TABLE project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,      -- 세션별 구분
  file_name TEXT NOT NULL,
  page INTEGER,
  content TEXT NOT NULL,
  embedding VECTOR(768),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 벡터 검색 인덱스
CREATE INDEX ON knowledge_base
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX ON project_documents
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
```

### 6.5 폴더 구조 확장

```
lib/
├── gemini.ts              # 기존 (채팅)
├── embedding.ts           # NEW: Gemini Embedding 래퍼
├── supabase.ts            # 기존 (클라이언트)
├── parsers/index.ts       # 기존 (PDF/DOCX/XLSX)
└── rag/
    ├── index.ts           # NEW: RAG 검색 엔진 (Layer 1 + 2)
    ├── chunker.ts         # NEW: 텍스트 청크 분할
    ├── reviewer.ts        # NEW: 설계 검토 로직 (155항목)
    └── permit.ts          # NEW: 인허가 판단 로직 (15종)

app/api/
├── chat/route.ts          # 기존 (자유 채팅)
├── parse/route.ts         # 기존 (파일 파싱)
├── review/route.ts        # UPDATE: RAG 검토 엔진
└── embed/route.ts         # NEW: 사용자 문서 임베딩 API

scripts/
└── embed-kds.ts           # NEW: KDS 임베딩 CLI 스크립트
```

---

## 7. Convention Prerequisites

### 7.1 Existing Project Conventions

- [x] `CLAUDE.md` has coding conventions section
- [ ] `docs/01-plan/conventions.md` exists
- [x] ESLint configuration (`.eslintrc.json`)
- [x] TypeScript configuration (`tsconfig.json`)

### 7.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| **Naming** | CLAUDE.md에 정의됨 | RAG 관련 함수명 규칙 (searchKnowledge, embedChunks 등) | Medium |
| **Folder structure** | 기존 구조 유지 | `lib/rag/` 하위 모듈 구조 | High |
| **Error handling** | try-catch + 한글 메시지 | Supabase 에러 코드별 처리 | Medium |
| **Environment variables** | GEMINI_API_KEY만 사용 중 | Supabase 키 3개 추가 | High |

### 7.3 Environment Variables Needed

| Variable | Purpose | Scope | To Be Created |
|----------|---------|-------|:-------------:|
| `GEMINI_API_KEY` | Gemini API (채팅 + 임베딩) | Server | ☑ (기존) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | Client | ☐ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 익명 키 | Client | ☐ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 키 (서버 전용) | Server | ☐ |

---

## 8. Implementation Order (Phase 2 세부 단계)

### Step 1: Supabase 연결 + 테이블 생성 (4주차)
1. Supabase 프로젝트 생성 + pgvector 확장 활성화
2. .env.local에 Supabase 키 3개 등록
3. knowledge_base, project_documents 테이블 생성
4. lib/supabase.ts 클라이언트 연결 확인

### Step 2: Gemini Embedding + 청크 분할 (4~5주차)
1. lib/embedding.ts — Gemini Embedding API 래퍼
2. lib/rag/chunker.ts — 텍스트 청크 분할 (500~1000자, 조항 단위)
3. scripts/embed-kds.ts — KDS PDF 임베딩 CLI
4. KDS 5개 우선 임베딩 실행 (관로, 수처리, 펌프장, 슬러지, 일반)

### Step 3: RAG 검색 엔진 (5주차)
1. lib/rag/index.ts — pgvector 유사도 검색
2. Layer 1 + Layer 2 동시 검색 로직
3. 출처 태그 생성 ([KDS 61 40 10 §3.2] 형식)
4. 검색 결과 상위 5~10개 반환

### Step 4: 설계 검토 엔진 (5~6주차)
1. lib/rag/reviewer.ts — 관로시설 45항목 우선 구현
2. 설계값 추출 프롬프트 (Gemini)
3. 기준값 vs 설계값 비교 로직
4. app/api/review/route.ts — ReviewCard[] 응답 생성
5. 채팅에서 ReviewCard 렌더링 연동

### Step 5: 인허가 자동 판단 (6~7주차)
1. lib/rag/permit.ts — 15종 인허가 트리거 매칭
2. 키워드 + 수치 매칭 → 4단계 판정
3. PermitCard[] 응답 생성
4. 채팅에서 PermitCard 렌더링 연동

### Step 6: Layer 2 사용자 문서 임베딩 (7주차)
1. app/api/embed/route.ts — 업로드 문서 임시 임베딩
2. 파일 업로드 → 자동 임베딩 파이프라인
3. 세션 종료 시 임시 데이터 정리

---

## 9. Next Steps

1. [ ] Write design document (`phase2-rag-review.design.md`)
2. [ ] Supabase 프로젝트 생성 (사용자 작업)
3. [ ] KDS PDF 다운로드 — 우선순위 상위 5개 (kcsc.re.kr)
4. [ ] Start implementation (Step 1부터)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-03-24 | Initial draft | AI 설계 검토 팀 |
