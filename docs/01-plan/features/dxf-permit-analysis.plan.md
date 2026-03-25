# DXF 계획평면도 기반 인허가 자동 판별 — Planning Document

> **Summary**: DXF 계획평면도의 레이어 접두사($/#) 컨벤션과 지적 텍스트 파싱을 통해 점용·전용 인허가 필요 여부를 자동 판별하는 기능
>
> **Project**: water-sewage-review
> **Version**: 0.1.0
> **Author**: AI 설계 검토 팀
> **Date**: 2026-03-25
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

설계사가 작성한 계획평면도(DXF)를 업로드하면, 도면 내 레이어와 지적 정보를 자동 분석하여 **어떤 점용·전용 인허가가 필요한지** 체크리스트 형태로 안내한다. 인허가 신청은 발주처/시행사가 수행하므로, 이 기능은 **설계사가 성과품에 반영해야 할 도서·도면·계산서를 누락 없이 준비**하도록 돕는 것이 목적이다.

### 1.2 Background

- 상하수도 설계에서 관로가 도로·하천·소하천·농지·산지 등을 통과할 때 각각 별도 인허가가 필요
- 현재 설계사는 계획평면도를 수동으로 확인하며 인허가 목록을 작성 — 누락 위험 존재
- DWG는 Autodesk 독점 바이너리 포맷으로 Node.js에서 직접 파싱 불가 → **DXF(텍스트 기반) 입력** 필요
- AutoCAD에서 DWG→DXF 변환은 `SAVEAS` 명령으로 1분 내 완료 가능
- 기존 `permit-info.ts`에 15종 인허가 상세 정보(설계사 준비사항, 납품도서, 주의사항) 이미 구축됨

### 1.3 Related Documents

- `lib/permit-info.ts`: 15종 인허가 상세 정보 (PermitInfo, PERMIT_INFO_MAP)
- `components/chat/PermitGuide.tsx`: 설계사 인허가 가이드 컴포넌트
- `lib/rag/permit.ts`: 인허가 판단 규칙 엔진 (PERMIT_RULES)
- `types/index.ts`: PermitCard 타입 정의

---

## 2. Scope

### 2.1 In Scope

- [ ] DXF 파일 파싱 모듈 (dxf-parser 라이브러리)
- [ ] CAD 레이어 접두사 컨벤션 정의 (`$` 설계, `#` 인허가)
- [ ] 레이어 기반 인허가 자동 매핑 (Phase A)
- [ ] 지적도 텍스트-폴리라인 연계 파싱 (번지+지목 추출)
- [ ] 도넛형 필지 포함관계 분석 (Turf.js)
- [ ] 지목 기반 전용허가 판별 (전/답→농지, 임→산지)
- [ ] 공간 교차 분석: 설계요소($) × 인허가구역(#) (Phase B)
- [ ] 분석 결과 → PermitGuide 연동 (체크리스트 자동 체크)
- [ ] CAD 레이어 표준 템플릿(DWT) 정의서 작성

### 2.2 Out of Scope

- DWG 파일 직접 파싱 (Vercel 서버리스 환경 제약)
- 서버 측 DWG→DXF 자동 변환 (ODA/LibreDWG 라이선스·환경 제약)
- 도면 뷰어 (DXF 시각화 렌더링)
- 좌표계 변환 (TM→WGS84 등)
- 측량 성과와의 비교 검증

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | DXF 파일 업로드 및 파싱 (레이어, 엔티티, 텍스트 추출) | High | Pending |
| FR-02 | 레이어 접두사 분류: `$`(설계), `#`(인허가), 없음(일반) | High | Pending |
| FR-03 | `#` 레이어 존재 여부 → 인허가 자동 매핑 (Phase A) | High | Pending |
| FR-04 | 지적도 폴리라인 수집 + 텍스트("154-7 답") 파싱 | High | Pending |
| FR-05 | 도넛형 필지 포함관계 분석 (외곽/내곽 구분) | Medium | Pending |
| FR-06 | 텍스트 삽입점 → point-in-polygon → 필지 매칭 | Medium | Pending |
| FR-07 | 지목(전/답/과/임/하/도) → 전용/점용 허가 매핑 | High | Pending |
| FR-08 | `$` 엔티티 × `#` 구역 공간 교차 분석 (Phase B) | Medium | Pending |
| FR-09 | 교차 면적/연장 산출 (점용면적, 횡단폭 등) | Low | Pending |
| FR-10 | 분석 결과 → PermitGuide 컴포넌트 연동 | High | Pending |
| FR-11 | CAD 레이어 표준 컨벤션 정의서 (설계사 배포용) | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | DXF 파싱 + 분석 < 10초 (50MB 이하) | 콘솔 시간 측정 |
| Accuracy | 레이어 기반 인허가 판별 정확도 95%+ | 표준 레이어 사용 시 |
| Accuracy | 지적 텍스트 파싱 정확도 90%+ | 샘플 DXF 5개 검증 |
| Compatibility | AutoCAD 2018+ DXF(R2018) 지원 | 버전별 테스트 |
| File Size | 100MB 이하 DXF 처리 가능 | 대용량 테스트 |

---

## 4. Technical Design

### 4.1 CAD 레이어 접두사 컨벤션

```
접두사 규칙:
─────────────────────────────────────────────────
$  = 설계 요소 (우리가 설계한 구조물·관로)
#  = 인허가 구역 경계 (타 기관 관할 구역)
없음 = 일반 참조 레이어 (지적도, 등고선 등)
─────────────────────────────────────────────────

설계 레이어 ($)          인허가 구역 (#)          일반 레이어
─────────────          ──────────────          ──────────
$관로-오수              #도로구역                지적경계
$관로-우수              #하천구역                지적텍스트
$관로-합류              #소하천구역              등고선
$맨홀                   #농지                    현황도로
$처리시설               #산지                    범례
$펌프장                 #철도보호지구            도곽
$구조물경계             #군사시설보호구역
$가시설                 #문화재보호구역
                        #영구점용선
                        #일시점용선
```

### 4.2 `#` 레이어 → 인허가 매핑 테이블

| # 레이어명 | 매핑 인허가 | permit-info.ts 키 |
|-----------|-----------|------------------|
| `#도로구역` | 도로 점용 허가 | `'도로 점용 허가'` |
| `#하천구역` | 하천 점용 허가 | `'하천 점용 허가'` |
| `#소하천구역` | 소하천 점용 허가 | `'소하천 점용 허가'` |
| `#영구점용선` | 도로 점용 허가 | `'도로 점용 허가'` |
| `#일시점용선` | 도로 점용 허가 (공사 중) | `'도로 점용 허가'` |
| `#농지` | 농지 전용 허가 | `'농지 전용 허가'` |
| `#산지` | 산지 전용 허가 | `'산지 전용 허가'` |
| `#철도보호지구` | 철도 보호지구 행위허가 | `'철도 보호지구 행위허가'` |
| `#군사시설보호구역` | 군사시설 보호구역 행위허가 | `'군사시설 보호구역 행위허가'` |
| `#문화재보호구역` | 문화재 현상변경 허가 | `'문화재 현상변경 허가'` |

### 4.3 지적도 파싱 알고리즘

```
Step 1: 엔티티 수집
  "지적경계" 레이어 → CLOSED LWPOLYLINE 수집
  "지적텍스트" 레이어 → TEXT/MTEXT 수집

Step 2: 도넛형 필지 판별
  폴리라인을 면적 내림차순 정렬
  폴리라인 A 내부에 B의 모든 꼭짓점이 포함되면 → B는 A의 hole
  결과: { outer: Polyline, holes: Polyline[] }[]

Step 3: 텍스트 → 필지 매핑
  각 텍스트의 삽입점(x,y)에 대해:
    도넛 폴리곤(outer - holes) 안에 있는지 point-in-polygon 검사
    매칭되면 해당 필지의 번지+지목으로 등록

Step 4: 지목 추출
  정규식: /^(산?\s*\d+(?:-\d+)?)\s+(\S+)/
  "154-7 답" → { lotNumber: "154-7", category: "답" }
  "산 12-3 임" → { lotNumber: "산 12-3", category: "임" }
```

### 4.4 지목 → 인허가 매핑

| 지목 | 의미 | 필요 인허가 |
|------|------|-----------|
| 전 | 밭 | 농지 전용 허가 |
| 답 | 논 | 농지 전용 허가 |
| 과 | 과수원 | 농지 전용 허가 |
| 임 | 임야 | 산지 전용 허가 |
| 하 | 하천 | 하천 점용 허가 |
| 도 | 도로 | 도로 점용 허가 |
| 천 | 천(내) | 하천 점용 허가 |
| 대/공/잡 등 | 대지/공장/잡종지 | 별도 인허가 불필요 (일반적) |

### 4.5 도넛형 필지 엣지 케이스

| 케이스 | 설명 | 처리 방법 |
|--------|------|----------|
| 단순 필지 | 닫힌 폴리라인 1개 + 내부 텍스트 | 기본 point-in-polygon |
| 도넛 1공 | 도로 관통 등으로 내곽 1개 | outer - hole[0] 영역에서 텍스트 매칭 |
| 도넛 다공 | 건물 여러 동 등 내곽 복수 | outer - hole[0..n] 도넛 폴리곤 |
| 텍스트 누락 | 소규모 필지에 텍스트 없음 | `lotNumber: '미확인'` + UI 경고 표시 |
| 텍스트 구멍 안 | 텍스트가 hole 내부에 위치 (작도 오류) | 도넛 영역 밖이므로 미매칭 → fallback: 최근접 폴리라인 |
| 복수 텍스트 | 합병 전 필지 등 | 첫 번째 매칭 사용 + 경고 |
| 열린 폴리라인 | CLOSED가 아닌 경우 | 첫점-끝점 거리 < 허용오차면 자동 닫기, 아니면 제외 |

---

## 5. Success Criteria

### 5.1 Definition of Done

- [ ] DXF 업로드 → 레이어 목록 추출 성공
- [ ] `#` 접두사 레이어 → 인허가 자동 매핑 표시
- [ ] 지적도 텍스트("154-7 답") 파싱 → 지목 추출 성공
- [ ] 도넛형 필지 포함관계 정상 판별 (테스트 DXF 3개)
- [ ] 지목 기반 전용허가 매핑 → PermitGuide에 결과 표시
- [ ] Phase B: 공간 교차 분석 → 교차 구간/면적 산출
- [ ] npm run build 성공

### 5.2 Quality Criteria

- [ ] TypeScript strict mode 유지
- [ ] 에러 핸들링: 잘못된 DXF, 레이어 누락 시 한글 안내 메시지
- [ ] 비용 $0 유지 (dxf-parser, @turf/turf 모두 무료)

---

## 6. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| DXF 버전 호환성 (R12~R2018 차이) | Medium | Medium | dxf-parser는 대부분 버전 지원, 미지원 시 에러 안내 |
| 레이어명 비표준 (기존 도면) | High | High | Phase A: 레이어 목록 표시 후 수동 매핑 UI 제공 |
| 대용량 DXF (100MB+) 파싱 지연 | Medium | Medium | 스트리밍 파싱, Vercel Serverless 10초 제한 고려 |
| 좌표 단위 불일치 (mm vs m) | Low | Medium | 면적 비교 시 단위 무관 (비율만 사용) |
| 지적 텍스트 비정형 형식 | Medium | Medium | 정규식 + fallback 패턴 복수 정의 |
| 도넛 판별 오류 (인접 필지 오인) | Medium | Low | 면적 비율 임계값 (hole < outer의 80%) |
| Vercel Serverless 함수 실행시간 제한 | High | Medium | Hobby: 10초 / Pro: 60초, 파일 크기 제한으로 대응 |

---

## 7. Architecture Considerations

### 7.1 기술 스택 추가

| 패키지 | 용도 | 크기 | 라이선스 |
|--------|------|------|---------|
| `dxf-parser` | DXF 파일 파싱 (레이어, 엔티티, 텍스트) | ~50KB | MIT |
| `@turf/turf` | GeoJSON 공간 분석 (point-in-polygon, intersect) | ~500KB | MIT |

### 7.2 폴더 구조 확장

```
lib/
├── parsers/
│   ├── index.ts          # 기존 (PDF/DOCX/XLSX)
│   └── dxf.ts            # NEW: DXF 파싱 모듈
├── dxf/
│   ├── layer-classifier.ts   # NEW: 접두사 기반 레이어 분류
│   ├── cadastral-parser.ts   # NEW: 지적도 텍스트-폴리라인 매칭
│   ├── spatial-analyzer.ts   # NEW: 공간 교차 분석 (Phase B)
│   └── permit-mapper.ts      # NEW: 레이어/지목 → 인허가 매핑
├── permit-info.ts         # 기존 (15종 인허가 상세)
└── rag/
    └── permit.ts          # 기존 (인허가 판단 규칙)

app/api/
├── parse/route.ts         # UPDATE: DXF 파싱 추가
└── dxf-analyze/route.ts   # NEW: DXF 인허가 분석 API

components/
├── chat/
│   ├── PermitGuide.tsx    # UPDATE: DXF 분석 결과 연동
│   └── DxfAnalysisCard.tsx # NEW: DXF 분석 결과 카드
└── file/
    └── DropZone.tsx       # UPDATE: .dxf 확장자 허용
```

### 7.3 처리 흐름

```
[Phase A — 레이어 체크]
DXF 업로드 → dxf-parser 파싱 → 레이어 분류($/#/일반)
  → "#" 레이어 존재? → PERMIT_LAYER_MAP으로 인허가 매핑
  → 지적텍스트 파싱 → 지목 추출 → 전용허가 매핑
  → 결과: PermitAnalysisResult { permits[], parcels[] }

[Phase B — 공간 분석 (후속)]
  → "$" 엔티티 좌표 → GeoJSON 변환
  → "#" 구역 폴리곤 → GeoJSON 변환
  → Turf.js intersect → 교차 여부 + 면적/연장
  → 결과에 교차 상세 추가
```

---

## 8. Implementation Order

### Phase A: 레이어 기반 인허가 체크 (1~2일)

1. `dxf-parser` 설치 + `lib/parsers/dxf.ts` 파싱 모듈
2. `lib/dxf/layer-classifier.ts` — 접두사 분류 + 인허가 매핑
3. `lib/dxf/cadastral-parser.ts` — 지적 텍스트 파싱 (정규식)
4. `app/api/dxf-analyze/route.ts` — DXF 분석 API
5. `components/file/DropZone.tsx` — .dxf 확장자 허용
6. `components/chat/DxfAnalysisCard.tsx` — 분석 결과 UI
7. PermitGuide 연동 (분석 결과로 체크리스트 자동 체크)

### Phase B: 공간 교차 분석 (3~5일 추가)

1. `@turf/turf` 설치 + `lib/dxf/spatial-analyzer.ts`
2. 도넛형 필지 포함관계 분석 알고리즘
3. 텍스트 → 필지 point-in-polygon 매칭
4. `$` 엔티티 × `#` 구역 교차 분석
5. 교차 면적/연장 산출 → 결과 카드에 표시

### Phase C: CAD 표준 템플릿 (1일)

1. 레이어 접두사 컨벤션 정의서 (PDF/문서)
2. AutoCAD 템플릿(.dwt) 파일 제작 가이드
3. 사내 배포용 가이드 작성

---

## 9. Next Steps

1. [ ] Write design document (`dxf-permit-analysis.design.md`)
2. [ ] `npm install dxf-parser` 테스트 (DXF 파싱 확인)
3. [ ] 테스트용 DXF 파일 확보 (표준 레이어 포함)
4. [ ] Phase A 구현 시작

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-03-25 | Initial draft — 기술 검토 결과 반영 | AI 설계 검토 팀 |
