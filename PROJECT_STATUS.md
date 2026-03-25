# 프로젝트 진행 상황

> 이 문서는 Claude Code에서 작업을 이어받기 위한 상세 현황 기록입니다.
> 마지막 업데이트: 2026-03-25 (DXF 인허가 분석 PDCA Act-1 완료 시점)

---

## 배포 정보
- **Vercel URL**: https://water-sewage-review.vercel.app
- **GitHub**: https://github.com/ekeoflgk-star/water-sewage-review
- **Supabase**: https://qmsintfrhxcpmevcksil.supabase.co

---

## 전체 완료 현황

### Phase 1 — 환경 세팅 + UI 골격 ✅
- [x] Next.js 14 + TypeScript + Tailwind CSS 초기화
- [x] Gemini 2.5 Flash API 연동 (스트리밍 채팅)
- [x] 3분할 UI (파일관리 / 채팅 / 법령참조)
- [x] PDF·DOCX·XLSX 업로드 + 파싱 (33.5MB 테스트 성공)
- [x] GitHub 레포 생성 + Vercel 배포

### Phase 2 — RAG 검토 + 인허가 ✅
- [x] Supabase 프로젝트 생성 + pgvector 활성화
- [x] knowledge_base, project_documents 테이블 + RPC 함수 2개
- [x] 임베딩 모델 gemini-embedding-001 적용 (3072차원)
- [x] KDS 임베딩 CLI 스크립트 (scripts/embed-kds.ts) — resume 기능 포함
- [x] RAG 검색 엔진 (lib/rag/index.ts) — Layer 1 + Layer 2 동시 검색
- [x] 설계 검토 엔진 (lib/rag/reviewer.ts) — 설계값 추출 + 규칙 비교 + RAG 판정
- [x] 인허가 15종 자동 판단 (lib/rag/permit.ts) — 키워드 + 수치 조건
- [x] 인허가 원스톱 체크리스트 (components/chat/PermitChecklist.tsx)
- [x] 인허가 일정 간트 차트 (components/chat/PermitGantt.tsx) — 선후행 + 크리티컬 패스
- [x] 인허가 설계사 가이드 (components/chat/PermitGuide.tsx) — DXF 연동 포함
- [x] 검토 보고서 PDF 출력 (lib/report/ReportTemplate.tsx + app/api/report/route.ts)
- [x] UI 개선: 마크다운 렌더링, ReviewCard/PermitCard pill 배지
- [x] 검토 API (app/api/review/route.ts) + 임베딩 API (app/api/embed/route.ts)

### Phase 2.5 — DXF 인허가 자동 분석 ✅ (PDCA 92%)
- [x] DXF 파일 파싱 (lib/parsers/dxf.ts) — dxf-parser 라이브러리
- [x] 레이어 접두사 분류 (lib/dxf/layer-classifier.ts) — $설계/#인허가/지적/일반
- [x] #레이어 → 인허가 자동 매핑 (PERMIT_LAYER_MAP 10종)
- [x] 지적 텍스트 파싱 (lib/dxf/cadastral-parser.ts) — "154-7 답" 패턴 + 멀티라인
- [x] 도넛형 필지 포함관계 분석 — Ray Casting + 면적비 0.8 임계값
- [x] 지목→전용/점용 허가 매핑 (9개 지목 코드)
- [x] 통합 분석 오케스트레이터 (lib/dxf/permit-mapper.ts)
- [x] REST API (app/api/dxf-analyze/route.ts) — multipart/form-data, 50MB 제한
- [x] DXF 분석 결과 UI 카드 (components/chat/DxfAnalysisCard.tsx)
- [x] DropZone .dxf 허용 + 파서 연동
- [x] PermitGuide DXF 연동 (dxfPermits prop + DXF 배지)
- [ ] ~~onPermitSelect 콜백~~ (Low 우선순위, 후속)
- [ ] ~~미매칭 텍스트 최근접 fallback~~ (Low, 후속)
- [ ] ~~공간 교차 분석 Phase B~~ (spatial-analyzer.ts, 후속)

### Phase 3 — 법령 연동 ✅
- [x] 법제처 Open API 프록시 (app/api/law/route.ts)
- [x] LawNavigator 컴포넌트 — 검색 + 조문 상세 + 바로가기
- [x] 법제처 API 키 등록 완료 (OC=jonghyeon)
- [x] 브라우저 직접 호출 + 서버 fallback (Vercel IP 우회)
- [x] Vercel 환경변수 NEXT_PUBLIC_LAW_API_OC 등록

---

## ⚠️ 즉시 해야 할 작업 (이어받는 사람 필독)

### 1. KDS 임베딩 실행 (최우선)
```bash
cd "D:\우종현\100.AI실무 아이템\01-2.설계 품질 검토\water-sewage-review"
npx tsx scripts/embed-kds.ts data/kds/
```
- **배치 임베딩 방식**: 100개/배치, 총 ~15회 API 호출, 약 3분 소요
- **상수도설계기준**: 715청크
- **하수도설계기준**: 721청크
- resume 기능 내장: 중단 후 재실행하면 자동으로 이어서 진행
- **쿼터 리셋**: 매일 한국시간 오후 4시 (PDT 자정)

### ~~2. 법제처 API 키 등록~~ ✅ 완료
- OC=jonghyeon, 브라우저 직접 호출 방식으로 Vercel 우회

### 3. DXF 인허가 분석 잔여 Gap (Low 우선순위)
- G-01: CLOSED 플래그 비트마스크 확인 (lib/parsers/dxf.ts:82) — 자동닫기 fallback으로 보완됨
- G-03: 미매칭 텍스트 최근접 fallback (lib/dxf/cadastral-parser.ts)
- G-04: onPermitSelect 콜백 (components/chat/DxfAnalysisCard.tsx)
- 상세: docs/03-analysis/dxf-permit-analysis.analysis.md 참조

### 4. 미커밋 변경사항
현재 `main` 브랜치에 아래 변경사항이 커밋되지 않은 상태:
- DXF 인허가 분석 기능 전체 (신규 파일 다수)
- PermitGuide.tsx DXF 연동
- embed-kds.ts REQUEST_DELAY 변경 (15초→4초)
- `git add` + `git commit` 필요

---

## DXF 인허가 분석 — PDCA 이력

| Phase | 상태 | 날짜 | 문서 |
|-------|------|------|------|
| Plan | ✅ | 2026-03-25 | docs/01-plan/features/dxf-permit-analysis.plan.md |
| Design | ✅ | 2026-03-25 | docs/02-design/features/dxf-permit-analysis.design.md |
| Do | ✅ | 2026-03-25 | 전체 구현 완료 |
| Check | ✅ 92% | 2026-03-25 | docs/03-analysis/dxf-permit-analysis.analysis.md |
| Act-1 | ✅ | 2026-03-25 | G-02(멀티라인), G-05(PermitGuide 연동) 수정 |
| Report | ⏳ | — | `/pdca report dxf-permit-analysis` 실행 가능 |

### DXF 레이어 컨벤션
- `$` 접두사: 설계 레이어 (예: $관로, $맨홀)
- `#` 접두사: 인허가 구분 레이어 (예: #도로구역, #하천구역)
- 접두사 없음: 일반 레이어 또는 지적도

### DXF 관련 파일 목록
```
types/dxf.ts                          타입 정의 (8개 인터페이스)
lib/parsers/dxf.ts                    DXF 파싱 (dxf-parser 래퍼)
lib/dxf/layer-classifier.ts           레이어 분류 + #레이어→인허가 매핑
lib/dxf/cadastral-parser.ts           지적 파싱 + 도넛 판별 + Ray Casting
lib/dxf/permit-mapper.ts              통합 분석 오케스트레이터
app/api/dxf-analyze/route.ts          REST API 엔드포인트
components/chat/DxfAnalysisCard.tsx    결과 표시 UI 카드
```

---

## 아직 안 한 기능 (우선순위순)

| 순위 | 기능 | 설명 | 난이도 |
|------|------|------|--------|
| 1 | KDS 임베딩 완료 | 배치 임베딩 ~15회 API, 약 3분 | 하 |
| 2 | 통합 테스트 | PDF 업로드→검토→보고서 전체 흐름 | 하 |
| 3 | DXF 공간 교차 분석 (Phase B) | 설계 폴리라인과 인허가 구역 교차 면적/연장 산출 | 중 |
| 4 | 프로젝트 이력 관리 | 검토 결과 DB 저장 + 버전 비교 + 대시보드 | 중 |
| 5 | 지자체별 조례 대응 | 시군구 선택 → 조례 차이 반영 | 하 |
| 6 | 수량산출서 검증 | 단가 적용 검증, 물량 역산, 누락 감지 | 중 |
| 7 | 협업 기능 | 코멘트, 검토자 지정, 알림 | 중 |

---

## 기술 스택 상세

| 구분 | 기술 | 버전/설정 |
|------|------|----------|
| 프레임워크 | Next.js (App Router) | 14.2.15 |
| 언어 | TypeScript strict | |
| 스타일 | Tailwind CSS | |
| AI | Google Gemini 2.5 Flash | @google/generative-ai |
| 임베딩 | gemini-embedding-001 | **3072차원** |
| DB | Supabase PostgreSQL + pgvector | 무료 플랜, VECTOR(3072) |
| DXF 파싱 | dxf-parser | ^3.2.1 |
| PDF 보고서 | @react-pdf/renderer | |
| 파일 파싱 | pdf-parse, mammoth, xlsx | |
| 호스팅 | Vercel Hobby | 무료 |

---

## 환경변수 (.env.local)
```
GEMINI_API_KEY=<aistudio.google.com에서 발급>
NEXT_PUBLIC_SUPABASE_URL=<Supabase 프로젝트 URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase anon key>
SUPABASE_SERVICE_ROLE_KEY=<Supabase service role key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
> 실제 키는 .env.local에만 저장. 절대 Git에 커밋하지 않기.

---

## 폴더 구조 (2026-03-25 시점)
```
water-sewage-review/
├── CLAUDE.md                        ← 프로젝트 규칙 (필독)
├── PROJECT_BRIEFING.md              ← 전체 기획서
├── PROJECT_STATUS.md                ← 이 파일 (진행 현황)
├── .env.local                       ← API 키 (Git 제외)
├── app/
│   ├── layout.tsx                   ✅
│   ├── page.tsx                     ✅ 3분할 + 검토 + DXF 분석 흐름
│   ├── globals.css                  ✅
│   └── api/
│       ├── chat/route.ts            ✅ Gemini 스트리밍
│       ├── parse/route.ts           ✅ PDF/DOCX/XLSX/DXF 파싱
│       ├── review/route.ts          ✅ 설계 검토 + 인허가 API
│       ├── embed/route.ts           ✅ 사용자 문서 임베딩
│       ├── law/route.ts             ✅ 법제처 Open API (키 필요)
│       ├── report/route.ts          ✅ PDF 보고서 생성
│       └── dxf-analyze/route.ts     ✅ DXF 인허가 분석 API
├── components/
│   ├── layout/
│   │   ├── FilePanel.tsx            ✅
│   │   ├── ChatPanel.tsx            ✅
│   │   └── LawPanel.tsx             ✅
│   ├── file/
│   │   ├── DropZone.tsx             ✅ (.dxf 지원 추가됨)
│   │   └── FileList.tsx             ✅
│   ├── chat/
│   │   ├── ChatInput.tsx            ✅
│   │   ├── MessageList.tsx          ✅ 마크다운 + 카드 + DXF 카드
│   │   ├── ReviewCard.tsx           ✅
│   │   ├── PermitCard.tsx           ✅
│   │   ├── PermitChecklist.tsx      ✅ 원스톱 체크리스트
│   │   ├── PermitGantt.tsx          ✅ 간트 차트
│   │   ├── PermitGuide.tsx          ✅ 설계사 가이드 (DXF 연동)
│   │   ├── DxfAnalysisCard.tsx      ✅ DXF 분석 결과 카드
│   │   └── ReportButton.tsx         ✅ PDF 다운로드
│   └── law/
│       └── LawNavigator.tsx         ✅
├── lib/
│   ├── gemini.ts                    ✅
│   ├── embedding.ts                 ✅ gemini-embedding-001 (3072차원)
│   ├── supabase.ts                  ✅
│   ├── permit-info.ts               ✅ 15종 인허가 상세정보
│   ├── permit-schedule.ts           ✅ 일정 계산 + 크리티컬 패스
│   ├── parsers/
│   │   ├── index.ts                 ✅ 파일 파서 (DXF 포함)
│   │   └── dxf.ts                   ✅ DXF 파싱 (dxf-parser)
│   ├── dxf/
│   │   ├── layer-classifier.ts      ✅ 레이어 분류 + 인허가 매핑
│   │   ├── cadastral-parser.ts      ✅ 지적 파싱 + 도넛 판별
│   │   └── permit-mapper.ts         ✅ 통합 분석
│   ├── rag/
│   │   ├── index.ts                 ✅ RAG 검색 엔진
│   │   ├── chunker.ts              ✅ 텍스트 청크 분할
│   │   ├── reviewer.ts             ✅ 설계 검토 로직
│   │   └── permit.ts               ✅ 인허가 판단 로직
│   └── report/
│       └── ReportTemplate.tsx       ✅ PDF 보고서 템플릿
├── scripts/
│   └── embed-kds.ts                 ✅ KDS 임베딩 CLI (4초 간격, resume)
├── data/
│   └── kds/
│       ├── 상수도설계기준_2022_통합본.pdf  (2.9MB, 100p, 715청크)
│       └── 하수도설계기준_2023_통합본.pdf  (2.0MB, 121p, 721청크)
├── types/
│   ├── index.ts                     ✅ 전체 타입 (UploadedFile.type에 'dxf' 포함)
│   └── dxf.ts                       ✅ DXF 관련 타입 (8개 인터페이스)
└── docs/
    ├── 01-plan/features/
    │   └── dxf-permit-analysis.plan.md
    ├── 02-design/features/
    │   └── dxf-permit-analysis.design.md
    ├── 03-analysis/
    │   └── dxf-permit-analysis.analysis.md  (92% Match Rate)
    ├── .pdca-status.json
    └── .bkit-memory.json
```

---

## Supabase DB 현황
- **knowledge_base**: **0행** (임베딩 미실행 — 이전 데이터 초기화됨)
  - 스키마: VECTOR(3072), source/section/page/content/embedding/metadata
- **project_documents**: 빈 테이블 (사용자 업로드 시 저장)
- **RPC 함수**: search_knowledge, search_project_docs 생성 완료
- **인덱스**: ivfflat vector_cosine_ops 적용

---

## 커밋 이력
```
65ee27f docs: PROJECT_STATUS.md 업데이트 — Phase 2 완료 현황 + 인수인계 정보
14395e8 fix: Vercel 빌드 오류 수정 + 인허가 간트 차트 추가
472b87a feat: Phase 2 완료 — RAG 검토 + 인허가 + 보고서 PDF + 법령 API
bd676b6 feat: Phase 1 완료 — UI 골격 + 파일 파싱 + Gemini 채팅 + RAG 코드 준비
```
> 주의: DXF 인허가 분석 기능은 아직 커밋되지 않음 (git add + commit 필요)

---

## 주의사항
- **OS**: Windows 10 (cp 대신 copy, 경로 구분자 \)
- **Gemini 무료 한도**: 임베딩 1,000건/일, 쿼터 리셋 한국시간 오후 4시 (PDT 자정)
- **API 키 보안**: .env.local에만 저장, GitHub에 절대 올리지 않기
- **Anthropic/OpenAI API 사용 금지**: Gemini만 사용 (CLAUDE.md 규칙)
- **빌드 확인**: `npm run build` 성공 확인됨 (2026-03-25)
