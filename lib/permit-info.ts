/**
 * 인허가 상세 정보 DB
 * - 15종 인허가별 필요 서류, 담당 기관, 연락처, 소요기간, 실무 참고사항
 * - lib/rag/permit.ts의 PERMIT_RULES와 permitName이 일치해야 함
 */

/** 인허가 카테고리 */
export type PermitCategory = 'installation' | 'occupation' | 'conversion' | 'assessment' | 'other';

/** 인허가 카테고리 한글 매핑 */
export const PERMIT_CATEGORY_LABELS: Record<PermitCategory, string> = {
  installation: '설치인가',
  occupation: '점용허가',
  conversion: '전용허가',
  assessment: '영향평가',
  other: '기타허가',
};

/** 인허가 상세 정보 타입 */
export interface PermitInfo {
  permitName: string;
  category: PermitCategory;
  requiredDocs: string[];
  authority: string;
  contactInfo: string;
  estimatedDays: number;
  notes: string;
  /** 설계사가 성과품에 반영해야 할 사항 */
  designerTasks: string[];
  /** 설계 도서에 포함해야 할 도면/계산서 */
  designDeliverables: string[];
  /** 설계 단계에서의 주의사항 */
  designCautions: string[];
}

/** 인허가명을 키로 사용하는 상세 정보 맵 */
export const PERMIT_INFO_MAP: Record<string, PermitInfo> = {
  // ── 필수 인허가 ──
  '공공하수도 설치인가': {
    permitName: '공공하수도 설치인가',
    category: 'installation',
    requiredDocs: [
      '사업계획서',
      '설계도서 (설계설명서, 설계도면, 시방서, 수량산출서)',
      '환경영향조사서',
      '토지매수계획서',
      '재원조달계획서',
      '공사시행에 따른 피해방지계획서',
    ],
    authority: '시·도지사 (시·군·구 경유)',
    contactInfo: '관할 시·군·구 하수도과 / 정부24 (gov.kr)',
    estimatedDays: 30,
    notes:
      '하수도법 제16조. 사업비 50억 이상 시 중앙부처(환경부) 협의 필요. 타 법률에 의한 인허가 의제처리 가능 여부 사전 확인 필수.',
    designerTasks: [
      '설계설명서에 사업 개요·목적·필요성 명시',
      '설계도면에 노선 평면도, 종단면도, 횡단면도 포함',
      '수리계산서에 계획하수량, 유속, 관경 산정 근거 기재',
      '시방서에 관종·접합방법·되메우기 기준 명시',
      '수량산출서에 공종별 물량 산출 내역 포함',
      '환경영향조사 결과를 설계설명서에 반영',
    ],
    designDeliverables: [
      '관로 노선 평면도 (1:1,000 ~ 1:2,500)',
      '관로 종단면도 (H:1/100, V:1/200)',
      '표준 횡단면도',
      '맨홀 상세도',
      '수리계산서 (Manning 공식)',
      '구조계산서 (토압, 활하중)',
    ],
    designCautions: [
      '타 지하매설물(가스·전기·통신) 이격거리 확인',
      '설치인가 신청 시 설계도서 완성도가 핵심 — 미비 시 반려',
      '인허가 의제 대상 목록을 사전에 정리하여 설계설명서에 기재',
    ],
  },

  '공공하수도 사용개시 신고': {
    permitName: '공공하수도 사용개시 신고',
    category: 'installation',
    requiredDocs: [
      '준공검사조서',
      '시설물 인수인계서',
      '시운전 결과 보고서',
      '사용개시 신고서',
      '시설 현황도',
    ],
    authority: '시·도지사 (시·군·구 경유)',
    contactInfo: '관할 시·군·구 하수도과',
    estimatedDays: 14,
    notes:
      '하수도법 제17조. 준공 후 사용개시 전 반드시 신고. 방류수 수질기준 충족 확인 필요.',
    designerTasks: [
      '준공도면(As-Built) 작성 기준을 시방서에 명시',
      '시운전 계획서 항목을 설계설명서에 포함',
      '방류수 수질기준을 설계에 반영 (BOD, SS, T-N, T-P)',
    ],
    designDeliverables: [
      '준공도면 작성 지침',
      '시운전 항목 체크리스트',
      '방류수 수질기준 비교표',
    ],
    designCautions: [
      '시운전 기간(통상 3~6개월)을 공사 일정에 반영',
      '계측 장비 설치 위치를 설계에 포함',
    ],
  },

  // ── 키워드 기반 인허가 ──
  '도로 점용 허가': {
    permitName: '도로 점용 허가',
    category: 'occupation',
    requiredDocs: [
      '도로점용허가 신청서',
      '공사설계도서',
      '점용 위치도 및 평면도',
      '교통처리계획서',
      '복구계획서',
      '점용료 산출서',
    ],
    authority: '도로관리청 (국토부/시·도/시·군·구)',
    contactInfo: '국도: 국토관리사무소 / 지방도·시도: 관할 도로과',
    estimatedDays: 20,
    notes:
      '도로법 제61조. 도로 폭 및 관로 매설 깊이 기준 확인. 교통영향 최소화 방안 수립 필요. 점용료 납부 의무.',
    designerTasks: [
      '도로 관할청(국도/지방도/시도/군도) 확인 후 설계설명서에 명시',
      '점용 구간별 위치도 작성 (도로 노선번호, 구간 표기)',
      '관로 매설 깊이가 도로 구조 기준에 적합한지 검토',
      '교통처리계획 수립을 위한 교통량 자료 확보',
      '도로 복구 단면도 작성 (원상복구 기준)',
      '점용료 산출 기초자료 정리 (점용 면적, 기간)',
    ],
    designDeliverables: [
      '도로점용 위치도 (1:5,000)',
      '도로점용 평면도 (1:1,000)',
      '도로 횡단면도 (관로 매설 위치 표시)',
      '도로 복구 표준단면도',
      '교통처리계획도',
      '점용료 산출서',
    ],
    designCautions: [
      '차도 매설 최소토피 1.2m, 보도 0.6m 확인',
      '도로 종류별 관할청이 다르므로 반드시 확인 (국도↔지방도↔시도)',
      '굴착 폭이 도로 폭의 1/2 이상이면 교통영향분석 필요 가능성',
      '기존 포장 구조(아스콘 두께 등) 확인하여 복구비 산정',
    ],
  },

  '하천 점용 허가': {
    permitName: '하천 점용 허가',
    category: 'occupation',
    requiredDocs: [
      '하천점용허가 신청서',
      '사업계획서',
      '하천횡단설계도',
      '구조계산서',
      '하천영향분석 보고서',
      '복구계획서',
    ],
    authority: '하천관리청 (국가하천: 국토부 / 지방하천: 시·도지사)',
    contactInfo: '국가하천: 지방국토관리청 / 지방하천: 관할 하천과',
    estimatedDays: 30,
    notes:
      '하천법 제33조. 하천횡단 시 추진공법(비개착) 우선 검토. 홍수위 이하 시설물은 구조적 안전성 검증 필수. 하천기본계획 반영 여부 확인.',
    designerTasks: [
      '하천 등급(국가하천/지방하천) 및 관할청 확인',
      '하천기본계획 열람 → 계획홍수위, 하폭, 유량 확인',
      '횡단 공법 비교 검토 (개착 vs 비개착/추진공법)',
      '하천영향분석 수행 (통수능 검토, 세굴 검토)',
      '구조계산서 작성 (수압, 토압, 부력 검토)',
    ],
    designDeliverables: [
      '하천횡단 위치도',
      '하천횡단 평면도 + 종단면도',
      '추진공법 상세도 (비개착 시)',
      '구조계산서 (수압·부력·토압)',
      '하천영향분석 보고서',
      '하상보호공 상세도',
    ],
    designCautions: [
      '계획홍수위(HWL) 이하 구조물은 구조적 안전성 필수 검증',
      '하천 횡단 시 비개착(추진)공법 우선 검토 필요',
      '하천점용허가 소요기간이 길어(30일+) 설계 초기 협의 필수',
      '홍수기(6~9월) 공사 제한 → 공사 일정 반영',
    ],
  },

  '농지 전용 허가': {
    permitName: '농지 전용 허가',
    category: 'conversion',
    requiredDocs: [
      '농지전용허가 신청서',
      '사업계획서',
      '토지이용계획 확인서',
      '대체 농지 조성계획서',
      '농지전용 부담금 산출서',
      '토양오염 조사 결과 (필요시)',
    ],
    authority: '시·군·구청장 (농지 면적에 따라 시·도지사)',
    contactInfo: '관할 시·군·구 농업정책과 / 한국농어촌공사',
    estimatedDays: 25,
    notes:
      '농지법 제34조. 농지전용 부담금(m²당 개별공시지가 30%) 납부. 3만m² 초과 시 농림축산식품부 협의. 농업진흥구역은 전용 제한.',
    designerTasks: [
      '토지이용계획 확인서로 농지 여부 확인 (전·답·과수원)',
      '농지 전용 면적 산출 (시설 부지 + 진입도로)',
      '농지전용 부담금 개략 산출 (사업비 반영)',
      '농업진흥구역 해당 여부 확인 (전용 제한지역)',
    ],
    designDeliverables: [
      '토지이용계획 확인서',
      '농지전용 면적 산출표',
      '부담금 산출서 (개략)',
      '부지 배치도 (전용 범위 표시)',
    ],
    designCautions: [
      '농업진흥구역은 원칙적 전용 불가 → 노선 변경 검토',
      '농지전용 부담금이 사업비에 큰 비중 → 초기 개략 산출 필수',
      '3만m² 초과 시 중앙부처 협의로 기간 장기화',
    ],
  },

  '산지 전용 허가': {
    permitName: '산지 전용 허가',
    category: 'conversion',
    requiredDocs: [
      '산지전용허가 신청서',
      '사업계획서',
      '산림조사서',
      '대체산림자원 조성비 산출서',
      '재해방지계획서',
      '복구계획서',
    ],
    authority: '산림청장 또는 시·도지사 (면적에 따라)',
    contactInfo: '관할 시·군·구 산림과 / 산림청 (forest.go.kr)',
    estimatedDays: 30,
    notes:
      '산지관리법 제14조. 대체산림자원 조성비 납부. 보전산지는 전용 제한. 경사도 25도 이상은 추가 검토 필요. 산사태위험지구 해당 여부 확인.',
    designerTasks: [
      '산지 구분(보전산지/준보전산지) 확인',
      '산지전용 면적 및 대체조성비 산출',
      '절·성토량 산출 및 사면안정성 검토',
      '재해방지계획 수립 (우수배제, 사면보호)',
    ],
    designDeliverables: [
      '산지전용 면적 산출서',
      '절·성토 계획도',
      '사면안정 검토서',
      '재해방지계획서',
      '복구계획도',
    ],
    designCautions: [
      '보전산지는 전용 제한 → 노선 대안 검토 필요',
      '경사도 25도 이상 구간은 별도 안전성 검토 필수',
      '산사태위험지구 해당 시 공사 제한',
    ],
  },

  '사도 개설 허가': {
    permitName: '사도 개설 허가',
    category: 'occupation',
    requiredDocs: [
      '사도 개설(변경) 허가 신청서',
      '공사설계도서',
      '토지소유자 동의서',
      '위치도 및 평면도',
    ],
    authority: '시장·군수·구청장',
    contactInfo: '관할 시·군·구 건설과',
    estimatedDays: 15,
    notes:
      '사도법 제4조. 토지소유자 동의 필수. 사도 개설 후 유지관리 책임 귀속 확인.',
    designerTasks: [
      '사도 구간 확인 및 위치도 작성',
      '토지소유자 목록 정리 (동의서 수령 대상)',
    ],
    designDeliverables: [
      '사도 위치도',
      '평면도 (사도 구간 표시)',
    ],
    designCautions: [
      '토지소유자 동의가 필수이므로 초기에 대상자 파악',
    ],
  },

  '철도 보호지구 행위허가': {
    permitName: '철도 보호지구 행위허가',
    category: 'other',
    requiredDocs: [
      '행위허가 신청서',
      '공사설계도서',
      '안전성 검토 보고서',
      '진동·소음 영향 평가',
      '철도시설 이격거리 도면',
    ],
    authority: '국토교통부장관 (한국철도시설공단 위탁)',
    contactInfo: '한국철도시설공단 (kr.or.kr) / 관할 지역본부',
    estimatedDays: 30,
    notes:
      '철도안전법 제45조. 철도 중심에서 30m 이내 굴착 시 안전성 검토 필수. 열차 운행 시간 외 작업 계획 수립. 궤도 침하 모니터링 계획 포함.',
    designerTasks: [
      '철도 중심선으로부터 이격거리 확인 (30m 이내 여부)',
      '안전성 검토 보고서 작성 (진동·침하 영향)',
      '열차 운행시간 외 작업계획 수립',
    ],
    designDeliverables: [
      '철도 이격거리 도면',
      '안전성 검토 보고서',
      '계측 관리 계획서',
    ],
    designCautions: [
      '철도시설공단 사전 협의 필수 — 30일 이상 소요',
      '궤도 침하 모니터링 계획을 설계에 포함',
    ],
  },

  '군사시설 보호구역 행위허가': {
    permitName: '군사시설 보호구역 행위허가',
    category: 'other',
    requiredDocs: [
      '행위허가 신청서',
      '사업계획서',
      '위치도 및 현황도',
      '보안각서',
      '부대장 의견서 (사전 협의)',
    ],
    authority: '관할 부대장 또는 국방부장관',
    contactInfo: '관할 군부대 민원실 / 국방부 시설기획과',
    estimatedDays: 45,
    notes:
      '군사기지법 제13조. 통제보호구역은 원칙적 행위제한. 사전 부대 협의 필수. 보안 사항으로 처리 기간 장기화 가능. 촬영·측량 제한 구역 확인.',
    designerTasks: [
      '군사시설 보호구역 해당 여부 확인 (토지이용규제시스템)',
      '측량·촬영 제한 여부 사전 확인',
    ],
    designDeliverables: [
      '위치도 (보호구역 경계 표시)',
      '현황도',
    ],
    designCautions: [
      '통제보호구역은 원칙 불가 → 노선 우회 검토',
      '처리기간 최대 45일 이상 → 일정 여유 확보',
      '보안 사유로 도면 반출 제한 가능',
    ],
  },

  '문화재 현상변경 허가': {
    permitName: '문화재 현상변경 허가',
    category: 'other',
    requiredDocs: [
      '현상변경허가 신청서',
      '문화재 영향 검토 보고서',
      '매장문화재 지표조사 보고서',
      '공사설계도서',
      '문화재 보호 대책',
    ],
    authority: '문화재청장 (시·도 지정문화재: 시·도지사)',
    contactInfo: '문화재청 (cha.go.kr) / 관할 시·군·구 문화재과',
    estimatedDays: 30,
    notes:
      '문화재보호법 제35조. 지표조사 비용 별도 확보 필요. 유물 발견 시 공사 중단 및 신고 의무. 문화재 보호구역 외곽 500m 이내도 검토 대상.',
    designerTasks: [
      '문화재 보호구역 및 외곽 500m 이내 해당 여부 확인',
      '지표조사 비용을 사업비에 반영',
      '유물 발견 시 대응절차를 시방서에 명시',
    ],
    designDeliverables: [
      '문화재 현황도 (보호구역 경계 표시)',
      '문화재 보호 대책서',
    ],
    designCautions: [
      '문화재 보호구역 외곽 500m도 검토 대상',
      '지표조사 비용 별도 확보 필요 (수천만 원 수준)',
    ],
  },

  '개발행위 허가': {
    permitName: '개발행위 허가',
    category: 'other',
    requiredDocs: [
      '개발행위허가 신청서',
      '사업계획서',
      '토지이용계획 확인서',
      '설계도서',
      '배수계획서',
      '경관계획서 (필요시)',
    ],
    authority: '시장·군수·구청장',
    contactInfo: '관할 시·군·구 도시계획과',
    estimatedDays: 20,
    notes:
      '국토계획법 제56조. 토지 형질변경 시 필요. 개발행위허가 기준 충족 확인. 도시계획위원회 심의 대상 여부 확인.',
    designerTasks: [
      '토지형질변경 해당 여부 확인',
      '배수계획서 작성 (우수 배제 계획)',
    ],
    designDeliverables: [
      '토지이용계획 확인서',
      '배수계획서',
      '부지 조성 계획도',
    ],
    designCautions: [
      '도시계획위원회 심의 대상 시 추가 기간 소요',
    ],
  },

  '소하천 점용 허가': {
    permitName: '소하천 점용 허가',
    category: 'occupation',
    requiredDocs: [
      '소하천 점용허가 신청서',
      '공사설계도서',
      '위치도 및 횡단도',
      '구조계산서',
      '복구계획서',
    ],
    authority: '시장·군수·구청장',
    contactInfo: '관할 시·군·구 치수과 또는 건설과',
    estimatedDays: 15,
    notes:
      '소하천정비법 제14조. 소하천정비종합계획 반영 여부 확인. 홍수기 공사 제한.',
    designerTasks: [
      '소하천 횡단 위치 확인 및 횡단도 작성',
      '소하천정비종합계획과의 정합성 확인',
      '구조계산서 작성 (관로 매설 깊이, 하중)',
    ],
    designDeliverables: [
      '소하천 횡단 위치도',
      '소하천 횡단 상세도',
      '구조계산서',
      '복구계획서',
    ],
    designCautions: [
      '홍수기(6~9월) 공사 제한 → 일정 반영',
      '소하천정비종합계획 열람 필수',
    ],
  },

  // ── 수치 조건 인허가 ──
  '환경영향평가': {
    permitName: '환경영향평가',
    category: 'assessment',
    requiredDocs: [
      '환경영향평가서 (초안)',
      '환경영향평가서 (본안)',
      '주민 의견 수렴 결과',
      '주민 공람·공고 자료',
      '대기·수질·소음 등 환경 조사 보고서',
      '생태계 조사 보고서',
    ],
    authority: '환경부장관 (한국환경공단 위탁 검토)',
    contactInfo: '환경부 (me.go.kr) / 한국환경공단 (keco.or.kr)',
    estimatedDays: 90,
    notes:
      '환경영향평가법 제22조. 하수처리 10만m³/일 이상 시 대상. 평가서 작성 6~12개월 소요. 전문 대행업체 위탁 일반적. 주민 설명회 개최 의무.',
    designerTasks: [
      '처리용량 확인하여 환경영향평가 대상 여부 판단',
      '환경영향평가 비용을 사업비에 반영',
      '평가 소요기간(6~12개월)을 사업 일정에 반영',
    ],
    designDeliverables: [
      '환경영향평가 대상 여부 검토서',
      '처리용량 산정 근거서',
    ],
    designCautions: [
      '10만m³/일 이상 시 필수 — 설계 초기에 판단해야 일정 영향 최소화',
      '전문 대행업체 별도 발주 필요',
    ],
  },

  '소규모 환경영향평가': {
    permitName: '소규모 환경영향평가',
    category: 'assessment',
    requiredDocs: [
      '소규모 환경영향평가서',
      '환경 현황 조사 보고서',
      '보전지역 해당 여부 확인서',
      '환경 보전 대책',
    ],
    authority: '환경부장관 (지방환경청)',
    contactInfo: '관할 지방환경청 / 환경부 (me.go.kr)',
    estimatedDays: 30,
    notes:
      '환경영향평가법 제43조. 보전지역·생태 민감 지역 공사 시 대상. 간이 환경영향평가로 기간 단축 가능. 환경부 협의 기간 포함.',
    designerTasks: [
      '보전지역·생태 민감 지역 해당 여부 확인',
      '환경보전대책을 설계에 반영',
    ],
    designDeliverables: [
      '보전지역 해당 여부 확인서',
      '환경보전대책서',
    ],
    designCautions: [
      '보전지역 여부는 토지이용규제시스템에서 확인 가능',
    ],
  },

  '지하안전영향평가': {
    permitName: '지하안전영향평가',
    category: 'assessment',
    requiredDocs: [
      '지하안전영향평가서',
      '지반조사 보고서',
      '지하시설물 현황도',
      '굴착공법 설계서',
      '지반침하 모니터링 계획',
      '안전관리계획서',
    ],
    authority: '국토교통부장관 (한국시설안전공단 위탁)',
    contactInfo: '한국시설안전공단 (kistec.or.kr) / 관할 지자체 안전과',
    estimatedDays: 45,
    notes:
      '지하안전관리법 제14조. 굴착 깊이 20m 이상 시 대상. 지하시설물 탐사(GPR) 선행 필요. 지반침하 위험도 평가 포함. 계측 관리 기준치 설정 필수.',
    designerTasks: [
      '최대 굴착깊이 확인 (20m 이상 여부)',
      '지반조사 결과를 설계에 반영',
      '지하시설물 현황 조사 (GPR 탐사)',
      '계측 관리 기준치를 설계에 포함',
    ],
    designDeliverables: [
      '굴착깊이 검토서',
      '지반조사 보고서',
      '지하시설물 현황도',
      '계측 관리 계획서',
    ],
    designCautions: [
      '굴착 20m 이상 시 필수 — 심도 깊은 관로·처리장 기초에 해당',
      'GPR 탐사 비용을 사업비에 반영',
    ],
  },
};

/**
 * 인허가명으로 상세 정보 조회
 * @param permitName - PERMIT_RULES의 permitName과 동일한 값
 * @returns PermitInfo 또는 undefined
 */
export function getPermitInfo(permitName: string): PermitInfo | undefined {
  return PERMIT_INFO_MAP[permitName];
}

/**
 * 전체 인허가 상세 정보 목록 반환
 */
export function getAllPermitInfos(): PermitInfo[] {
  return Object.values(PERMIT_INFO_MAP);
}
