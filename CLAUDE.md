# 상하수도 설계 성과품 AI 검토 플랫폼

## 프로젝트 개요
상하수도 설계 성과품(PDF·DOCX·XLSX)을 업로드하면 법령·KDS 설계기준과 자동 대조해 적합/부적합 판정하는 사내 웹 도구.
- 회사 부서 내 사용 (회원제·구독제 없음)
- 사용자는 URL 접속만 하면 됨 (Claude.ai 계정 불필요)

## 현재 상태 ✅
- **Phase 1 환경 세팅 완료** (2024-03 기준)
- Next.js 14 프로젝트 초기화 완료
- 전체 컴포넌트 코드 작성 완료
- npm install 완료, npm run dev 실행 확인
- Gemini API 키 발급 및 .env.local 등록 완료
- PDF 업로드 + 파싱 작동 확인 (33.5MB PDF 테스트 성공)
- Gemini 채팅 스트리밍 작동 확인
- **오류 수정 완료**: 모델명 gemini-2.5-flash로 변경, 텍스트 트렁케이트(30,000자) 적용
- **OS: Windows** (cp 대신 copy 명령 사용)

## 기술 스택
- **프레임워크**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **AI**: Google Gemini 2.5 Flash (`@google/generative-ai`)
- **DB**: Supabase (PostgreSQL + pgvector) — 무료 플랜 (Phase 2부터)
- **호스팅**: Vercel 무료 Hobby 플랜
- **파일 파싱**: pdf-parse(PDF) / mammoth(DOCX) / xlsx SheetJS(XLSX)
- **파일 업로드**: react-dropzone
- **인증**: NextAuth.js (Phase 4)
- **리포트**: @react-pdf/renderer (Phase 4)

## ⛔ 절대 금지
- Anthropic Claude API 사용 금지 (비용 발생)
- OpenAI GPT API 사용 금지 (비용 발생)
- ✅ Google Gemini 2.5 Flash만 사용 (무료 API 키)

## 환경변수 (.env.local)
```
GEMINI_API_KEY=AIzaSy...        # 필수 — aistudio.google.com에서 발급
NEXT_PUBLIC_SUPABASE_URL=       # Phase 2부터 필요
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Phase 2부터 필요
SUPABASE_SERVICE_ROLE_KEY=      # Phase 2부터 필요
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 폴더 구조
```
water-sewage-review/
├── CLAUDE.md                    ← 이 파일
├── PROJECT_BRIEFING.md          ← 전체 프로젝트 기획서 (필독)
├── PROJECT_STATUS.md            ← 진행 상황 + 남은 작업 상세
├── package.json
├── .env.local                   ← API 키 (Git 제외)
├── app/
│   ├── layout.tsx               ✅ 완료
│   ├── page.tsx                 ✅ 완료 (3분할 레이아웃)
│   ├── globals.css              ✅ 완료
│   └── api/
│       ├── chat/route.ts        ✅ 완료 (Gemini 스트리밍 + 에러 핸들링)
│       ├── parse/route.ts       ✅ 완료 (PDF/DOCX/XLSX 파싱)
│       └── review/route.ts      ⬜ Phase 2 플레이스홀더
├── components/
│   ├── layout/
│   │   ├── FilePanel.tsx        ✅ 완료
│   │   ├── ChatPanel.tsx        ✅ 완료
│   │   └── LawPanel.tsx         ✅ 완료 (Phase 3 플레이스홀더)
│   ├── file/
│   │   ├── DropZone.tsx         ✅ 완료
│   │   └── FileList.tsx         ✅ 완료
│   ├── chat/
│   │   ├── ChatInput.tsx        ✅ 완료
│   │   ├── MessageList.tsx      ✅ 완료
│   │   ├── ReviewCard.tsx       ✅ 완료 (Phase 2 준비)
│   │   └── PermitCard.tsx       ✅ 완료 (Phase 2 준비)
│   └── law/
│       └── LawNavigator.tsx     ✅ 완료 (Phase 3 플레이스홀더)
├── lib/
│   ├── gemini.ts                ✅ 완료 (모델: gemini-2.5-flash, truncateText 포함)
│   ├── parsers/index.ts         ✅ 완료
│   └── supabase.ts              ✅ 완료 (Phase 2 테이블 스키마 주석 포함)
└── types/index.ts               ✅ 완료 (전체 타입 정의)
```

## UI 구조 — 3분할 레이아웃
```
┌──────────────┬─────────────────────────────────┬───────────────┐
│ 좌측 240px   │ 중앙 flex                        │ 우측 280px    │
│ FilePanel    │ ChatPanel                        │ LawPanel      │
│ 파일관리      │ Gemini 스트리밍 채팅               │ 법령참조       │
│ 드래그앤드롭  │ 검토의견 카드 (Phase 2)             │ Phase 3       │
│ 6종 그룹분류  │ 인허가 카드 (Phase 2)              │               │
└──────────────┴─────────────────────────────────┴───────────────┘
```

## 파일 그룹 분류 (6종)
1. 설계설명서 (design-description)
2. 수리계산서 (hydraulic-calculation)
3. 설계도면 (drawing)
4. 시방서 (specification)
5. 수량산출서 (quantity-calculation)
6. 검토기준문서 (review-criteria) — 사용자 업로드

## 검토 판정 기준
- 설계 검토 3단계: 🟢 적합(pass) / 🔴 부적합(fail) / 🟡 확인필요(check)
- 인허가 검토 4단계: ✅ 필수(required) / ⚠️ 조건부(conditional) / ℹ️ 규모검토(scale-review) / ❌ 해당없음(not-applicable)

## 개발 Phase
| Phase | 기간 | 주요 기능 | 상태 |
|-------|------|----------|------|
| 1 | 1~3주 | 환경세팅 + UI 골격 + 파일 파싱 + Gemini 채팅 | ✅ 기본 완료 |
| 2 | 4~7주 | KDS→pgvector 임베딩 + RAG 검토 + 인허가 검토 | ⬜ 미시작 |
| 3 | 8~11주 | 법제처 Open API + 파도타기 탐색 UI | ⬜ 미시작 |
| 4 | 12~16주 | PDF 보고서 + NextAuth 인증 + 최적화 | ⬜ 미시작 |

## Phase 1 남은 작업
1. UI 품질 개선 — 반응형, 로딩 상태, 에러 표시 다듬기
2. 파일 파싱 개선 — 대용량 PDF 처리 최적화, 페이지별 분할
3. 채팅 개선 — 마크다운 렌더링, 코드블록, 테이블 포맷
4. GitHub 레포지토리 생성 + 첫 커밋
5. Vercel 배포 연결
6. Supabase 프로젝트 생성 + pgvector 활성화 (Phase 2 준비)

## 코딩 컨벤션
- 한국어 주석 사용
- 컴포넌트 함수형 + TypeScript strict mode
- API 라우트는 App Router (route.ts)
- 에러 핸들링 필수 (try-catch + 사용자 친화적 한글 메시지)
- Tailwind CSS만 사용 (styled-components 금지)
- 파일명: PascalCase(컴포넌트), camelCase(유틸), kebab-case(라우트 폴더)

## 주요 참조 문서
- PROJECT_BRIEFING.md: 전체 프로젝트 기획 (지식베이스 3-Layer, 검토 155항목, 인허가 15종 등)
- types/index.ts: 전역 타입 정의 참조
- lib/supabase.ts: Phase 2 테이블 스키마 (주석으로 정리됨)
