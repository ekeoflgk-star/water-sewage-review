// ============================================================
// DXF 분석 관련 타입 정의
// ============================================================

/** DXF 레이어 역할 분류 */
export type LayerRole = 'design' | 'permit' | 'cadastral' | 'general';

/** 분류된 레이어 정보 */
export interface ClassifiedLayer {
  name: string;            // 원본 레이어명 (예: "#도로구역")
  role: LayerRole;
  prefix: '$' | '#' | '';
  baseName: string;        // 접두사 제외 이름 (예: "도로구역")
  entityCount: number;
  hasPolylines: boolean;
  hasTexts: boolean;
}

/** DXF 폴리라인 (LWPOLYLINE) */
export interface DxfPolyline {
  layer: string;
  vertices: { x: number; y: number }[];
  isClosed: boolean;
  area: number;            // Shoelace formula 계산 면적
}

/** DXF 텍스트 (TEXT/MTEXT) */
export interface DxfText {
  layer: string;
  text: string;
  insertionPoint: { x: number; y: number };
  height: number;
}

/** 지적 필지 정보 */
export interface CadParcel {
  outerBoundary: { x: number; y: number }[];
  holes: { x: number; y: number }[][];
  lotNumber: string;       // "154-7", "산 12-3" 등
  landCategory: string;    // "답", "전", "임" 등
  landCategoryFull: string; // "논", "밭", "임야" 등
  area: number;
  matched: boolean;        // 텍스트 매칭 성공 여부
}

/** 인허가 분석 결과 항목 */
export interface PermitAnalysisItem {
  permitName: string;
  source: 'layer' | 'cadastral' | 'spatial';
  sourceDetail: string;
  layerName?: string;
  parcelInfo?: {
    lotNumber: string;
    landCategory: string;
  };
}

/** DXF 분석 전체 결과 */
export interface DxfAnalysisResult {
  fileName: string;
  layerSummary: {
    total: number;
    design: ClassifiedLayer[];
    permit: ClassifiedLayer[];
    cadastral: ClassifiedLayer[];
    general: ClassifiedLayer[];
  };
  parcels: CadParcel[];
  permits: PermitAnalysisItem[];
  warnings: string[];
  analyzedAt: string;
}
