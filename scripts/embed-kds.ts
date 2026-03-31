/**
 * KDS 임베딩 CLI 스크립트
 *
 * 사용법:
 *   npx tsx scripts/embed-kds.ts data/kds/KDS_61_40_10.pdf "KDS 61 40 10"
 *   npx tsx scripts/embed-kds.ts data/kds/           <-- 폴더 내 PDF 전체
 *   npx tsx scripts/embed-kds.ts --check              <-- DB 상태만 확인
 *   npx tsx scripts/embed-kds.ts --reset <source>     <-- 특정 source 데이터 삭제 후 재시작
 *
 * 동작:
 *   1. PDF 파일 텍스트 추출
 *   2. 조항 경계 기준 청크 분할 (800자, overlap 100자)
 *   3. Gemini Embedding API로 벡터화 (3072차원)
 *   4. Supabase knowledge_base 테이블에 INSERT
 *
 * Resume 방식:
 *   - 로컬 진행 파일 (.embed-progress.json) + DB count 이중 확인
 *   - 쿼터 소진으로 중단 후 재실행 시 이어서 진행
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
// 로컬 진행 파일 (.embed-progress.json) — DB 의존 제거
// ============================================================
const PROGRESS_FILE = path.resolve(__dirname, '..', '.embed-progress.json');

interface ProgressData {
  [source: string]: {
    totalChunks: number;
    savedChunks: number;
    lastBatchIndex: number;
    updatedAt: string;
  };
}

function loadProgress(): ProgressData {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch {
    console.warn('  ⚠️ 진행 파일 읽기 실패 — 새로 생성합니다.');
  }
  return {};
}

function saveProgress(data: ProgressData) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function updateProgress(source: string, totalChunks: number, savedChunks: number, lastBatchIndex: number) {
  const data = loadProgress();
  data[source] = {
    totalChunks,
    savedChunks,
    lastBatchIndex,
    updatedAt: new Date().toISOString(),
  };
  saveProgress(data);
}

function getLocalProgress(source: string): { savedChunks: number; totalChunks: number } | null {
  const data = loadProgress();
  if (data[source]) {
    return { savedChunks: data[source].savedChunks, totalChunks: data[source].totalChunks };
  }
  return null;
}

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
// Gemini 배치 임베딩 (batchEmbedContents — 1회 호출로 최대 100개)
// ============================================================
const EMBEDDING_MODEL = 'gemini-embedding-001'; // 3072차원 — Supabase 스키마 맞춤
const BATCH_SIZE = 5; // 무료 쿼터 분당 토큰 제한 대응
const BATCH_DELAY_MS = 4000; // 배치 간 4초 대기 (분당 제한 회피)
const MAX_RETRIES = 5;

/** 배치 임베딩 — 최대 100개 텍스트를 1회 API 호출로 처리 */
async function embedBatch(texts: string[]): Promise<number[][]> {
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.batchEmbedContents({
    requests: texts.map((text) => ({
      content: { role: 'user', parts: [{ text }] },
    })),
  });
  return result.embeddings.map((e) => e.values);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// 429 감지 (Gemini SDK 에러 형식 대응)
// ============================================================
function is429Error(error: unknown): boolean {
  // 1) .status 프로퍼티 직접 확인
  const status = (error as { status?: number }).status;
  if (status === 429) return true;

  // 2) .message 안에 429 또는 RESOURCE_EXHAUSTED 텍스트 확인
  const msg = (error as { message?: string }).message || '';
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) return true;

  // 3) .errorDetails 배열 확인 (GoogleGenerativeAIFetchError)
  const details = (error as { errorDetails?: Array<{ reason?: string }> }).errorDetails;
  if (details?.some((d) => d.reason === 'RATE_LIMIT_EXCEEDED' || d.reason === 'RESOURCE_EXHAUSTED')) return true;

  return false;
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
// DB 상태 확인
// ============================================================
/** 이미 저장된 청크 수 확인 (DB 조회) */
async function getExistingChunkCount(source: string): Promise<{ count: number; error: boolean }> {
  try {
    const { count, error } = await supabase
      .from('knowledge_base')
      .select('id', { count: 'exact', head: true })
      .eq('source', source);

    if (error) {
      console.error(`  ❌ DB 조회 오류 [${source}]:`, error.message);
      return { count: 0, error: true };
    }
    return { count: count || 0, error: false };
  } catch (err) {
    console.error(`  ❌ DB 연결 오류:`, (err as Error).message);
    return { count: 0, error: true };
  }
}

/** DB 연결 테스트 */
async function testDbConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('knowledge_base').select('id', { count: 'exact', head: true });
    if (error) {
      console.error('❌ Supabase 연결 실패:', error.message);
      return false;
    }
    console.log('✅ Supabase 연결 성공');
    return true;
  } catch (err) {
    console.error('❌ Supabase 연결 실패:', (err as Error).message);
    return false;
  }
}

// ============================================================
// Resume 로직 — 로컬 파일 + DB 이중 확인
// ============================================================
async function getResumeStartIndex(source: string, totalChunks: number): Promise<number> {
  // 1) 로컬 진행 파일 확인
  const localProgress = getLocalProgress(source);

  // 2) DB 확인
  const dbResult = await getExistingChunkCount(source);

  // 로컬 파일과 DB 모두 확인
  const localCount = localProgress?.savedChunks || 0;
  const dbCount = dbResult.count;

  console.log(`  📋 Resume 확인: 로컬=${localCount}, DB=${dbCount}${dbResult.error ? ' (조회 실패!)' : ''}`);

  if (dbResult.error) {
    // DB 조회 실패 시 로컬 진행 파일 기준으로 진행
    if (localCount > 0) {
      console.log(`  ⚠️ DB 조회 실패 — 로컬 진행 파일 기준으로 resume (${localCount}개)`);
      // DB에 실제로 데이터가 있을 수 있으므로, 중복 방지를 위해 upsert 모드로 전환
      return localCount;
    }
    // 로컬도 0이면 DB 연결부터 해결해야 함
    console.error('  ❌ DB 조회 실패 + 로컬 진행 기록 없음. Supabase 연결을 확인하세요.');
    process.exit(1);
  }

  // DB와 로컬이 다른 경우 — 더 큰 값 사용 (데이터가 이미 저장된 건 건너뛰기)
  if (localCount !== dbCount && localCount > 0 && dbCount > 0) {
    const useCount = Math.max(localCount, dbCount);
    console.log(`  ⚠️ 로컬(${localCount})과 DB(${dbCount}) 불일치 — ${useCount}개부터 이어서 진행`);
    return useCount;
  }

  return dbCount;
}

// ============================================================
// 배치 임베딩 + Supabase 저장
// ============================================================
async function embedAndSaveBatch(
  chunks: Chunk[],
  source: string
): Promise<boolean> {
  // 임베딩 결과 캐시 — 재시도 시 API 재호출 방지 (쿼터 보호)
  let cachedEmbeddings: number[][] | null = null;

  for (let retry = 0; retry <= MAX_RETRIES; retry++) {
    try {
      // 1. 배치 임베딩 (캐시가 없을 때만 API 호출)
      if (!cachedEmbeddings) {
        console.log(`     → Gemini 임베딩 API 호출 (${chunks.length}개)...`);
        cachedEmbeddings = await embedBatch(chunks.map((c) => c.content));
        console.log(`     → 임베딩 성공 (${cachedEmbeddings.length}개 벡터, ${cachedEmbeddings[0]?.length}차원)`);
      } else {
        console.log(`     → 캐시된 임베딩 사용 (API 재호출 없음)`);
      }

      // 2. Supabase INSERT
      const rows = chunks.map((chunk, i) => ({
        source,
        section: chunk.section || null,
        page: chunk.page || null,
        content: chunk.content,
        embedding: JSON.stringify(cachedEmbeddings![i]),
        metadata: JSON.stringify({
          chunkIndex: chunk.index,
          charCount: chunk.content.length,
        }),
      }));

      const { error } = await supabase.from('knowledge_base').insert(rows);
      if (error) {
        // 중복 키 에러인 경우 이미 저장된 것으로 간주
        if (error.message.includes('duplicate') || error.code === '23505') {
          console.log(`  ⏩ 이미 저장된 배치 — 건너뜁니다.`);
          return true;
        }
        console.error(`  ❌ INSERT 오류:`, error.message, `(code: ${error.code})`);
        // INSERT 실패는 재시도 (임베딩은 캐시에서 재사용)
        if (retry < MAX_RETRIES) {
          console.warn(`  ⏳ INSERT 재시도 (${retry + 1}/${MAX_RETRIES})... 5초 대기`);
          await delay(5000);
          continue;
        }
        return false;
      }
      return true;
    } catch (error: unknown) {
      const msg = (error as { message?: string }).message || '';
      const isQuotaError = is429Error(error);

      console.warn(`  ⚠️ 배치 오류 (retry ${retry + 1}/${MAX_RETRIES}): ${isQuotaError ? '[429 쿼터]' : '[기타]'} ${msg.slice(0, 150)}`);

      if (isQuotaError) {
        // 429 에러 — 분당 제한이므로 대기 후 재시도 (최대 3회)
        if (retry < 3) {
          const waitSec = 30 + (retry * 30); // 30초, 60초, 90초
          console.warn(`  ⏳ 분당 제한 — ${waitSec}초 대기 후 재시도... (${retry + 1}/3)`);
          await delay(waitSec * 1000);
        } else {
          // 3회 재시도 후에도 429면 일일 쿼터 소진으로 판단
          console.warn(`\n  ⛔ 반복 429 오류 — 일일 쿼터 소진. 다음 쿼터 리셋 후 다시 실행하세요.`);
          console.warn(`  💡 진행 상태가 저장되어 다음 실행 시 이어서 진행됩니다.`);
          return false;
        }
      } else if (retry < MAX_RETRIES) {
        console.warn(`  ⏳ 5초 대기 후 재시도...`);
        await delay(5000);
      } else {
        console.error(`  ❌ 최대 재시도 초과`);
        return false;
      }
    }
  }
  return false;
}

// ============================================================
// 파일 처리 메인 로직
// ============================================================
async function processFile(filePath: string, source?: string) {
  const filename = path.basename(filePath);
  const kdsSource = source || inferSourceFromFilename(filename);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 처리 시작: ${filename}`);
  console.log(`   출처(source): "${kdsSource}"`);
  console.log(`${'='.repeat(60)}`);

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

  // 3. Resume 확인 (로컬 + DB 이중 확인)
  const startIdx = await getResumeStartIndex(kdsSource, chunks.length);

  // 이미 모든 청크가 저장되어 있으면 건너뛰기
  if (startIdx >= chunks.length) {
    console.log(`  ✅ 이미 완료됨 (${startIdx}/${chunks.length}) — 건너뜁니다.\n`);
    return;
  }

  // resume: 이미 저장된 만큼 건너뛰기
  const remainingChunks = chunks.slice(startIdx);
  if (startIdx > 0) {
    console.log(`  ⏩ ${startIdx}개 건너뛰고 ${remainingChunks.length}개부터 이어서 진행`);
  }

  // 4. 배치 임베딩 + 저장 (100개씩)
  const totalBatches = Math.ceil(remainingChunks.length / BATCH_SIZE);
  console.log(`  3️⃣ 배치 임베딩 시작 (${BATCH_SIZE}개/배치, 총 ${totalBatches}배치)\n`);
  let saved = 0;

  for (let b = 0; b < totalBatches; b++) {
    const batchStart = b * BATCH_SIZE;
    const batch = remainingChunks.slice(batchStart, batchStart + BATCH_SIZE);
    const globalStart = startIdx + batchStart + 1;
    const globalEnd = startIdx + batchStart + batch.length;
    console.log(`  📊 배치 ${b + 1}/${totalBatches}: 청크 ${globalStart}~${globalEnd} / ${chunks.length}`);

    const ok = await embedAndSaveBatch(batch, kdsSource);
    if (!ok) {
      // 실패 시 로컬 진행 파일에 현재 상태 저장
      updateProgress(kdsSource, chunks.length, startIdx + saved, b);
      console.log(`\n  📌 중단됨: 이번 세션 ${saved}개 저장 (총 ${startIdx + saved}/${chunks.length})`);
      console.log(`  💾 진행 상태 저장됨: ${PROGRESS_FILE}`);
      console.log(`  💡 다시 실행하면 ${startIdx + saved}번째부터 이어서 진행됩니다.`);
      return;
    }
    saved += batch.length;

    // 매 배치 성공마다 로컬 진행 파일 갱신
    updateProgress(kdsSource, chunks.length, startIdx + saved, b);

    // 배치 간 대기
    if (b < totalBatches - 1) {
      console.log(`     ✓ 저장 완료 (${startIdx + saved}/${chunks.length}) — ${BATCH_DELAY_MS / 1000}초 대기...`);
      await delay(BATCH_DELAY_MS);
    }
  }

  // 완료 시 로컬 진행 파일 갱신
  updateProgress(kdsSource, chunks.length, chunks.length, totalBatches - 1);
  console.log(`\n  ✅ 완료: ${filename} → 총 ${chunks.length}개 청크 저장됨\n`);
}

// ============================================================
// --check 모드: DB 상태만 확인
// ============================================================
async function checkStatus() {
  console.log('\n📊 KDS 임베딩 현황 확인\n');

  // DB 연결 테스트
  const connected = await testDbConnection();
  if (!connected) return;

  // 전체 행 수
  const { count: totalCount } = await supabase
    .from('knowledge_base')
    .select('id', { count: 'exact', head: true });
  console.log(`\n  전체 knowledge_base 행 수: ${totalCount || 0}`);

  // source별 행 수 조회
  const { data: sources } = await supabase
    .from('knowledge_base')
    .select('source')
    .limit(1000);

  if (sources && sources.length > 0) {
    const sourceCounts: Record<string, number> = {};
    for (const row of sources) {
      sourceCounts[row.source] = (sourceCounts[row.source] || 0) + 1;
    }
    console.log('\n  Source별 청크 수:');
    for (const [src, cnt] of Object.entries(sourceCounts)) {
      console.log(`    "${src}": ${cnt}개`);
    }
  } else {
    console.log('  ⚠️ 저장된 데이터 없음 (0행)');
  }

  // 로컬 진행 파일 확인
  const localData = loadProgress();
  if (Object.keys(localData).length > 0) {
    console.log('\n  📋 로컬 진행 파일 (.embed-progress.json):');
    for (const [src, info] of Object.entries(localData)) {
      console.log(`    "${src}": ${info.savedChunks}/${info.totalChunks} (${info.updatedAt})`);
    }
  } else {
    console.log('\n  📋 로컬 진행 파일: 없음');
  }

  console.log('');
}

// ============================================================
// --reset 모드: 특정 source 데이터 삭제
// ============================================================
async function resetSource(source: string) {
  console.log(`\n🗑️ "${source}" 데이터 초기화...\n`);

  // DB에서 삭제
  const { error, count } = await supabase
    .from('knowledge_base')
    .delete({ count: 'exact' })
    .eq('source', source);

  if (error) {
    console.error('  ❌ DB 삭제 오류:', error.message);
  } else {
    console.log(`  DB: ${count || 0}행 삭제됨`);
  }

  // 로컬 진행 파일에서 삭제
  const data = loadProgress();
  if (data[source]) {
    delete data[source];
    saveProgress(data);
    console.log('  로컬 진행 파일: 삭제됨');
  }

  console.log(`  ✅ "${source}" 초기화 완료. 다시 실행하면 처음부터 시작합니다.\n`);
}

// ============================================================
// 메인 실행
// ============================================================
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
사용법:
  npx tsx scripts/embed-kds.ts <PDF경로> [KDS코드]
  npx tsx scripts/embed-kds.ts data/kds/              (폴더 내 PDF 전체)
  npx tsx scripts/embed-kds.ts --check                 (DB 상태 확인)
  npx tsx scripts/embed-kds.ts --reset <source명>      (특정 source 삭제 후 재시작)

예시:
  npx tsx scripts/embed-kds.ts data/kds/
  npx tsx scripts/embed-kds.ts --check
  npx tsx scripts/embed-kds.ts --reset "상수도설계기준_2022_통합본"
    `);
    process.exit(0);
  }

  // --check 모드
  if (args[0] === '--check') {
    await checkStatus();
    return;
  }

  // --reset 모드
  if (args[0] === '--reset') {
    if (!args[1]) {
      console.error('❌ source명을 지정하세요. 예: --reset "상수도설계기준_2022_통합본"');
      process.exit(1);
    }
    await resetSource(args[1]);
    return;
  }

  // DB 연결 테스트
  const connected = await testDbConnection();
  if (!connected) {
    console.error('\n❌ Supabase 연결 실패. 환경변수를 확인하세요.');
    console.error('   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
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

  // 완료 후 상태 출력
  await checkStatus();
}

main().catch((err) => {
  console.error('❌ 치명적 오류:', err);
  process.exit(1);
});
