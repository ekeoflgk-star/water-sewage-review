# 상하수도 설계 성과품 AI 검토 플랫폼

상하수도 설계 성과품(PDF·DOCX·XLSX)을 업로드하면 법령·KDS 설계기준과 자동 대조하여 적합/부적합을 판정하는 사내 웹 도구입니다.

## 기술 스택

- **프레임워크**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **AI 엔진**: Google Gemini 2.5 Flash
- **DB**: Supabase (PostgreSQL + pgvector)
- **호스팅**: Vercel

## 시작하기

### 1. 사전 준비

- Node.js 18+ 설치
- [aistudio.google.com](https://aistudio.google.com)에서 Gemini API 키 발급 (무료)
- [supabase.com](https://supabase.com)에서 프로젝트 생성 (Phase 2부터 필요)

### 2. 설치

```bash
# 레포 클론
git clone https://github.com/your-repo/water-sewage-review.git
cd water-sewage-review

# 의존성 설치
npm install

# 환경변수 설정
cp .env.local.example .env.local
# .env.local 파일을 열어 GEMINI_API_KEY 입력
```

### 3. 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

### 4. 배포 (Vercel)

```bash
# Vercel CLI
npx vercel

# 또는 GitHub 연결 후 자동 배포
```

## 개발 Phase

| Phase | 기간 | 주요 기능 |
|-------|------|----------|
| 1 | 1~3주 | UI 골격 + 파일 파싱 + Gemini 채팅 |
| 2 | 4~7주 | KDS 임베딩 + RAG 검토 + 인허가 검토 |
| 3 | 8~11주 | 법제처 API + 파도타기 탐색 |
| 4 | 12~16주 | PDF 보고서 + 인증 + 최적화 |

## 라이선스

사내 전용 — 비공개
