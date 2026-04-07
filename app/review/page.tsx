'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useToast } from '@/components/ui/Toast';
import {
  saveMessages, loadMessages,
  saveFiles, loadFiles,
  saveProjects, loadProjects,
  saveActiveProjectId, loadActiveProjectId,
  saveSessionId, loadSessionId,
  saveSessions, loadSessions,
  saveSessionMessages, loadSessionMessages,
  saveSessionFiles, loadSessionFiles,
  saveSessionProjects, loadSessionProjects,
  deleteSessionData,
} from '@/lib/storage';
import type { UploadedFile, ChatMessage, ReviewCard, PermitCard, Project, Session } from '@/types';
import type { DxfAnalysisResult } from '@/types/dxf';

// SSR 비활성화 — react-resizable-panels hydration 오류 방지
const ReviewLayout = dynamic(
  () => import('@/components/layout/ReviewLayout').then((mod) => mod.ReviewLayout),
  { ssr: false }
);

export default function ReviewPage() {
  // 파일 상태
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // 채팅 상태
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // 세션 관리
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');

  // 검토 상태
  const [isReviewing, setIsReviewing] = useState(false);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const [isHydrated, setIsHydrated] = useState(false);

  // ───── localStorage 복원 (최초 마운트) ─────
  useEffect(() => {
    let savedSessions = loadSessions<Session>();
    let currentSessionId = loadSessionId() || '';

    // 기존 단일 세션 데이터 마이그레이션
    if (savedSessions.length === 0) {
      const savedMessages = loadMessages<ChatMessage>();
      const savedFiles = loadFiles<UploadedFile>();
      const savedProjects = loadProjects<Project>();
      const id = currentSessionId || crypto.randomUUID();
      const firstMsg = savedMessages[0]?.content || '';
      const title = firstMsg.length > 0
        ? firstMsg.slice(0, 30) + (firstMsg.length > 30 ? '...' : '')
        : '새 대화';
      const newSession: Session = {
        id,
        title,
        createdAt: savedMessages[0]?.timestamp || new Date(),
        updatedAt: savedMessages[savedMessages.length - 1]?.timestamp || new Date(),
      };
      savedSessions = [newSession];
      currentSessionId = id;
      if (savedMessages.length > 0) saveSessionMessages(id, savedMessages);
      if (savedFiles.length > 0) saveSessionFiles(id, savedFiles);
      if (savedProjects.length > 0) saveSessionProjects(id, savedProjects);
      saveSessions(savedSessions);
      saveSessionId(id);
    }

    if (!currentSessionId && savedSessions.length > 0) {
      currentSessionId = savedSessions[0].id;
    }

    setSessions(savedSessions);
    setActiveSessionId(currentSessionId);
    sessionIdRef.current = currentSessionId;

    const sessionMessages = loadSessionMessages<ChatMessage>(currentSessionId);
    const sessionFiles = loadSessionFiles<UploadedFile>(currentSessionId);
    const sessionProjects = loadSessionProjects<Project>(currentSessionId);
    const savedActiveProjectId = loadActiveProjectId();

    if (sessionMessages.length > 0) setMessages(sessionMessages);
    if (sessionFiles.length > 0) setFiles(sessionFiles);
    if (sessionProjects.length > 0) setProjects(sessionProjects);
    if (savedActiveProjectId) setActiveProjectId(savedActiveProjectId);

    setIsHydrated(true);
  }, []);

  // ───── 상태 변경 시 자동 저장 ─────
  useEffect(() => {
    if (!isHydrated || !activeSessionId) return;
    saveSessionMessages(activeSessionId, messages);
    saveMessages(messages);
  }, [messages, isHydrated, activeSessionId]);

  useEffect(() => {
    if (!isHydrated || !activeSessionId) return;
    saveSessionFiles(activeSessionId, files);
    saveFiles(files);
  }, [files, isHydrated, activeSessionId]);

  useEffect(() => {
    if (!isHydrated || !activeSessionId) return;
    saveSessionProjects(activeSessionId, projects);
    saveProjects(projects);
  }, [projects, isHydrated, activeSessionId]);

  useEffect(() => {
    if (!isHydrated) return;
    saveActiveProjectId(activeProjectId);
  }, [activeProjectId, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    saveSessions(sessions);
  }, [sessions, isHydrated]);

  // 세션 제목 자동 업데이트
  useEffect(() => {
    if (!isHydrated || !activeSessionId || messages.length === 0) return;
    const firstUserMsg = messages.find((m) => m.role === 'user');
    if (!firstUserMsg) return;
    const autoTitle = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId && s.title === '새 대화'
          ? { ...s, title: autoTitle, updatedAt: new Date() }
          : s.id === activeSessionId
          ? { ...s, updatedAt: new Date() }
          : s
      )
    );
  }, [messages, isHydrated, activeSessionId]);

  const { addToast } = useToast();

  // ───── 파일 핸들러 ─────

  const handleFilesAdded = useCallback((newFiles: UploadedFile[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    if (activeProjectId) {
      const newIds = newFiles.map((f) => f.id);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === activeProjectId
            ? { ...p, fileIds: [...p.fileIds, ...newIds], updatedAt: new Date() }
            : p
        )
      );
    }
  }, [activeProjectId]);

  const handleFileRemove = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    setProjects((prev) =>
      prev.map((p) => ({
        ...p,
        fileIds: p.fileIds.filter((id) => id !== fileId),
      }))
    );
  }, []);

  const getProjectIdForFile = useCallback((fileId: string): string => {
    const project = projects.find((p) => p.fileIds.includes(fileId));
    return project?.id || activeProjectId || sessionIdRef.current;
  }, [projects, activeProjectId]);

  const handleGroupChange = useCallback((fileId: string, group: UploadedFile['group']) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, group } : f))
    );
    if (group === 'guideline') {
      const file = files.find((f) => f.id === fileId);
      if (file?.content && file.embedStatus !== 'embedded' && file.embedStatus !== 'embedding') {
        const projectId = getProjectIdForFile(fileId);
        embedGuidelineFile(fileId, file.name, file.content, projectId);
      }
    }
  }, [files, getProjectIdForFile]);

  const embedGuidelineFile = useCallback(async (fileId: string, fileName: string, content: string, projectId: string) => {
    const projectName = projects.find((p) => p.id === projectId)?.name;
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, embedStatus: 'embedding' as const, embedProjectId: projectId } : f))
    );
    addToast('info', `📌 "${fileName}" 추가참고문서 임베딩 중${projectName ? ` (📂 ${projectName})` : ''}...`);

    try {
      const response = await fetch('/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, fileName: `[추가참고문서] ${fileName}`, sessionId: projectId }),
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.error || `임베딩 오류: ${response.status}`);
      }
      const data = await response.json();
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? { ...f, embedStatus: 'embedded' as const, embedChunks: data.chunksCreated, embedProjectId: projectId }
            : f
        )
      );
      addToast('success', `📌 "${fileName}" 임베딩 완료 (${data.chunksCreated}개 청크)${projectName ? ` — 📂 ${projectName} 전용` : ''}`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '임베딩 실패';
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, embedStatus: 'embed-error' as const, errorMessage: errMsg } : f))
      );
      addToast('error', `임베딩 실패: ${errMsg}`);
    }
  }, [addToast, projects]);

  const handleFileProgress = useCallback((fileId: string, progress: number) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, uploadProgress: progress } : f))
    );
  }, []);

  const handleFileStatusChange = useCallback((fileId: string, status: UploadedFile['status'], content?: string, error?: string) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;
        return {
          ...f,
          status,
          ...(content !== undefined && { content }),
          ...(error && { errorMessage: error }),
          ...(status === 'ready' && { uploadProgress: 100 }),
        };
      })
    );
  }, []);

  // ───── 프로젝트 폴더 핸들러 ─────

  const handleCreateProject = useCallback((name: string, parentId?: string) => {
    const newProject: Project = {
      id: crypto.randomUUID(), name, parentId, fileIds: [],
      createdAt: new Date(), updatedAt: new Date(),
    };
    setProjects((prev) => [...prev, newProject]);
    setActiveProjectId(newProject.id);
    addToast('success', `"${name}" 폴더가 생성되었습니다.`);
  }, [addToast]);

  const handleDeleteProject = useCallback((projectId: string) => {
    const idsToDelete = new Set<string>();
    const collectChildren = (pid: string) => {
      idsToDelete.add(pid);
      projects.filter((p) => p.parentId === pid).forEach((c) => collectChildren(c.id));
    };
    collectChildren(projectId);
    setProjects((prev) => prev.filter((p) => !idsToDelete.has(p.id)));
    if (activeProjectId && idsToDelete.has(activeProjectId)) setActiveProjectId(null);
  }, [activeProjectId, projects]);

  const handleRenameProject = useCallback((projectId: string, newName: string) => {
    setProjects((prev) =>
      prev.map((p) => p.id === projectId ? { ...p, name: newName, updatedAt: new Date() } : p)
    );
  }, []);

  const handleMoveFileToProject = useCallback((fileId: string, projectId: string | null) => {
    setProjects((prev) =>
      prev.map((p) => {
        const filtered = p.fileIds.filter((id) => id !== fileId);
        if (p.id === projectId) return { ...p, fileIds: [...filtered, fileId], updatedAt: new Date() };
        return { ...p, fileIds: filtered };
      })
    );
  }, []);

  // ───── 키워드 감지 ─────
  const isReviewCommand = (text: string) => {
    const keywords = ['검토 시작', '검토시작', '설계 검토', '설계검토', '자동 검토', '자동검토'];
    return keywords.some((kw) => text.includes(kw));
  };

  const isDxfAnalyzeCommand = (text: string) => {
    const keywords = ['인허가 분석', '인허가분석', 'DXF 분석', 'DXF분석', 'dxf 분석', '도면 분석', '도면분석'];
    return keywords.some((kw) => text.includes(kw));
  };

  // ───── 설계 검토 핸들러 ─────
  const handleReview = useCallback(async () => {
    const readyFiles = files.filter((f) => f.status === 'ready' && f.content);
    if (readyFiles.length === 0) {
      addToast('warning', '검토할 파일이 없습니다. 파일을 먼저 업로드하세요.');
      return;
    }
    setIsReviewing(true);
    const currentProjectId = activeProjectId || sessionIdRef.current;
    const guidelineFiles = files.filter(
      (f) => f.group === 'guideline' && f.embedStatus === 'embedded' && f.embedProjectId === currentProjectId
    );
    const guidelineNote = guidelineFiles.length > 0
      ? `\n\n📌 **추가참고문서 ${guidelineFiles.length}건** 적용 중: ${guidelineFiles.map((f) => f.name).join(', ')}`
      : '';

    const progressMessage: ChatMessage = {
      id: crypto.randomUUID(), role: 'assistant',
      content: `📋 업로드된 ${readyFiles.length}개 파일을 기반으로 설계 검토를 시작합니다...\n\n검토 항목: 유속, 관경, 토피, 경사, 충만도 등${guidelineNote}`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, progressMessage]);

    try {
      const allReviewCards: ReviewCard[] = [];
      const allPermitCards: PermitCard[] = [];

      for (const file of readyFiles) {
        const response = await fetch('/api/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileContent: file.content, fileName: file.name,
            fileGroup: file.group, sessionId: activeProjectId || sessionIdRef.current,
            reviewScope: 'sewer-pipeline',
          }),
        });
        if (!response.ok) {
          const errBody = await response.json().catch(() => null);
          throw new Error(errBody?.error || `검토 API 오류: ${response.status}`);
        }
        const data = await response.json();
        if (data.reviewCards) allReviewCards.push(...data.reviewCards);
        if (data.permitCards) allPermitCards.push(...data.permitCards);
      }

      const passCount = allReviewCards.filter((c) => c.verdict === 'pass').length;
      const failCount = allReviewCards.filter((c) => c.verdict === 'fail').length;
      const checkCount = allReviewCards.filter((c) => c.verdict === 'check').length;

      const resultMessage: ChatMessage = {
        id: crypto.randomUUID(), role: 'assistant',
        content: `## 설계 검토 완료\n\n총 **${allReviewCards.length}개** 항목 검토 | 🟢 적합 ${passCount} | 🔴 부적합 ${failCount} | 🟡 확인필요 ${checkCount}\n\n인허가 판단: **${allPermitCards.length}개** 항목 확인\n\n---\n\n아래 **설계도서 검토의견서** 양식에서 결과를 확인하고, 한글 파일로 다운로드할 수 있습니다.`,
        timestamp: new Date(), reviewCards: allReviewCards, permitCards: allPermitCards,
      };
      setMessages((prev) => prev.map((m) => (m.id === progressMessage.id ? resultMessage : m)));
      addToast('success', `검토 완료: ${allReviewCards.length}개 항목`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '검토 중 오류 발생';
      addToast('error', errMsg);
      setMessages((prev) => prev.map((m) => m.id === progressMessage.id ? { ...m, content: `❌ 검토 실패: ${errMsg}` } : m));
    } finally {
      setIsReviewing(false);
    }
  }, [files, addToast, activeProjectId]);

  // ───── DXF 인허가 분석 핸들러 ─────
  const handleDxfAnalyze = useCallback(async () => {
    const dxfFiles = files.filter((f) => f.type === 'dxf' && f.status === 'ready');
    if (dxfFiles.length === 0) {
      addToast('warning', 'DXF 파일이 없습니다. .dxf 파일을 먼저 업로드하세요.');
      return;
    }
    const progressMessage: ChatMessage = {
      id: crypto.randomUUID(), role: 'assistant',
      content: `📐 DXF 파일 ${dxfFiles.length}개의 인허가 분석을 시작합니다...\n\n레이어 접두사: **$**(설계), **#**(인허가) 기반으로 분석합니다.`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, progressMessage]);
    setIsReviewing(true);

    try {
      for (const dxfFile of dxfFiles) {
        const content = dxfFile.content || '';
        const layerSection = content.split('[레이어 목록]')[1]?.split('[텍스트 내용]')[0] || '';
        const layerNames = layerSection.split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2).trim());
        const permitLayers = layerNames.filter(n => n.startsWith('#'));
        const designLayers = layerNames.filter(n => n.startsWith('$'));
        const cadastralLayers = layerNames.filter(n => n.includes('지적'));

        const PERMIT_MAP: Record<string, string> = {
          '#도로구역': '도로 점용 허가', '#하천구역': '하천 점용 허가',
          '#소하천구역': '소하천 점용 허가', '#영구점용선': '도로 점용 허가',
          '#일시점용선': '도로 점용 허가', '#농지': '농지 전용 허가',
          '#산지': '산지 전용 허가', '#철도보호지구': '철도 보호지구 행위허가',
          '#군사시설보호구역': '군사시설 보호구역 행위허가', '#문화재보호구역': '문화재 현상변경 허가',
        };

        const permits = permitLayers.filter(n => PERMIT_MAP[n]).map((n) => ({
          permitName: PERMIT_MAP[n], source: 'layer' as const,
          sourceDetail: `${n} 레이어 존재`, layerName: n,
        }));
        const uniquePermits = Array.from(new Map(permits.map(p => [p.permitName, p])).values());

        const dxfResult: DxfAnalysisResult = {
          fileName: dxfFile.name,
          layerSummary: {
            total: layerNames.length,
            design: designLayers.map(n => ({ name: n, role: 'design' as const, prefix: '$' as const, baseName: n.slice(1), entityCount: 0, hasPolylines: false, hasTexts: false })),
            permit: permitLayers.map(n => ({ name: n, role: 'permit' as const, prefix: '#' as const, baseName: n.slice(1), entityCount: 0, hasPolylines: false, hasTexts: false })),
            cadastral: cadastralLayers.map(n => ({ name: n, role: 'cadastral' as const, prefix: '' as const, baseName: n, entityCount: 0, hasPolylines: false, hasTexts: false })),
            general: layerNames.filter(n => !n.startsWith('$') && !n.startsWith('#') && !n.includes('지적')).map(n => ({ name: n, role: 'general' as const, prefix: '' as const, baseName: n, entityCount: 0, hasPolylines: false, hasTexts: false })),
          },
          parcels: [], permits: uniquePermits,
          warnings: cadastralLayers.length === 0 ? ['지적 레이어가 없어 지목 기반 분석을 건너뛰었습니다.'] : [],
          analyzedAt: new Date().toISOString(),
        };

        const resultMessage: ChatMessage = {
          id: crypto.randomUUID(), role: 'assistant',
          content: `## DXF 인허가 분석 완료\n\n**${dxfFile.name}** — ${layerNames.length}개 레이어 | 설계($) ${designLayers.length} | 인허가(#) ${permitLayers.length}\n\n감지된 인허가: **${uniquePermits.length}건**`,
          timestamp: new Date(), dxfAnalysis: dxfResult,
        };
        setMessages((prev) => prev.map((m) => (m.id === progressMessage.id ? resultMessage : m)));
      }
      addToast('success', 'DXF 인허가 분석 완료');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '분석 중 오류 발생';
      addToast('error', errMsg);
      setMessages((prev) => prev.map((m) => m.id === progressMessage.id ? { ...m, content: `❌ DXF 분석 실패: ${errMsg}` } : m));
    } finally {
      setIsReviewing(false);
    }
  }, [files, addToast]);

  // ───── 채팅 메시지 전송 핸들러 ─────
  const handleSendMessage = useCallback(async (content: string) => {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(), role: 'user', content, timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    if (isDxfAnalyzeCommand(content)) { await handleDxfAnalyze(); return; }
    if (isReviewCommand(content)) { await handleReview(); return; }

    setIsStreaming(true);
    try {
      const MAX_PER_FILE = 8_000;
      const MAX_TOTAL = 30_000;
      let totalLen = 0;
      const fileContextParts: string[] = [];
      for (const f of files.filter((f) => f.status === 'ready' && f.content)) {
        const truncated = f.content!.length > MAX_PER_FILE
          ? f.content!.slice(0, MAX_PER_FILE) + `\n...(이하 ${(f.content!.length - MAX_PER_FILE).toLocaleString()}자 생략)`
          : f.content!;
        if (totalLen + truncated.length > MAX_TOTAL) break;
        fileContextParts.push(`[파일: ${f.name}]\n${truncated}`);
        totalLen += truncated.length;
      }
      const fileContexts = fileContextParts.join('\n\n---\n\n');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content, fileContext: fileContexts || undefined,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        const errMsg = errBody?.error || `API 오류: ${response.status}`;
        if (response.status === 429) addToast('warning', '무료 사용량 한도 도달 — 잠시 후 다시 시도하세요');
        throw new Error(errMsg);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(), role: 'assistant', content: '', timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantContent += decoder.decode(value, { stream: true });
          setMessages((prev) => prev.map((m) => (m.id === assistantMessage.id ? { ...m, content: assistantContent } : m)));
        }
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(), role: 'system',
        content: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsStreaming(false);
    }
  }, [files, messages, addToast, handleReview, handleDxfAnalyze]);

  // ───── 세션 관리 ─────
  const handleCreateSession = useCallback(() => {
    const newId = crypto.randomUUID();
    const newSession: Session = { id: newId, title: '새 대화', createdAt: new Date(), updatedAt: new Date() };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
    sessionIdRef.current = newId;
    saveSessionId(newId);
    setMessages([]); setFiles([]); setProjects([]); setActiveProjectId(null);
    addToast('info', '새 대화가 시작되었습니다.');
  }, [addToast]);

  const handleSelectSession = useCallback((sessionId: string) => {
    if (sessionId === activeSessionId) return;
    setActiveSessionId(sessionId);
    sessionIdRef.current = sessionId;
    saveSessionId(sessionId);
    setMessages(loadSessionMessages<ChatMessage>(sessionId));
    setFiles(loadSessionFiles<UploadedFile>(sessionId));
    setProjects(loadSessionProjects<Project>(sessionId));
    setActiveProjectId(null);
  }, [activeSessionId]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    deleteSessionData(sessionId);
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== sessionId);
      if (sessionId === activeSessionId) {
        if (updated.length > 0) {
          const nextId = updated[0].id;
          setActiveSessionId(nextId); sessionIdRef.current = nextId; saveSessionId(nextId);
          setMessages(loadSessionMessages<ChatMessage>(nextId));
          setFiles(loadSessionFiles<UploadedFile>(nextId));
          setProjects(loadSessionProjects<Project>(nextId));
        } else {
          handleCreateSession();
        }
      }
      return updated;
    });
    addToast('info', '대화가 삭제되었습니다.');
  }, [activeSessionId, addToast, handleCreateSession]);

  const handleRenameSession = useCallback((sessionId: string, newTitle: string) => {
    setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, title: newTitle, updatedAt: new Date() } : s));
  }, []);

  const handleNewSession = useCallback(() => { handleCreateSession(); }, [handleCreateSession]);

  return (
    <ReviewLayout
      files={files}
      messages={messages}
      isStreaming={isStreaming || isReviewing}
      onSendMessage={handleSendMessage}
      onFilesAdded={handleFilesAdded}
      onFileRemove={handleFileRemove}
      onGroupChange={handleGroupChange}
      onFileProgress={handleFileProgress}
      onFileStatusChange={handleFileStatusChange}
      projects={projects}
      activeProjectId={activeProjectId}
      onCreateProject={handleCreateProject}
      onSelectProject={setActiveProjectId}
      onDeleteProject={handleDeleteProject}
      onRenameProject={handleRenameProject}
      onMoveFileToProject={handleMoveFileToProject}
      onNewSession={handleNewSession}
      sessions={sessions}
      activeSessionId={activeSessionId}
      onSelectSession={handleSelectSession}
      onCreateSession={handleCreateSession}
      onDeleteSession={handleDeleteSession}
      onRenameSession={handleRenameSession}
    />
  );
}
