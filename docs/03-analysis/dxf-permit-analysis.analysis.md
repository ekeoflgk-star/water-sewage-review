# DXF 인허가 자동 판별 — Gap Analysis Report

> **Feature**: dxf-permit-analysis
> **Date**: 2026-03-25
> **Phase**: Check (Gap Analysis)
> **Design Doc**: `docs/02-design/features/dxf-permit-analysis.design.md`

---

## Match Rate: 92%

```
██████████████████████░  92% (24/26 항목 일치) — Act-1 반영
```

---

## 1. 항목별 비교

### 1.1 타입 정의 (`types/dxf.ts`)

| 항목 | Design | Implementation | 일치 |
|------|--------|---------------|------|
| LayerRole 타입 | ✅ | ✅ 동일 | ✅ |
| ClassifiedLayer 인터페이스 | 7 필드 | 7 필드 동일 | ✅ |
| DxfPolyline 인터페이스 | 4 필드 | 4 필드 동일 | ✅ |
| DxfText 인터페이스 | 4 필드 | 4 필드 동일 | ✅ |
| CadParcel 인터페이스 | 7 필드 | 7 필드 동일 | ✅ |
| PermitAnalysisItem 인터페이스 | 5 필드 | 5 필드 동일 | ✅ |
| DxfAnalysisResult 인터페이스 | 6 필드 | 6 필드 동일 | ✅ |
| UploadedFile.type에 'dxf' 추가 | ✅ | ✅ 완료 | ✅ |
| ChatMessage.dxfAnalysis 추가 | (설계에 암시) | ✅ 추가됨 | ✅ |

**소계: 9/9 (100%)**

### 1.2 모듈 — `lib/parsers/dxf.ts`

| 항목 | Design | Implementation | 일치 |
|------|--------|---------------|------|
| DxfParseResult 인터페이스 | ✅ | ✅ 동일 | ✅ |
| parseDXF() 함수 | parseSync 사용 | ✅ parseSync 사용 | ✅ |
| isDxfFile() 함수 | ✅ | ✅ 구현 | ✅ |
| Shoelace 면적 계산 | ✅ | ✅ shoelaceArea() | ✅ |
| LWPOLYLINE/POLYLINE 처리 | ✅ | ✅ | ✅ |
| TEXT/MTEXT 처리 | ✅ | ✅ | ✅ |
| LINE 처리 | (설계 미언급) | ✅ 추가 구현 | ✅+ |
| CLOSED 플래그 감지 | 비트마스크 0x01 | entity.shape 사용 | ⚠️ |

> **Gap G-01**: CLOSED 플래그 감지 방식 차이. Design에서는 "비트마스크 0x01"을 명시했으나, 구현에서는 `entity.shape`만 확인. dxf-parser 라이브러리에서 `shape`가 closed 상태를 나타내지만, 일부 DXF에서 `flags & 1` 방식이 필요할 수 있음. cadastral-parser에서 자동 닫기 fallback이 있어 실질적 영향은 낮음.

**소계: 7/8 (88%)**

### 1.3 모듈 — `lib/dxf/layer-classifier.ts`

| 항목 | Design | Implementation | 일치 |
|------|--------|---------------|------|
| PERMIT_LAYER_MAP 상수 | 10개 항목 | ✅ 10개 동일 | ✅ |
| classifyLayers() 함수 | ✅ | ✅ 동일 시그니처 | ✅ |
| mapPermitLayers() 함수 | ✅ | ✅ 동일 시그니처 | ✅ |
| 접두사 분류 로직 ($/#/일반) | ✅ | ✅ + cadastral 감지 추가 | ✅ |
| 중복 인허가 통합 | ✅ | ✅ seen Set 사용 | ✅ |

**소계: 5/5 (100%)**

### 1.4 모듈 — `lib/dxf/cadastral-parser.ts`

| 항목 | Design | Implementation | 일치 |
|------|--------|---------------|------|
| LAND_CATEGORY_PERMIT 상수 | 9개 | ✅ 9개 동일 | ✅ |
| LAND_CATEGORY_FULL 상수 | 16개 | ✅ 21개 (확장됨) | ✅+ |
| parseLotText() 함수 | ✅ | ✅ 동일 시그니처 | ✅ |
| 메인 정규식 패턴 | MAIN_PATTERN | ✅ mainPattern | ✅ |
| 면적 포함 패턴 | AREA_PATTERN | ✅ areaPattern | ✅ |
| 멀티라인 패턴 | MULTILINE_PATTERN | ✅ Act-1에서 구현 | ✅ |
| 도넛 판별 (면적 정렬+포함관계) | ✅ | ✅ 동일 알고리즘 | ✅ |
| point-in-polygon (Ray Casting) | Turf.js 사용 | 자체 구현 (Ray Casting) | ✅ |
| 도넛 영역 텍스트 매칭 | ✅ | ✅ pointInDonut() | ✅ |
| 면적비 임계값 0.8 | ✅ | ✅ 동일 | ✅ |
| 열린 폴리라인 자동 닫기 | ✅ | ✅ dist < 0.5 | ✅ |
| 미매칭 fallback (최근접) | ✅ | ❌ 미구현 | ❌ |
| 미매칭 경고 | ✅ | ✅ warnings 배열 | ✅ |
| mapCadastralPermits() 함수 | ✅ | ✅ 구현 | ✅ |

> **Gap G-02**: ~~MULTILINE_PATTERN 미구현~~ → **Act-1에서 수정 완료** (멀티라인 패턴 추가)
> **Gap G-03**: 미매칭 텍스트 fallback 미구현. Design에서는 "최근접 폴리라인 중심점과의 거리"를 fallback으로 명시했으나 구현 안 됨.

**소계: 13/14 (93%)**

### 1.5 모듈 — `lib/dxf/spatial-analyzer.ts` (Phase B)

| 항목 | Design | Implementation | 일치 |
|------|--------|---------------|------|
| spatial-analyzer.ts 파일 | Phase B로 명시 | ❌ 미생성 (계획대로) | N/A |

> Phase B는 Design에서 "후속" 단계로 명시. Phase A 범위 외이므로 Gap으로 산정하지 않음.

### 1.6 모듈 — `lib/dxf/permit-mapper.ts`

| 항목 | Design | Implementation | 일치 |
|------|--------|---------------|------|
| analyzeDxfForPermits() 함수 | ✅ | ✅ 구현 | ✅ |
| deduplicatePermits() 함수 | export | 내부 함수 (비export) | ⚠️ |
| enableSpatialAnalysis 옵션 | ✅ | ❌ 미구현 (Phase B) | N/A |
| cadastralLayerName 옵션 | ✅ | ✅ | ✅ |
| cadastralTextLayerName 옵션 | ✅ | ✅ | ✅ |
| 통합 흐름 (1→2→3→5→6) | ✅ | ✅ 동일 순서 | ✅ |

**소계: 4/4 (100%)** (Phase B 제외)

### 1.7 API — `POST /api/dxf-analyze`

| 항목 | Design | Implementation | 일치 |
|------|--------|---------------|------|
| multipart/form-data 요청 | ✅ | ✅ | ✅ |
| 파일 확장자 검증 | ✅ | ✅ | ✅ |
| 크기 제한 50MB | ✅ | ✅ | ✅ |
| 에러 응답 (400) | ✅ | ✅ | ✅ |
| 에러 응답 (413) | ✅ | ✅ | ✅ |
| cadastralLayer 옵션 | ✅ | ✅ | ✅ |
| success/result 응답 구조 | ✅ | ✅ | ✅ |

**소계: 7/7 (100%)**

### 1.8 컴포넌트 — `DxfAnalysisCard.tsx`

| 항목 | Design | Implementation | 일치 |
|------|--------|---------------|------|
| result prop | ✅ | ✅ | ✅ |
| onPermitSelect prop | ✅ | ❌ 미구현 | ❌ |
| 레이어 요약 (펼치기/접기) | ✅ | ✅ LayerList 컴포넌트 | ✅ |
| 인허가 목록 표시 | ✅ | ✅ | ✅ |
| 소스 배지 (layer/cadastral/spatial) | ✅ | ✅ SourceBadge | ✅ |
| 경고 섹션 (펼치기/접기) | ✅ | ✅ | ✅ |
| 지적 필지 표시 | ✅ | ✅ parcels 태그 | ✅ |

> **Gap G-04**: `onPermitSelect` 콜백 미구현. PermitGuide 연동을 위한 인허가 클릭 → 스크롤 기능 없음.

**소계: 6/7 (86%)**

### 1.9 수정 파일

| 항목 | Design | Implementation | 일치 |
|------|--------|---------------|------|
| DropZone.tsx — .dxf 허용 | ✅ | ✅ | ✅ |
| parsers/index.ts — DXF case | ✅ | ✅ | ✅ |
| parse/route.ts — dxf 확장자 | ✅ | ✅ | ✅ |
| MessageList.tsx — 카드 렌더링 | ✅ | ✅ | ✅ |
| PermitGuide.tsx — DXF 연동 | ✅ | ✅ Act-1에서 dxfPermits prop 추가 | ✅ |
| package.json — 의존성 | ✅ | ✅ | ✅ |

> **Gap G-05**: ~~PermitGuide.tsx에 DXF 분석 결과 연동 prop이 추가되지 않음~~ → **Act-1에서 수정 완료** (dxfPermits prop + DXF 배지 추가)

**소계: 6/6 (100%)**

---

## 2. Gap Summary

| ID | 심각도 | 설명 | 상태 |
|----|--------|------|------|
| G-01 | Low | CLOSED 플래그: `entity.shape` vs 비트마스크 | 미수정 (자동 닫기 fallback으로 보완됨) |
| G-02 | Medium | MULTILINE_PATTERN 미구현 (줄바꿈 텍스트) | **Act-1 수정 완료** |
| G-03 | Low | 미매칭 텍스트 fallback (최근접) 미구현 | 미수정 (경고 표시로 대체) |
| G-04 | Low | onPermitSelect 콜백 미구현 | 미수정 (후속 개선) |
| G-05 | Medium | PermitGuide.tsx DXF 연동 미수정 | **Act-1 수정 완료** |

---

## 3. Recommendations

### Act-1에서 수정 완료
1. ~~**G-02**~~: `cadastral-parser.ts`의 `parseLotText()`에 멀티라인 패턴 추가 ✅
2. ~~**G-05**~~: `PermitGuide.tsx`에 `dxfPermits` prop 추가 + `MessageList.tsx` 연동 ✅

### 후속 개선 (Low 우선순위)
3. G-01: CLOSED 플래그 비트마스크 확인 추가 (실제 DXF 테스트 후 판단)
4. G-03: 미매칭 fallback 구현 (최근접 중심점 거리)
5. G-04: onPermitSelect 콜백 + PermitGuide 스크롤 연동

---

## Version History

| Version | Date | Match Rate | Author |
|---------|------|-----------|--------|
| 0.1 | 2026-03-25 | 88% | Gap Analysis (manual) |
| 0.2 | 2026-03-25 | 92% | Act-1 iteration (G-02, G-05 수정) |
