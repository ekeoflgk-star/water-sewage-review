# 외부 검토의견 자동 회신 — Design Document

> **Summary**: 외부 검토서(XLSX)를 파싱하여 질문을 추출하고, 업로드된 성과품에서 근거 위치를 찾아 AI 회신 초안을 생성하는 기능의 상세 설계
>
> **Project**: water-sewage-review
> **Feature**: review-response
> **Version**: 0.1.0
> **Date**: 2026-04-03
> **Status**: Draft
> **Planning Doc**: [review-response.plan.md](../../01-plan/features/review-response.plan.md)

---

## 1. Overview

### 1.1 Design Goals

1. 외부 검토서(XLSX 표)에서 **질문 항목을 자동 추출** (열 구조 자동 인식)
2. 이미 업로드된 성과품에서 **근거 위치를 2가지 방식으로 검색** (페이지 / 섹션)
3. Gemini + RAG로 **실무 톤의 회신 초안을 자동 생성**
4. 사용자가 **인라인 편집**으로 초안을 수정하고 **XLSX로 다운로드**
5. Gemini 2.5 Flash 무료 API만 사용 (비용 $0)

### 1.2 Design Principles

- **AI 유연 파싱**: 검토서마다 열 구조가 다르므로, Gemini가 표 구조를 자동 판단
- **2단 검색**: 임베딩 유사도(의미) + 키워드 직접 매칭(정확도) 병행
- **편집 가능 초안**: AI 결과는 초안일 뿐, 사용자가 반드시 검토/수정
- **기존 인프라 활용**: 기존 parseXLSX, searchKnowledge, Gemini 모듈 재사용

---

## 2. Architecture

### 2.1 전체 흐름도

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client (ReviewPage)                         │
│                                                                 │
│  FilePanel                    ChatPanel                         │
│  ┌──────────────────┐         ┌───────────────────────────────┐ │
│  │ 성과품 파일들      │         │ "검토 회신" 입력              │ │
│  │ (PDF/DOCX/XLSX)   │         │     ↓                        │ │
│  │ 검토서.xlsx        │         │ ReviewResponseCard ×N        │ │
│  │  (group: review)  │         │ ┌─────────────────────────┐  │ │
│  │                    │         │ │ Q1. PE관 200mm 근거?     │  │ │
│  │                    │         │ │ 📍 보고서 p.45 §3.2     │  │ │
│  │                    │         │ │ 💬 [편집 가능 답변]      │  │ │
│  │                    │         │ └─────────────────────────┘  │ │
│  └──────────────────┘         └───────────────────────────────┘ │
└──────────┬───────────────────────────────┬──────────────────────┘
           │                               │
           ▼                               ▼
┌──────────────────┐        ┌──────────────────────────────────────┐
│ /api/parse       │        │ /api/review-response (NEW)           │
│ (기존 파서)       │        │                                      │
│ XLSX → CSV 텍스트│        │  Phase 1: parseReviewQuestions()      │
│ PDF → 페이지텍스트│        │    └→ Gemini로 질문 구조화 추출       │
└──────────────────┘        │  Phase 2: searchSources()             │
                            │    ├→ 페이지 텍스트 키워드 검색        │
                            │    ├→ 섹션/단락명 매칭                 │
                            │    └→ RAG 임베딩 유사도 검색           │
                            │  Phase 3: generateResponses()         │
                            │    └→ Gemini로 회신 초안 생성          │
                            └──────────────┬───────────────────────┘
                                           │
                                           ▼
                            ┌──────────────────────────────────────┐
                            │ Supabase (pgvector)                  │
                            │  knowledge_base — KDS 임베딩          │
                            │  user_documents — 성과품 임베딩        │
                            └──────────────────────────────────────┘
```

### 2.2 데이터 흐름 시퀀스

```
User                Client              API                  Gemini          Supabase
 │                    │                   │                     │               │
 │ 1. 성과품 업로드    │                   │                     │               │
 │──────────────────▶│ /api/parse        │                     │               │
 │                    │──────────────────▶│ 파싱 + 페이지마커    │               │
 │                    │◀─ content ────────│                     │               │
 │                    │                   │                     │               │
 │ 2. 검토서 업로드    │                   │                     │               │
 │──────────────────▶│ /api/parse        │                     │               │
 │                    │──────────────────▶│ XLSX → CSV          │               │
 │                    │◀─ content ────────│                     │               │
 │                    │  group='review'   │                     │               │
 │                    │                   │                     │               │
 │ 3. "검토 회신"     │                   │                     │               │
 │──────────────────▶│                   │                     │               │
 │                    │ POST /api/review-response               │               │
 │                    │──────────────────▶│                     │               │
 │                    │                   │ ① 질문 추출         │               │
 │                    │                   │────────────────────▶│               │
 │                    │                   │◀───── questions[] ──│               │
 │                    │                   │                     │               │
 │                    │                   │ ② 위치 검색         │               │
 │                    │                   │  (키워드+섹션 매칭)  │               │
 │                    │                   │───────────────────────────────────▶│
 │                    │                   │◀────────── RAG results ───────────│
 │                    │                   │                     │               │
 │                    │                   │ ③ 회신 생성 (배치5)  │               │
 │                    │                   │────────────────────▶│               │
 │                    │                   │◀──── responses[] ───│               │
 │                    │                   │                     │               │
 │                    │◀── responses[] ───│                     │               │
 │ ReviewResponseCard │                   │                     │               │
 │◀──────────────────│                   │                     │               │
 │                    │                   │                     │               │
 │ 4. 답변 편집       │                   │                     │               │
 │──────────────────▶│ (로컬 state)      │                     │               │
 │                    │                   │                     │               │
 │ 5. XLSX 다운로드   │                   │                     │               │
 │──────────────────▶│ /api/export-response                    │               │
 │                    │──────────────────▶│                     │               │
 │◀─── .xlsx file ───│◀──────────────────│                     │               │
```

---

## 3. Type Definitions

### 3.1 types/review-response.ts (신규)

```typescript
// ============================================================
// 외부 검토 회신 관련 타입
// ============================================================

/** 외부 검토서의 질문 항목 */
export interface ReviewQuestion {
  id: string;
  number: number;              // 번호 (1, 2, 3...)
  category: string;            // 검토 분야 (설계, 시공, 구조, 일반 등)
  question: string;            // 검토 의견 / 지적사항 (질문 내용)
  keywords: string[];          // AI가 추출한 핵심 키워드
  originalRow: number;         // 원본 Excel 행 번호 (출력 시 매칭용)
}

/** 성과품 내 위치 매칭 결과 */
export interface SourceMatch {
  fileId: string;              // 매칭된 파일 ID
  fileName: string;            // 파일명
  matchType: 'page' | 'section' | 'keyword' | 'embedding';
  page?: number;               // 페이지 번호 (PDF)
  section?: string;            // 단락명/섹션명
  sheetName?: string;          // 시트명 (XLSX)
  excerpt: string;             // 매칭된 텍스트 발췌 (300자 이내)
  confidence: number;          // 매칭 신뢰도 (0~1)
}

/** 자동 생성된 회신 항목 */
export interface ReviewResponseItem {
  id: string;
  questionId: string;          // 원본 질문 ID
  question: ReviewQuestion;    // 원본 질문
  sources: SourceMatch[];      // 근거 위치 (복수, 최대 3건)
  draftAnswer: string;         // AI 초안 답변
  editedAnswer?: string;       // 사용자 수정 답변
  status: 'draft' | 'edited' | 'confirmed';
}

/** API 요청 바디 */
export interface ReviewResponseRequest {
  reviewDocContent: string;    // 검토서 파싱된 텍스트 (CSV)
  deliverableFiles: Array<{    // 성과품 파일들
    id: string;
    name: string;
    content: string;
    type: string;
    group: string | null;
  }>;
  sessionId?: string;          // RAG 검색용 세션 ID
}

/** API 응답 */
export interface ReviewResponseResult {
  questions: ReviewQuestion[];
  responses: ReviewResponseItem[];
  summary: {
    totalQuestions: number;
    answeredCount: number;
    noMatchCount: number;       // 매칭 실패 건수
  };
}

/** 회신 내보내기 요청 */
export interface ExportResponseRequest {
  responses: ReviewResponseItem[];
  templateType: 'default' | 'custom';
  customTemplate?: string;      // base64 인코딩된 양식 파일 (미래)
}
```

### 3.2 types/index.ts 수정

```typescript
// FileGroup에 'review-doc' 추가
export type FileGroup =
  | 'report'
  | 'drawing'
  | 'quantity-calculation'
  | 'design-estimate'
  | 'specification'
  | 'guideline'
  | 'review-doc'          // ← 신규: 외부 검토서
  | 'etc';

// FILE_GROUP_LABELS에 추가
'review-doc': '📋 검토서',

// FILE_GROUP_DESCRIPTIONS에 추가
'review-doc': '외부 검토의견서, 심의의견서 등 — AI 자동 회신 생성 대상',

// suggestFileGroup에 추가
if (name.includes('검토') || name.includes('심의') || name.includes('의견'))
  return 'review-doc';
```

### 3.3 ParseResult 확장 (lib/parsers/index.ts)

```typescript
export interface ParseResult {
  content: string;
  pageCount?: number;
  sheetNames?: string[];
  isDxf?: boolean;
  /** 신규: 페이지별 텍스트 (PDF 검토회신용) */
  pageTexts?: Array<{ page: number; content: string }>;
}
```

### 3.4 ChatMessage 확장 (types/index.ts)

```typescript
export interface ChatMessage {
  // ... 기존 필드
  /** 검토 회신 결과 */
  reviewResponses?: import('./review-response').ReviewResponseItem[];
}
```

---

## 4. Module Design

### 4.1 검토서 질문 추출 — `lib/review-response/parse-questions.ts`

```typescript
import { getGeminiModelJSON } from '@/lib/gemini';
import type { ReviewQuestion } from '@/types/review-response';

/**
 * 검토서 CSV 텍스트에서 질문 항목 추출
 *
 * Gemini가 표 구조를 자동 인식하여:
 * - 번호, 분야, 질문 내용을 추출
 * - 열 이름이 다양해도 자동 판단 (검토의견/지적사항/질의내용 등)
 * - 빈 행, 소계 행 등 자동 제외
 */
export async function parseReviewQuestions(
  csvContent: string
): Promise<ReviewQuestion[]> {
  const jsonModel = getGeminiModelJSON();

  const prompt = `당신은 건설 설계 검토서 분석 전문가입니다.

아래 CSV는 외부 기관에서 보낸 **설계 검토의견서**입니다.
각 행에서 "검토 의견", "지적사항", "질의내용" 등에 해당하는 **질문/지적 항목**을 추출하세요.

## 추출 규칙:
1. 번호(순번) 열을 찾아서 number로 사용. 없으면 1부터 자동 부여
2. 분야/분류 열이 있으면 category로 사용. 없으면 "일반"
3. 질문/지적 내용이 있는 열을 찾아서 question으로 사용
4. 각 질문에서 핵심 키워드 2~5개를 keywords로 추출
5. 빈 행, 합계 행, 헤더 행은 제외
6. "회신", "답변", "조치" 열이 있어도 무시 (빈칸일 수 있음)
7. originalRow는 CSV에서의 행 번호 (1-based, 헤더 제외)

## CSV 내용:
${csvContent.slice(0, 30000)}

## 출력 형식 (JSON 배열):
[
  {
    "number": 1,
    "category": "설계",
    "question": "PE관 200mm 적용 근거를 제시하시오",
    "keywords": ["PE관", "200mm", "관경", "근거"],
    "originalRow": 2
  }
]`;

  const result = await jsonModel.generateContent(prompt);
  const text = result.response.text();
  const parsed = JSON.parse(text);
  const items = Array.isArray(parsed) ? parsed : (parsed?.items || []);

  return items.map((item: Record<string, unknown>, idx: number) => ({
    id: crypto.randomUUID(),
    number: Number(item.number) || idx + 1,
    category: String(item.category || '일반'),
    question: String(item.question || ''),
    keywords: Array.isArray(item.keywords) ? item.keywords.map(String) : [],
    originalRow: Number(item.originalRow) || idx + 2,
  }));
}
```

### 4.2 성과품 위치 검색 — `lib/review-response/search-sources.ts`

```typescript
import { searchKnowledge } from '@/lib/rag/index';
import type { ReviewQuestion, SourceMatch } from '@/types/review-response';
import type { UploadedFile } from '@/types';

/**
 * 성과품에서 질문 관련 위치를 검색
 *
 * 3단계 검색:
 * 1. 페이지 기반 검색 (PDF - pageTexts 활용)
 * 2. 섹션/단락명 기반 검색 (제목 패턴 매칭)
 * 3. RAG 임베딩 유사도 검색 (Supabase)
 */
export async function searchSources(
  question: ReviewQuestion,
  files: Array<{
    id: string;
    name: string;
    content: string;
    type: string;
    group: string | null;
  }>,
  sessionId?: string
): Promise<SourceMatch[]> {
  const matches: SourceMatch[] = [];

  // 검토서 자체는 검색 대상에서 제외
  const deliverables = files.filter(f => f.group !== 'review-doc');

  // --- 방식 1: 키워드 직접 텍스트 검색 ---
  for (const file of deliverables) {
    const keywordMatches = searchByKeyword(
      question.keywords,
      question.question,
      file
    );
    matches.push(...keywordMatches);
  }

  // --- 방식 2: 섹션/단락명 매칭 ---
  for (const file of deliverables) {
    const sectionMatches = searchBySection(
      question.keywords,
      file
    );
    matches.push(...sectionMatches);
  }

  // --- 방식 3: RAG 임베딩 검색 ---
  if (sessionId) {
    const ragMatches = await searchByEmbedding(
      question.question,
      sessionId,
      deliverables
    );
    matches.push(...ragMatches);
  }

  // 중복 제거 + 신뢰도 순 정렬 + 상위 3건
  return deduplicateAndRank(matches).slice(0, 3);
}

/** 키워드 직접 텍스트 검색 */
function searchByKeyword(
  keywords: string[],
  fullQuestion: string,
  file: { id: string; name: string; content: string }
): SourceMatch[] {
  const results: SourceMatch[] = [];
  const content = file.content;

  for (const keyword of keywords) {
    const idx = content.indexOf(keyword);
    if (idx === -1) continue;

    // 매칭 위치 주변 텍스트 추출
    const start = Math.max(0, idx - 100);
    const end = Math.min(content.length, idx + 200);
    const excerpt = content.slice(start, end).trim();

    // 페이지 번호 추출 (페이지 마커가 있는 경우)
    const page = extractPageNumber(content, idx);

    // 섹션명 추출 (가장 가까운 제목 찾기)
    const section = extractNearestSection(content, idx);

    results.push({
      fileId: file.id,
      fileName: file.name,
      matchType: page ? 'page' : 'keyword',
      page: page || undefined,
      section: section || undefined,
      excerpt,
      confidence: calculateKeywordConfidence(keywords, excerpt),
    });
  }

  return results;
}

/** 페이지 마커에서 페이지 번호 추출 */
function extractPageNumber(content: string, position: number): number | null {
  // "--- [page N] ---" 패턴 역방향 탐색
  const before = content.slice(0, position);
  const pageMatch = before.match(/---\s*\[page\s+(\d+)\]\s*---/g);
  if (pageMatch && pageMatch.length > 0) {
    const lastPage = pageMatch[pageMatch.length - 1];
    const num = lastPage.match(/(\d+)/);
    return num ? parseInt(num[1]) : null;
  }
  return null;
}

/** 가장 가까운 섹션/단락 제목 추출 */
function extractNearestSection(content: string, position: number): string | null {
  const before = content.slice(Math.max(0, position - 3000), position);

  // 제목 패턴: "제N장", "N.N", "N.N.N", "제N절", 등
  const patterns = [
    /(?:^|\n)(제\d+장\s+.+)/g,
    /(?:^|\n)(제\d+절\s+.+)/g,
    /(?:^|\n)(\d+\.\d+(?:\.\d+)?\s+.+)/g,
    /(?:^|\n)((?:Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ|Ⅵ)\.\s+.+)/g,
  ];

  let lastMatch: string | null = null;
  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(before)) !== null) {
      lastMatch = m[1].trim().slice(0, 80);
    }
  }
  return lastMatch;
}

/** 섹션/단락명 기반 검색 */
function searchBySection(
  keywords: string[],
  file: { id: string; name: string; content: string }
): SourceMatch[] {
  const results: SourceMatch[] = [];
  const content = file.content;

  // 섹션 제목 추출
  const sectionPattern = /(?:^|\n)((?:제\d+[장절]\s+|(?:\d+\.)+\d*\s+).+)/g;
  let m;
  const sections: Array<{ title: string; start: number }> = [];
  while ((m = sectionPattern.exec(content)) !== null) {
    sections.push({ title: m[1].trim(), start: m.index });
  }

  // 키워드와 섹션 제목 매칭
  for (const section of sections) {
    const matchCount = keywords.filter(kw =>
      section.title.includes(kw)
    ).length;

    if (matchCount === 0) continue;

    const sectionEnd = Math.min(content.length, section.start + 500);
    const excerpt = content.slice(section.start, sectionEnd).trim();

    results.push({
      fileId: file.id,
      fileName: file.name,
      matchType: 'section',
      section: section.title,
      page: extractPageNumber(content, section.start) || undefined,
      excerpt: excerpt.slice(0, 300),
      confidence: matchCount / keywords.length,
    });
  }

  return results;
}

/** RAG 임베딩 검색 */
async function searchByEmbedding(
  query: string,
  sessionId: string,
  files: Array<{ id: string; name: string }>
): Promise<SourceMatch[]> {
  try {
    const ragResults = await searchKnowledge({
      query,
      sessionId,
      topK: 3,
      threshold: 0.65,
    });

    return ragResults.map(r => ({
      fileId: files.find(f => r.source.includes(f.name))?.id || '',
      fileName: r.source,
      matchType: 'embedding' as const,
      section: r.section || undefined,
      page: r.page || undefined,
      excerpt: r.content.slice(0, 300),
      confidence: r.similarity,
    }));
  } catch {
    return [];
  }
}

/** 키워드 매칭 신뢰도 계산 */
function calculateKeywordConfidence(keywords: string[], text: string): number {
  if (keywords.length === 0) return 0.3;
  const matched = keywords.filter(kw => text.includes(kw)).length;
  return Math.min(0.95, 0.3 + (matched / keywords.length) * 0.6);
}

/** 중복 제거 + 신뢰도 순 정렬 */
function deduplicateAndRank(matches: SourceMatch[]): SourceMatch[] {
  // 같은 파일 + 같은 페이지/섹션은 중복
  const seen = new Set<string>();
  const unique = matches.filter(m => {
    const key = `${m.fileId}:${m.page || ''}:${m.section || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.sort((a, b) => b.confidence - a.confidence);
}
```

### 4.3 회신 자동 생성 — `lib/review-response/generate-answer.ts`

```typescript
import { getGeminiModelJSON } from '@/lib/gemini';
import { searchKnowledge, formatRAGContext } from '@/lib/rag/index';
import type {
  ReviewQuestion, ReviewResponseItem, SourceMatch
} from '@/types/review-response';

/**
 * 회신 초안 생성 (배치 5개씩)
 *
 * 각 질문에 대해:
 * 1. 매칭된 성과품 내용 + KDS/법령 RAG 컨텍스트 조합
 * 2. Gemini로 실무 톤의 회신 초안 생성
 */
export async function generateResponses(
  questions: ReviewQuestion[],
  sourcesByQuestion: Map<string, SourceMatch[]>,
  sessionId?: string
): Promise<ReviewResponseItem[]> {
  const responses: ReviewResponseItem[] = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE);
    const batchResponses = await generateBatch(
      batch, sourcesByQuestion, sessionId
    );
    responses.push(...batchResponses);
  }

  return responses;
}

/** 배치 단위 회신 생성 */
async function generateBatch(
  questions: ReviewQuestion[],
  sourcesByQuestion: Map<string, SourceMatch[]>,
  sessionId?: string
): Promise<ReviewResponseItem[]> {
  const jsonModel = getGeminiModelJSON();

  // 질문별 컨텍스트 구성
  const questionsWithContext = questions.map(q => {
    const sources = sourcesByQuestion.get(q.id) || [];
    const sourceText = sources.map(s => {
      const loc = [s.fileName, s.page ? `p.${s.page}` : '', s.section || '']
        .filter(Boolean).join(' > ');
      return `[${loc}]\n${s.excerpt}`;
    }).join('\n\n');

    return {
      number: q.number,
      category: q.category,
      question: q.question,
      sourceText: sourceText || '(관련 성과품 내용을 찾지 못했습니다)',
    };
  });

  // KDS/법령 RAG 검색 (질문 전체 키워드로)
  const allKeywords = questions.flatMap(q => q.keywords).join(' ');
  let ragContext = '';
  if (sessionId) {
    try {
      const ragResults = await searchKnowledge({
        query: allKeywords,
        sessionId,
        topK: 5,
        threshold: 0.6,
      });
      if (ragResults.length > 0) {
        ragContext = `\n\n## 관련 KDS/법령 기준:\n${formatRAGContext(ragResults)}`;
      }
    } catch { /* RAG 실패 시 무시 */ }
  }

  const prompt = `당신은 상하수도 설계 실무자입니다.
외부 검토기관의 검토의견에 대한 **회신문**을 작성하세요.

## 회신 작성 규칙:
1. 근거 위치를 먼저 명시 (예: "기본설계보고서 p.45 '3.2 관경 산정' 참조")
2. 설계 기준(KDS, 법령)이 있으면 인용
3. 정중하고 전문적인 실무 톤 ("~하였습니다", "~반영하겠습니다")
4. 수치가 있으면 정확히 기재
5. 성과품에서 내용을 찾지 못한 경우 "확인 후 보완하겠습니다" 등으로 작성
6. 각 회신은 2~5문장으로 간결하게

## 검토 의견 목록:
${questionsWithContext.map(q => `
### [${q.number}] ${q.category}
**의견**: ${q.question}
**관련 성과품 내용**:
${q.sourceText}
`).join('\n---\n')}
${ragContext}

## 출력 형식 (JSON 배열):
[
  {
    "number": 1,
    "answer": "회신 내용"
  }
]`;

  try {
    const result = await jsonModel.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);
    const items = Array.isArray(parsed) ? parsed : (parsed?.items || []);

    return questions.map((q, idx) => {
      const answer = items.find(
        (a: { number?: number }) => a.number === q.number
      );
      return {
        id: crypto.randomUUID(),
        questionId: q.id,
        question: q,
        sources: sourcesByQuestion.get(q.id) || [],
        draftAnswer: answer?.answer
          ? String(answer.answer)
          : '관련 내용을 확인 후 회신드리겠습니다.',
        status: 'draft' as const,
      };
    });
  } catch (error) {
    console.error('[ReviewResponse] 회신 생성 실패:', error);
    return questions.map(q => ({
      id: crypto.randomUUID(),
      questionId: q.id,
      question: q,
      sources: sourcesByQuestion.get(q.id) || [],
      draftAnswer: '(AI 회신 생성 실패 — 직접 작성해주세요)',
      status: 'draft' as const,
    }));
  }
}
```

### 4.4 API 엔드포인트 — `app/api/review-response/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { parseReviewQuestions } from '@/lib/review-response/parse-questions';
import { searchSources } from '@/lib/review-response/search-sources';
import { generateResponses } from '@/lib/review-response/generate-answer';
import type { ReviewResponseRequest, ReviewResponseResult } from '@/types/review-response';

export async function POST(request: NextRequest) {
  try {
    const body: ReviewResponseRequest = await request.json();
    const { reviewDocContent, deliverableFiles, sessionId } = body;

    if (!reviewDocContent) {
      return NextResponse.json(
        { error: '검토서 내용이 없습니다.' },
        { status: 400 }
      );
    }

    if (deliverableFiles.length === 0) {
      return NextResponse.json(
        { error: '성과품 파일이 없습니다. 파일을 먼저 업로드하세요.' },
        { status: 400 }
      );
    }

    console.log(`[ReviewResponse] 검토 회신 시작 — 성과품 ${deliverableFiles.length}건`);

    // Phase 1: 질문 추출
    console.log('[ReviewResponse] Phase 1: 질문 추출 중...');
    const questions = await parseReviewQuestions(reviewDocContent);
    console.log(`[ReviewResponse] ${questions.length}개 질문 추출됨`);

    if (questions.length === 0) {
      return NextResponse.json(
        { error: '검토서에서 질문을 추출하지 못했습니다. 검토서 형식을 확인하세요.' },
        { status: 400 }
      );
    }

    // Phase 2: 성과품 위치 검색
    console.log('[ReviewResponse] Phase 2: 성과품 위치 검색 중...');
    const sourcesByQuestion = new Map<string, import('@/types/review-response').SourceMatch[]>();
    for (const q of questions) {
      const sources = await searchSources(q, deliverableFiles, sessionId);
      sourcesByQuestion.set(q.id, sources);
    }

    // Phase 3: 회신 초안 생성
    console.log('[ReviewResponse] Phase 3: 회신 초안 생성 중...');
    const responses = await generateResponses(
      questions, sourcesByQuestion, sessionId
    );

    const noMatchCount = responses.filter(
      r => r.sources.length === 0
    ).length;

    const result: ReviewResponseResult = {
      questions,
      responses,
      summary: {
        totalQuestions: questions.length,
        answeredCount: responses.length,
        noMatchCount,
      },
    };

    console.log(`[ReviewResponse] 완료 — ${questions.length}개 질문, ${noMatchCount}개 매칭 실패`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ReviewResponse] API 오류:', error);
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    if (message.includes('429') || message.includes('quota')) {
      return NextResponse.json(
        { error: 'Gemini 무료 사용량 한도에 도달했습니다. 1분 후 다시 시도하세요.' },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: `검토 회신 생성 중 오류: ${message}` },
      { status: 500 }
    );
  }
}
```

---

## 5. UI Components

### 5.1 ReviewResponseCard — `components/chat/ReviewResponseCard.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│ 📋 검토 회신 결과 (12개 항목) — 매칭 실패 2건              │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ #1 [설계] PE관 200mm 적용 근거를 제시하시오     [초안] │ │
│ │                                                         │ │
│ │ 📍 근거 위치:                                           │ │
│ │   • 기본설계보고서.pdf p.45 > 3.2 관경 산정 (92%)       │ │
│ │   • 관로제원표.xlsx > Sheet1 (78%)                      │ │
│ │                                                         │ │
│ │ 💬 회신:                                                │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ PE관 관경 200mm는 KDS 61 40 10 §3.1.1에 따른      │ │ │
│ │ │ 오수관 최소관경(200mm) 기준을 만족하며,             │ │ │
│ │ │ 기본설계보고서 p.45 '3.2 관경 산정'에 산출          │ │ │
│ │ │ 근거를 명시하였습니다.                               │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ │                                     [🔄 재생성] [✅ 확정] │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ #2 [시공] NO.3~5 구간 토피 부족 검토            [초안] │ │
│ │ ...                                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [📥 회신서 XLSX 다운로드]                    [전체 확정 ✅] │
└─────────────────────────────────────────────────────────────┘
```

#### 컴포넌트 구조

```typescript
// 상위: 전체 회신 결과 카드
function ReviewResponseCard({
  responses,
  onUpdateAnswer,
  onRegenerateOne,
  onConfirmOne,
  onConfirmAll,
  onExportXlsx,
}: Props) {
  // 상태: 확장/축소, 필터(전체/초안/확정)
}

// 하위: 개별 회신 항목
function ResponseItem({
  response,
  index,
  onUpdateAnswer,
  onRegenerate,
  onConfirm,
}: ItemProps) {
  // textarea로 답변 편집
  // 상태 배지 (초안 → 수정됨 → 확정)
  // 근거 위치 목록
}
```

#### 상태 배지 색상

| 상태 | 배지 | 색상 |
|------|------|------|
| draft | 초안 | 노란 `bg-amber-100 text-amber-700` |
| edited | 수정됨 | 파란 `bg-blue-100 text-blue-700` |
| confirmed | 확정 | 초록 `bg-green-100 text-green-700` |

### 5.2 MessageList.tsx 수정

```typescript
// 기존 reviewCards, permitCards, dxfAnalysis 렌더링과 동일 패턴
{message.reviewResponses && message.reviewResponses.length > 0 && (
  <ReviewResponseCard
    responses={message.reviewResponses}
    onUpdateAnswer={...}
    onRegenerateOne={...}
    onConfirmOne={...}
    onConfirmAll={...}
    onExportXlsx={...}
  />
)}
```

---

## 6. PDF 페이지 마커 추가

### 6.1 parsePDF 수정 (lib/parsers/index.ts)

```typescript
export async function parsePDF(buffer: Buffer): Promise<ParseResult> {
  const data = await pdf(buffer);

  // 페이지별 텍스트 분리 (pdf-parse는 전체 텍스트만 반환)
  // \f (form feed) 또는 다른 패턴으로 페이지 구분
  const pages = data.text.split('\f').filter(p => p.trim());
  const pageTexts = pages.map((text, idx) => ({
    page: idx + 1,
    content: text.trim(),
  }));

  // 페이지 마커를 삽입한 통합 텍스트 생성
  const contentWithMarkers = pageTexts
    .map(pt => `--- [page ${pt.page}] ---\n${pt.content}`)
    .join('\n\n');

  return {
    content: contentWithMarkers || data.text,
    pageCount: data.numpages,
    pageTexts,
  };
}
```

**핵심**: 기존 `data.text`를 그대로 쓰되, 페이지 마커 `--- [page N] ---`를 삽입하여 나중에 위치 추적 가능하게 함.

---

## 7. review/page.tsx 수정사항

### 7.1 키워드 감지 추가

```typescript
const isReviewResponseCommand = (text: string) => {
  const keywords = ['검토 회신', '검토회신', '회신 작성', '회신작성',
                     '의견 회신', '의견회신', '검토서 분석', '검토서분석'];
  return keywords.some(kw => text.includes(kw));
};
```

### 7.2 handleReviewResponse 핸들러

```typescript
const handleReviewResponse = useCallback(async () => {
  // 검토서 파일 찾기 (group === 'review-doc')
  const reviewDocs = files.filter(
    f => f.group === 'review-doc' && f.status === 'ready' && f.content
  );
  if (reviewDocs.length === 0) {
    addToast('warning', '검토서가 없습니다. 검토서(XLSX)를 업로드하고 그룹을 "검토서"로 설정하세요.');
    return;
  }

  // 성과품 파일 (검토서 제외)
  const deliverables = files.filter(
    f => f.group !== 'review-doc' && f.status === 'ready' && f.content
  );
  if (deliverables.length === 0) {
    addToast('warning', '성과품 파일이 없습니다. 설계 성과품을 먼저 업로드하세요.');
    return;
  }

  // API 호출
  const response = await fetch('/api/review-response', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reviewDocContent: reviewDocs[0].content,
      deliverableFiles: deliverables.map(f => ({
        id: f.id, name: f.name, content: f.content,
        type: f.type, group: f.group,
      })),
      sessionId: activeProjectId || sessionIdRef.current,
    }),
  });

  // 결과 메시지에 reviewResponses 포함
  const data = await response.json();
  const resultMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: `## 검토 회신 완료\n\n총 **${data.summary.totalQuestions}개** 질문 | 회신 ${data.summary.answeredCount}건 | 매칭실패 ${data.summary.noMatchCount}건`,
    timestamp: new Date(),
    reviewResponses: data.responses,
  };
  setMessages(prev => [...prev, resultMessage]);
}, [files, activeProjectId, addToast]);
```

---

## 8. XLSX 내보내기 — `app/api/export-response/route.ts`

### 8.1 기본 양식 출력

```typescript
import * as XLSX from 'xlsx';

// 기본 양식: 번호 | 분야 | 검토의견 | 근거위치 | 회신내용
function createDefaultTemplate(responses: ReviewResponseItem[]): Buffer {
  const wb = XLSX.utils.book_new();

  const data = [
    ['번호', '분야', '검토 의견', '근거 위치', '회신 내용'],
    ...responses.map(r => [
      r.question.number,
      r.question.category,
      r.question.question,
      r.sources.map(s => {
        const parts = [s.fileName];
        if (s.page) parts.push(`p.${s.page}`);
        if (s.section) parts.push(s.section);
        return parts.join(' > ');
      }).join('\n'),
      r.editedAnswer || r.draftAnswer,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // 열 너비 설정
  ws['!cols'] = [
    { wch: 6 },   // 번호
    { wch: 10 },  // 분야
    { wch: 40 },  // 검토의견
    { wch: 30 },  // 근거위치
    { wch: 50 },  // 회신내용
  ];

  XLSX.utils.book_append_sheet(wb, ws, '검토회신');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
```

### 8.2 회사 양식 템플릿 지원 (미래)

```typescript
// 사용자가 양식 파일을 업로드하면:
// 1. 양식 XLSX를 읽어서 기존 구조 파악
// 2. "회신" 열 위치를 자동 감지 또는 사용자 지정
// 3. 해당 셀에 회신 내용 삽입
// 4. 수정된 XLSX 반환

function fillCustomTemplate(
  templateBuffer: Buffer,
  responses: ReviewResponseItem[],
  columnMapping: { answerCol: string; locationCol?: string }
): Buffer {
  const wb = XLSX.read(templateBuffer);
  const ws = wb.Sheets[wb.SheetNames[0]];
  // ... 셀 매핑 로직
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
```

---

## 9. 구현 순서 체크리스트

```
Step 1: 기반 타입 + 검토서 파싱
  □ types/review-response.ts 생성
  □ types/index.ts — FileGroup에 'review-doc' 추가
  □ lib/review-response/parse-questions.ts 구현
  □ 검토서 파싱 단독 테스트

Step 2: PDF 페이지 마커 + 위치 검색
  □ lib/parsers/index.ts — parsePDF 페이지 마커 추가
  □ lib/review-response/search-sources.ts 구현
  □ 위치 검색 단독 테스트

Step 3: 회신 생성 + API
  □ lib/review-response/generate-answer.ts 구현
  □ app/api/review-response/route.ts 구현
  □ API 통합 테스트

Step 4: UI + 내보내기
  □ components/chat/ReviewResponseCard.tsx 구현
  □ components/chat/MessageList.tsx — ReviewResponseCard 렌더링 추가
  □ app/review/page.tsx — 키워드 감지 + 핸들러 추가
  □ app/api/export-response/route.ts 구현
  □ 전체 통합 테스트
```

---

## 10. 대기/확장 항목

- **회사 양식 XLSX**: 사용자 제공 후 Step 4에서 커스텀 템플릿 기능 추가
- **실시간 진행률**: 질문 N개 중 몇 번째 처리 중인지 스트리밍 표시 (SSE)
- **검토서 재파싱**: 다른 검토서를 업로드하면 이전 회신 결과 대체
- **회신 이력 저장**: Supabase에 회신 결과 저장 (review_responses 테이블)
