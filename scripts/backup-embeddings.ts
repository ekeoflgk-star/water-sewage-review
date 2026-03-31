/**
 * KDS 임베딩 백업/복원 스크립트
 *
 * 사용법:
 *   npx tsx scripts/backup-embeddings.ts --backup            ← DB → JSON 백업
 *   npx tsx scripts/backup-embeddings.ts --restore           ← JSON → DB 복원
 *   npx tsx scripts/backup-embeddings.ts --restore --clear   ← DB 초기화 후 복원
 *   npx tsx scripts/backup-embeddings.ts --info              ← 백업 파일 정보 확인
 *
 * 백업 파일: data/backup/knowledge_base_backup.json
 * - 임베딩 완료 후 실행하면 Gemini API 재호출 없이 복원 가능
 * - 다른 Supabase 프로젝트로 마이그레이션할 때도 사용 가능
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// 환경변수 로드
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 환경변수 부족: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const BACKUP_DIR = path.resolve(__dirname, '..', 'data', 'backup');
const BACKUP_FILE = path.join(BACKUP_DIR, 'knowledge_base_backup.json');

// ============================================================
// 타입
// ============================================================
interface KnowledgeRow {
  id: number;
  source: string;
  section: string | null;
  page: number | null;
  content: string;
  embedding: string; // JSON string of number[]
  metadata: string | null;
  created_at: string;
}

interface BackupData {
  exportedAt: string;
  supabaseUrl: string;
  totalRows: number;
  sources: Record<string, number>;
  rows: Omit<KnowledgeRow, 'id' | 'created_at'>[];
}

// ============================================================
// 백업: DB → JSON
// ============================================================
async function backup() {
  console.log('\n📦 KDS 임베딩 백업 시작...\n');

  // 전체 행 수 확인
  const { count: totalCount } = await supabase
    .from('knowledge_base')
    .select('id', { count: 'exact', head: true });

  if (!totalCount || totalCount === 0) {
    console.log('  ⚠️ DB에 데이터가 없습니다. 백업할 내용이 없습니다.');
    return;
  }

  console.log(`  전체 행 수: ${totalCount}`);

  // 페이지네이션으로 전체 데이터 가져오기 (Supabase는 기본 1000행 제한)
  const PAGE_SIZE = 500;
  const allRows: KnowledgeRow[] = [];
  let offset = 0;

  while (offset < totalCount) {
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('*')
      .range(offset, offset + PAGE_SIZE - 1)
      .order('id', { ascending: true });

    if (error) {
      console.error(`  ❌ 데이터 조회 오류 (offset=${offset}):`, error.message);
      process.exit(1);
    }

    if (data && data.length > 0) {
      allRows.push(...(data as KnowledgeRow[]));
      console.log(`  📥 ${allRows.length}/${totalCount} 행 조회...`);
    }

    offset += PAGE_SIZE;
  }

  // source별 통계
  const sources: Record<string, number> = {};
  for (const row of allRows) {
    sources[row.source] = (sources[row.source] || 0) + 1;
  }

  // 백업 데이터 구성 (id, created_at 제외 — 복원 시 자동 생성)
  const backupData: BackupData = {
    exportedAt: new Date().toISOString(),
    supabaseUrl: supabaseUrl!,
    totalRows: allRows.length,
    sources,
    rows: allRows.map((row) => ({
      source: row.source,
      section: row.section,
      page: row.page,
      content: row.content,
      embedding: row.embedding,
      metadata: row.metadata,
    })),
  };

  // 백업 디렉토리 생성
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // JSON 파일 저장
  fs.writeFileSync(BACKUP_FILE, JSON.stringify(backupData, null, 2), 'utf-8');
  const fileSizeMB = (fs.statSync(BACKUP_FILE).size / 1024 / 1024).toFixed(1);

  console.log(`\n  ✅ 백업 완료!`);
  console.log(`  📄 파일: ${BACKUP_FILE}`);
  console.log(`  📊 크기: ${fileSizeMB} MB`);
  console.log(`  📦 행 수: ${allRows.length}`);
  console.log(`  Source별:`);
  for (const [src, cnt] of Object.entries(sources)) {
    console.log(`    "${src}": ${cnt}개`);
  }
  console.log('');
}

// ============================================================
// 복원: JSON → DB
// ============================================================
async function restore(clearFirst: boolean) {
  console.log('\n📥 KDS 임베딩 복원 시작...\n');

  if (!fs.existsSync(BACKUP_FILE)) {
    console.error(`  ❌ 백업 파일이 없습니다: ${BACKUP_FILE}`);
    console.error('  💡 먼저 --backup 으로 백업을 생성하세요.');
    process.exit(1);
  }

  const raw = fs.readFileSync(BACKUP_FILE, 'utf-8');
  const backupData: BackupData = JSON.parse(raw);

  console.log(`  백업 정보:`);
  console.log(`    생성일시: ${backupData.exportedAt}`);
  console.log(`    원본 DB: ${backupData.supabaseUrl}`);
  console.log(`    총 행 수: ${backupData.totalRows}`);
  for (const [src, cnt] of Object.entries(backupData.sources)) {
    console.log(`    "${src}": ${cnt}개`);
  }

  // --clear 옵션: 기존 데이터 삭제
  if (clearFirst) {
    console.log('\n  🗑️ 기존 데이터 삭제 중...');
    for (const source of Object.keys(backupData.sources)) {
      const { error, count } = await supabase
        .from('knowledge_base')
        .delete({ count: 'exact' })
        .eq('source', source);

      if (error) {
        console.error(`    ❌ 삭제 오류 [${source}]:`, error.message);
      } else {
        console.log(`    "${source}": ${count || 0}행 삭제`);
      }
    }
  }

  // 배치 INSERT (500행씩)
  const BATCH_SIZE = 500;
  const totalBatches = Math.ceil(backupData.rows.length / BATCH_SIZE);
  let inserted = 0;

  console.log(`\n  📤 복원 시작 (${BATCH_SIZE}행/배치, 총 ${totalBatches}배치)\n`);

  for (let b = 0; b < totalBatches; b++) {
    const batch = backupData.rows.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);

    const { error } = await supabase.from('knowledge_base').insert(batch);

    if (error) {
      if (error.message.includes('duplicate') || error.code === '23505') {
        console.log(`  ⏩ 배치 ${b + 1}/${totalBatches}: 이미 존재 — 건너뜀`);
        inserted += batch.length;
        continue;
      }
      console.error(`  ❌ INSERT 오류 (배치 ${b + 1}):`, error.message);
      console.log(`  📌 ${inserted}행까지 복원됨. --clear 옵션으로 재시도하세요.`);
      return;
    }

    inserted += batch.length;
    console.log(`  ✓ 배치 ${b + 1}/${totalBatches}: ${inserted}/${backupData.totalRows} 행 복원`);
  }

  console.log(`\n  ✅ 복원 완료: ${inserted}/${backupData.totalRows} 행`);

  // 로컬 진행 파일도 갱신
  const progressFile = path.resolve(__dirname, '..', '.embed-progress.json');
  const progressData: Record<string, { totalChunks: number; savedChunks: number; lastBatchIndex: number; updatedAt: string }> = {};
  for (const [src, cnt] of Object.entries(backupData.sources)) {
    progressData[src] = {
      totalChunks: cnt,
      savedChunks: cnt,
      lastBatchIndex: Math.ceil(cnt / 100) - 1,
      updatedAt: new Date().toISOString(),
    };
  }
  fs.writeFileSync(progressFile, JSON.stringify(progressData, null, 2), 'utf-8');
  console.log(`  📋 .embed-progress.json 갱신 완료\n`);
}

// ============================================================
// 정보 확인
// ============================================================
function showInfo() {
  console.log('\n📋 백업 파일 정보\n');

  if (!fs.existsSync(BACKUP_FILE)) {
    console.log(`  ⚠️ 백업 파일 없음: ${BACKUP_FILE}`);
    console.log('  💡 --backup 으로 백업을 먼저 생성하세요.\n');
    return;
  }

  const stat = fs.statSync(BACKUP_FILE);
  const fileSizeMB = (stat.size / 1024 / 1024).toFixed(1);

  // 메타데이터만 파싱 (rows는 건너뛰기)
  const raw = fs.readFileSync(BACKUP_FILE, 'utf-8');
  const data: BackupData = JSON.parse(raw);

  console.log(`  파일: ${BACKUP_FILE}`);
  console.log(`  크기: ${fileSizeMB} MB`);
  console.log(`  생성일시: ${data.exportedAt}`);
  console.log(`  원본 DB: ${data.supabaseUrl}`);
  console.log(`  총 행 수: ${data.totalRows}`);
  console.log(`  Source별:`);
  for (const [src, cnt] of Object.entries(data.sources)) {
    console.log(`    "${src}": ${cnt}개`);
  }
  console.log('');
}

// ============================================================
// 메인
// ============================================================
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--backup')) {
    await backup();
  } else if (args.includes('--restore')) {
    const clearFirst = args.includes('--clear');
    await restore(clearFirst);
  } else if (args.includes('--info')) {
    showInfo();
  } else {
    console.log(`
사용법:
  npx tsx scripts/backup-embeddings.ts --backup            DB → JSON 백업
  npx tsx scripts/backup-embeddings.ts --restore           JSON → DB 복원
  npx tsx scripts/backup-embeddings.ts --restore --clear   DB 초기화 후 복원
  npx tsx scripts/backup-embeddings.ts --info              백업 파일 정보 확인

백업 파일: data/backup/knowledge_base_backup.json
    `);
  }
}

main().catch((err) => {
  console.error('❌ 치명적 오류:', err);
  process.exit(1);
});
