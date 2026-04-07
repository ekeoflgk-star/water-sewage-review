/**
 * 설계 검토 로직
 * - Gemini로 설계값 추출
 * - 규칙 기반 수치 비교 (관로시설 우선)
 * - ReviewCard 생성
 */

import { getGeminiModel, getGeminiModelJSON } from '@/lib/gemini';
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

  const prompt = `당신은 상하수도 설계 문서에서 **설계값(실제 적용된 값)**만 정확히 추출하는 전문가입니다.

## 중요 규칙:
1. **문서에 명시된 실제 설계값만 추출**하세요. 기준값·법적 기준·최소기준 등은 추출하지 마세요.
2. 표(table)에서 추출할 때 "설계값", "적용값", "계획값" 열의 수치를 읽으세요.
3. "기준값", "법적 기준", "최소", "이상", "이하" 등과 함께 나오는 값은 기준값이므로 제외하세요.
4. 관종(PE관, DCIP관 등)과 관경은 반드시 짝으로 추출하세요.
5. 수치는 문서에 적힌 그대로 정확히 읽으세요. 절대 반올림하거나 추측하지 마세요.

${categoryGuide}

아래 JSON 배열 형식으로 출력하세요:
[
  { "itemName": "항목명 (관종 포함)", "value": 수치값, "unit": "단위", "location": "문서 내 위치 (페이지·표·행 등)" }
]

예시: [{"itemName": "PE관 관경", "value": 200, "unit": "mm", "location": "관로 제원표 3행"}]

## 문서 내용:
${fileContent.slice(0, 50000)}`;

  try {
    // JSON 전용 모델 사용 (마크다운 출력 방지)
    const jsonModel = getGeminiModelJSON();
    const result = await jsonModel.generateContent(prompt);
    const text = result.response.text();

    // JSON 파싱 (responseMimeType='application/json'이므로 직접 파싱 가능)
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed) ? parsed : (parsed?.items || parsed?.data || []);
    if (!Array.isArray(arr) || arr.length === 0) return [];

    const designValues = arr.map((item: { itemName?: string; value?: number | string; unit?: string; location?: string }) => ({
      itemName: String(item.itemName || ''),
      value: item.value ?? '',
      unit: String(item.unit || ''),
      location: String(item.location || ''),
    }));

    // 디버그: 추출된 설계값 출력
    console.log(`[Reviewer] 설계값 ${designValues.length}개 추출됨:`);
    designValues.forEach((dv, i) => {
      console.log(`  [${i + 1}] ${dv.itemName}: ${dv.value} ${dv.unit} (${dv.location})`);
    });
    console.log(`[Reviewer] 문서 원본 길이: ${fileContent.length}자, Gemini에 전달: ${Math.min(fileContent.length, 50000)}자`);

    return designValues;
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

  // 추가참고문서 vs KDS 기준 분리
  const refDocResults = ragResults.filter((r) => r.source.includes('[추가참고문서]'));
  const kdsResults = ragResults.filter((r) => !r.source.includes('[추가참고문서]'));
  const refDocContext = refDocResults.length > 0
    ? `\n\n## 추가참고문서 기준 (우선 적용):\n${formatRAGContext(refDocResults)}`
    : '';
  const kdsContext = kdsResults.length > 0
    ? `\n\n## 관련 KDS 기준:\n${formatRAGContext(kdsResults)}`
    : `\n\n## 관련 KDS 기준:\n${ragContext}`;

  // Gemini JSON 모델로 판정 요청
  const jsonModel = getGeminiModelJSON();
  const prompt = `당신은 상하수도 설계 검토 전문가입니다.
다음 설계값들을 관련 기준과 비교하여 판정하세요.
${refDocResults.length > 0 ? '\n**중요**: 추가참고문서(발주처 가이드라인·조례 등)가 있는 경우 KDS보다 우선 적용합니다. 추가참고문서에 명시된 기준이 KDS와 다를 경우, 추가참고문서 기준으로 판정하세요.\n' : ''}
## 설계값:
${designValues.map((dv) => `- ${dv.itemName}: ${dv.value} ${dv.unit} (${dv.location})`).join('\n')}
${refDocContext}${kdsContext}

아래 JSON 배열 형식으로 출력하세요:
[
  {
    "itemName": "항목명",
    "verdict": "pass 또는 fail 또는 check",
    "finding": "검토 의견",
    "reference": "근거 조문 (추가참고문서 또는 KDS)",
    "designValue": "설계값",
    "standardValue": "기준값"
  }
]`;

  try {
    const result = await jsonModel.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);
    const items = Array.isArray(parsed) ? parsed : (parsed?.items || parsed?.data || []);
    if (!Array.isArray(items) || items.length === 0) return cards;

    for (const item of items) {
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

  // 추가참고문서 vs KDS 분리
  const refDocResults = ragResults.filter((r) => r.source.includes('[추가참고문서]'));
  const kdsResults = ragResults.filter((r) => !r.source.includes('[추가참고문서]'));

  const refDocContext = refDocResults.length > 0
    ? `\n\n## 추가참고문서 기준 (우선 적용):\n${formatRAGContext(refDocResults)}`
    : '';
  const kdsContext = kdsResults.length > 0
    ? `\n\n## 참조 KDS 기준:\n${formatRAGContext(kdsResults)}`
    : '';

  const jsonModel = getGeminiModelJSON();
  const prompt = `당신은 상하수도 설계 검토 전문가입니다.
다음 문서를 검토하고 주요 항목별 적합/부적합을 판정하세요.

## 중요 규칙:
1. **문서에 명시된 실제 설계값(적용값)을 정확히 읽어서** 기준값과 비교하세요.
2. 기준값과 설계값을 절대 혼동하지 마세요. designValue에는 문서에 적힌 실제 값을 적으세요.
3. 관종(PE관, DCIP관 등)별로 관경·유속 등을 구분하여 검토하세요.
${refDocResults.length > 0 ? '\n**중요**: 추가참고문서(발주처 가이드라인·조례 등)가 있는 경우 KDS보다 우선 적용합니다. 추가참고문서에 명시된 기준이 KDS와 다를 경우, 추가참고문서 기준으로 판정하세요.\n' : ''}${refDocContext}${kdsContext}

## 문서 내용:
${fileContent.slice(0, 50000)}

아래 JSON 배열 형식으로 출력하세요:
[
  {
    "itemName": "검토 항목명",
    "verdict": "pass 또는 fail 또는 check",
    "finding": "상세 검토 의견",
    "reference": "근거 조문 (추가참고문서, KDS 또는 법령)",
    "designValue": "설계값 (있으면)",
    "standardValue": "기준값 (있으면)"
  }
]`;

  // 최대 2회 시도
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await jsonModel.generateContent(prompt);
      const text = result.response.text();

      // responseMimeType='application/json'이므로 직접 파싱
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        // 혹시 JSON 파싱 실패 시 기존 방식 fallback
        const cleaned = text.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
        const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          console.warn(`[Reviewer] 직접 검토 시도 ${attempt + 1}: JSON 추출 실패, 응답 앞 200자:`, text.slice(0, 200));
          continue;
        }
        parsed = JSON.parse(jsonMatch[0]);
      }

      const items = Array.isArray(parsed) ? parsed : (parsed?.items || parsed?.data || []);
      if (!Array.isArray(items) || items.length === 0) continue;

      return items.map((item: {
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
      console.error(`[Reviewer] 직접 검토 시도 ${attempt + 1} 실패:`, error);
    }
  }

  console.error('[Reviewer] 직접 검토 2회 모두 실패');
  return [];
}
