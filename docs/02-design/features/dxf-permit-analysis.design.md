# DXF 계획평면도 기반 인허가 자동 판별 — Design Document

> **Summary**: DXF 파일의 레이어 접두사($/#)와 지적 텍스트를 파싱하여 점용·전용 인허가를 자동 판별하는 기능의 상세 설계
>
> **Project**: water-sewage-review
> **Version**: 0.1.0
> **Author**: AI 설계 검토 팀
> **Date**: 2026-03-25
> **Status**: Draft
> **Plan Reference**: `docs/01-plan/features/dxf-permit-analysis.plan.md`

---

## 1. Type Definitions

### 1.1 DXF 파싱 결과 타입 (`types/dxf.ts` — NEW)

```typescript
/** DXF 레이어 역할 분류 */
export type LayerRole = 'design' | 'permit' | 'cadastral' | 'general';

/** 분류된 레이어 정보 */
export interface ClassifiedLayer {
  name: string;            // 원본 레이어명 (예: "#도로구역")
  role: LayerRole;         // 분류 결과
  prefix: '$' | '#' | '';  // 접두사
  baseName: string;        // 접두사 제외 이름 (예: "도로구역")
  entityCount: number;     // 이 레이어의 엔티티 수
  hasPolylines: boolean;   // 폴리라인 포함 여부
  hasTexts: boolean;       // 텍스트 포함 여부
}

/** DXF 폴리라인 (LWPOLYLINE) */
export interface DxfPolyline {
  layer: string;
  vertices: { x: number; y: number }[];
  isClosed: boolean;
  area: number;            // 부호 있는 면적 (Shoelace formula)
}

/** DXF 텍스트 (TEXT/MTEXT) */
export interface DxfText {
  layer: string;
  text: string;
  insertionPoint: { x: number; y: number };
  height: number;          // 텍스트 높이
}

/** 지적 필지 정보 */
export interface CadParcel {
  outerBoundary: { x: number; y: number }[];
  holes: { x: number; y: number }[][];
  lotNumber: string;       // "154-7", "산 12-3" 등
  landCategory: string;    // "답", "전", "임" 등
  landCategoryFull: string; // "논", "밭", "임야" 등
  area: number;            // 면적 (도면 단위²)
  matched: boolean;        // 텍스트 매칭 성공 여부
}

/** 인허가 분석 결과 항목 */
export interface PermitAnalysisItem {
  permitName: string;              // permit-info.ts의 키
  source: 'layer' | 'cadastral' | 'spatial';  // 판별 근거
  sourceDetail: string;            // 예: "#도로구역 레이어 존재" 또는 "154-7 답 (농지)"
  layerName?: string;              // 근거 레이어명
  parcelInfo?: {                   // 지적 근거 (cadastral일 때)
    lotNumber: string;
    landCategory: string;
  };
  intersection?: {                 // 공간 교차 정보 (Phase B)
    length?: number;               // 교차 연장 (m)
    area?: number;                 // 교차 면적 (㎡)
  };
}

/** DXF 분석 전체 결과 */
export interface DxfAnalysisResult {
  fileName: string;
  layerSummary: {
    total: number;
    design: ClassifiedLayer[];     // $ 레이어 목록
    permit: ClassifiedLayer[];     // # 레이어 목록
    cadastral: ClassifiedLayer[];  // 지적 관련 레이어
    general: ClassifiedLayer[];    // 기타 레이어
  };
  parcels: CadParcel[];            // 파싱된 필지 목록
  permits: PermitAnalysisItem[];   // 판별된 인허가 목록
  warnings: string[];              // 경고 메시지 (미매칭 텍스트, 열린 폴리라인 등)
  analyzedAt: string;              // ISO timestamp
}
```

---

## 2. Module Design

### 2.1 `lib/parsers/dxf.ts` — DXF 파싱 모듈

**책임**: DXF 파일 바이너리 → 구조화된 데이터 (레이어, 폴리라인, 텍스트) 추출

```typescript
import DxfParser from 'dxf-parser';

/** DXF 파싱 결과 (dxf-parser 출력의 래퍼) */
export interface DxfParseResult {
  layers: Record<string, { name: string; color: number; visible: boolean }>;
  polylines: DxfPolyline[];
  texts: DxfText[];
  entityCount: number;
}

/** DXF 파일 파싱 */
export function parseDXF(buffer: Buffer): DxfParseResult;

/** 파일 확장자 DXF인지 확인 */
export function isDxfFile(filename: string): boolean;
```

**구현 핵심**:
- `dxf-parser` 라이브러리의 `parseSync()` 사용
- LWPOLYLINE, POLYLINE → `DxfPolyline[]` 변환
- TEXT, MTEXT → `DxfText[]` 변환
- 레이어 목록은 HEADER/TABLES 섹션에서 추출
- CLOSED 플래그(비트 마스크 0x01) 확인하여 `isClosed` 설정
- 면적은 Shoelace formula로 계산: `Σ(xᵢyᵢ₊₁ - xᵢ₊₁yᵢ) / 2`

---

### 2.2 `lib/dxf/layer-classifier.ts` — 레이어 분류 모듈

**책임**: 레이어명 접두사(`$`/`#`)로 역할 분류 + `#` 레이어 → 인허가 매핑

```typescript
/** 레이어 분류 */
export function classifyLayers(
  layers: Record<string, any>,
  polylines: DxfPolyline[],
  texts: DxfText[]
): ClassifiedLayer[];

/** "#" 레이어 → 인허가 매핑 */
export function mapPermitLayers(
  permitLayers: ClassifiedLayer[]
): PermitAnalysisItem[];

/** 레이어 → 인허가 매핑 테이블 */
export const PERMIT_LAYER_MAP: Record<string, string>;
```

**`PERMIT_LAYER_MAP` 상수 정의**:

```typescript
export const PERMIT_LAYER_MAP: Record<string, string> = {
  '#도로구역':         '도로 점용 허가',
  '#하천구역':         '하천 점용 허가',
  '#소하천구역':       '소하천 점용 허가',
  '#영구점용선':       '도로 점용 허가',
  '#일시점용선':       '도로 점용 허가',
  '#농지':             '농지 전용 허가',
  '#산지':             '산지 전용 허가',
  '#철도보호지구':     '철도 보호지구 행위허가',
  '#군사시설보호구역': '군사시설 보호구역 행위허가',
  '#문화재보호구역':   '문화재 현상변경 허가',
};
```

**분류 로직**:
1. 레이어명이 `$`로 시작 → `design`
2. 레이어명이 `#`로 시작 → `permit`
3. 레이어명이 `지적경계` 또는 `지적텍스트` → `cadastral`
4. 나머지 → `general`

---

### 2.3 `lib/dxf/cadastral-parser.ts` — 지적도 파싱 모듈

**책임**: 지적 폴리라인 + 텍스트 → 필지 정보 (도넛 처리 포함)

```typescript
/** 지적 필지 파싱 (도넛 처리 포함) */
export function parseCadastralParcels(
  polylines: DxfPolyline[],   // "지적경계" 레이어의 폴리라인
  texts: DxfText[]             // "지적텍스트" 레이어의 텍스트
): CadParcel[];

/** 지적 텍스트 파싱 ("154-7 답" → {lotNumber, category}) */
export function parseLotText(
  text: string
): { lotNumber: string; category: string } | null;

/** 지목 한글 풀네임 매핑 */
export const LAND_CATEGORY_FULL: Record<string, string>;

/** 지목 → 인허가 매핑 */
export const LAND_CATEGORY_PERMIT: Record<string, string>;
```

**도넛 판별 알고리즘 상세**:

```
입력: CLOSED 폴리라인 배열 (지적경계 레이어)

1. 면적 계산 (Shoelace) 후 절대값 내림차순 정렬
2. 사용됨 표시 배열 초기화: used[i] = false

3. for i = 0 to N-1:
     if used[i]: continue
     outer = polylines[i]
     holes = []

     for j = i+1 to N-1:
       if used[j]: continue

       // j가 i의 내곽인지 판별:
       //   조건1: j의 모든 꼭짓점이 i 내부 (point-in-polygon)
       //   조건2: j의 면적 < i의 면적 * 0.8 (안전 마진)
       if allVerticesInside(polylines[j], outer)
          AND area(j) < area(i) * 0.8:
         holes.push(polylines[j])
         used[j] = true

     parcels.push({ outer, holes })

4. 텍스트 매칭:
   for each text in cadastralTexts:
     for each parcel in parcels:
       donutPolygon = outer - holes  // GeoJSON Polygon with holes
       if pointInPolygon(text.insertionPoint, donutPolygon):
         parcel.lotNumber = parseLotText(text.text).lotNumber
         parcel.landCategory = parseLotText(text.text).category
         parcel.matched = true
         break

5. 미매칭 텍스트 → fallback: 최근접 폴리라인 중심점과의 거리
```

**지적 텍스트 정규식 패턴**:

```typescript
// 메인 패턴: "154-7 답", "산 12 임", "1-2 대"
const MAIN_PATTERN = /^(산?\s*\d+(?:-\d+)?)\s+(\S+)$/;

// 확장 패턴: "154-7\n답" (줄바꿈 포함)
const MULTILINE_PATTERN = /^(산?\s*\d+(?:-\d+)?)\s*[\n\r]+\s*(\S+)$/;

// 면적 포함 패턴: "154-7 답 1,234㎡"
const AREA_PATTERN = /^(산?\s*\d+(?:-\d+)?)\s+(\S+)\s+[\d,]+(?:㎡|m2)?$/;
```

**`LAND_CATEGORY_PERMIT` 매핑**:

```typescript
export const LAND_CATEGORY_PERMIT: Record<string, string> = {
  '전': '농지 전용 허가',
  '답': '농지 전용 허가',
  '과': '농지 전용 허가',
  '임': '산지 전용 허가',
  '하': '하천 점용 허가',
  '도': '도로 점용 허가',
  '천': '하천 점용 허가',
  '구': '도로 점용 허가',   // 구거 (도랑)
  '유': '하천 점용 허가',   // 유지 (저수지)
};

export const LAND_CATEGORY_FULL: Record<string, string> = {
  '전': '밭', '답': '논', '과': '과수원', '임': '임야',
  '하': '하천', '도': '도로', '천': '천(내)', '대': '대지',
  '공': '공장용지', '잡': '잡종지', '학': '학교용지',
  '구': '구거', '유': '유지', '제': '제방', '목': '목장용지',
};
```

---

### 2.4 `lib/dxf/spatial-analyzer.ts` — 공간 분석 모듈 (Phase B)

**책임**: `$` 설계요소 × `#` 인허가구역 교차 분석

```typescript
import * as turf from '@turf/turf';

/** 공간 교차 분석 결과 */
export interface SpatialIntersection {
  designLayer: string;     // 예: "$관로-오수"
  permitLayer: string;     // 예: "#도로구역"
  permitName: string;      // 예: "도로 점용 허가"
  intersects: boolean;
  intersectionLength?: number;  // 선형 교차 시 (m)
  intersectionArea?: number;    // 면적 교차 시 (㎡)
}

/** $ 레이어와 # 레이어 간 교차 분석 */
export function analyzeSpatialIntersections(
  designPolylines: DxfPolyline[],   // $ 레이어 엔티티
  permitPolylines: DxfPolyline[]    // # 레이어 엔티티
): SpatialIntersection[];

/** 폴리라인 → GeoJSON 변환 */
export function polylineToGeoJSON(
  polyline: DxfPolyline
): turf.Feature<turf.Polygon | turf.LineString>;

/** point-in-polygon 판별 (Turf.js 래퍼) */
export function isPointInPolygon(
  point: { x: number; y: number },
  polygon: { x: number; y: number }[],
  holes?: { x: number; y: number }[][]
): boolean;
```

**교차 분석 로직**:

```
1. $ 레이어의 각 엔티티를 GeoJSON으로 변환
   - CLOSED 폴리라인 → Polygon
   - OPEN 폴리라인 → LineString

2. # 레이어의 각 엔티티를 GeoJSON Polygon으로 변환

3. 모든 ($, #) 조합에 대해:
   - turf.booleanIntersects(design, permit)
   - 교차 시:
     - LineString × Polygon: turf.lineIntersect → 교차 연장
     - Polygon × Polygon: turf.intersect → 교차 면적

4. 결과를 PERMIT_LAYER_MAP으로 인허가명 매핑
```

---

### 2.5 `lib/dxf/permit-mapper.ts` — 인허가 매핑 통합 모듈

**책임**: 레이어 분석 + 지적 분석 + 공간 분석 결과를 통합하여 최종 인허가 목록 생성

```typescript
/** DXF 분석 메인 함수 — 모든 모듈 통합 호출 */
export function analyzeDxfForPermits(
  parseResult: DxfParseResult,
  options?: {
    enableSpatialAnalysis?: boolean;  // Phase B (default: false)
    cadastralLayerName?: string;       // 기본값: "지적경계"
    cadastralTextLayerName?: string;   // 기본값: "지적텍스트"
  }
): DxfAnalysisResult;

/** 중복 인허가 통합 (같은 인허가를 다른 소스에서 감지 시) */
export function deduplicatePermits(
  items: PermitAnalysisItem[]
): PermitAnalysisItem[];
```

**통합 흐름**:

```
analyzeDxfForPermits(parseResult)
  │
  ├─ 1. classifyLayers() → 레이어 분류
  ├─ 2. mapPermitLayers() → # 레이어 → 인허가 (Phase A)
  ├─ 3. parseCadastralParcels() → 지적 필지 파싱 + 지목 → 인허가
  ├─ 4. analyzeSpatialIntersections() → 공간 교차 (Phase B, optional)
  ├─ 5. deduplicatePermits() → 중복 제거 + 통합
  └─ 6. 경고 메시지 수집 → warnings[]
```

---

## 3. API Design

### 3.1 `POST /api/dxf-analyze` — DXF 인허가 분석 API

**Request**:
```
POST /api/dxf-analyze
Content-Type: multipart/form-data

Body:
  file: <DXF 파일>
  enableSpatial: "true" | "false"  (optional, default: "false")
  cadastralLayer: string            (optional, default: "지적경계")
  cadastralTextLayer: string        (optional, default: "지적텍스트")
```

**Response (200)**:
```json
{
  "success": true,
  "result": {
    "fileName": "계획평면도.dxf",
    "layerSummary": {
      "total": 24,
      "design": [
        { "name": "$관로-오수", "role": "design", "prefix": "$", "baseName": "관로-오수", "entityCount": 156, "hasPolylines": true, "hasTexts": false }
      ],
      "permit": [
        { "name": "#도로구역", "role": "permit", "prefix": "#", "baseName": "도로구역", "entityCount": 12, "hasPolylines": true, "hasTexts": false },
        { "name": "#하천구역", "role": "permit", "prefix": "#", "baseName": "하천구역", "entityCount": 4, "hasPolylines": true, "hasTexts": false }
      ],
      "cadastral": [...],
      "general": [...]
    },
    "parcels": [
      {
        "lotNumber": "154-7",
        "landCategory": "답",
        "landCategoryFull": "논",
        "area": 2340.5,
        "matched": true,
        "outerBoundary": [...],
        "holes": []
      }
    ],
    "permits": [
      {
        "permitName": "도로 점용 허가",
        "source": "layer",
        "sourceDetail": "#도로구역 레이어 존재 (엔티티 12개)"
      },
      {
        "permitName": "하천 점용 허가",
        "source": "layer",
        "sourceDetail": "#하천구역 레이어 존재 (엔티티 4개)"
      },
      {
        "permitName": "농지 전용 허가",
        "source": "cadastral",
        "sourceDetail": "지적 필지 154-7 답 (농지)",
        "parcelInfo": { "lotNumber": "154-7", "landCategory": "답" }
      }
    ],
    "warnings": [
      "지적 필지 2건에서 텍스트 매칭 실패 (텍스트 누락 추정)"
    ],
    "analyzedAt": "2026-03-25T06:30:00.000Z"
  }
}
```

**Error Response (400)**:
```json
{
  "success": false,
  "error": "DXF 파일 형식이 올바르지 않습니다. AutoCAD에서 다른이름으로저장(SAVEAS) → DXF 형식을 선택해주세요."
}
```

**Error Response (413)**:
```json
{
  "success": false,
  "error": "파일 크기가 50MB를 초과합니다. 불필요한 레이어를 PURGE 후 다시 시도해주세요."
}
```

---

## 4. Component Design

### 4.1 `components/chat/DxfAnalysisCard.tsx` — 분석 결과 카드

**Props**:
```typescript
interface DxfAnalysisCardProps {
  result: DxfAnalysisResult;
  onPermitSelect?: (permitName: string) => void;  // PermitGuide 연동
}
```

**UI 구조**:
```
┌─────────────────────────────────────────────┐
│ 📐 DXF 인허가 분석 결과                      │
│ 파일: 계획평면도.dxf (24개 레이어)             │
├─────────────────────────────────────────────┤
│                                             │
│ 📋 레이어 요약                               │
│ ├ 설계($): 8개 — $관로-오수, $맨홀, ...      │
│ ├ 인허가(#): 3개 — #도로구역, #하천구역, ...  │
│ ├ 지적: 2개 — 지적경계, 지적텍스트            │
│ └ 일반: 11개                                 │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│ 🔍 필요 인허가 (3건)                         │
│                                             │
│ ✅ 도로 점용 허가                             │
│    근거: #도로구역 레이어                      │
│    [상세보기] → PermitGuide 연동              │
│                                             │
│ ✅ 하천 점용 허가                             │
│    근거: #하천구역 레이어                      │
│    [상세보기]                                 │
│                                             │
│ ✅ 농지 전용 허가                             │
│    근거: 지적 154-7 답 (농지)                 │
│    [상세보기]                                 │
│                                             │
├─────────────────────────────────────────────┤
│ ⚠️ 경고 (1건)                                │
│ • 지적 필지 2건에서 텍스트 미매칭              │
└─────────────────────────────────────────────┘
```

**상태 관리**:
- 펼치기/접기: 레이어 요약, 경고 섹션
- 필요 인허가 클릭 시 → `onPermitSelect` 콜백 → PermitGuide에서 해당 인허가로 스크롤

### 4.2 `components/file/DropZone.tsx` — 수정사항

**변경**: 허용 파일 형식에 `.dxf` 추가

```typescript
// 기존
accept: { 'application/pdf': ['.pdf'], ... }

// 변경
accept: {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx', '.xls'],
  'application/dxf': ['.dxf'],           // NEW
  'application/x-autocad': ['.dxf'],     // NEW (대체 MIME)
}
```

**`UploadedFile` 타입 수정** (`types/index.ts`):

```typescript
// 기존
type: 'pdf' | 'docx' | 'xlsx';

// 변경
type: 'pdf' | 'docx' | 'xlsx' | 'dxf';
```

---

## 5. File Change List

### 5.1 신규 파일

| 파일 | 책임 | FR |
|------|------|-----|
| `types/dxf.ts` | DXF 관련 타입 정의 | 전체 |
| `lib/parsers/dxf.ts` | DXF 파싱 (dxf-parser 래퍼) | FR-01 |
| `lib/dxf/layer-classifier.ts` | 레이어 접두사 분류 + 인허가 매핑 | FR-02, FR-03 |
| `lib/dxf/cadastral-parser.ts` | 지적도 파싱 (도넛 포함) | FR-04, FR-05, FR-06, FR-07 |
| `lib/dxf/spatial-analyzer.ts` | 공간 교차 분석 (Phase B) | FR-08, FR-09 |
| `lib/dxf/permit-mapper.ts` | 인허가 매핑 통합 | FR-03, FR-07 |
| `app/api/dxf-analyze/route.ts` | DXF 분석 API 엔드포인트 | FR-01~FR-10 |
| `components/chat/DxfAnalysisCard.tsx` | 분석 결과 UI 카드 | FR-10 |

### 5.2 수정 파일

| 파일 | 변경 내용 | FR |
|------|----------|-----|
| `types/index.ts` | `UploadedFile.type`에 `'dxf'` 추가 | FR-01 |
| `components/file/DropZone.tsx` | `.dxf` 확장자 허용 | FR-01 |
| `lib/parsers/index.ts` | `parseDXF` import 및 switch case 추가 | FR-01 |
| `components/chat/PermitGuide.tsx` | DXF 분석 결과 연동 prop 추가 | FR-10 |
| `components/chat/MessageList.tsx` | DxfAnalysisCard 렌더링 추가 | FR-10 |
| `package.json` | `dxf-parser`, `@turf/turf` 의존성 추가 | — |

---

## 6. Implementation Order

### Step 1: 기반 세팅 (30분)

```bash
npm install dxf-parser @turf/turf
npm install -D @types/dxf-parser  # 타입 있으면
```

1. `types/dxf.ts` — 타입 정의
2. `types/index.ts` — `UploadedFile.type`에 `'dxf'` 추가
3. `package.json` 의존성 확인

### Step 2: DXF 파싱 모듈 (1시간)

1. `lib/parsers/dxf.ts` — dxf-parser 래퍼
2. `lib/parsers/index.ts` — DXF case 추가
3. 단위 테스트: 간단한 DXF 문자열 파싱

### Step 3: 레이어 분류 + 인허가 매핑 (1시간)

1. `lib/dxf/layer-classifier.ts` — 접두사 분류
2. `lib/dxf/permit-mapper.ts` — 매핑 통합

### Step 4: 지적도 파싱 (2시간)

1. `lib/dxf/cadastral-parser.ts`:
   - `parseLotText()` — 정규식 파싱
   - 면적 계산 (Shoelace formula)
   - 도넛 판별 (포함관계 분석)
   - 텍스트-필지 매칭 (point-in-polygon)
   - 지목 → 인허가 매핑

### Step 5: API 엔드포인트 (1시간)

1. `app/api/dxf-analyze/route.ts`
2. 에러 핸들링 (잘못된 DXF, 크기 초과)
3. 요청/응답 검증

### Step 6: UI 컴포넌트 (2시간)

1. `components/file/DropZone.tsx` — .dxf 허용
2. `components/chat/DxfAnalysisCard.tsx` — 결과 카드
3. `components/chat/MessageList.tsx` — 카드 렌더링
4. `components/chat/PermitGuide.tsx` — 분석 결과 연동

### Step 7: 빌드 확인 (30분)

1. `npm run build` 성공 확인
2. 타입 에러 수정
3. lint 에러 수정

### Phase B (후속): 공간 교차 분석

1. `lib/dxf/spatial-analyzer.ts` — Turf.js 교차 분석
2. `permit-mapper.ts`에 공간 분석 결과 통합
3. `DxfAnalysisCard.tsx`에 교차 면적/연장 표시

---

## 7. Dependencies

```json
{
  "dependencies": {
    "dxf-parser": "^1.1.2",
    "@turf/turf": "^7.1.0"
  }
}
```

| 패키지 | 버전 | 용도 | 번들 크기 |
|--------|------|------|----------|
| `dxf-parser` | ^1.1.2 | DXF 파싱 → JSON | ~50KB |
| `@turf/turf` | ^7.1.0 | 공간 분석 (point-in-polygon, intersect) | ~500KB |

> **참고**: Phase A만 구현 시 `@turf/turf`는 point-in-polygon만 필요하므로 `@turf/boolean-point-in-polygon`만 설치하여 번들 크기를 줄일 수 있음. 다만 Phase B에서 `intersect`, `area` 등이 필요하므로 처음부터 전체 설치 권장.

---

## 8. Error Handling

| 에러 상황 | HTTP | 메시지 |
|----------|------|--------|
| DXF가 아닌 파일 | 400 | "DXF 파일이 아닙니다. .dxf 확장자 파일을 업로드해주세요." |
| DXF 파싱 실패 | 400 | "DXF 파일을 읽을 수 없습니다. AutoCAD에서 SAVEAS → DXF로 다시 저장 후 시도해주세요." |
| 파일 크기 초과 | 413 | "파일 크기가 50MB를 초과합니다. PURGE 명령으로 불필요한 데이터 제거 후 다시 시도해주세요." |
| `#` 레이어 없음 | 200 | 경고: "인허가 구역 레이어(#)가 없습니다. CAD 레이어 표준을 확인해주세요." |
| 지적 레이어 없음 | 200 | 경고: "지적경계/지적텍스트 레이어가 없습니다. 지목 기반 분석을 건너뜁니다." |
| 텍스트 미매칭 | 200 | 경고: "N건의 지적 필지에서 텍스트 매칭 실패" |
| Serverless 타임아웃 | 504 | "분석 시간이 초과되었습니다. 더 작은 범위의 DXF 파일로 시도해주세요." |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-03-25 | Initial design — Plan 기반 상세 설계 | AI 설계 검토 팀 |
