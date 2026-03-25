// ============================================================
// 파일 관련 타입
// ============================================================

/** 파일 그룹 분류 (6종) */
export type FileGroup =
  | 'design-description'    // 설계설명서
  | 'hydraulic-calculation' // 수리계산서
  | 'drawing'               // 설계도면
  | 'specification'         // 시방서
  | 'quantity-calculation'  // 수량산출서
  | 'review-criteria';      // 검토기준문서 (사용자 업로드)

/** 파일 그룹 한글 매핑 */
export const FILE_GROUP_LABELS: Record<FileGroup, string> = {
  'design-description': '설계설명서',
  'hydraulic-calculation': '수리계산서',
  'drawing': '설계도면',
  'specification': '시방서',
  'quantity-calculation': '수량산출서',
  'review-criteria': '검토기준문서',
};

/** 업로드된 파일 */
export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: 'pdf' | 'docx' | 'xlsx' | 'dxf';
  group: FileGroup | null;       // 분류 전이면 null
  content?: string;               // 파싱된 텍스트 내용
  uploadedAt: Date;
  status: 'uploading' | 'parsing' | 'ready' | 'error';
  errorMessage?: string;
}

// ============================================================
// 채팅 관련 타입
// ============================================================

/** 채팅 메시지 역할 */
export type MessageRole = 'user' | 'assistant' | 'system';

/** 채팅 메시지 */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  /** 메시지에 포함된 검토 카드 (Phase 2) */
  reviewCards?: ReviewCard[];
  /** 메시지에 포함된 인허가 카드 (Phase 2) */
  permitCards?: PermitCard[];
  /** DXF 인허가 분석 결과 */
  dxfAnalysis?: import('./dxf').DxfAnalysisResult;
}

// ============================================================
// 설계 검토 관련 타입 (Phase 2)
// ============================================================

/** 설계 검토 판정 3단계 */
export type ReviewVerdict = 'pass' | 'fail' | 'check';

/** 설계 검토 판정 한글 매핑 */
export const REVIEW_VERDICT_LABELS: Record<ReviewVerdict, string> = {
  pass: '적합',
  fail: '부적합',
  check: '확인필요',
};

/** 검토 분야 (7종) */
export type ReviewCategory =
  | 'sewer-pipeline'        // 하수도 관로시설
  | 'sewer-pump'            // 하수도 펌프장시설
  | 'sewer-treatment'       // 하수도 수처리시설
  | 'sewer-sludge'          // 하수도 슬러지처리
  | 'water-intake'          // 상수도 취정수시설
  | 'water-distribution'    // 상수도 송배급수시설
  | 'common-structural';    // 공통 구조·전기·토목

/** 설계 검토 카드 */
export interface ReviewCard {
  id: string;
  category: ReviewCategory;
  itemName: string;           // 검토 항목명
  verdict: ReviewVerdict;
  finding: string;            // 검토 의견
  reference: string;          // 근거 조문 (예: KDS 61 40 10 §3.2)
  designValue?: string;       // 설계값
  standardValue?: string;     // 기준값
}

// ============================================================
// 인허가 검토 관련 타입 (Phase 2)
// ============================================================

/** 인허가 판정 4단계 */
export type PermitVerdict = 'required' | 'conditional' | 'scale-review' | 'not-applicable';

/** 인허가 판정 한글 매핑 */
export const PERMIT_VERDICT_LABELS: Record<PermitVerdict, string> = {
  required: '필수',
  conditional: '조건부 확인',
  'scale-review': '규모 검토',
  'not-applicable': '해당 없음',
};

/** 인허가 카드 */
export interface PermitCard {
  id: string;
  permitName: string;         // 인허가명 (예: 공공하수도 설치인가)
  verdict: PermitVerdict;
  legalBasis: string;         // 근거법령 (예: 하수도법 §16)
  triggerCondition: string;   // 트리거 조건
  explanation: string;        // AI 판단 설명
}

// ============================================================
// 법령 참조 관련 타입 (Phase 3)
// ============================================================

/** 법령 계층 */
export type LawLevel = 'act' | 'decree' | 'rule' | 'standard' | 'ordinance';

/** 법령 조항 */
export interface LawArticle {
  id: string;
  level: LawLevel;
  lawName: string;            // 법령명 (예: 하수도법)
  articleNumber: string;      // 조항번호 (예: 제16조)
  content: string;            // 조문 내용
  children?: LawArticle[];    // 하위 법령 (파도타기 탐색용)
}

// ============================================================
// 지식 베이스 관련 타입 (Phase 2)
// ============================================================

/** 지식 베이스 레이어 */
export type KnowledgeLayer = 'layer1-preset' | 'layer2-upload' | 'layer3-api';

/** 지식 베이스 검색 결과 */
export interface KnowledgeResult {
  id: string;
  layer: KnowledgeLayer;
  source: string;             // 출처 (예: KDS 61 40 10 또는 김천시 기본계획)
  content: string;            // 검색된 텍스트 청크
  similarity: number;         // 유사도 점수
  page?: number;              // 페이지 번호
  section?: string;           // 섹션명
}
