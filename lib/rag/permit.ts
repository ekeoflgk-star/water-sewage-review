/**
 * 인허가 자동 판단 로직
 * - 15종 인허가 트리거 규칙 (하드코딩)
 * - 키워드 매칭 + 수치 조건 기반 4단계 판정
 */

import { getGeminiModel } from '@/lib/gemini';
import type { PermitCard, PermitVerdict } from '@/types';

/** 인허가 규칙 정의 */
interface PermitRule {
  permitName: string;
  legalBasis: string;
  keywords: string[];
  condition: 'always' | 'keyword-match' | 'numeric' | 'conditional';
  threshold?: {
    field: string;
    operator: '>=' | '<=' | '>' | '<';
    value: number;
    unit: string;
  };
  description: string; // 트리거 조건 설명
}

/** 인허가 15종 규칙 */
const PERMIT_RULES: PermitRule[] = [
  // ── 필수 인허가 (하수도 사업이면 무조건) ──
  {
    permitName: '공공하수도 설치인가',
    legalBasis: '하수도법 §16',
    keywords: ['하수도', '하수관로', '하수처리', '공공하수도'],
    condition: 'always',
    description: '하수도 사업 시 필수',
  },
  {
    permitName: '공공하수도 사용개시 신고',
    legalBasis: '하수도법 §17',
    keywords: ['하수도', '사용개시', '준공'],
    condition: 'always',
    description: '하수도 시설 준공 후 필수',
  },

  // ── 키워드 기반 인허가 ──
  {
    permitName: '도로 점용 허가',
    legalBasis: '도로법 §61',
    keywords: ['도로', '국도', '지방도', '시도', '군도', '도로 하부', '노면', '차도'],
    condition: 'keyword-match',
    description: '도로 하부 관로 매설 시',
  },
  {
    permitName: '하천 점용 허가',
    legalBasis: '하천법 §33',
    keywords: ['하천', '하천횡단', '하천부지', '제방', '호안'],
    condition: 'keyword-match',
    description: '하천 구역 내 시설물 설치 시',
  },
  {
    permitName: '농지 전용 허가',
    legalBasis: '농지법 §34',
    keywords: ['농지', '전답', '농업용지', '경작지', '논', '밭'],
    condition: 'keyword-match',
    description: '농지에 시설물 설치 시',
  },
  {
    permitName: '산지 전용 허가',
    legalBasis: '산지관리법 §14',
    keywords: ['산지', '임야', '산림', '임도'],
    condition: 'keyword-match',
    description: '산지 내 시설물 설치 시',
  },
  {
    permitName: '사도 개설 허가',
    legalBasis: '사도법 §4',
    keywords: ['사도', '사유도로', '사설도로'],
    condition: 'keyword-match',
    description: '사도 구간 굴착 시',
  },
  {
    permitName: '철도 보호지구 행위허가',
    legalBasis: '철도안전법 §45',
    keywords: ['철도', '선로', '철도 하부', '궤도'],
    condition: 'keyword-match',
    description: '철도 인접 시설물 설치 시',
  },
  {
    permitName: '군사시설 보호구역 행위허가',
    legalBasis: '군사기지법 §13',
    keywords: ['군사시설', '군부대', '보호구역', '군사'],
    condition: 'keyword-match',
    description: '군사시설 보호구역 내 공사 시',
  },
  {
    permitName: '문화재 현상변경 허가',
    legalBasis: '문화재보호법 §35',
    keywords: ['문화재', '매장문화재', '유적', '보호구역', '사적'],
    condition: 'keyword-match',
    description: '문화재 보호구역 내 굴착 시',
  },
  {
    permitName: '개발행위 허가',
    legalBasis: '국토계획법 §56',
    keywords: ['개발행위', '토지형질변경', '형질변경'],
    condition: 'keyword-match',
    description: '토지 형질 변경 시',
  },
  {
    permitName: '소하천 점용 허가',
    legalBasis: '소하천정비법 §14',
    keywords: ['소하천', '소하천 횡단'],
    condition: 'keyword-match',
    description: '소하천 구역 내 시설물 설치 시',
  },

  // ── 수치 조건 인허가 ──
  {
    permitName: '환경영향평가',
    legalBasis: '환경영향평가법 §22',
    keywords: ['처리용량', '처리시설', '처리장'],
    condition: 'numeric',
    threshold: { field: '처리용량', operator: '>=', value: 100000, unit: 'm³/일' },
    description: '하수처리 10만m³/일 이상 시',
  },
  {
    permitName: '소규모 환경영향평가',
    legalBasis: '환경영향평가법 §43',
    keywords: ['보전지역', '자연환경', '생태'],
    condition: 'conditional',
    description: '보전지역 등 환경 민감 지역 공사 시',
  },
  {
    permitName: '지하안전영향평가',
    legalBasis: '지하안전관리법 §14',
    keywords: ['지하굴착', '굴착깊이', '터파기'],
    condition: 'numeric',
    threshold: { field: '굴착깊이', operator: '>=', value: 20, unit: 'm' },
    description: '굴착 깊이 20m 이상 시',
  },
];

/**
 * 인허가 자동 판단
 *
 * 1. 키워드 스캔 → 조건별 1차 판정
 * 2. numeric 조건은 Gemini로 수치 추출 시도
 * 3. PermitCard[] 반환
 */
export async function checkPermits(fileContent: string): Promise<PermitCard[]> {
  const cards: PermitCard[] = [];
  const contentLower = fileContent.toLowerCase();

  for (const rule of PERMIT_RULES) {
    // 키워드 존재 여부 확인
    const matchedKeywords = rule.keywords.filter((kw) =>
      contentLower.includes(kw.toLowerCase())
    );
    const hasKeyword = matchedKeywords.length > 0;

    let verdict: PermitVerdict;
    let explanation: string;

    switch (rule.condition) {
      case 'always':
        // 하수도 사업이면 무조건 필수
        verdict = 'required';
        explanation = `${rule.description}. 하수도 사업에서 반드시 필요한 인허가입니다.`;
        break;

      case 'keyword-match':
        if (hasKeyword) {
          verdict = 'required';
          explanation = `문서에서 관련 키워드(${matchedKeywords.join(', ')})가 발견되어 해당 인허가가 필요합니다.`;
        } else {
          verdict = 'not-applicable';
          explanation = `문서에서 관련 키워드가 발견되지 않아 해당 사항이 없는 것으로 판단됩니다.`;
        }
        break;

      case 'numeric':
        if (!hasKeyword) {
          verdict = 'not-applicable';
          explanation = '문서에서 관련 키워드가 발견되지 않았습니다.';
        } else if (rule.threshold) {
          // Gemini로 수치 추출 시도
          const numResult = await extractNumericValue(
            fileContent,
            rule.threshold.field,
            rule.threshold.unit
          );
          if (numResult === null) {
            verdict = 'scale-review';
            explanation = `관련 키워드는 발견되었으나 ${rule.threshold.field} 수치를 확인할 수 없습니다. 규모 검토가 필요합니다.`;
          } else if (compareThreshold(numResult, rule.threshold.operator, rule.threshold.value)) {
            verdict = 'required';
            explanation = `${rule.threshold.field} ${numResult.toLocaleString()}${rule.threshold.unit}으로 기준(${rule.threshold.value.toLocaleString()}${rule.threshold.unit}) 이상이므로 필수입니다.`;
          } else {
            verdict = 'not-applicable';
            explanation = `${rule.threshold.field} ${numResult.toLocaleString()}${rule.threshold.unit}으로 기준(${rule.threshold.value.toLocaleString()}${rule.threshold.unit}) 미만이므로 해당 없습니다.`;
          }
        } else {
          verdict = 'scale-review';
          explanation = '규모 검토가 필요합니다.';
        }
        break;

      case 'conditional':
        if (hasKeyword) {
          verdict = 'conditional';
          explanation = `관련 키워드(${matchedKeywords.join(', ')})가 발견되었습니다. 세부 조건을 확인하세요.`;
        } else {
          verdict = 'not-applicable';
          explanation = '문서에서 관련 키워드가 발견되지 않았습니다.';
        }
        break;

      default:
        verdict = 'not-applicable';
        explanation = '판단 불가';
    }

    // not-applicable은 결과에서 제외 (필요한 것만 표시)
    if (verdict === 'not-applicable') continue;

    cards.push({
      id: crypto.randomUUID(),
      permitName: rule.permitName,
      verdict,
      legalBasis: rule.legalBasis,
      triggerCondition: rule.description,
      explanation,
    });
  }

  return cards;
}

/**
 * Gemini로 문서에서 특정 수치 추출
 */
async function extractNumericValue(
  fileContent: string,
  fieldName: string,
  unit: string
): Promise<number | null> {
  try {
    const model = getGeminiModel();
    const prompt = `다음 문서에서 "${fieldName}" 수치를 추출하세요.
단위: ${unit}
숫자만 응답하세요. 찾을 수 없으면 "없음"이라고 응답하세요.

문서 내용 (앞부분):
${fileContent.slice(0, 10000)}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    if (text === '없음' || text === 'null' || text === 'N/A') return null;

    const numMatch = text.match(/[\d,]+\.?\d*/);
    if (!numMatch) return null;

    return parseFloat(numMatch[0].replace(/,/g, ''));
  } catch {
    return null;
  }
}

/**
 * 수치 비교
 */
function compareThreshold(
  value: number,
  operator: '>=' | '<=' | '>' | '<',
  threshold: number
): boolean {
  switch (operator) {
    case '>=': return value >= threshold;
    case '<=': return value <= threshold;
    case '>':  return value > threshold;
    case '<':  return value < threshold;
    default:   return false;
  }
}
