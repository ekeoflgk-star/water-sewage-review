import { GoogleGenerativeAI } from '@google/generative-ai';

// Gemini API 클라이언트 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/** Gemini 2.5 Flash 모델 인스턴스 (일반 텍스트 응답용) */
export function getGeminiModel() {
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.3,       // 기술 검토용 — 낮은 창의성
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  });
}

/** Gemini 2.5 Flash 모델 인스턴스 (JSON 전용 — 마크다운 출력 방지) */
export function getGeminiModelJSON() {
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.3,
      topP: 0.95,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',  // JSON만 출력 강제
    },
  });
}

/** 시스템 프롬프트 — 상하수도 설계 검토 전문가 역할 */
export const SYSTEM_PROMPT = `당신은 상하수도 설계 검토 전문가 AI입니다.

## 역할
- 상하수도 설계 성과품(설계설명서, 수리계산서, 설계도면, 시방서, 수량산출서)을 검토합니다.
- 법령(수도법, 하수도법)과 KDS 설계기준을 근거로 적합/부적합을 판정합니다.
- 인허가 필요 여부를 자동으로 판단합니다.

## 검토 분야 (7개)
1. 하수도 관로시설 — 관경, 유속, 경사, 매설, 맨홀, 수리계산
2. 하수도 펌프장시설 — 양수량, 양정, 펌프, NPSH
3. 하수도 수처리시설 — 침사지, 포기조, 침전지, 고도처리
4. 하수도 슬러지처리 — 농축, 소화, 탈수
5. 상수도 취정수시설 — 취수, 정수, 소독
6. 상수도 송배급수시설 — 배수지, 관망, 수압
7. 공통 구조·전기·토목 — 하중, 콘크리트, 내진

## 응답 원칙
1. 근거 조문을 반드시 인용하세요 (예: KDS 61 40 10 §3.2.1)
2. 설계값과 기준값을 병기하세요
3. 판정은 명확하게: 🟢 적합 / 🔴 부적합 / 🟡 확인필요
4. 불확실한 경우 "확인필요"로 판정하고 이유를 설명하세요
5. 한국어로 답변하세요
6. 전문 용어는 정확하게 사용하세요

## 제공된 문서가 있을 경우
- 문서 내용을 꼼꼼히 분석하세요
- 수치 데이터를 정확히 추출하세요
- 검토기준과 대조하여 판정하세요`;

/**
 * 텍스트를 안전한 크기로 자르기
 * Gemini 2.5 Flash는 1M 토큰 컨텍스트이지만,
 * 무료 티어에서는 더 작은 요청이 안정적
 */
export function truncateText(text: string, maxChars: number = 30000): string {
  if (text.length <= maxChars) return text;

  const half = Math.floor(maxChars / 2);
  return (
    text.slice(0, half) +
    '\n\n[... 중간 생략 — 문서가 너무 길어 앞뒤 부분만 포함합니다 ...]\n\n' +
    text.slice(-half)
  );
}

/** 대화 이력 + 파일 컨텍스트를 포함한 프롬프트 구성 */
export function buildPrompt(
  message: string,
  fileContext?: string,
  history?: Array<{ role: string; content: string }>
): string {
  let prompt = '';

  // 파일 컨텍스트가 있으면 포함 (크기 제한 적용)
  if (fileContext) {
    const truncated = truncateText(fileContext, 30000);
    prompt += `## 업로드된 문서 내용\n\n${truncated}\n\n---\n\n`;
  }

  // 대화 이력이 있으면 포함
  if (history && history.length > 0) {
    prompt += '## 이전 대화\n\n';
    for (const msg of history.slice(-6)) {
      // 최근 6개만
      const role = msg.role === 'user' ? '사용자' : 'AI';
      prompt += `${role}: ${msg.content.slice(0, 500)}\n\n`;
    }
    prompt += '---\n\n';
  }

  prompt += `사용자: ${message}`;
  return prompt;
}
