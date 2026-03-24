# 프로젝트 진행 상황

> 이 문서는 Claude Code에서 작업을 이어받기 위한 상세 현황 기록입니다.
> 마지막 업데이트: 2026-03-24

---

## 완료된 작업

### 1. 프로젝트 초기화 ✅
- Next.js 14 (App Router) + TypeScript + Tailwind CSS 프로젝트 생성
- package.json에 Phase 1 전체 의존성 포함
- npm install 완료, npm run dev 실행 확인
- tsconfig.json, tailwind.config.ts, postcss.config.js, next.config.js 설정 완료
- .gitignore, .eslintrc.json 설정 완료

### 2. Gemini API 연동 ✅
- aistudio.google.com에서 API 키 발급 완료
- .env.local에 GEMINI_API_KEY 등록 완료
- lib/gemini.ts 구현:
  - 모델: `gemini-2.5-flash` (안정 버전)
  - temperature: 0.3 (기술 검토용 낮은 창의성)
  - maxOutputTokens: 8192
  - 시스템 프롬프트: 상하수도 설계 검토 전문가 역할
  - `truncateText()`: 30,000자 제한 (대용량 PDF 대응)
  - `buildPrompt()`: 파일 컨텍스트 + 대화 이력 조합

### 3. 3분할 UI 레이아웃 ✅
- app/page.tsx: 메인 레이아웃 (좌240px + 중앙flex + 우280px)
- 상태 관리: files, messages, isStreaming을 page.tsx에서 관리
- 패널 간 데이터 흐름 구현 완료

### 4. 파일 업로드 + 파싱 ✅
- components/file/DropZone.tsx: react-dropzone 기반 드래그앤드롭
- components/file/FileList.tsx: 파일 목록 + 그룹 분류 UI
- lib/parsers/index.ts: PDF(pdf-parse), DOCX(mammoth), XLSX(SheetJS) 통합 파서
- app/api/parse/route.ts: 파일 파싱 API (50MB 제한, 100K자 트렁케이트)
- 실제 테스트: 33.5MB PDF 업로드 + 파싱 성공 확인

### 5. 채팅 기능 ✅
- components/chat/ChatInput.tsx: 입력창 (Shift+Enter 줄바꿈, 자동 높이)
- components/chat/MessageList.tsx: 메시지 목록 (자동 스크롤, 스트리밍 인디케이터)
- app/api/chat/route.ts: Gemini 스트리밍 API
  - ReadableStream으로 실시간 토큰 전송
  - 에러별 한글 메시지 (API키 무효, 사용량 초과, 요청 크기 초과, 모델 없음)
  - 프롬프트 크기 콘솔 로깅
- 실제 테스트: PDF 문서 기반 Q&A 작동 확인

### 6. Phase 2 준비 ✅
- components/chat/ReviewCard.tsx: 설계 검토 결과 카드 (3단계 판정 UI)
- components/chat/PermitCard.tsx: 인허가 검토 결과 카드 (4단계 판정 UI)
- lib/supabase.ts: Supabase 클라이언트 + 테이블 스키마 주석
- types/index.ts: 전체 타입 정의 (파일, 채팅, 검토, 인허가, 법령, 지식베이스)

### 7. 버그 수정 이력
- **모델명 오류**: `gemini-2.5-flash-preview-05-20` → `gemini-2.5-flash` (API 500 에러 해결)
- **대용량 PDF**: truncateText() 추가로 30,000자 제한 (API 요청 크기 초과 해결)

---

## Phase 1 남은 작업 (우선순위순)

### P1 — 반드시 완료
1. **GitHub 레포지토리 생성 + 첫 커밋**
   ```
   git init
   git add .
   git commit -m "feat: Phase 1 완료 — UI 골격 + 파일 파싱 + Gemini 채팅"
   git remote add origin https://github.com/[username]/water-sewage-review.git
   git push -u origin main
   ```

2. **Vercel 배포 연결**
   - vercel.com에서 GitHub 연결
   - 환경변수 GEMINI_API_KEY 설정
   - 자동 배포 확인

3. **Supabase 프로젝트 생성**
   - supabase.com에서 프로젝트 생성
   - pgvector 확장 활성화: `CREATE EXTENSION IF NOT EXISTS vector;`
   - .env.local에 Supabase 키 3개 추가

### P2 — 품질 개선
4. **채팅 마크다운 렌더링 개선**
   - react-markdown 또는 marked 라이브러리 추가
   - 코드블록, 테이블, 링크 등 포맷 지원

5. **파일 파싱 개선**
   - 대용량 PDF 페이지별 분할 파싱
   - 파싱 진행률 표시 (프로그레스 바)
   - XLSX 시트별 미리보기

6. **에러 UI 개선**
   - 토스트 알림 컴포넌트
   - 파일 업로드 실패 시 재시도 버튼
   - API 키 미설정 시 안내 화면

---

## Phase 2 로드맵 (4~7주)

### 핵심 목표
수리계산서 업로드 후 KDS 조항 인용하며 자동 판정

### 작업 순서
1. **Supabase 테이블 생성**
   - `knowledge_base` (Layer 1: 사전 임베딩 DB)
   - `project_documents` (Layer 2: 사용자 업로드 임시)
   - pgvector 인덱스 생성

2. **KDS 문서 임베딩 파이프라인**
   - KDS PDF 다운로드 (kcsc.re.kr) — 우선순위 상위 5개부터
   - 텍스트 추출 → 청크 분할 (500~1000자)
   - Gemini Embedding API로 벡터화
   - Supabase에 저장

3. **RAG 검색 엔진 (lib/rag/)**
   - 사용자 질문/문서 → 벡터 검색 → 관련 KDS 조항 조회
   - Layer 1 + Layer 2 동시 검색
   - 유사도 점수 기반 상위 5~10개 결과 반환
   - 출처 태그 포함: [KDS 61 40 10 §3.2] vs [업로드: 김천시 기본계획 p.45]

4. **검토 엔진 (app/api/review/route.ts)**
   - 155개 검토항목 체크리스트 기반 자동 판정
   - 설계값 vs 기준값 추출 및 비교
   - ReviewCard 구조화된 응답 생성

5. **인허가 자동 판단**
   - 15종 인허가 트리거 키워드 추출
   - 키워드 + 수치 매칭 → 4단계 판정
   - PermitCard 구조화된 응답 생성

6. **사용자 업로드 문서 임베딩 (Layer 2)**
   - 업로드 → 파싱 → 청크 → 임시 벡터 저장
   - 프로젝트 종료 시 자동 삭제

---

## 비용 구조
- 목표: Phase 1~3 전체 개인 비용 $0
- Gemini API: 무료 티어 (분당 10회, 하루 ~250회)
- Supabase: 무료 플랜 (500MB)
- Vercel: 무료 Hobby 플랜
- 법제처 API: 무료
- KDS PDF: 무료 다운로드 (kcsc.re.kr)

---

## 주의사항
- Windows 환경: `cp` 대신 `copy`, 경로 구분자 `\`
- 프로젝트 경로: `D:\우종현\100.AI실무 아이템\01-1.설계 품질 검토\water-sewage-review`
- API 키 보안: .env.local에만 저장, GitHub에 절대 올리지 않기
- Gemini 무료 한도: 분당 10회, 하루 ~250회 — 개발 중 과도한 테스트 주의
