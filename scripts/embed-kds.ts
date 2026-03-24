/**
 * KDS 임베딩 CLI 스크립트
 *
 * 사용법:
 *   npx tsx scripts/embed-kds.ts data/kds/KDS_61_40_10.pdf "KDS 61 40 10"
 *   npx tsx scripts/embed-kds.ts data/kds/           <-- 폴더 내 PDF 전체
 *
 * 동작:
 *   1. PDF 파일 텍스트 추출
 *   2. 조항 경계 기준 청크 분할 (800자, overlap 100자)
 *   3. Gemini Embedding API로 벡터화 (768차원)
 *   4. Supabase knowledge_base 테이블에 INSERT
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

// pdf-parse는 CommonJS 모듈
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

// ============================================================
// 환경변수 로드 (.env.local)
// ============================================================
function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local 파일을 찾을 수 없습니다.');
    process.exit(1);
  }
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv();

// ============================================================
// 클라이언트 초기화
// ============================================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseKey || !geminiKey) {
  console.error('❌ 환경변수가 부족합니다: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenerativeAI(geminiKey);

// ============================================================
// 청크 분할 (lib/rag/chunker.ts 로직 복제 — CLI 독립 실행용)
// ============================================================
interface Chunk {
  content: string;
  page?: number;
  section?: string;
  index: number;
}

const SECTION_PATTERNS = [
  /^#{1,3}\s+/m,
  /^제\d+조/m,
  /^§\s*\d/m,
  /^\d+\.\d+(\.\d+)?\s+[가-힣]/m,
  /^[가나다라마바사아자차카타파하]\.\s/m,
  /^제\d+장/m,
];

function extractSectionTitle(text: string): string | undefined {
  const firstLine = text.split('\n')[0]?.trim();
  if (!firstLine) return undefined;
  for (const pattern of SECTION_PATTERNS) {
    if (pattern.test(firstLine)) return firstLine.slice(0, 100);
  }
  return undefined;
}

function splitIntoChunks(text: string, maxSize = 800, overlap = 100): Chunk[] {
  if (!text.trim()) return [];

  // 조항 경계로 1차 분할
  const sectionPattern = /(?=^#{1,3}\s+|^제\d+조|^§\s*\d|^\d+\.\d+(?:\.\d+)?\s+[가-힣]|^제\d+장)/m;
  let rawParts = text.split(sectionPattern).filter((p) => p.trim().length > 0);
  if (rawParts.length === 0) rawParts = [text];

  // 크기 초과 시 문단 재분할
  const splitParts: string[] = [];
  for (const part of rawParts) {
    if (part.length <= maxSize) {
      splitParts.push(part);
    } else {
      const paragraphs = part.split(/\n\n+/);
      let current = '';
      for (const para of paragraphs) {
        if (current.length + para.length + 2 > maxSize && current.length > 0) {
          splitParts.push(current.trim());
          current = para;
        } else {
          current += (current ? '\n\n' : '') + para;
        }
      }
      if (current.trim()) splitParts.push(current.trim());
    }
  }

  // overlap 적용 + Chunk 생성
  const chunks: Chunk[] = [];
  for (let i = 0; i < splitParts.length; i++) {
    let content = splitParts[i];
    if (i > 0 && overlap > 0) {
      const prevText = splitParts[i - 1];
      content = prevText.slice(-overlap) + '\n' + content;
    }
    chunks.push({
      content: content.trim(),
      section: extractSectionTitle(splitParts[i]),
      index: i,
    });
  }

  return chunks;
}

// ============================================================
// Gemini 배치 임베딩
// ============================================================
const EMBEDDING_MODEL = 'gemini-embedding-001';
// 무료 티어: 분당 100 요청 → 개별 임베딩 + 적절한 대기
const BATCH_SIZE = 50; // 로그 출력 단위
const REQUEST_DELAY_MS = 800; // 요청 간 0.8초 (분당 ~75건)
const MAX_RETRIES = 3;

async function embedSingle(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

async function embedAllChunks(chunks: Chunk[]): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < chunks.length; i++) {
    if (i % BATCH_SIZE === 0) {
      console.log(`  📊 임베딩 중... ${i + 1}~${Math.min(i + BATCH_SIZE, chunks.length)} / ${chunks.length}`);
    }

    for (let retry = 0; retry <= MAX_RETRIES; retry++) {
      try {
        const embedding = await embedSingle(chunks[i].content);
        results.push(embedding);
        break;
      } catch (error: unknown) {
        const status = (error as { status?: number }).status;
        if (status === 429 && retry < MAX_RETRIES) {
          const waitSec = 30 * (retry + 1);
          console.warn(`  ⚠️ 레이트 리밋 — ${waitSec}초 대기 (${retry + 1}/${MAX_RETRIES})...`);
          await delay(waitSec * 1000);
        } else if (retry === MAX_RETRIES) {
          throw error;
        } else {
          // 기타 오류도 짧게 대기 후 재시도
          await delay(3000);
        }
      }
    }

    // 요청 간 대기 (레이트 리밋 방지)
    if (i < chunks.length - 1) {
      await delay(REQUEST_DELAY_MS);
    }
  }
  return results;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// PDF 파싱
// ============================================================
async function parsePDF(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

// ============================================================
// Supabase INSERT
// ============================================================
async function insertToSupabase(
  chunks: Chunk[],
  embeddings: number[][],
  source: string
) {
  const rows = chunks.map((chunk, i) => ({
    source,
    section: chunk.section || null,
    page: chunk.page || null,
    content: chunk.content,
    embedding: JSON.stringify(embeddings[i]),
    metadata: JSON.stringify({
      chunkIndex: chunk.index,
      charCount: chunk.content.length,
    }),
  }));

  // 50개씩 배치 INSERT
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase.from('knowledge_base').insert(batch);
    if (error) {
      console.error(`  ❌ INSERT 오류 (${i}~${i + batch.length}):`, error.message);
      throw error;
    }
    console.log(`  💾 저장 완료: ${i + 1}~${Math.min(i + 50, rows.length)} / ${rows.length}`);
  }
}

// ============================================================
// 파일명에서 KDS 코드 자동 추출
// ============================================================
function inferSourceFromFilename(filename: string): string {
  // KDS_61_40_10.pdf → KDS 61 40 10
  const match = filename.match(/KDS[_\s-]*(\d{2})[_\s-]*(\d{2})[_\s-]*(\d{2})/i);
  if (match) {
    return `KDS ${match[1]} ${match[2]} ${match[3]}`;
  }
  // 파일명 그대로 사용
  return path.basename(filename, path.extname(filename));
}

// ============================================================
// 메인 실행
// ============================================================
/** 이미 저장된 청크 수 확인 (resume 기능) */
async function getExistingChunkCount(source: string): Promise<number> {
  const { count, error } = await supabase
    .from('knowledge_base')
    .select('id', { count: 'exact', head: true })
    .eq('source', source);

  if (error) {
    console.warn('  ⚠️ 기존 데이터 확인 실패:', error.message);
    return 0;
  }
  return count || 0;
}

async function processFile(filePath: string, source?: string) {
  const filename = path.basename(filePath);
  const kdsSource = source || inferSourceFromFilename(filename);

  console.log(`\n📄 처리 시작: ${filename}`);
  console.log(`   출처: ${kdsSource}`);

  // 0. 이미 저장된 데이터 확인 (resume)
  const existingCount = await getExistingChunkCount(kdsSource);
  if (existingCount > 0) {
    console.log(`  ⏩ 기존 ${existingCount}개 청크 발견`);
  }

  // 1. PDF 파싱
  console.log('  1️⃣ PDF 텍스트 추출...');
  const text = await parsePDF(filePath);
  console.log(`     추출 완료: ${text.length.toLocaleString()}자`);

  // 2. 청크 분할
  console.log('  2️⃣ 청크 분할...');
  const chunks = splitIntoChunks(text);
  console.log(`     분할 완료: ${chunks.length}개 청크`);

  if (chunks.length === 0) {
    console.warn('  ⚠️ 청크가 0개 — 건너뜁니다.');
    return;
  }

  // 이미 모든 청크가 저장되어 있으면 건너뛰기
  if (existingCount >= chunks.length) {
    console.log(`  ✅ 이미 완료됨 (${existingCount}/${chunks.length}) — 건너뜁니다.\n`);
    return;
  }

  // resume: 이미 저장된 만큼 건너뛰기
  const startIdx = existingCount;
  const remainingChunks = chunks.slice(startIdx);
  if (startIdx > 0) {
    console.log(`  ⏩ ${startIdx}개 건너뛰고 ${remainingChunks.length}개부터 이어서 진행`);
  }

  // 3. 임베딩
  console.log('  3️⃣ Gemini 임베딩...');
  const embeddings = await embedAllChunks(remainingChunks);
  console.log(`     임베딩 완료: ${embeddings.length}개 벡터 (${embeddings[0]?.length}차원)`);

  // 4. Supabase 저장
  console.log('  4️⃣ Supabase 저장...');
  await insertToSupabase(remainingChunks, embeddings, kdsSource);

  console.log(`  ✅ 완료: ${filename} → ${remainingChunks.length}개 청크 저장됨 (총 ${startIdx + remainingChunks.length}/${chunks.length})\n`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
사용법:
  npx tsx scripts/embed-kds.ts <PDF경로> [KDS코드]
  npx tsx scripts/embed-kds.ts data/kds/              (폴더 내 PDF 전체)

예시:
  npx tsx scripts/embed-kds.ts data/kds/KDS_61_40_10.pdf "KDS 61 40 10"
  npx tsx scripts/embed-kds.ts data/kds/
    `);
    process.exit(0);
  }

  const target = args[0];
  const source = args[1]; // 수동 지정 (선택)

  const stat = fs.statSync(target);

  if (stat.isDirectory()) {
    // 폴더 내 PDF 전체 처리
    const pdfFiles = fs.readdirSync(target)
      .filter((f) => f.toLowerCase().endsWith('.pdf'))
      .map((f) => path.join(target, f));

    if (pdfFiles.length === 0) {
      console.error('❌ PDF 파일이 없습니다:', target);
      process.exit(1);
    }

    console.log(`📂 폴더 모드: ${pdfFiles.length}개 PDF 발견`);
    for (const pdfFile of pdfFiles) {
      await processFile(pdfFile);
    }
  } else {
    // 단일 파일 처리
    await processFile(target, source);
  }

  console.log('🎉 모든 임베딩 작업 완료!');
}

main().catch((err) => {
  console.error('❌ 치명적 오류:', err);
  process.exit(1);
});
