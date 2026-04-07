# 통합 참고문서 뷰어 — Planning Document

> **Summary**: 상하수도 설계기준(KDS) + 표준시방서(KCS) + 전문시방서(KWCS)를 사전 변환된 이미지로 연속 열람하고, 계층형 목차 클릭으로 해당 내용에 즉시 이동할 수 있는 전체화면 뷰어. 하나의 플랫폼에서 설계에 필요한 모든 참고문서를 열람.
>
> **Project**: water-sewage-review
> **Version**: 0.2.0
> **Author**: AI 설계 검토 팀
> **Date**: 2026-04-01
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

상하수도 설계 엔지니어가 설계 검토 중 참고문서(설계기준, 시방서)를 참조할 때, **기존 PDF/HWP보다 더 빠르고 직관적으로** 원하는 조항을 찾아 열람할 수 있도록 한다. 하나의 플랫폼에서 **설계검토 + 법령 + 설계기준 + 시방서**를 모두 사용할 수 있는 통합 환경을 제공한다.

### 1.2 Background

- 현재 설계기준 탭은 Supabase 텍스트 청크(1,436개) 검색만 가능 → 표/그림/수식 소실, 원문 맥락 파악 불가
- 시방서 탭은 메타정보(이름, 관련법령)만 표시 → 실제 내용 열람 불가
- 엔지니어는 검토 중 원본 PDF/HWP를 별도로 열어 대조 → 작업 흐름 단절
- KDS 임베딩 경험: 가독성 저하 + 데이터 가공 어려움 → **원본 이미지 방식 채택**
- **목표**: "원본보다 더 뛰어난 가독성"으로 모든 연령대가 편하게 사용

### 1.3 Design Decisions (시니어 리뷰 반영)

| 결정 사항 | 선택 | 근거 |
|-----------|------|------|
| 렌더링 방식 | **사전 생성 이미지** (WebP) | pdfjs-dist 캔버스 렌더링은 CMap(3.7MB)+Worker(1.4MB) 번들 부담, 한글 깨짐 리스크 |
| 뷰어 위치 | **전체화면 모달/오버레이** | 오른쪽 패널 기본 280px에 TOC+PDF 중첩은 가독성 불가 |
| 스크롤 방식 | **`<img loading="lazy">`** 네이티브 | IntersectionObserver 직접 구현(2~3주)은 과잉 투자 |
| 검색 방식 | **기존 Supabase 청크 검색 재활용** | pdfjs 텍스트 레이어 검색은 242p 전체 로딩 필요 → 무거움 |
| TOC 데이터 | **원본 목차 기반 정적 정의 + 수동 보완** | 정적 페이지 번호만은 PDF 개정 시 깨짐 |
| 시방서 원본 확보 | **KCSC HWP 다운 → 한/글 PDF 변환** | KCSC는 HWP만 제공, PDF 직접 다운 불가 |
| 시방서 범위 | **핵심 10~15종 선별 → 점진적 확장** | 104종 전체는 수동 변환 부담, MVP 우선 |
| 임베딩 여부 | **열람용 이미지만, 임베딩 안 함** | 임베딩 가독성 저하 경험, 검색은 기존 인프라 활용 |

### 1.4 Related Documents

- `components/law/LawNavigator.tsx`: 설계기준/시방서 탭 (현재 메타정보+텍스트검색)
- `app/api/kds-search/route.ts`: Supabase knowledge_base 텍스트 검색 API
- `scripts/embed-kds.ts`: KDS 임베딩 스크립트 (청크 구조 참조)
- `public/kds/`: 원본 PDF 파일 (gitignored)

---

## 2. 대상 문서 목록

### 2.1 설계기준 (KDS) — 이미 보유

| # | 코드 | 문서명 | 페이지 | 상태 |
|---|------|--------|--------|------|
| 1 | KDS 57 00 00 | 상수도설계기준 (2024) | 186p | ✅ PDF 보유 |
| 2 | KDS 61 00 00 | 하수도설계기준 (2022) | 242p | ✅ PDF 보유 |

### 2.2 표준시방서 (KCS) — 핵심 선별 (KCSC 다운로드 필요)

**상수도 (KCS 57):**

| # | 코드 | 문서명 | 우선순위 |
|---|------|--------|----------|
| 3 | KCS 57 10 05 | 상수도공사 일반사항 | ★★★ |
| 4 | KCS 57 30 00 | 도수·송수·배수 관로 부설공사 | ★★★ |
| 5 | KCS 57 20 15 | 취수시설 설치공사 | ★★☆ |
| 6 | KCS 57 40 10 | 정수처리시설 설치공사 | ★★☆ |
| 7 | KCS 57 80 05 | 기계공사 일반사항 | ★★☆ |
| 8 | KCS 57 90 00 | 전기공사 | ★☆☆ |
| 9 | KCS 57 95 00 | 계측제어공사 | ★☆☆ |

**하수도 (KCS 61):**

| # | 코드 | 문서명 | 우선순위 |
|---|------|--------|----------|
| 10 | KCS 61 10 00 | 하수도공사 일반사항 | ★★★ |
| 11 | KCS 61 20 00 | 하수관로 부설공사 | ★★★ |
| 12 | KCS 61 40 00 | 하수도 부속설비공사 | ★★☆ |
| 13 | KCS 61 50 10 | 펌프장 기계공사 | ★★☆ |
| 14 | KCS 61 70 00 | 추진공사 | ★☆☆ |

**공통:**

| # | 코드 | 문서명 | 우선순위 |
|---|------|--------|----------|
| 15 | KCS 14 20 10 | 콘크리트공사 일반사항 | ★★★ |
| 16 | KCS 11 10 05 | 토공사 일반사항 | ★★☆ |

### 2.3 전문시방서 (KWCS) — 향후 확장

| 분류 | 수량 | 비고 |
|------|------|------|
| KWCS K-water | 88종 | K-water 프로젝트 수주 시 추가 |

> **1단계 MVP**: KDS 2종 + KCS 핵심 12~14종 = **총 14~16종**
> **2단계 확장**: 나머지 KCS + KWCS 선별 추가

---

## 3. 문서 확보 및 변환 가이드

### 3.1 KCSC 다운로드 절차

```
1. https://www.kcsc.re.kr/ 접속
2. 상단 메뉴 "건설기준" → "표준시방서(KCS)"
3. 분류 선택: [57] 상수도 또는 [61] 하수도
4. 해당 코드 클릭 → HWP 다운로드
5. 파일 저장 위치: data/kcs-hwp/
```

### 3.2 HWP → PDF 변환

```
[권장] 한/글에서 직접 변환 (최고 품질)

1. 한/글 프로그램에서 HWP 파일 열기
2. 파일 → 다른 이름으로 저장 → PDF 선택
3. 저장 위치: data/kcs-pdf/
4. 파일명 규칙: KCS_57_10_05_상수도공사_일반사항.pdf
```

### 3.3 PDF → WebP 이미지 변환 (자동화)

```
[스크립트 1회 실행]

node scripts/convert-doc-images.js data/kcs-pdf/

결과:
  data/doc-images/
    ├── kds-57/          ← 상수도설계기준
    │   ├── page-001.webp
    │   └── ...page-186.webp
    ├── kds-61/          ← 하수도설계기준
    │   ├── page-001.webp
    │   └── ...page-242.webp
    ├── kcs-57-10-05/    ← 상수도공사 일반사항
    │   ├── page-001.webp
    │   └── ...
    ├── kcs-57-30-00/    ← 관로 부설공사
    │   └── ...
    └── kcs-61-10-00/    ← 하수도공사 일반사항
        └── ...
```

### 3.4 Supabase Storage 업로드

```
버킷: doc-images (public)
경로: /doc-images/{문서코드}/page-{NNN}.webp
예시: /doc-images/kds-57/page-001.webp
     /doc-images/kcs-57-10-05/page-001.webp

예상 용량:
  KDS 2종: ~21MB (428p)
  KCS 14종: ~70MB (추정 1,400p, 종당 ~100p)
  합계: ~91MB (Supabase 무료 1GB 중 9%)
```

---

## 4. Technical Approach

### 4.1 통합 문서 카탈로그 구조

```typescript
// lib/docs/catalog.ts

type DocCategory = 'kds' | 'kcs' | 'kwcs';

interface DocEntry {
  id: string;              // "kds-57", "kcs-57-10-05"
  category: DocCategory;
  code: string;            // "KDS 57 00 00", "KCS 57 10 05"
  title: string;           // "상수도설계기준"
  shortTitle: string;      // "상수도설계"
  field: '상수도' | '하수도' | '공통';
  version: string;         // "2024"
  totalPages: number;
  imageBasePath: string;   // Supabase Storage URL prefix
  toc: TocItem[];          // 목차 데이터
}

interface TocItem {
  id: string;
  title: string;
  page: number;
  level: 1 | 2 | 3;
  children?: TocItem[];
}
```

### 4.2 뷰어 모달 레이아웃

```
┌─────────────────────────────────────────────────────────────┐
│  ← 닫기    📐 상수도설계기준 (KDS 57, 2024)                 │
│            [설계기준] [표준시방서] [전문시방서]                │
│                                   🔍검색  [−][+] 100%       │
├─────────────┬───────────────────────────────────────────────┤
│ 문서 선택    │  이미지 연속 스크롤 영역                       │
│ ▼ 상수도    │                                              │
│   KDS 57    │  ┌───────────────────────────────────┐       │
│   KCS 57-10 │  │     page-001.webp                 │       │
│   KCS 57-30 │  │     (lazy loading)                │       │
│   KCS 57-40 │  └───────────────────────────────────┘       │
│ ▼ 하수도    │  ─── p.1 ─────────────────────────────       │
│   KDS 61    │  ┌───────────────────────────────────┐       │
│   KCS 61-10 │  │     page-002.webp                 │       │
│   KCS 61-20 │  └───────────────────────────────────┘       │
│ ▶ 공통      │                                              │
│   KCS 14-20 │                                              │
│─────────────│                                              │
│ 목차 (TOC)  │                                              │
│ ▼ 1. 총칙   │                                              │
│   1.1 적용  │  ┌────────────────────────────────┐          │
│   1.2 참고  │  │ p.3 / 186                      │          │
│ ▶ 2. 관로   │  └────────────────────────────────┘          │
└─────────────┴───────────────────────────────────────────────┘
```

### 4.3 기존 탭과 연동

```
[사용자 흐름 A — 설계기준 탭]
설계기준 탭 → KDS 클릭 → 모달 뷰어 오픈

[사용자 흐름 B — 시방서 탭]
시방서 탭 → KCS 클릭 → 모달 뷰어 오픈

[사용자 흐름 C — 검색 결과]
KDS 검색 → 결과 카드 [원문 보기] → 모달 + 해당 페이지

[사용자 흐름 D — AI 검토 결과]
검토 결과 "KDS 57 55 00 4.3.2" 참조 → 클릭 → 모달 + 해당 페이지 (향후)
```

---

## 5. Scope

### 5.1 In Scope

- [ ] PDF → WebP 이미지 사전 변환 스크립트 (`scripts/convert-doc-images.js`)
- [ ] 변환된 이미지 Supabase Storage 업로드 스크립트
- [ ] 통합 문서 카탈로그 데이터 (`lib/docs/catalog.ts`)
- [ ] 상수도 KDS 목차 (10편, 2단계 계층)
- [ ] 하수도 KDS 목차 (9편, 2단계 계층)
- [ ] KCS 시방서 목차 (KCSC 다운로드 후 추출)
- [ ] 전체화면 모달 뷰어 (`DocViewerModal.tsx`)
- [ ] 문서 선택 + 계층형 TOC 사이드바 (`DocToc.tsx`)
- [ ] 이미지 연속 스크롤 뷰어 (`DocPageViewer.tsx`)
- [ ] TOC 클릭 → 해당 페이지 스크롤 이동
- [ ] 스크롤 위치 → TOC 현재 섹션 하이라이트
- [ ] 문서 카테고리/분야 탭 전환
- [ ] 줌 컨트롤 (75%, 100%, 125%, 150%)
- [ ] 페이지 번호 표시 및 페이지 이동
- [ ] LawNavigator 설계기준 탭 연동
- [ ] LawNavigator 시방서 탭 연동
- [ ] 기존 Supabase 검색 → 뷰어 페이지 이동 연동
- [ ] KCSC 다운로드 가이드 문서

### 5.2 Out of Scope

- 텍스트 선택/복사 (이미지 방식 한계, 검색은 Supabase로 대체)
- 주석/메모/하이라이트 기능 (향후 Phase)
- KWCS 전문시방서 (향후 확장)
- 시방서 임베딩 (가독성 저하 경험, 불필요)
- 모바일 전용 UI (데스크톱 우선)

### 5.3 Assumptions

- 원본 문서는 변경 빈도 낮음 (2~3년 주기 개정)
- 문서 개정 시 변환 스크립트 재실행으로 이미지 갱신
- Supabase Storage 무료 1GB 중 ~91MB 사용 (여유 충분)
- 사내 데스크톱 환경 기준 (1280px+ 해상도)
- 사용자 PC에 한/글 설치됨 (HWP→PDF 변환 가능)

---

## 6. Implementation Plan

### Phase 0: 문서 확보 (사용자 작업)

| 작업 | 설명 | 담당 |
|------|------|------|
| 0-1 | KCSC에서 KCS 57/61 핵심 12~14종 HWP 다운로드 | 사용자 |
| 0-2 | 한/글에서 HWP → PDF 변환 (종당 2분, 총 30분) | 사용자 |
| 0-3 | `data/kcs-pdf/` 폴더에 PDF 파일 배치 | 사용자 |

### Phase A: 이미지 변환 인프라

| 작업 | 설명 | 예상 |
|------|------|------|
| A-1 | `scripts/convert-doc-images.js` 통합 변환 스크립트 | 1h |
| A-2 | 의존성 설치 (node-canvas 또는 대안) | 0.5h |
| A-3 | KDS 2종 + KCS 12~14종 WebP 변환 실행 | 0.5h |
| A-4 | Supabase Storage `doc-images` 버킷 생성 + 업로드 | 0.5h |
| A-5 | 이미지 URL 접근 확인 | 0.5h |

### Phase B: 카탈로그 + 뷰어 기본

| 작업 | 설명 | 예상 |
|------|------|------|
| B-1 | `lib/docs/catalog.ts` — 통합 문서 카탈로그 | 1.5h |
| B-2 | KDS 목차 데이터 (상수도 10편 + 하수도 9편) | 1.5h |
| B-3 | KCS 목차 데이터 (PDF에서 추출) | 2h |
| B-4 | `DocViewerModal.tsx` — 전체화면 모달 골격 | 1h |
| B-5 | `DocPageViewer.tsx` — 이미지 연속 스크롤 | 1h |
| B-6 | `DocToc.tsx` — 문서선택 + 목차 사이드바 | 1.5h |

### Phase C: 네비게이션 + 연동

| 작업 | 설명 | 예상 |
|------|------|------|
| C-1 | TOC 클릭 → 해당 페이지 scrollIntoView | 0.5h |
| C-2 | 스크롤 위치 → TOC 현재 섹션 하이라이트 | 1h |
| C-3 | 줌 컨트롤 (CSS transform scale) | 0.5h |
| C-4 | 문서 카테고리/분야 전환 | 0.5h |
| C-5 | 페이지 번호 표시 + 직접 이동 | 0.5h |
| C-6 | LawNavigator 설계기준 탭 → 모달 오픈 | 0.5h |
| C-7 | LawNavigator 시방서 탭 → 모달 오픈 | 0.5h |
| C-8 | KdsResultCard [원문 보기] → 뷰어 페이지 이동 | 0.5h |
| C-9 | 뷰어 내 검색 → Supabase API → 페이지 이동 | 1h |

### Phase D: 품질 + 배포

| 작업 | 설명 | 예상 |
|------|------|------|
| D-1 | ESC 닫기, 키보드 탐색 (↑↓ 페이지) | 0.5h |
| D-2 | 로딩 스켈레톤 (이미지 로딩 중 placeholder) | 0.5h |
| D-3 | 빌드 확인 (`npm run build`) | 0.5h |
| D-4 | 실사용 테스트 + 가독성 확인 | 0.5h |

---

## 7. Risks & Mitigations

| 리스크 | 영향 | 대응 |
|--------|------|------|
| node-canvas Windows 설치 실패 | Phase A 차단 | 대안: Python(pdfplumber+Pillow) 스크립트 |
| KCSC에서 일부 KCS HWP 미제공 | 문서 누락 | 해당 문서 제외, CODIL 등 대안 경로 탐색 |
| HWP→PDF 변환 시 서식 깨짐 | 가독성 저하 | 한/글 직접 변환 권장 (LibreOffice 비추천) |
| Supabase Storage 대역폭 한계 | 이미지 로딩 느림 | CDN 캐싱 or public/ 폴더 직접 배치 |
| ~1,800장 이미지 로딩 성능 | 스크롤 끊김 | 문서별 lazy loading + placeholder 높이 지정 |
| PDF 개정 시 TOC 페이지 불일치 | 잘못된 위치 이동 | 개정 시 재변환 가이드 문서 포함 |

---

## 8. File Structure

```
신규 파일:
├── scripts/convert-doc-images.js      ← PDF→WebP 통합 변환 스크립트
├── scripts/upload-doc-images.js       ← Supabase Storage 업로드
├── lib/docs/catalog.ts                ← 통합 문서 카탈로그 (KDS+KCS+KWCS)
├── lib/docs/toc-kds-57.ts            ← 상수도 설계기준 목차
├── lib/docs/toc-kds-61.ts            ← 하수도 설계기준 목차
├── lib/docs/toc-kcs.ts               ← KCS 시방서 목차 (종별)
├── components/doc-viewer/
│   ├── DocViewerModal.tsx             ← 전체화면 모달 (진입점)
│   ├── DocToc.tsx                     ← 문서선택 + 계층형 목차
│   └── DocPageViewer.tsx              ← 이미지 연속 스크롤 뷰어
├── data/kcs-pdf/                      ← KCS PDF 원본 (gitignored)
├── data/doc-images/                   ← 변환된 WebP (gitignored, Storage 업로드)
└── docs/guides/kcsc-download.md       ← KCSC 다운로드 가이드

수정 파일:
├── components/law/LawNavigator.tsx    ← 설계기준/시방서 탭에서 모달 오픈 트리거
└── app/api/kds-search/route.ts        ← page 번호 반환 보강
```

---

## 9. Success Criteria

- [ ] KDS 2종 + KCS 12~14종을 전체화면 모달에서 연속 스크롤로 열람 가능
- [ ] 원본 목차 기반 TOC 클릭 시 1초 이내 해당 페이지로 이동
- [ ] 스크롤 시 현재 섹션이 TOC에서 자동 하이라이트
- [ ] 설계기준 탭, 시방서 탭 모두에서 해당 문서 뷰어 오픈 가능
- [ ] 기존 KDS 검색 결과에서 [원문 보기] 클릭 → 해당 페이지 즉시 표시
- [ ] 줌 75%~150% 범위에서 텍스트 가독성 유지
- [ ] `npm run build` 성공 (런타임 JS 추가 최소화)
- [ ] 초기 로딩 3초 이내 (첫 5페이지 기준)
- [ ] 향후 KWCS 추가 시 catalog.ts에 항목만 추가하면 동작
