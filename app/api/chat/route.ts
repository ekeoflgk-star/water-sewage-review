import { NextRequest } from 'next/server';
import { getGeminiModel, SYSTEM_PROMPT, buildPrompt } from '@/lib/gemini';

export const runtime = 'nodejs';

// Vercel 무료 플랜 타임아웃 고려 (최대 60초)
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, fileContext, history } = body;

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: '메시지가 제공되지 않았습니다.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // API 키 확인
    if (!process.env.GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY가 설정되지 않았습니다. .env.local 파일을 확인하세요.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Gemini 모델 초기화
    const model = getGeminiModel();

    // 프롬프트 구성 (파일 컨텍스트는 gemini.ts에서 자동 트렁케이트)
    const userPrompt = buildPrompt(message, fileContext, history);

    // 프롬프트 크기 로깅 (디버깅용)
    console.log(`[Chat API] 프롬프트 크기: ${userPrompt.length}자, 파일 컨텍스트: ${fileContext ? `${fileContext.length}자` : '없음'}`);

    // 스트리밍 생성
    const result = await model.generateContentStream({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${SYSTEM_PROMPT}\n\n---\n\n${userPrompt}` }],
        },
      ],
    });

    // ReadableStream으로 스트리밍 응답 생성
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
          console.error('[Chat API] Gemini 스트리밍 오류:', error);
          const errorMsg =
            error instanceof Error ? error.message : '스트리밍 오류';
          controller.enqueue(
            encoder.encode(`\n\n[오류: ${errorMsg}]`)
          );
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
    // 상세 에러 로깅
    console.error('[Chat API] 오류 전체:', error);

    let errorMessage = '알 수 없는 오류';
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;

      // Gemini API 특정 에러 처리
      if (errorMessage.includes('API_KEY_INVALID') || errorMessage.includes('API key not valid')) {
        errorMessage = 'API 키가 유효하지 않습니다. .env.local의 GEMINI_API_KEY를 확인하세요.';
        statusCode = 401;
      } else if (errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('429')) {
        errorMessage = '무료 사용량 한도에 도달했습니다. 잠시 후 다시 시도하세요. (분당 요청 제한)';
        statusCode = 429;
      } else if (errorMessage.includes('INVALID_ARGUMENT') || errorMessage.includes('too large')) {
        errorMessage = '요청 크기가 너무 큽니다. 더 작은 파일로 시도하거나, 질문을 짧게 해주세요.';
        statusCode = 413;
      } else if (errorMessage.includes('model') && errorMessage.includes('not found')) {
        errorMessage = '모델을 찾을 수 없습니다. Gemini API 설정을 확인하세요.';
        statusCode = 404;
      }
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: statusCode, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
