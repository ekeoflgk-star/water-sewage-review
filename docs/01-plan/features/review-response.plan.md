# 외부 검토의견 자동 회신 기능 — 구현 계획서

> **Feature**: review-response
> **작성일**: 2026-04-03
> **Phase**: Plan

---

## 1. 배경 및 목적

상하수도 설계 성과품을 외부 기관(발주처, 심의위원 등)에서 검토한 뒤 **검토의견서(Excel 표)**가 나온다.
설계사는 이 검토의견서의 각 질문에 대해:

1. **우리 성과품 어디에 해당 내용이 있는지** 위치를 찾고
2. **질문에 대한 답변(회신)**을 작성해야 한다

이 과정이 수작업으로 수 시간~수 일이 걸리는데, AI로 자동화하여 **초안을 자동 생성**하고 사용자가 수정하는 방식으로 시간을 단축한다.

---

## 2. 사용 시나리오

```
사용자 흐름:

1. [기존] 설계 성과품 파일들 업로드 (PDF/DOCX/XLSX/DXF)
2. [신규] 외부 검토서(XLSX) 업로드 → 그룹: "검토서"
3. [신규] 채팅에 "검토 회신" 입력
4. [시스템]
   ① 검토서 XLSX 파싱 → 질문 N개 구조화 추출
   ② 각 질문의 키워드로 성과품 내 위치 검색 (2가지 방식)
      - 페이지 번호 기반 검색 (PDF)
      - 단락명/섹션명 기반 검색 (전체)
   ③ 매칭된 성과품 내용 + KDS/법령 기준 → Gemini로 회신 초안 생성
   ④ 결과를 카드형 UI로 표시
5. [사용자] 각 회신 내용을 인라인 편집으로 수정
6. [사용자] "회신서 다운로드" → 회사 양식 XLSX로 출력
```

---

## 3. 핵심 데이터 구조

### 3.1 검토서 질문 (입력)

```typescript
/** 외부 검토서의 질문 항목 */
interface ReviewQuestion {
  id: string;
  number: number;            // 번호 (1, 2, 3...)
  category: string;          // 검토 분야 (설계, 시공, 구조 등)
  question: string;          // 검토 의견 (질문 내용)
  keywords: string[];        // AI가 추출한 핵심 키워드
  originalRow: number;       // 원본 Excel 행 번호
}
```

### 3.2 성과품 위치 매칭 결과

```typescript
/** 성과품 내 위치 매칭 결과 */
interface SourceMatch {
  fileId: string;            // 매칭된 파일 ID
  fileName: string;          // 파일명
  matchType: 'page' | 'section' | 'keyword';  // 매칭 방식
  page?: number;             // 페이지 번호 (PDF)
  section?: string;          // 단락명/섹션명
  excerpt: string;           // 매칭된 텍스트 발췌 (200자 이내)
  confidence: number;        // 매칭 신뢰도 (0~1)
}
```

### 3.3 회신 항목 (출력)

```typescript
/** 자동 생성된 회신 항목 */
interface ReviewResponse {
  id: string;
  questionId: string;        // 원본 질문 ID
  question: ReviewQuestion;  // 원본 질문
  sources: SourceMatch[];    // 근거 위치 (복수)
  draftAnswer: string;       // AI 초안 답변
  editedAnswer?: string;     // 사용자 수정 답변 (수정 시)
  status: 'draft' | 'edited' | 'confirmed';  // 상태
}
```

---

## 4. 구현 단계 (4단계)

### Step 1: 검토서 XLSX 파싱 — 질문 구조화 추출

**목표**: Excel 검토서에서 질문 항목을 자동으로 추출

**방식**:
- 기존 `parseXLSX()`로 CSV 변환한 뒤
- Gemini에 보내서 **표 구조 인식 + 질문 추출**
- 검토서마다 열 구조가 다를 수 있으므로, AI가 자동 판단

**프롬프트 전략**:
```
이 Excel은 설계 검토의견서입니다.
각 행에서 "검토 의견" 또는 "지적사항"에 해당하는 내용을 추출하세요.
번호, 분야, 질문 내용을 구조화하여 JSON으로 출력하세요.
```

**파일**:
- `lib/review-response/parse-questions.ts` — 질문 추출 로직

---

### Step 2: 성과품 위치 검색 — 2가지 방식

**목표**: 각 질문에 대해 우리 성과품의 어디에 관련 내용이 있는지 찾기

#### 방식 A: 페이지 번호 기반 (PDF)

현재 `parsePDF()`는 전체 텍스트를 하나로 합친다.
→ **페이지별 텍스트 분리 기능 추가** 필요

```typescript
interface PageText {
  page: number;
  content: string;
}
```

- `pdf-parse`의 `pagerender` 옵션 활용하여 페이지별 텍스트 추출
- 또는 파싱 시 `\f` (form feed) 문자로 페이지 구분점 추가

#### 방식 B: 단락명/섹션명 기반 (전체 파일)

문서의 큰 단락 제목(목차)을 추출하여 섹션 단위로 검색:
- PDF: "제1장 총론", "3.2 관경 산정" 등의 패턴 인식
- DOCX: 마크다운 헤딩 구조 활용
- XLSX: 시트명 + 병합셀 제목

**검색 순서**:
1. 임베딩 유사도 검색 (Supabase pgvector) — 의미적 매칭
2. 키워드 직접 텍스트 검색 — `file.content`에서 `indexOf`
3. 파일명/시트명 매칭 — 파일명에 관련 키워드 포함 여부

**파일**:
- `lib/review-response/search-sources.ts` — 위치 검색 로직
- `lib/parsers/index.ts` — parsePDF 페이지별 텍스트 추가

---

### Step 3: 회신 자동 생성 — Gemini + RAG

**목표**: 질문 + 매칭된 성과품 내용 → 실무 회신 초안

**Gemini 프롬프트 구성**:
```
당신은 상하수도 설계 실무자입니다.
외부 검토 의견에 대한 회신을 작성하세요.

## 검토 의견:
{question}

## 우리 성과품 관련 내용:
{matchedExcerpts}

## 관련 KDS/법령 기준:
{ragContext}

## 회신 작성 규칙:
1. 근거 위치를 먼저 명시 (예: "기본설계보고서 p.45 '3.2 관경 산정' 참조")
2. 설계 기준(KDS, 법령)을 인용하여 답변
3. 정중하고 전문적인 실무 톤
4. 수치가 있으면 정확히 기재
```

**파일**:
- `lib/review-response/generate-answer.ts` — 답변 생성 로직
- `app/api/review-response/route.ts` — API 엔드포인트

---

### Step 4: UI + XLSX 출력

**목표**: 결과 표시 + 인라인 편집 + 회사 양식 XLSX 다운로드

#### UI 컴포넌트

```
ReviewResponseCard
├── 질문 표시 (번호 + 분야 + 내용)
├── 근거 위치 표시 (파일명 + 페이지/섹션)
├── AI 답변 초안 (textarea로 편집 가능)
├── 상태 배지 (초안 / 수정됨 / 확정)
└── 개별 재생성 버튼
```

#### XLSX 출력

- 회사 양식 XLSX를 **템플릿**으로 사용
- SheetJS(`xlsx`)로 셀 단위 데이터 삽입
- 사용자가 양식 파일을 등록하면 해당 양식에 맞춰 출력
- 양식 미등록 시 기본 양식(번호/분야/의견/위치/회신) 사용

**파일**:
- `components/chat/ReviewResponseCard.tsx` — 회신 결과 카드
- `app/api/export-response/route.ts` — XLSX 회신서 출력 API

---

## 5. 파일 구조 (신규/수정)

```
신규 파일:
├── lib/review-response/
│   ├── parse-questions.ts        ← Step 1: 검토서 질문 추출
│   ├── search-sources.ts         ← Step 2: 성과품 위치 검색
│   └── generate-answer.ts        ← Step 3: 회신 자동 생성
├── app/api/
│   ├── review-response/route.ts  ← 검토회신 통합 API
│   └── export-response/route.ts  ← XLSX 회신서 출력 API
├── components/chat/
│   └── ReviewResponseCard.tsx    ← 회신 결과 카드 UI
└── types/
    └── review-response.ts        ← 타입 정의

수정 파일:
├── types/index.ts                ← FileGroup에 'review-doc' 추가
├── lib/parsers/index.ts          ← PDF 페이지별 텍스트 기능 추가
├── app/review/page.tsx           ← "검토 회신" 키워드 감지 + 핸들러
└── components/chat/MessageList.tsx ← ReviewResponseCard 렌더링 추가
```

---

## 6. 기술적 고려사항

### 6.1 검토서 형식 자동 인식
- 검토서마다 열 이름이 다를 수 있음 (의견/지적사항/검토내용 등)
- Gemini가 CSV를 보고 질문 열을 자동 판단하도록 유연한 프롬프트 설계
- 첫 행(헤더)을 기준으로 열 매핑 → 실패 시 AI 추론

### 6.2 PDF 페이지 번호 추적
- 현재: `pdf-parse`가 전체 텍스트를 합쳐서 반환
- 개선: 파싱 시 `--- [page N] ---` 마커 삽입 또는 별도 pageTexts 배열 저장
- ParseResult 타입 확장: `pageTexts?: { page: number; content: string }[]`

### 6.3 Gemini 토큰 관리
- 검토 질문 10~30개 × 성과품 매칭 각 5건 → 대량 컨텍스트
- **질문별 개별 호출** vs **배치 호출** 선택
- 권장: 5개씩 묶어서 배치 호출 (API 호출 수 절약 + 품질 유지)

### 6.4 회사 양식 XLSX 템플릿
- 사용자가 양식 파일을 업로드하면 localStorage에 저장
- 양식의 열 매핑 정보를 설정으로 관리
- 양식이 없으면 기본 양식 사용

---

## 7. 우선순위 및 일정

| 단계 | 내용 | 의존성 | 예상 소요 |
|------|------|--------|----------|
| Step 1 | 검토서 XLSX 파싱 + 질문 추출 | 없음 | 1일 |
| Step 2 | 성과품 위치 검색 (페이지+섹션) | PDF 파서 수정 | 1~2일 |
| Step 3 | Gemini 회신 생성 + API | Step 1, 2 | 1일 |
| Step 4 | UI 카드 + 인라인 편집 + XLSX 출력 | Step 3 + 회사양식 | 1~2일 |

**총 예상**: 4~6일 (회사 양식 수신 후)

---

## 8. 대기 항목

- [ ] **회사 회신서 양식 XLSX** — 사용자가 제공 예정
- [ ] 양식의 열 구조 확인 (어떤 셀에 무엇이 들어가는지)
- [ ] 실제 검토서 샘플 — 파싱 테스트용 (선택사항)
