/**
 * 설계 검토 로직
 * - Gemini로 설계값 추출
 * - 규칙 기반 수치 비교 (관로시설 우선)
 * - ReviewCard 생성
 */

import { getGeminiModel } from '@/lib/gemini';
import { searchKnowledge, formatRAGContext } from '@/lib/rag/index';
import type { ReviewCard, ReviewCategory, ReviewVerdict } from '@/types';

/** 설계값 추출 결과 */
export interface DesignValue {
  itemName: string;          // 항목명
  value: number | string;    // 설계값
  unit: string;              // 단위
  location: string;          // 문서 내 위치
}

/** 관로시설 수치 비교 규칙 */
interface NumericRule {
  itemName: string;
  category: ReviewCategory;
  min?: number;
  max?: number;
  unit: string;
  reference: string;         // KDS 조문 참조
  description: string;       // 기준 설명
}

/** Phase 2 우선 구현: 하수도 관로시설 주요 규칙 */
const PIPELINE_RULES: NumericRule[] = [
  {
    itemName: '오수관 유속',
    category: 'sewer-pipeline',
    min: 0.6, max: 3.0, unit: 'm/s',
    reference: 'KDS 61 40 10 §3.2.1',
    description: '오수관 유속은 0.6~3.0 m/s 범위',
  },
  {
    itemName: '우수관 유속',
    category: 'sewer-pipeline',
    min: 0.8, max: 3.0, unit: 'm/s',
    reference: 'KDS 61 40 10 §3.2.2',
    description: '우수관 유속은 0.8~3.0 m/s 범위',
  },
  {
    itemName: '오수관 최소관경',
    category: 'sewer-pipeline',
    min: 200, unit: 'mm',
    reference: 'KDS 61 40 10 §3.1.1',
    description: '오수관 최소관경 200mm 이상',
  },
  {
    itemName: '우수관 최소관경',
    category: 'sewer-pipeline',
    min: 250, unit: 'mm',
    reference: 'KDS 61 40 10 §3.1.2',
    description: '우수관 최소관경 250mm 이상',
  },
  {
    itemName: '차도 최소토피',
    category: 'sewer-pipeline',
    min: 1.0, unit: 'm',
    reference: 'KDS 61 40 10 §4.5',
    description: '차도 구간 최소토피 1.0m 이상',
  },
  {
    itemName: '보도 최소토피',
    category: 'sewer-pipeline',
    min: 0.6, unit: 'm',
    reference: 'KDS 61 40 10 §4.5',
    description: '보도 구간 최소토피 0.6m 이상',
  },
  {
    itemName: '오수관 충만도',
    category: 'sewer-pipeline',
    max: 0.8, unit: '',
    reference: 'KDS 61 40 10 §3.3',
    description: '오수관 충만도 0.8 이하',
  },
  {
    itemName: '우수관 충만도',
    category: 'sewer-pipeline',
    max: 1.0, unit: '',
    reference: 'KDS 61 40 10 §3.3',
    description: '우수관 충만도 1.0 이하',
  },
];

/**
 * Gemini를 사용하여 문서에서 설계값 추출
 */
export async function extractDesignValues(
  fileContent: string,
  category?: ReviewCategory
): Promise<DesignValue[]> {
  const model = getGeminiModel();

  const categoryGuide = category === 'sewer-pipeline'
    ? '하수도 관로시설 관련 수치를 중점 추출: 유속, 관경, 토피, 경사, 충만도, 맨홀간격 등'
    : '모든 설계 수치를 추출';

  const prompt = `다음 설계 문서에서 설계 수치를 JSON 배열로 추출하세요.
${categoryGuide}

## 출력 형식 (JSON만 출력, 다른 텍스트 금지):
[
  { "itemName": "항목명", "value": 수치값, "unit": "단위", "location": "문서 내 위치" }
]

## 문서 내용:
${fileContent.slice(0, 15000)}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // JSON 추출 (```json ... ``` 블록 또는 직접 배열)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: { itemName?: string; value?: number | string; unit?: string; location?: string }) => ({
      itemName: String(item.itemName || ''),
      value: item.value ?? '',
      unit: String(item.unit || ''),
      location: String(item.location || ''),
    }));
  } catch (error) {
    console.error('[Reviewer] 설계값 추출 실패:', error);
    return [];
  }
}

/**
 * 규칙 기반 수치 비교
 */
function compareWithRules(designValues: DesignValue[]): {
  matched: Array<{ design: DesignValue; rule: NumericRule; verdict: ReviewVerdict; finding: string }>;
  unmatched: DesignValue[];
} {
  const matched: Array<{ design: DesignValue; rule: NumericRule; verdict: ReviewVerdict; finding: string }> = [];
  const unmatched: DesignValue[] = [];

  for (const dv of designValues) {
    // 이름으로 규칙 매칭 (부분 매칭)
    const rule = PIPELINE_RULES.find((r) =>
      dv.itemName.includes(r.itemName) ||
      r.itemName.includes(dv.itemName) ||
      (dv.itemName.includes('유속') && r.itemName.includes('유속') && dv.itemName.includes(r.itemName.includes('오수') ? '오수' : '우수'))
    );

    if (!rule || typeof dv.value !== 'number') {
      unmatched.push(dv);
      continue;
    }

    const numValue = Number(dv.value);
    if (isNaN(numValue)) {
      unmatched.push(dv);
      continue;
    }

    let verdict: ReviewVerdict = 'pass';
    let finding = '';

    if (rule.min !== undefined && numValue < rule.min) {
      verdict = 'fail';
      finding = `설계값 ${numValue}${rule.unit}이(가) 최소 기준 ${rule.min}${rule.unit} 미만입니다.`;
    } else if (rule.max !== undefined && numValue > rule.max) {
      verdict = 'fail';
      finding = `설계값 ${numValue}${rule.unit}이(가) 최대 기준 ${rule.max}${rule.unit}을(를) 초과합니다.`;
    } else {
      const rangeStr = rule.min !== undefined && rule.max !== undefined
        ? `${rule.min}~${rule.max}${rule.unit}`
        : rule.min !== undefined
          ? `${rule.min}${rule.unit} 이상`
          : `${rule.max}${rule.unit} 이하`;
      finding = `설계값 ${numValue}${rule.unit}이(가) 기준 범위(${rangeStr}) 내에 있습니다.`;
    }

    matched.push({ design: dv, rule, verdict, finding });
  }

  return { matched, unmatched };
}

/**
 * 설계 검토 실행 → ReviewCard[] 생성
 *
 * 1. 설계값 추출 (Gemini)
 * 2. 규칙 기반 수치 비교
 * 3. 미매칭 항목은 RAG + Gemini로 판정
 * 4. ReviewCard[] 반환
 */
export async function runDesignReview(
  fileContent: string,
  sessionId?: string,
  category?: ReviewCategory
): Promise<ReviewCard[]> {
  const reviewCards: ReviewCard[] = [];

  // 1. 설계값 추출
  const designValues = await extractDesignValues(fileContent, category);

  if (designValues.length === 0) {
    // 설계값을 추출할 수 없는 경우 → Gemini 직접 검토
    return await geminiDirectReview(fileContent, sessionId);
  }

  // 2. 규칙 기반 비교
  const { matched, unmatched } = compareWithRules(designValues);

  // 3. 규칙 매칭된 항목 → ReviewCard 변환
  for (const m of matched) {
    const standardRange = m.rule.min !== undefined && m.rule.max !== undefined
      ? `${m.rule.min}~${m.rule.max} ${m.rule.unit}`
      : m.rule.min !== undefined
        ? `${m.rule.min} ${m.rule.unit} 이상`
        : `${m.rule.max} ${m.rule.unit} 이하`;

    reviewCards.push({
      id: crypto.randomUUID(),
      category: m.rule.category,
      itemName: m.design.itemName,
      verdict: m.verdict,
      finding: m.finding,
      reference: m.rule.reference,
      designValue: `${m.design.value} ${m.design.unit}`,
      standardValue: standardRange,
    });
  }

  // 4. 미매칭 항목 → RAG 검색 + Gemini 판정
  if (unmatched.length > 0) {
    const ragCards = await reviewWithRAG(unmatched, fileContent, sessionId);
    reviewCards.push(...ragCards);
  }

  return reviewCards;
}

/**
 * RAG 검색 + Gemini로 미매칭 항목 검토
 */
async function reviewWithRAG(
  designValues: DesignValue[],
  fileContent: string,
  sessionId?: string
): Promise<ReviewCard[]> {
  const cards: ReviewCard[] = [];

  // 설계값 목록으로 RAG 검색 쿼리 구성
  const queryText = designValues
    .map((dv) => `${dv.itemName} ${dv.value} ${dv.unit}`)
    .join(', ');

  const ragResults = await searchKnowledge({
    query: queryText,
    sessionId,
    topK: 10,
    threshold: 0.6,
  });

  if (ragResults.length === 0) return cards;

  const ragContext = formatRAGContext(ragResults);

  // Gemini에 판정 요청
  const model = getGeminiModel();
  const prompt = `당신은 상하수도 설계 검토 전문가입니다.
다음 설계값들을 관련 KDS 기준과 비교하여 판정하세요.

## 설계값:
${designValues.map((dv) => `- ${dv.itemName}: ${dv.value} ${dv.unit} (${dv.location})`).join('\n')}

## 관련 KDS 기준:
${ragContext}

## 출력 형식 (JSON 배열만 출력):
[
  {
    "itemName": "항목명",
    "verdict": "pass|fail|check",
    "finding": "검토 의견",
    "reference": "근거 조문",
    "designValue": "설계값",
    "standardValue": "기준값"
  }
]`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return cards;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return cards;

    for (const item of parsed) {
      cards.push({
        id: crypto.randomUUID(),
        category: 'sewer-pipeline' as ReviewCategory,
        itemName: String(item.itemName || ''),
        verdict: (['pass', 'fail', 'check'].includes(item.verdict) ? item.verdict : 'check') as ReviewVerdict,
        finding: String(item.finding || ''),
        reference: String(item.reference || ''),
        designValue: item.designValue ? String(item.designValue) : undefined,
        standardValue: item.standardValue ? String(item.standardValue) : undefined,
      });
    }
  } catch (error) {
    console.error('[Reviewer] RAG 판정 실패:', error);
  }

  return cards;
}

/**
 * Gemini 직접 검토 (설계값 추출 불가 시 fallback)
 */
async function geminiDirectReview(
  fileContent: string,
  sessionId?: string
): Promise<ReviewCard[]> {
  // RAG 컨텍스트 확보
  const ragResults = await searchKnowledge({
    query: '상하수도 설계 검토 기준 유속 관경 토피',
    sessionId,
    topK: 5,
  });

  const ragContext = ragResults.length > 0
    ? `\n\n## 참조 KDS 기준:\n${formatRAGContext(ragResults)}`
    : '';

  const model = getGeminiModel();
  const prompt = `당신은 상하수도 설계 검토 전문가입니다.
다음 문서를 검토하고 주요 항목별 적합/부적합을 판정하세요.
${ragContext}

## 문서 내용:
${fileContent.slice(0, 15000)}

## 출력 형식 (JSON 배열만 출력):
[
  {
    "itemName": "검토 항목명",
    "verdict": "pass|fail|check",
    "finding": "상세 검토 의견",
    "reference": "근거 조문 (KDS 또는 법령)",
    "designValue": "설계값 (있으면)",
    "standardValue": "기준값 (있으면)"
  }
]`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: {
      itemName?: string; verdict?: string; finding?: string;
      reference?: string; designValue?: string; standardValue?: string;
    }) => ({
      id: crypto.randomUUID(),
      category: 'sewer-pipeline' as ReviewCategory,
      itemName: String(item.itemName || '미분류'),
      verdict: (['pass', 'fail', 'check'].includes(String(item.verdict)) ? item.verdict : 'check') as ReviewVerdict,
      finding: String(item.finding || ''),
      reference: String(item.reference || ''),
      designValue: item.designValue ? String(item.designValue) : undefined,
      standardValue: item.standardValue ? String(item.standardValue) : undefined,
    }));
  } catch (error) {
    console.error('[Reviewer] 직접 검토 실패:', error);
    return [];
  }
}
