// ============================================================
// 파일 관련 타입
// ============================================================

/** 파일 그룹 분류 (7종) */
export type FileGroup =
  | 'report'                // 보고서
  | 'drawing'               // 설계도면
  | 'quantity-calculation'  // 수량산출서
  | 'design-estimate'       // 설계내역서
  | 'specification'         // 시방서
  | 'guideline'             // 추가참고문서 (발주처 가이드라인·조례 등)
  | 'etc';                  // 기타

/** 파일 그룹 한글 매핑 */
export const FILE_GROUP_LABELS: Record<FileGroup, string> = {
  'report': '보고서',
  'drawing': '설계도면',
  'quantity-calculation': '수량산출서',
  'design-estimate': '설계내역서',
  'specification': '시방서',
  'guideline': '📌 추가참고문서',
  'etc': '기타',
};

/** 파일 그룹별 설명 (툴팁용) */
export const FILE_GROUP_DESCRIPTIONS: Record<FileGroup, string> = {
  'report': '설계설명서, 기본/실시설계보고서 등',
  'drawing': '평면도, 종단면도, 횡단면도, 구조도 등 (PDF/DXF)',
  'quantity-calculation': '수량산출서, 물량내역서 등 (주로 XLSX)',
  'design-estimate': '설계내역서, 원가계산서, 단가표 등 (주로 XLSX)',
  'specification': '공사시방서, 특별시방서 등',
  'guideline': '발주처 가이드라인, 조례, 지침 등 — 해당 사업 전용 검토 기준으로 적용',
  'etc': '기타 참고 문서',
};

/** 파일 확장자/이름 → 추천 그룹 */
export function suggestFileGroup(fileName: string): FileGroup | null {
  const name = fileName.toLowerCase();
  const ext = name.split('.').pop();

  // 확장자 기반 추천
  if (ext === 'dxf') return 'drawing';
  if (ext === 'xlsx' || ext === 'xls') {
    if (name.includes('수량') || name.includes('물량')) return 'quantity-calculation';
    if (name.includes('내역') || name.includes('단가') || name.includes('원가')) return 'design-estimate';
    return null;
  }

  // 파일명 키워드 기반 추천
  if (name.includes('보고서') || name.includes('설명서') || name.includes('개요')) return 'report';
  if (name.includes('도면') || name.includes('평면') || name.includes('종단') || name.includes('횡단')) return 'drawing';
  if (name.includes('수량') || name.includes('물량')) return 'quantity-calculation';
  if (name.includes('내역') || name.includes('단가')) return 'design-estimate';
  if (name.includes('시방')) return 'specification';
  if (name.includes('가이드') || name.includes('조례') || name.includes('지침')) return 'guideline';

  return null;
}

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
  uploadProgress?: number;     // 업로드 진행률 (0~100)
  errorMessage?: string;
  /** 임베딩 상태 (추가참고문서용) */
  embedStatus?: 'none' | 'embedding' | 'embedded' | 'embed-error';
  embedChunks?: number;          // 임베딩된 청크 수
  embedProjectId?: string;       // 임베딩된 사업 ID (사업별 격리)
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
  references?: ReferenceAnnotation[];  // 복수 근거 (클릭 바로가기용)
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
// 근거 문서 참조 (Phase 4 — 주석 바로가기)
// ============================================================

/** 검토 근거 참조 정보 */
export interface ReferenceAnnotation {
  id: string;
  source: string;        // 출처명 (예: "KDS 61 40 10", "하수도법 제16조")
  content: string;       // 근거 텍스트 원문
  page?: number;         // 페이지 번호
  section?: string;      // 섹션명
  similarity?: number;   // 유사도 점수 (RAG 검색 결과)
  fileId?: string;       // 업로드된 파일 ID (있으면 파일 바로가기 가능)
}

// ============================================================
// 프로젝트 폴더 관리 (Phase 4 — 사업별 폴더)
// ============================================================

/** 사업 프로젝트 (2단계 중첩: 사업 → 하위폴더) */
export interface Project {
  id: string;
  name: string;          // 사업명 (예: "아포 하수관로 정비")
  parentId?: string;     // 상위 폴더 ID (null이면 최상위)
  description?: string;
  fileIds: string[];     // 소속 파일 ID 목록
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// 세션 (대화) 관리 타입
// ============================================================

/** 대화 세션 */
export interface Session {
  id: string;
  title: string;          // 대화 제목 (첫 메시지 기반 자동 생성)
  createdAt: Date;
  updatedAt: Date;
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
