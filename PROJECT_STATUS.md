# 프로젝트 진행 상황

> 이 문서는 Claude Code에서 작업을 이어받기 위한 상세 현황 기록입니다.
> 마지막 업데이트: 2026-03-24 (Phase 2 완료 시점)

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
- [x] 임베딩 모델 gemini-embedding-001 적용
- [x] KDS 임베딩 CLI 스크립트 (scripts/embed-kds.ts) — resume 기능 포함
- [x] RAG 검색 엔진 (lib/rag/index.ts) — Layer 1 + Layer 2 동시 검색
- [x] 설계 검토 엔진 (lib/rag/reviewer.ts) — 설계값 추출 + 규칙 비교 + RAG 판정
- [x] 인허가 15종 자동 판단 (lib/rag/permit.ts) — 키워드 + 수치 조건
- [x] 인허가 원스톱 체크리스트 (components/chat/PermitChecklist.tsx)
- [x] 인허가 일정 간트 차트 (components/chat/PermitGantt.tsx) — 선후행 + 크리티컬 패스
- [x] 검토 보고서 PDF 출력 (lib/report/ReportTemplate.tsx + app/api/report/route.ts)
- [x] UI 개선: 마크다운 렌더링, ReviewCard/PermitCard pill 배지
- [x] 검토 API (app/api/review/route.ts) + 임베딩 API (app/api/embed/route.ts)

### Phase 3 — 법령 연동 (부분 완료)
- [x] 법제처 Open API 프록시 (app/api/law/route.ts) — 코드 완성
- [x] LawNavigator 컴포넌트 — 검색 + 조문 상세 + 바로가기
- [ ] **법제처 API 키 발급 대기 중** (OC=test 차단됨, https://open.law.go.kr 에서 발급 필요)

---

## ⚠️ 즉시 해야 할 작업 (이어받는 사람 필독)

### 1. KDS 임베딩 이어하기 (일일 쿼터 리셋 후)
```bash
cd "D:\우종현\100.AI실무 아이템\01-2.설계 품질 검토\water-sewage-review"
npx tsx scripts/embed-kds.ts data/kds/
```
- **상수도설계기준**: ~601/715 청크 완료 (84%) → 나머지 ~114개
- **하수도설계기준**: 0/721 청크 → 전체 721개
- resume 기능 내장: 이미 저장된 청크는 자동 건너뜀
- Gemini 무료 티어 일일 한도: 임베딩 1,000건/일
- 전체 완료까지 약 2일 소요

### 2. 법제처 API 키 등록
- https://open.law.go.kr 에서 API 키 발급
- app/api/law/route.ts 9행의 `const OC = 'test';`를 발급받은 키로 교체
- .env.local에 `LAW_API_KEY=발급받은키` 추가 권장

### 3. 통합 테스트
- PDF 업로드 → 채팅에 "검토 시작" 입력 → ReviewCard + PermitCard 확인
- "검토 보고서 다운로드" 버튼 → PDF 생성 확인
- 인허가 체크리스트 + 간트 차트 표시 확인

---

## 아직 안 한 기능 (우선순위순)

| 순위 | 기능 | 설명 | 난이도 |
|------|------|------|--------|
| 1 | 수리계산 자동 검증 | Manning 공식 역산, 유속-관경-경사 삼각관계 검증 | 중 |
| 2 | 프로젝트 이력 관리 | 검토 결과 DB 저장 + 버전 비교 + 대시보드 | 중 |
| 3 | 지자체별 조례 대응 | 시군구 선택 → 조례 차이 반영 | 하 |
| 4 | 수량산출서 검증 | 단가 적용 검증, 물량 역산, 누락 감지 | 중 |
| 5 | 도면 CAD 연동 | DWG/DXF 읽기, 종단면도 자동 추출 | 상 |
| 6 | 협업 기능 | 코멘트, 검토자 지정, 알림 | 중 |

---

## 기술 스택 상세

| 구분 | 기술 | 버전/설정 |
|------|------|----------|
| 프레임워크 | Next.js (App Router) | 14.2.15 |
| 언어 | TypeScript strict | |
| 스타일 | Tailwind CSS | |
| AI | Google Gemini 2.5 Flash | @google/generative-ai |
| 임베딩 | gemini-embedding-001 | 768차원 |
| DB | Supabase PostgreSQL + pgvector | 무료 플랜 |
| PDF 보고서 | @react-pdf/renderer | |
| 파일 파싱 | pdf-parse, mammoth, xlsx | |
| 호스팅 | Vercel Hobby | 무료 |

---

## 환경변수 (.env.local)
```
GEMINI_API_KEY=AIzaSyCsOphLh5Mt-SnMkL5qq8cvf3gPeE04G9s
NEXT_PUBLIC_SUPABASE_URL=https://qmsintfrhxcpmevcksil.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2ludGZyaHhjcG1ldmNrc2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMzM0MzYsImV4cCI6MjA4OTkwOTQzNn0.KTWIZ4RK-Cm4OH7lyJyUYzPPIlFO9lVa_n730jpFsFY
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2ludGZyaHhjcG1ldmNrc2lsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDMzMzQzNiwiZXhwIjoyMDg5OTA5NDM2fQ.rWx1p8gQjEkOmV05k9wCWQFKJjP7E4PI6eHbhg1Wk-U
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 폴더 구조 (Phase 2 완료 시점)
```
water-sewage-review/
├── CLAUDE.md                        ← 프로젝트 규칙 (필독)
├── PROJECT_BRIEFING.md              ← 전체 기획서
├── PROJECT_STATUS.md                ← 이 파일 (진행 현황)
├── .env.local                       ← API 키 (Git 제외)
├── app/
│   ├── layout.tsx                   ✅
│   ├── page.tsx                     ✅ 3분할 + 검토 흐름
│   ├── globals.css                  ✅
│   └── api/
│       ├── chat/route.ts            ✅ Gemini 스트리밍
│       ├── parse/route.ts           ✅ PDF/DOCX/XLSX 파싱
│       ├── review/route.ts          ✅ 설계 검토 + 인허가 API
│       ├── embed/route.ts           ✅ 사용자 문서 임베딩
│       ├── law/route.ts             ✅ 법제처 Open API (키 필요)
│       └── report/route.ts          ✅ PDF 보고서 생성
├── components/
│   ├── layout/
│   │   ├── FilePanel.tsx            ✅
│   │   ├── ChatPanel.tsx            ✅
│   │   └── LawPanel.tsx             ✅
│   ├── file/
│   │   ├── DropZone.tsx             ✅
│   │   └── FileList.tsx             ✅
│   ├── chat/
│   │   ├── ChatInput.tsx            ✅
│   │   ├── MessageList.tsx          ✅ 마크다운 + 카드 렌더링
│   │   ├── ReviewCard.tsx           ✅ pill 배지 + 컬러코딩
│   │   ├── PermitCard.tsx           ✅ pill 배지 + 아이콘
│   │   ├── PermitChecklist.tsx      ✅ 원스톱 체크리스트
│   │   ├── PermitGantt.tsx          ✅ 간트 차트
│   │   └── ReportButton.tsx         ✅ PDF 다운로드
│   └── law/
│       └── LawNavigator.tsx         ✅ 법령 검색 + 조문 상세
├── lib/
│   ├── gemini.ts                    ✅ Gemini 클라이언트
│   ├── embedding.ts                 ✅ gemini-embedding-001
│   ├── supabase.ts                  ✅ Supabase 클라이언트
│   ├── permit-info.ts               ✅ 15종 인허가 상세정보
│   ├── permit-schedule.ts           ✅ 일정 계산 + 크리티컬 패스
│   ├── parsers/index.ts             ✅ 파일 파서
│   ├── rag/
│   │   ├── index.ts                 ✅ RAG 검색 엔진
│   │   ├── chunker.ts              ✅ 텍스트 청크 분할
│   │   ├── reviewer.ts             ✅ 설계 검토 로직
│   │   └── permit.ts               ✅ 인허가 판단 로직
│   └── report/
│       └── ReportTemplate.tsx       ✅ PDF 보고서 템플릿
├── scripts/
│   └── embed-kds.ts                 ✅ KDS 임베딩 CLI (resume 지원)
├── data/
│   └── kds/
│       ├── 상수도설계기준_2022_통합본.pdf  (2.9MB)
│       └── 하수도설계기준_2023_통합본.pdf  (2.0MB)
└── types/
    └── index.ts                     ✅ 전체 타입 정의
```

---

## Supabase DB 현황
- **knowledge_base**: 상수도 ~601행 저장됨 (하수도 미완료)
- **project_documents**: 빈 테이블 (사용자 업로드 시 저장)
- **RPC 함수**: search_knowledge, search_project_docs 생성 완료
- **인덱스**: ivfflat vector_cosine_ops 적용

---

## 커밋 이력
```
14395e8 fix: Vercel 빌드 오류 수정 + 인허가 간트 차트 추가
472b87a feat: Phase 2 완료 — RAG 검토 + 인허가 + 보고서 PDF + 법령 API
bd676b6 feat: Phase 1 완료 — UI 골격 + 파일 파싱 + Gemini 채팅 + RAG 코드 준비
```

---

## 주의사항
- **OS**: Windows 10 (cp 대신 copy, 경로 구분자 \)
- **Gemini 무료 한도**: 분당 100 임베딩, 일 1,000 임베딩
- **API 키 보안**: .env.local에만 저장, GitHub에 절대 올리지 않기
- **Anthropic/OpenAI API 사용 금지**: Gemini만 사용 (CLAUDE.md 규칙)
