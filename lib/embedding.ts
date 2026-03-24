import { GoogleGenerativeAI } from '@google/generative-ai';

// Gemini Embedding 모델 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/** Gemini text-embedding-004 모델 (768차원, 무료) */
const EMBEDDING_MODEL = 'text-embedding-004';

/** 배치 최대 크기 */
const BATCH_SIZE = 100;

/**
 * 단일 텍스트 임베딩
 * @returns 768차원 벡터 배열
 */
export async function embedText(text: string): Promise<number[]> {
  if (!text.trim()) {
    throw new Error('임베딩할 텍스트가 비어있습니다.');
  }

  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

/**
 * 여러 텍스트 배치 임베딩
 * - 최대 BATCH_SIZE(100)개씩 묶어서 요청
 * - 빈 텍스트는 건너뜀
 * - 실패 시 1회 재시도 (3초 대기)
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const validTexts = texts.filter((t) => t.trim().length > 0);

  if (validTexts.length === 0) {
    return [];
  }

  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const results: number[][] = [];

  // 배치 단위로 처리
  for (let i = 0; i < validTexts.length; i += BATCH_SIZE) {
    const batch = validTexts.slice(i, i + BATCH_SIZE);

    try {
      const embeddings = await embedBatchWithRetry(model, batch);
      results.push(...embeddings);
    } catch (error) {
      console.error(`[Embedding] 배치 ${i / BATCH_SIZE + 1} 실패:`, error);
      throw error;
    }

    // Gemini 무료 티어 레이트 리밋 대응 (배치 간 짧은 대기)
    if (i + BATCH_SIZE < validTexts.length) {
      await delay(500);
    }
  }

  return results;
}

/**
 * 배치 임베딩 + 1회 재시도
 */
async function embedBatchWithRetry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  texts: string[],
  retries: number = 1
): Promise<number[][]> {
  try {
    const result = await model.batchEmbedContents({
      requests: texts.map((text) => ({
        content: { parts: [{ text }] },
      })),
    });
    return result.embeddings.map(
      (e: { values: number[] }) => e.values
    );
  } catch (error) {
    if (retries > 0) {
      console.warn('[Embedding] 재시도 대기 3초...');
      await delay(3000);
      return embedBatchWithRetry(model, texts, retries - 1);
    }
    throw error;
  }
}

/** 대기 유틸 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
