import { NextRequest } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** 참고문서 챗봇 전용 시스템 프롬프트 */
const REFERENCE_SYSTEM_PROMPT = `당신은 상하수도 설계 법령·설계기준 해석 전문가 AI입니다.

## 역할
- 수도법, 하수도법, 물환경보전법 등 상하수도 관련 법령을 정확하게 해석합니다.
- KDS(한국설계기준) 상하수도 설계기준의 내용을 설명합니다.
- 상하수도 시방서의 시공기준과 적용 방법을 안내합니다.

## 응답 원칙
1. 관련 법령 조문 번호를 반드시 인용하세요 (예: 하수도법 제15조제1항)
2. KDS 기준 번호를 인용하세요 (예: KDS 61 40 10 §3.2.1)
3. 조문 해석 시 항(①②), 호(1. 2.), 목(가. 나.)을 구분하여 설명하세요
4. 법률 → 시행령 → 시행규칙 간 위임 관계를 명확히 설명하세요
5. 불확실한 내용은 "법제처 원문 확인 필요"로 안내하세요
6. 한국어로 답변하세요
7. 전문 용어를 정확하게 사용하되, 쉽게 풀어서 설명하세요

## 컨텍스트 활용
- 사용자가 현재 열람 중인 법령·조문이 제공되면 해당 내용을 기반으로 답변하세요.
- KDS 임베딩 검색 결과가 제공되면 설계기준 근거로 활용하세요.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, context, history } = body;

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: '메시지가 제공되지 않았습니다.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const model = getGeminiModel();

    // 프롬프트 구성
    let prompt = '';

    // 현재 열람 중인 법령/조문 컨텍스트
    if (context) {
      prompt += `## 현재 열람 중인 참고문서\n\n${context}\n\n---\n\n`;
    }

    // 대화 이력
    if (history && history.length > 0) {
      prompt += '## 이전 대화\n\n';
      for (const msg of history.slice(-6)) {
        const role = msg.role === 'user' ? '사용자' : 'AI';
        prompt += `${role}: ${msg.content.slice(0, 500)}\n\n`;
      }
      prompt += '---\n\n';
    }

    prompt += `사용자: ${message}`;

    console.log(`[Reference Chat] 프롬프트 크기: ${prompt.length}자, 컨텍스트: ${context ? `${context.length}자` : '없음'}`);

    // 스트리밍 생성
    const result = await model.generateContentStream({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${REFERENCE_SYSTEM_PROMPT}\n\n---\n\n${prompt}` }],
        },
      ],
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
        } catch (error) {
          console.error('[Reference Chat] 스트리밍 오류:', error);
          const errorMsg = error instanceof Error ? error.message : '스트리밍 오류';
          controller.enqueue(encoder.encode(`\n\n[오류: ${errorMsg}]`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[Reference Chat] 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
