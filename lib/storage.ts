/**
 * localStorage 기반 상태 저장/복원 유틸
 * — 새로고침 시 채팅 메시지, 프로젝트 폴더 등 복원
 * — 파일 content는 용량이 크므로 별도 sessionStorage에 저장
 */

const STORAGE_PREFIX = 'wsr_'; // water-sewage-review
const MAX_CONTENT_SIZE = 500_000; // sessionStorage에 저장할 파일 content 최대 크기 (500KB per file)

/** 안전한 JSON 파싱 */
function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/** localStorage에 저장 (에러 안전) */
function safeSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  } catch (e) {
    // QuotaExceededError 등 무시
    console.warn(`[Storage] 저장 실패 (${key}):`, e);
  }
}

/** localStorage에서 읽기 */
function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return safeParse(raw, fallback);
  } catch {
    return fallback;
  }
}

/** sessionStorage에 파일 content 저장 (대용량) */
function saveFileContent(fileId: string, content: string): void {
  try {
    if (content.length <= MAX_CONTENT_SIZE) {
      sessionStorage.setItem(`${STORAGE_PREFIX}file_${fileId}`, content);
    }
  } catch {
    // 용량 초과 무시
  }
}

/** sessionStorage에서 파일 content 복원 */
function loadFileContent(fileId: string): string | undefined {
  try {
    return sessionStorage.getItem(`${STORAGE_PREFIX}file_${fileId}`) || undefined;
  } catch {
    return undefined;
  }
}

// ─── 채팅 메시지 ───

export function saveMessages(messages: any[]): void {
  // content가 너무 긴 메시지는 잘라서 저장 (localStorage 용량 절약)
  const trimmed = messages.map((m) => ({
    ...m,
    // 타임스탬프는 문자열로 변환
    timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
  }));
  safeSet('messages', trimmed);
}

export function loadMessages<T>(): T[] {
  const raw = safeGet<T[]>('messages', []);
  // Date 문자열을 Date 객체로 복원
    return raw.map((m: any) => ({
    ...m,
    timestamp: m.timestamp ? new Date(m.timestamp as string) : new Date(),
  })) as T[];
}

// ─── 프로젝트 폴더 ───

export function saveProjects(projects: any[]): void {
  const serialized = projects.map((p: any) => ({
    ...p,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
  }));
  safeSet('projects', serialized);
}

export function loadProjects<T>(): T[] {
  const raw = safeGet<T[]>('projects', []);
    return raw.map((p: any) => ({
    ...p,
    createdAt: p.createdAt ? new Date(p.createdAt as string) : new Date(),
    updatedAt: p.updatedAt ? new Date(p.updatedAt as string) : new Date(),
  })) as T[];
}

// ─── 활성 프로젝트 ID ───

export function saveActiveProjectId(id: string | null): void {
  safeSet('activeProjectId', id);
}

export function loadActiveProjectId(): string | null {
  return safeGet<string | null>('activeProjectId', null);
}

// ─── 파일 목록 (content 제외한 메타데이터) ───

export function saveFiles(files: any[]): void {
  const metas = files.map((f: any) => {
    // content는 sessionStorage에 별도 저장
    if (f.content && typeof f.content === 'string') {
      saveFileContent(f.id as string, f.content as string);
    }
    return {
      ...f,
      content: f.content ? '[saved]' : undefined, // 마커만 남김
      uploadedAt: f.uploadedAt instanceof Date ? f.uploadedAt.toISOString() : f.uploadedAt,
    };
  });
  safeSet('files', metas);
}

export function loadFiles<T>(): T[] {
  const raw = safeGet<T[]>('files', []);
    return raw.map((f: any) => {
    // sessionStorage에서 content 복원
    const content = f.content === '[saved]'
      ? loadFileContent(f.id as string)
      : f.content;
    return {
      ...f,
      content: content || undefined,
      status: content ? 'ready' : 'error', // content 없으면 에러 상태
      uploadedAt: f.uploadedAt ? new Date(f.uploadedAt as string) : new Date(),
    };
  }) as T[];
}

// ─── 세션 ID ───

export function saveSessionId(id: string): void {
  safeSet('sessionId', id);
}

export function loadSessionId(): string | null {
  return safeGet<string | null>('sessionId', null);
}

// ─── 멀티 세션 관리 ───

/** 세션 목록 저장 */
export function saveSessions(sessions: any[]): void {
  const serialized = sessions.map((s: any) => ({
    ...s,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
  }));
  safeSet('sessions', serialized);
}

/** 세션 목록 로드 */
export function loadSessions<T>(): T[] {
  const raw = safeGet<T[]>('sessions', []);
  return raw.map((s: any) => ({
    ...s,
    createdAt: s.createdAt ? new Date(s.createdAt as string) : new Date(),
    updatedAt: s.updatedAt ? new Date(s.updatedAt as string) : new Date(),
  })) as T[];
}

/** 특정 세션의 메시지 저장 */
export function saveSessionMessages(sessionId: string, messages: any[]): void {
  const trimmed = messages.map((m) => ({
    ...m,
    timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
  }));
  safeSet(`session_messages_${sessionId}`, trimmed);
}

/** 특정 세션의 메시지 로드 */
export function loadSessionMessages<T>(sessionId: string): T[] {
  const raw = safeGet<T[]>(`session_messages_${sessionId}`, []);
  return raw.map((m: any) => ({
    ...m,
    timestamp: m.timestamp ? new Date(m.timestamp as string) : new Date(),
  })) as T[];
}

/** 특정 세션의 파일 저장 */
export function saveSessionFiles(sessionId: string, files: any[]): void {
  const metas = files.map((f: any) => {
    if (f.content && typeof f.content === 'string') {
      saveFileContent(f.id as string, f.content as string);
    }
    return {
      ...f,
      content: f.content ? '[saved]' : undefined,
      uploadedAt: f.uploadedAt instanceof Date ? f.uploadedAt.toISOString() : f.uploadedAt,
    };
  });
  safeSet(`session_files_${sessionId}`, metas);
}

/** 특정 세션의 파일 로드 */
export function loadSessionFiles<T>(sessionId: string): T[] {
  const raw = safeGet<T[]>(`session_files_${sessionId}`, []);
  return raw.map((f: any) => {
    const content = f.content === '[saved]'
      ? loadFileContent(f.id as string)
      : f.content;
    return {
      ...f,
      content: content || undefined,
      status: content ? 'ready' : 'error',
      uploadedAt: f.uploadedAt ? new Date(f.uploadedAt as string) : new Date(),
    };
  }) as T[];
}

/** 특정 세션의 프로젝트 저장 */
export function saveSessionProjects(sessionId: string, projects: any[]): void {
  const serialized = projects.map((p: any) => ({
    ...p,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
  }));
  safeSet(`session_projects_${sessionId}`, serialized);
}

/** 특정 세션의 프로젝트 로드 */
export function loadSessionProjects<T>(sessionId: string): T[] {
  const raw = safeGet<T[]>(`session_projects_${sessionId}`, []);
  return raw.map((p: any) => ({
    ...p,
    createdAt: p.createdAt ? new Date(p.createdAt as string) : new Date(),
    updatedAt: p.updatedAt ? new Date(p.updatedAt as string) : new Date(),
  })) as T[];
}

/** 특정 세션 데이터 삭제 */
export function deleteSessionData(sessionId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}session_messages_${sessionId}`);
    localStorage.removeItem(`${STORAGE_PREFIX}session_files_${sessionId}`);
    localStorage.removeItem(`${STORAGE_PREFIX}session_projects_${sessionId}`);
  } catch {
    // 무시
  }
}

// ─── 전체 초기화 ───

export function clearAllStorage(): void {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
    const sessionKeys = Object.keys(sessionStorage).filter(k => k.startsWith(STORAGE_PREFIX));
    sessionKeys.forEach(k => sessionStorage.removeItem(k));
  } catch {
    // 무시
  }
}
