# 프로젝트 진행 상황

> 이 문서는 Claude Code에서 작업을 이어받기 위한 상세 현황 기록입니다.
> 마지막 업데이트: 2026-04-02 (Phase 5 — 멀티페이지 + 참고문서 챗봇 + 법령 UI 개선 완료)

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
- [x] KDS 임베딩 CLI 스크립트 (scripts/embed-kds.ts) — 배치(100개/호출) + resume 기능
- [x] RAG 검색 엔진 (lib/rag/index.ts) — Layer 1 + Layer 2 동시 검색
- [x] 설계 검토 엔진 (lib/rag/reviewer.ts) — 설계값 추출 + 규칙 비교 + RAG 판정
- [x] 인허가 15종 자동 판단 (lib/rag/permit.ts) — 키워드 + 수치 조건
- [x] 인허가 원스톱 체크리스트 (PermitChecklist.tsx)
- [x] 인허가 일정 간트 차트 (PermitGantt.tsx)
- [x] 인허가 설계사 가이드 (PermitGuide.tsx)
- [x] 검토 보고서 PDF 출력 (lib/report/ReportTemplate.tsx)
- [x] 검토 API (app/api/review/route.ts) + 이력 자동 저장

### Phase 2.5 — DXF 인허가 자동 분석 ✅ (PDCA 92%)
- [x] DXF 파일 파싱 (lib/parsers/dxf.ts)
- [x] 레이어 접두사 분류 ($설계/#인허가/지적/일반)
- [x] #레이어 → 인허가 자동 매핑 (10종)
- [x] 지적 텍스트 파싱 + 도넛형 필지 판별
- [x] 통합 분석 오케스트레이터 (permit-mapper.ts)
- [x] **공간 교차 분석 Phase B** (lib/dxf/spatial-analyzer.ts)
  - Turf.js 기반 $레이어 × #레이어 교차 분석
  - 교차 연장(m) / 교차 면적(m²) 자동 산출
  - BBox 빠른 거부 + 엔티티 수 제한(3000/500)
- [x] DXF 분석 결과 카드 (DxfAnalysisCard.tsx) — 공간 교차 수치 표시

### Phase 3 — 법령 연동 + 조례 대응 ✅
- [x] 법제처 Open API 프록시 + 브라우저 직접 호출 방식
- [x] LawNavigator — 검색 + 조문 상세 + 바로가기
- [x] 법제처 API 키 등록 (OC=jonghyeon)
- [x] 조례 바로가기 3종 추가 (하수도사용조례, 도로굴착복구, 수도급수조례)
- [x] 인허가 관련 조례 참조 매핑 (permit-info.ts에 relatedOrdinances 필드)
- [x] **법령 3단비교** (법률↔시행령↔시행규칙 비교 뷰) ← **신규**

### Phase 3.5 — 검토 이력 관리 ✅
- [x] review_history 테이블 SQL (scripts/create-review-history.sql)
- [x] History REST API (app/api/history/route.ts) — GET/POST/DELETE
- [x] 검토 완료 시 자동 이력 저장 (review/route.ts 연동)
- [x] ReviewHistory UI 컴포넌트 (접기/펼치기, 페이지네이션, 삭제)
- [x] ChatPanel 초기 화면에 검토 이력 통합
- [ ] **Supabase에 review_history 테이블 생성 필요** (SQL 실행 안 됨)

### Phase 4 — UI/UX 개선 ✅ (2026-03-27)
- [x] **리사이즈 패널**: 좌우 패널 드래그 크기 조절 (`react-resizable-panels` v4.7.6)
- [x] **파일 업로드 진행률**: XHR `upload.onprogress`로 실시간 퍼센트 표시
- [x] **하위폴더 구조**: 2단 중첩 폴더 (ProjectManager.tsx 리라이팅)
- [x] **법령 탭 뒤로가기**: 모든 법령참조 탭(법령/시방서/설계기준)에 뒤로가기 버튼
- [x] **설계기준 탭 오류 수정**: KDS 클릭 시 법령 검색탭으로 이동하던 버그 수정 (hasSearched 플래그)
- [x] **KDS 검색 0건 안내**: KDS는 국가건설기준센터(KCSC) 관리 — 법제처에서 검색 불가 안내 메시지

### Phase 4.5 — 추가참고문서 + 3단비교 + 패널 UX (2026-03-27, 최신)
- [x] **추가참고문서 기능**: `guideline` FileGroup 추가, 사업별 격리 임베딩, 검토 시 KDS보다 우선 적용
- [x] **법령 3단비교 완성**: 인용조문(knd=1) + 위임조문(knd=2) 모두 지원
  - knd=1: root `ThdCmpLawXService`, 중첩 `시행령조문목록.시행령조문`
  - knd=2: root `LspttnThdCmpLawXService`, 직접 `시행령조문` 키
  - `extractNested()` 함수로 두 구조 통합 파싱
- [x] **3단비교 새 창**: `openThreeWayPopup()` — 1200×800 팝업, 글씨 14px, 인쇄 지원
- [x] **3단비교 버튼 확대**: text-sm + 더 큰 패딩 + 인용/위임 토글 버튼 확대
- [x] **3단비교 글씨 확대**: 인라인 뷰 text-xs→text-sm, 팝업 13px→14px
- [x] **"법령 참조" → "참고 문서"**: LawPanel 헤더 + ChatPanel 토글 버튼 명칭 변경
- [x] **패널 접힘 표시**: 파일/참고문서 패널 접힘 시 세로 탭(아이콘+이름) 표시, 클릭으로 펼치기
  - `usePanelRef` + `panelRef` + `onResize` 콜백으로 접힘 감지
  - 접힘 탭을 `Group` 외부에 배치 (Group 내부에는 Panel/Separator만)
- [x] **패널 리사이즈 CSS**: `[data-separator]` 상태별 스타일 (inactive/hover/active)
- [x] **법령 패널 최대폭**: maxSize="70%" (사이트 절반 이상 확장 가능)
- [ ] **파일관리 하위폴더 3레벨**: 미구현 (현재 2레벨)
- [x] **빌드 테스트**: ✅ 빌드 성공 확인 (2026-03-31, supabase.ts 더미URL 수정 포함)

### Phase 5 — 멀티페이지 분리 + 참고문서 챗봇 + 법령 UI 대폭 개선 ✅ (2026-04-02)

#### 페이지 구조 변경
- [x] **멀티페이지 분리**: 단일 페이지 → 3페이지 (홈/설계검토/참고문서)
  - `/` — 홈 (네비게이션)
  - `/review` — 설계검토 (기존 3분할 레이아웃)
  - `/reference` — 참고문서 (법령+챗봇)
- [x] **TopNav 상단 네비게이션**: 홈/설계검토/참고문서 탭
- [x] **ReviewLayout**: 설계검토 전용 3분할 레이아웃 컴포넌트

#### 참고문서 챗봇 (Gemini 2.5 Flash)
- [x] **ReferenceChatPanel**: 법령·설계기준 해석 전문 AI 챗봇 패널
- [x] **/api/reference-chat**: 참고문서 전용 스트리밍 API
- [x] **react-resizable-panels**: 법령(70%) + 챗봇(30%) 리사이즈 레이아웃
- [x] **onContextChange**: 현재 열람 중인 법령/조문 컨텍스트를 챗봇에 자동 전달

#### 법령 탭 아코디언 + 바로가기
- [x] **QUICK_LAW_GROUPS 아코디언**: 5개 카테고리(상수도/하수도/공통/인허가/조례) 그룹화
- [x] **카테고리 색상**: CATEGORY_STYLES — blue/teal/slate/amber/purple
- [x] **handleDirectAccess**: 법령 클릭 시 검색 없이 정확 매칭으로 바로 조문 조회
- [x] **인허가 법령 21종**: 기존 6종 → 21종으로 대폭 확대
  - 기존: 환경영향평가법, 건설기술진흥법, 도로법, 하천법, 농지법, 산지관리법
  - 추가: 소하천정비법, 공유수면법, 국토계획법, 토지보상법, 사방사업법, 초지법,
    산림보호법, 자연공원법, 문화재보호법, 개발제한구역법, 군사시설보호법,
    도시공원법, 장사법, 건설산업기본법, 산업안전보건법

#### 법령 UI 개선 4종
- [x] **글꼴 크기 조절**: 작게/보통/크게 3단계 (조문 목록 + 상세 뷰 모두 적용)
- [x] **로딩 스피너**: 법령 클릭 시 바로가기 목록 대신 "○○법 조회 중..." 스피너 표시
- [x] **조문 목차 사이드바**: 조문 상세 뷰에서 좌측 목차(§조번호+제목), 현재 조문 하이라이트, 토글 가능
- [x] **호 번호 중복 수정**: stripLeadingNumber() 유틸리티로 "1. 1." → "1." 수정
- [x] **항 접기 제거**: 모든 항을 한번에 표시 (나머지 N개 항 보기 삭제)
- [x] **빌드 + 프리뷰 검증**: npm run build 성공, dev 서버 기능 동작 확인

#### 삭제된 파일
- `components/layout/LawPanel.tsx` → LawNavigator 직접 사용으로 대체
- `components/layout/ResizableLayout.tsx` → ReviewLayout으로 대체

---

## ⚠️ 즉시 해야 할 작업 (이어받는 사람 필독)

### 1. ~~KDS 임베딩~~ ✅ 완료 (2026-03-31)

`knowledge_base` 테이블에 **1,436행/1,436행** (100%) 저장 완료.

| 문서 | 완료 | 전체 | 진행률 |
|------|------|------|--------|
| 상수도설계기준_2022_통합본 | 715 | 715 | 100% ✅ |
| 하수도설계기준_2023_통합본 | 721 | 721 | 100% ✅ |
| **합계** | **1,436** | **1,436** | **100%** |

**백업 완료:** `data/backup/knowledge_base_backup.json` (55.2MB, 1,436행)

### 2. Supabase에 review_history 테이블 생성
```sql
-- Supabase SQL Editor (https://qmsintfrhxcpmevcksil.supabase.co) 에서 실행
-- scripts/create-review-history.sql 내용을 복사하여 실행
```

### 3. Git commit + push ★★★
아래 변경사항이 **모두 미커밋 상태**. 빌드 성공 확인됨 (2026-03-27).

**수정된 파일 (25개):**
```
M  .gitignore
M  PROJECT_STATUS.md
M  app/api/review/route.ts          ← 이력 자동 저장
M  app/globals.css                  ← 리사이즈 핸들 스타일
M  app/page.tsx                     ← react-resizable-panels + 하위폴더
M  components/chat/DxfAnalysisCard.tsx ← 교차 수치 표시
M  components/chat/MessageList.tsx   ← 카드 렌더링 업데이트
M  components/chat/ReviewCard.tsx
M  components/file/DropZone.tsx      ← XHR 업로드 + 진행률
M  components/file/FileList.tsx      ← 퍼센트 프로그레스바
M  components/law/LawNavigator.tsx   ← 3단비교 + 뒤로가기 + hasSearched
M  components/layout/ChatPanel.tsx   ← ReviewHistory 통합
M  components/layout/FilePanel.tsx   ← 리사이즈 대응 (w-full)
M  components/layout/LawPanel.tsx    ← 리사이즈 대응 (w-full)
M  docs/.bkit-memory.json
M  docs/.pdca-status.json
M  lib/dxf/permit-mapper.ts         ← 공간 분석 통합
M  lib/gemini.ts
M  lib/permit-info.ts               ← relatedOrdinances 필드
M  lib/rag/reviewer.ts
M  package-lock.json                ← react-resizable-panels 추가
M  package.json                     ← react-resizable-panels 추가
M  scripts/embed-kds.ts             ← 배치 임베딩 개선
M  types/dxf.ts                     ← SpatialIntersectionResult 타입
M  types/index.ts                   ← parentId, uploadProgress 필드
```

**신규 파일 (12개):**
```
?? app/api/export-docx/              ← DOCX 내보내기 API
?? app/api/history/                  ← 검토 이력 API
?? components/chat/DocumentCompare.tsx ← 문서 비교 컴포넌트
?? components/chat/ReferencePopover.tsx ← 참조 팝오버
?? components/chat/ReviewHistory.tsx  ← 검토 이력 UI
?? components/chat/ReviewOpinionTable.tsx ← 검토 의견 테이블
?? components/file/ProjectManager.tsx ← 하위폴더 트리 뷰
?? data/backup/                      ← 임베딩 백업 (Git 제외 권장)
?? docs/.pdca-snapshots/
?? lib/dxf/spatial-analyzer.ts       ← Turf.js 공간 교차 분석
?? scripts/backup-embeddings.ts      ← 임베딩 백업/복원 CLI
?? scripts/create-review-history.sql ← review_history DDL
```

### 4. 보류 중인 기능 (사용자가 "보류" 지시)
- **FileGroup 카테고리 변경**: 보고서, 설계도면, 수량산출서, 설계내역서, 시방서, 기타
- **검토카드 미표시 버그**: Gemini가 JSON 대신 마크다운 반환하는 문제 (파싱 실패)

### 5. Phase 4.5에서 발견된 서버/UI 문제점 (코드 분석 결과)

**~~🔴 심각한 문제~~ ✅ 모두 수정 완료 (2026-03-31 확인)**
1. ~~DXF 파일 UTF-8 인코딩~~ → UTF-8/EUC-KR/latin1 3단 fallback 구현
2. ~~Supabase .catch() 누락~~ → .catch() 추가됨
3. ~~XHR 타임아웃 미설정~~ → 2분 타임아웃 + 핸들러 구현
4. ~~Gemini 에러 매칭 취약~~ → HTTP 코드 + 문자열 이중 매칭 구현
5. ~~임베딩 범위 체크 부재~~ → 길이 불일치 + 개별 유효성 검증 구현

**🟡 중요 개선 (UX/성능)**
1. 다중 파일 순차 업로드 → 병렬 처리 권장
2. MessageBubble에 React.memo 미적용 → 리렌더링 성능
3. 매 메시지마다 전체 파일 내용 전송 → 토큰 낭비
4. 새로고침 시 모든 상태(파일/메시지/프로젝트) 손실 → localStorage 저장 필요

**🟢 권장 개선 (편의)**
1. 검토 결과 필터링 (적합/부적합/확인필요)
2. 채팅 빠른 명령 버튼 (검토 시작, DXF 분석)
3. 파일 그룹 도움말 말풍선
4. 긴 조문 접기/펼치기
5. DXF 결과 카드 요약/상세 탭 분리

---

## 신규 패키지 (Phase 4에서 추가)

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `react-resizable-panels` | v4.7.6 | 좌우 패널 리사이즈 |

> **주의**: v4 API는 `Group`/`Panel`/`Separator`를 사용 (`PanelGroup`/`PanelResizeHandle`가 아님).
> `direction` → `orientation`, `autoSaveId` → `useDefaultLayout` hook, `order` prop 없음.

---

## 임베딩 백업/복원 스크립트 (신규)

```bash
# 백업 (DB → JSON)
npx tsx scripts/backup-embeddings.ts --backup
# → data/backup/knowledge_base_backup.json

# 복원 (JSON → DB) — Gemini API 호출 없이 바로 복원
npx tsx scripts/backup-embeddings.ts --restore

# DB 초기화 후 복원
npx tsx scripts/backup-embeddings.ts --restore --clear

# 백업 파일 정보 확인
npx tsx scripts/backup-embeddings.ts --info
```

> `data/backup/` 폴더는 `.gitignore`에 추가 권장 (15MB+ 바이너리 데이터)

---

## LawNavigator 주요 변경사항 (Phase 4)

### 뷰 상태 관리
```typescript
type ViewState = 'search' | 'articles' | 'article-detail' | 'three-way';
```
- `search`: 검색 결과 목록 또는 탭 홈
- `articles`: 법령 조문 목록
- `article-detail`: 조문 상세
- `three-way`: 3단비교 (법률↔시행령↔시행규칙)

### 핵심 상태 플래그
- `hasSearched: boolean` — "검색 안 함" vs "검색했으나 0건" 구분
- `searchOriginTab: string` — 검색 시작 탭 추적 (탭 전환 방지)

### KDS/시방서 검색 동작
- KDS는 국가건설기준센터(KCSC) 관리 → 법제처 API에서 검색 불가
- 검색 0건 시 "국가건설기준센터에서 관리하는 기준으로, 법제처에서 검색되지 않습니다" 안내

---

## react-resizable-panels v4 API 주의사항

```typescript
// ❌ 잘못됨 (v2/v3 API)
import { PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
<PanelGroup direction="horizontal" autoSaveId="layout">
  <Panel order={1}>...</Panel>
  <PanelResizeHandle />
</PanelGroup>

// ✅ 올바름 (v4 API)
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
<Group orientation="horizontal">
  <Panel id="file" defaultSize={20} minSize={15} maxSize={30}>...</Panel>
  <Separator />
  <Panel id="chat" defaultSize={50} minSize={30}>...</Panel>
  <Separator />
  <Panel id="law" defaultSize={30} minSize={15} maxSize={40}>...</Panel>
</Group>
```

SSR-safe localStorage 사용:
```typescript
const safeStorage = typeof window !== 'undefined'
  ? { getItem: (k: string) => localStorage.getItem(k), setItem: (k: string, v: string) => localStorage.setItem(k, v) }
  : { getItem: () => null, setItem: () => {} };

const { defaultLayout, onLayoutChanged } = useDefaultLayout({
  id: 'main-layout', panelIds: ['file-panel', 'chat-panel', 'law-panel'], storage: safeStorage,
});
```

---

## ★★★ KDS 임베딩 상세 가이드 ★★★

### 개요

KDS(건설기준) 설계기준 PDF 2개를 텍스트 추출 → 청크 분할 → Gemini 임베딩 → Supabase 저장하는 과정입니다.
이것이 완료되어야 RAG 기반 설계 검토(`/api/review`)가 정상 동작합니다.

### 대상 파일

| 파일 | 크기 | 예상 청크 수 |
|------|------|------------|
| `data/kds/상수도설계기준_2022_통합본.pdf` | 2.9MB | ~715개 |
| `data/kds/하수도설계기준_2023_통합본.pdf` | 2.0MB | ~721개 |
| **합계** | 4.9MB | **~1,436개** |

### 기술 스펙

| 항목 | 값 |
|------|------|
| 임베딩 모델 | `gemini-embedding-001` |
| 벡터 차원 | **3072차원** |
| 청크 크기 | 800자, overlap 100자 |
| 청크 분할 기준 | 조항 경계 (제N조, N.N.N, 가.나.다 등) |
| 배치 크기 | **100개/API 호출** (`batchEmbedContents`) |
| 배치 간 대기 | 5초 |
| 429 재시도 | 최대 5회, 대기 60초×retry횟수 |
| 저장 테이블 | `knowledge_base` (VECTOR(3072)) |
| Resume 기능 | 있음 — 로컬 파일 + DB 이중 확인 |

### 실행 방법

```bash
# 프로젝트 루트에서 실행
cd "D:\우종현\100.AI실무 아이템\01-2.설계 품질 검토\water-sewage-review"

# 폴더 내 모든 PDF 한번에 임베딩 (권장)
npx tsx scripts/embed-kds.ts data/kds/

# 현황 확인
npx tsx scripts/embed-kds.ts --check

# 특정 source 초기화 후 재시작
npx tsx scripts/embed-kds.ts --reset "상수도설계기준_2022_통합본"
```

### Resume 동작 원리

```
1. .embed-progress.json (로컬 파일) + DB count 이중 확인
2. 로컬과 DB 중 큰 값 기준으로 건너뛰기
3. 매 배치 성공마다 로컬 진행 파일 갱신
4. 429 쿼터 소진 시 자동 중단 + 상태 저장
5. 재실행 시 저장된 위치부터 이어서 진행
```

### 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `429 Too Many Requests` | Gemini 일일 쿼터 소진 | 오후 4시(KST) 이후 재실행 |
| `⏳ 60초 대기 후 재시도...` | 단기 레이트 리밋 | 자동 재시도됨, 기다리면 됨 |
| `⛔ 반복 429 오류` | 일일 쿼터 완전 소진 | 다음 날 오후 4시 재실행 |
| `❌ .env.local 파일을 찾을 수 없습니다` | 환경변수 파일 누락 | .env.local 생성 |
| `❌ INSERT 오류` | Supabase 연결 문제 | SUPABASE_SERVICE_ROLE_KEY 확인 |
| `⏩ 이미 완료됨 — 건너뜁니다` | 이미 완료된 파일 | 정상 (resume 기능) |

### 임베딩 후 확인

```sql
-- Supabase SQL Editor에서 실행
SELECT source, COUNT(*) FROM knowledge_base GROUP BY source;
-- 예상: 상수도 715 + 하수도 721 = 1,436
```

---

## DXF 인허가 분석 — 현재 상태

### PDCA 이력

| Phase | 상태 | 날짜 |
|-------|------|------|
| Plan | ✅ | 2026-03-25 |
| Design | ✅ | 2026-03-25 |
| Do | ✅ | 2026-03-25 |
| Check | ✅ 92% | 2026-03-25 |
| Act-1 | ✅ | 2026-03-25 |

### DXF 레이어 컨벤션
- `$` 접두사: 설계 레이어 (예: $관로-오수, $맨홀)
- `#` 접두사: 인허가 구분 레이어 (예: #도로구역, #하천구역)
- 접두사 없음: 일반 레이어 또는 지적도

### 잔여 Gap (Low 우선순위)
- G-01: CLOSED 플래그 비트마스크 확인 — 자동닫기 fallback으로 보완됨
- G-03: 미매칭 텍스트 최근접 fallback
- G-04: onPermitSelect 콜백

---

## 아직 안 한 기능 (우선순위순)

| 순위 | 기능 | 설명 | 난이도 |
|------|------|------|--------|
| ~~1~~ | ~~**KDS 임베딩 완료**~~ | ✅ 2026-03-31 완료 (1,436/1,436) | - |
| 2 | **review_history 테이블 생성** | Supabase SQL Editor에서 SQL 실행 | 하 |
| 3 | **Git commit + push** | 40+ 파일 미커밋 (빌드 확인 필요) | 하 |
| 4 | **파일관리 하위폴더 3레벨** | 현재 2레벨 → 3레벨 중첩 (ProjectManager.tsx) | 중 |
| ~~5~~ | ~~**서버 버그 수정 5건**~~ | ✅ 모두 수정 완료 확인 (2026-03-31) | - |
| 6 | **상태 영속화** | localStorage로 파일/메시지/프로젝트 자동 저장 | 중 |
| 7 | **검토 결과 필터링** | 적합/부적합/확인필요 탭 필터 + 정렬 | 중 |
| 8 | **채팅 빠른 명령 버튼** | [검토 시작] [DXF 분석] [법령 검색] 클릭 버튼 | 하 |
| 9 | **보류: FileGroup 카테고리 변경** | 보고서/설계도면/수량산출서/설계내역서/시방서/기타 | 중 |
| 10 | **보류: 검토카드 미표시 버그** | Gemini가 JSON 대신 마크다운 반환 → 파싱 실패 | 중 |
| 11 | 통합 테스트 | PDF 업로드→검토→보고서 전체 흐름 | 하 |
| 12 | 지자체 선택 UI | 시·도/시·군·구 드롭다운 → 조례 필터링 | 중 |
| 13 | 수량산출서 검증 | 단가 적용 검증, 물량 역산, 누락 감지 | 중 |

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
| 리사이즈 | react-resizable-panels | **v4.7.6** (Group/Panel/Separator API) |
| 공간분석 | @turf/turf | 7.3.4 |
| DXF 파싱 | dxf-parser | ^3.2.1 |
| PDF 보고서 | @react-pdf/renderer | |
| 파일 파싱 | pdf-parse, mammoth, xlsx | |
| 호스팅 | Vercel Hobby | 무료 |

---

## 환경변수 (.env.local)
```
GEMINI_API_KEY=AIzaSy...                    # 필수 — aistudio.google.com에서 발급
NEXT_PUBLIC_SUPABASE_URL=https://qmsintfrhxcpmevcksil.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...        # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=eyJ...            # Supabase service role key (관리자)
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_LAW_API_OC=jonghyeon            # 법제처 API OC 코드
LAW_API_OC=jonghyeon                        # 서버 사이드용
```
> 실제 키는 .env.local에만 저장. 절대 Git에 커밋하지 않기.

---

## Supabase DB 현황
- **knowledge_base**: **1,436행/1,436행** (100% 완료, 2026-03-31)
  - 상수도설계기준: 715/715 | 하수도설계기준: 721/721
  - 스키마: VECTOR(3072), source/section/page/content/embedding/metadata
- **project_documents**: 빈 테이블 (사용자 업로드 시 저장)
- **review_history**: **미생성** (scripts/create-review-history.sql 실행 필요)
- **RPC 함수**: search_knowledge, search_project_docs 생성 완료
- **인덱스**: ivfflat vector_cosine_ops 적용
- **백업**: data/backup/knowledge_base_backup.json (1,436행, 55.2MB)

---

## 폴더 구조 (2026-03-27 최신)
```
water-sewage-review/
├── CLAUDE.md                        ← 프로젝트 규칙 (필독)
├── PROJECT_BRIEFING.md              ← 전체 기획서
├── PROJECT_STATUS.md                ← 이 파일 (진행 현황)
├── .env.local                       ← API 키 (Git 제외)
├── .embed-progress.json             ← 임베딩 진행 상태 (로컬)
├── app/
│   ├── page.tsx                     ✅ react-resizable-panels + 하위폴더 + XHR 업로드
│   └── api/
│       ├── chat/route.ts            ✅ Gemini 스트리밍
│       ├── parse/route.ts           ✅ PDF/DOCX/XLSX/DXF 파싱
│       ├── review/route.ts          ✅ 설계 검토 + 인허가 + 이력 자동 저장
│       ├── embed/route.ts           ✅ 사용자 문서 임베딩
│       ├── law/route.ts             ✅ 법제처 Open API
│       ├── report/route.ts          ✅ PDF 보고서 생성
│       ├── export-docx/route.ts     ✅ DOCX 내보내기
│       ├── history/route.ts         ✅ 검토 이력 API (GET/POST/DELETE)
│       └── dxf-analyze/route.ts     ✅ DXF 인허가 분석 API
├── components/
│   ├── layout/
│   │   ├── ChatPanel.tsx            ✅ ReviewHistory 통합
│   │   ├── FilePanel.tsx            ✅ w-full (리사이즈 대응)
│   │   └── LawPanel.tsx             ✅ w-full (리사이즈 대응)
│   ├── file/
│   │   ├── ProjectManager.tsx       ✅ 2단 중첩 폴더 트리 뷰
│   │   ├── DropZone.tsx             ✅ XHR 업로드 + onFileProgress
│   │   └── FileList.tsx             ✅ 퍼센트 프로그레스바
│   ├── chat/
│   │   ├── MessageList.tsx          ✅ 마크다운 + 카드 렌더링
│   │   ├── DxfAnalysisCard.tsx      ✅ DXF 분석 결과 + 교차 수치
│   │   ├── ReviewHistory.tsx        ✅ 검토 이력 패널
│   │   ├── ReviewCard.tsx           ✅ 검토 결과 카드
│   │   ├── ReviewOpinionTable.tsx   ✅ 검토 의견 테이블
│   │   ├── DocumentCompare.tsx      ✅ 문서 비교
│   │   ├── ReferencePopover.tsx     ✅ 참조 팝오버
│   │   ├── PermitGuide.tsx          ✅ 설계사 가이드
│   │   ├── PermitChecklist.tsx      ✅ 원스톱 체크리스트
│   │   └── PermitGantt.tsx          ✅ 간트 차트
│   └── law/
│       └── LawNavigator.tsx         ✅ 3단비교 + 뒤로가기 + hasSearched
├── lib/
│   ├── embedding.ts                 ✅ gemini-embedding-001 (3072차원)
│   ├── gemini.ts                    ✅ Gemini 클라이언트
│   ├── supabase.ts                  ✅ (주석의 768은 오래된 정보, 실제 3072)
│   ├── permit-info.ts               ✅ 15종 인허가 + relatedOrdinances
│   ├── dxf/
│   │   ├── layer-classifier.ts      ✅ PERMIT_LAYER_MAP 10종
│   │   ├── cadastral-parser.ts      ✅ 지적 파싱 + 도넛 판별
│   │   ├── permit-mapper.ts         ✅ 통합 (레이어+지적+공간)
│   │   └── spatial-analyzer.ts      ✅ Turf.js 교차 분석
│   └── rag/
│       ├── index.ts                 ✅ RAG 검색 (Layer 1 + 2)
│       ├── reviewer.ts              ✅ 설계 검토 로직
│       └── permit.ts                ✅ 인허가 판단 로직
├── scripts/
│   ├── embed-kds.ts                 ✅ KDS 임베딩 CLI (배치 + resume)
│   ├── backup-embeddings.ts         ✅ 임베딩 백업/복원 CLI (신규)
│   └── create-review-history.sql    ✅ review_history DDL
├── data/
│   ├── kds/
│   │   ├── 상수도설계기준_2022_통합본.pdf  (2.9MB)
│   │   └── 하수도설계기준_2023_통합본.pdf  (2.0MB)
│   └── backup/
│       └── knowledge_base_backup.json   (15.4MB, 401행 백업)
├── types/
│   ├── index.ts                     ✅ 전체 타입 (parentId, uploadProgress 추가)
│   └── dxf.ts                       ✅ DXF + 공간분석 타입
└── docs/                            PDCA 문서
```

---

## 커밋 이력
```
d865a61 feat: Phase 2.5 DXF 인허가 분석 + Phase 3 법령 API 완료 + 배치 임베딩
65ee27f docs: PROJECT_STATUS.md 업데이트 — Phase 2 완료 현황 + 인수인계 정보
14395e8 fix: Vercel 빌드 오류 수정 + 인허가 간트 차트 추가
472b87a feat: Phase 2 완료 — RAG 검토 + 인허가 + 보고서 PDF + 법령 API
bd676b6 feat: Phase 1 완료 — UI 골격 + 파일 파싱 + Gemini 채팅 + RAG 코드 준비
```
> 주의: Phase 3.5(이력) + Phase 4(UI개선) + Phase 4.5(추가참고문서+3단비교+패널) + 백업 스크립트는 **모두 미커밋**

---

## 주의사항
- **OS**: Windows 10 (cp 대신 copy, 경로 구분자 \)
- **Gemini 무료 한도**: 쿼터 리셋 한국시간 **오후 4시** (PDT 자정)
- **API 키 보안**: .env.local에만 저장, GitHub에 절대 올리지 않기
- **Anthropic/OpenAI API 사용 금지**: Gemini만 사용 (CLAUDE.md 규칙)
- **빌드 확인**: `npm run build` 성공 확인됨 (2026-03-27, Phase 4까지) — Phase 4.5 빌드 미확인
- **lib/supabase.ts 주석**: VECTOR(768)은 오래된 정보 — 실제는 VECTOR(3072)
- **react-resizable-panels v4**: Group/Panel/Separator API 사용 (v2/v3과 다름)
- **TypeScript**: `new Set([...prev])` 대신 `new Set(Array.from(prev))` 사용 (downlevelIteration 미설정)

---

## Phase 4.5 기술 세부사항 (이어받는 사람 필독)

### 추가참고문서 (guideline) 임베딩 흐름
```
1. 사용자가 파일 그룹을 "📌 추가참고문서"로 변경
2. handleGroupChange() → embedGuidelineFile() 자동 호출
3. /api/embed 호출 시 projectId를 sessionId로 전달
4. project_documents 테이블에 project_id별 격리 저장
5. 검토 시 reviewer.ts에서 [추가참고문서] 결과를 KDS보다 우선 적용
```

**관련 코드:**
- `app/page.tsx`: `embedGuidelineFile()`, `getProjectIdForFile()`
- `lib/rag/reviewer.ts`: `refDocResults` vs `kdsResults` 분리 + 프롬프트 우선순위
- `types/index.ts`: `embedStatus`, `embedChunks`, `embedProjectId` 필드

### 법제처 3단비교 API 구조
```
knd=1 (인용조문):
  Root: ThdCmpLawXService
  구조: 인용조문삼단비교.법령조문.시행령조문목록.시행령조문 (중첩)

knd=2 (위임조문):
  Root: LspttnThdCmpLawXService
  구조: 위임조문삼단비교.법령조문.시행령조문 (직접 키, 중첩 아님)
```

**관련 코드:**
- `components/law/LawNavigator.tsx`: `directFetchThreeWay()`, `extractNested()`, `openThreeWayPopup()`

### 패널 접힘 표시 구현
```
- usePanelRef() → filePanelRef, lawPanelRef
- Panel의 panelRef prop으로 연결
- onResize 콜백에서 isCollapsed() 체크 → state 업데이트
- 접힘 탭은 Group 외부(flex 컨테이너 양쪽)에 배치
- 클릭 시 panelRef.current?.expand() 호출
```

**관련 코드:**
- `app/page.tsx`: `filePanelCollapsed`, `lawPanelCollapsed` state
- `app/globals.css`: `.collapsed-panel-tab` 스타일

### SSR 하이드레이션 경고 (무시 가능)
`react-resizable-panels`의 `useDefaultLayout` + localStorage 복원으로 인해 서버/클라이언트 `flex-basis` 불일치 경고가 발생합니다. 기능에 영향 없음.
