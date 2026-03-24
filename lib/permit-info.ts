/**
 * 인허가 상세 정보 DB
 * - 15종 인허가별 필요 서류, 담당 기관, 연락처, 소요기간, 실무 참고사항
 * - lib/rag/permit.ts의 PERMIT_RULES와 permitName이 일치해야 함
 */

/** 인허가 상세 정보 타입 */
export interface PermitInfo {
  permitName: string;
  requiredDocs: string[];
  authority: string;
  contactInfo: string;
  estimatedDays: number;
  notes: string;
}

/** 인허가명을 키로 사용하는 상세 정보 맵 */
export const PERMIT_INFO_MAP: Record<string, PermitInfo> = {
  // ── 필수 인허가 ──
  '공공하수도 설치인가': {
    permitName: '공공하수도 설치인가',
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
  },

  '공공하수도 사용개시 신고': {
    permitName: '공공하수도 사용개시 신고',
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
  },

  // ── 키워드 기반 인허가 ──
  '도로 점용 허가': {
    permitName: '도로 점용 허가',
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
  },

  '하천 점용 허가': {
    permitName: '하천 점용 허가',
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
  },

  '농지 전용 허가': {
    permitName: '농지 전용 허가',
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
      '농지법 제34조. 농지전용 부담금(m당 개별공시지가 30%) 납부. 3만m 초과 시 농림축산식품부 협의. 농업진흥구역은 전용 제한.',
  },

  '산지 전용 허가': {
    permitName: '산지 전용 허가',
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
  },

  '사도 개설 허가': {
    permitName: '사도 개설 허가',
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
  },

  '철도 보호지구 행위허가': {
    permitName: '철도 보호지구 행위허가',
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
  },

  '군사시설 보호구역 행위허가': {
    permitName: '군사시설 보호구역 행위허가',
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
  },

  '문화재 현상변경 허가': {
    permitName: '문화재 현상변경 허가',
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
  },

  '개발행위 허가': {
    permitName: '개발행위 허가',
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
  },

  '소하천 점용 허가': {
    permitName: '소하천 점용 허가',
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
  },

  // ── 수치 조건 인허가 ──
  '환경영향평가': {
    permitName: '환경영향평가',
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
      '환경영향평가법 제22조. 하수처리 10만m/일 이상 시 대상. 평가서 작성 6~12개월 소요. 전문 대행업체 위탁 일반적. 주민 설명회 개최 의무.',
  },

  '소규모 환경영향평가': {
    permitName: '소규모 환경영향평가',
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
  },

  '지하안전영향평가': {
    permitName: '지하안전영향평가',
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
