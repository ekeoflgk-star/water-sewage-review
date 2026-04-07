# 상하수도 설계 성과품 AI 검토 플랫폼

## 프로젝트 개요
상하수도 설계 성과품(PDF·DOCX·XLSX·DXF)을 업로드하면 법령·KDS 설계기준과 자동 대조해 적합/부적합 판정하는 사내 웹 도구.
- 회사 부서 내 사용 (회원제·구독제 없음)
- 사용자는 URL 접속만 하면 됨 (Claude.ai 계정 불필요)

## 현재 상태 ✅
- **Phase 1 완료**: UI 골격 + 파일 파싱 + Gemini 채팅
- **Phase 2 완료**: RAG 검토 + 인허가 15종 + 보고서 PDF + 법령 API
- **Phase 2.5 완료 (92%)**: DXF 인허가 자동 분석 (PDCA Act-1 완료)
- **Phase 3 완료**: 법령 API + 3단비교(인용+위임조문) + 조례 바로가기
- **Phase 4 완료**: 리사이즈 패널 + 업로드 진행률 + 하위폴더 + 법령 탭 개선
- **Phase 4.5 완료**: 추가참고문서 기능 + 3단비교 UI 확대 + 패널 접힘 표시
- **Phase 5 완료**: 멀티페이지 분리 + 참고문서 챗봇 + 법령 UI 대폭 개선 (2026-04-02)
- **KDS 임베딩 완료**: 상수도+하수도 1,436청크 전체 완료 (100%) — 백업 55.2MB
- **빌드**: Phase 5까지 `npm run build` 성공 확인 (2026-04-02)
- **미커밋**: Phase 3.5 ~ 5 변경사항 모두 미커밋 (50+ 파일)
- **OS: Windows** (cp 대신 copy 명령 사용)

## ⛔ 절대 금지
- Anthropic Claude API 사용 금지 (비용 발생)
- OpenAI GPT API 사용 금지 (비용 발생)
- ✅ Google Gemini 2.5 Flash만 사용 (무료 API 키)

## 기술 스택
- **프레임워크**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **AI**: Google Gemini 2.5 Flash (`@google/generative-ai`)
- **임베딩**: gemini-embedding-001 (3072차원)
- **DB**: Supabase (PostgreSQL + pgvector) — 무료 플랜, VECTOR(3072)
- **호스팅**: Vercel 무료 Hobby 플랜
- **파일 파싱**: pdf-parse(PDF) / mammoth(DOCX) / xlsx(XLSX) / dxf-parser(DXF)
- **파일 업로드**: react-dropzone
- **리포트**: @react-pdf/renderer

## 환경변수 (.env.local)
```
GEMINI_API_KEY=AIzaSy...        # 필수 — aistudio.google.com에서 발급
NEXT_PUBLIC_SUPABASE_URL=       # Supabase 프로젝트 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=      # Supabase service role key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 즉시 해야 할 작업
1. ~~**npm run build 확인**~~: ✅ 빌드 성공 (2026-03-31, supabase.ts 더미URL 수정)
2. **Git commit + push**: 문서 업데이트 + supabase.ts 수정 미커밋
3. ~~**KDS 임베딩 실행**~~: ✅ 완료 (2026-03-31, 1,436/1,436, 백업 55.2MB)
4. **review_history 테이블 생성**: Supabase SQL Editor에서 `scripts/create-review-history.sql` 실행
5. ~~**서버 버그 5건 수정**~~: ✅ 모두 수정 완료 확인 (2026-03-31)

## DXF 인허가 분석 기능 (Phase 2.5)
- 레이어 접두사 컨벤션: `$`=설계, `#`=인허가, 없음=일반/지적
- #레이어 10종 → 인허가 자동 매핑 (도로점용, 하천점용, 농지전용 등)
- 지적 텍스트 파싱: "154-7 답" → 지목→전용/점용 허가 매핑
- 도넛형 필지 판별: Ray Casting + 면적비 임계값 0.8
- PDCA 문서: docs/01-plan, 02-design, 03-analysis 참조
- Gap 분석 92% (G-01,G-03,G-04 Low 우선순위 잔여)

## 폴더 구조
```
water-sewage-review/
├── CLAUDE.md                        ← 이 파일
├── PROJECT_BRIEFING.md              ← 전체 프로젝트 기획서 (필독)
├── PROJECT_STATUS.md                ← 진행 상황 + 남은 작업 상세 (필독★)
├── app/
│   ├── page.tsx                     ✅ 홈 (네비게이션)
│   ├── review/page.tsx              ✅ 설계검토 페이지 (3분할 레이아웃)
│   ├── reference/page.tsx           ✅ 참고문서 페이지 (법령+챗봇 리사이즈)
│   └── api/
│       ├── chat/route.ts            ✅ Gemini 스트리밍
│       ├── reference-chat/route.ts  ✅ 참고문서 전용 챗봇 API
│       ├── parse/route.ts           ✅ PDF/DOCX/XLSX/DXF 파싱
│       ├── review/route.ts          ✅ 설계 검토 + 인허가 + 이력 저장
│       ├── embed/route.ts           ✅ 사용자 문서 임베딩 (사업별 격리)
│       ├── law/route.ts             ✅ 법제처 Open API
│       ├── report/route.ts          ✅ PDF 보고서 생성
│       ├── export-docx/route.ts     ✅ DOCX 내보내기
│       ├── history/route.ts         ✅ 검토 이력 API
│       └── dxf-analyze/route.ts     ✅ DXF 인허가 분석
├── components/
│   ├── layout/
│   │   ├── ChatPanel.tsx            ✅ 참고 토글 + ReviewHistory
│   │   ├── ReviewLayout.tsx         ✅ 설계검토 3분할 레이아웃
│   │   └── TopNav.tsx               ✅ 상단 네비게이션 바
│   ├── chat/
│   │   ├── MessageList.tsx          ✅ 마크다운 + 모든 카드 렌더링
│   │   ├── ReferenceChatPanel.tsx   ✅ 참고문서 전용 챗봇 패널
│   │   ├── DxfAnalysisCard.tsx      ✅ DXF 분석 결과 + 교차 수치
│   │   ├── ReviewHistory.tsx        ✅ 검토 이력 패널
│   │   └── ...                      기타 카드 컴포넌트
│   ├── file/
│   │   ├── ProjectManager.tsx       ✅ 2단 중첩 폴더 (→3레벨 미구현)
│   │   ├── DropZone.tsx             ✅ XHR 업로드 + 진행률
│   │   └── FileList.tsx             ✅ 임베딩 상태 배지
│   └── law/
│       └── LawNavigator.tsx         ✅ 아코디언 법령목록(21종) + 3단비교 + 목차 + 글꼴조절
├── lib/
│   ├── dxf/                         ✅ 레이어 분류 + 지적 + 공간분석
│   └── rag/
│       └── reviewer.ts              ✅ 추가참고문서 우선 적용
├── types/
│   ├── index.ts                     ✅ FileGroup 'guideline' + 임베딩 상태
│   └── dxf.ts                       ✅ DXF + 공간분석 타입
└── docs/                            PDCA 문서
```

## 검토 판정 기준
- 설계 검토 3단계: 적합(pass) / 부적합(fail) / 확인필요(check)
- 인허가 검토 4단계: 필수(required) / 조건부(conditional) / 규모검토(scale-review) / 해당없음(not-applicable)

## 코딩 컨벤션
- 한국어 주석 사용
- 컴포넌트 함수형 + TypeScript strict mode
- API 라우트는 App Router (route.ts)
- 에러 핸들링 필수 (try-catch + 사용자 친화적 한글 메시지)
- Tailwind CSS만 사용 (styled-components 금지)
- 파일명: PascalCase(컴포넌트), camelCase(유틸), kebab-case(라우트 폴더)

## 주요 참조 문서
- PROJECT_STATUS.md: 진행 현황 + 이어받기 가이드 (필독)
- PROJECT_BRIEFING.md: 전체 프로젝트 기획 (지식베이스 3-Layer, 검토 155항목, 인허가 15종 등)
- types/index.ts + types/dxf.ts: 전역 타입 정의
- docs/02-design/features/dxf-permit-analysis.design.md: DXF 기능 설계서
