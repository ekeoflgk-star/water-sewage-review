'use client';

import { useState } from 'react';
import { DropZone } from '@/components/file/DropZone';
import { FileList } from '@/components/file/FileList';
import { ProjectManager } from '@/components/file/ProjectManager';
import type { UploadedFile, FileGroup, Project, Session } from '@/types';

/** 패널 뷰 모드 */
type ViewMode = 'sessions' | 'files';

interface FilePanelProps {
  files: UploadedFile[];
  onFilesAdded: (files: UploadedFile[]) => void;
  onFileRemove: (fileId: string) => void;
  onGroupChange: (fileId: string, group: FileGroup | null) => void;
  onFileProgress?: (fileId: string, progress: number) => void;
  onFileStatusChange?: (fileId: string, status: UploadedFile['status'], content?: string, error?: string) => void;
  // 프로젝트 폴더 관리
  projects: Project[];
  activeProjectId: string | null;
  onCreateProject: (name: string, parentId?: string) => void;
  onSelectProject: (projectId: string | null) => void;
  onDeleteProject: (projectId: string) => void;
  onRenameProject: (projectId: string, newName: string) => void;
  onMoveFileToProject: (fileId: string, projectId: string | null) => void;
  // 세션(대화) 관리
  sessions: Session[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
}

/** 날짜 그룹 라벨 */
function getDateGroup(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return '이번 주';
  if (days < 30) return '이번 달';
  return '이전';
}

export function FilePanel({
  files,
  onFilesAdded,
  onFileRemove,
  onGroupChange,
  onFileProgress,
  onFileStatusChange,
  projects,
  activeProjectId,
  onCreateProject,
  onSelectProject,
  onDeleteProject,
  onRenameProject,
  onMoveFileToProject,
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onRenameSession,
}: FilePanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('sessions');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // 활성 프로젝트에 따라 파일 필터링
  const filteredFiles = activeProjectId
    ? files.filter((f) => {
        const project = projects.find((p) => p.id === activeProjectId);
        return project?.fileIds.includes(f.id);
      })
    : files;

  // 프로젝트별 파일 수
  const fileCount: Record<string, number> = {};
  for (const p of projects) {
    fileCount[p.id] = files.filter((f) => p.fileIds.includes(f.id)).length;
  }

  // 세션 날짜별 그룹화
  const groupedSessions = sessions.reduce<Record<string, Session[]>>((acc, session) => {
    const group = getDateGroup(session.updatedAt);
    if (!acc[group]) acc[group] = [];
    acc[group].push(session);
    return acc;
  }, {});

  // 세션 이름 변경 처리
  const handleRename = (sessionId: string) => {
    const trimmed = editTitle.trim();
    if (trimmed) onRenameSession(sessionId, trimmed);
    setEditingSessionId(null);
    setEditTitle('');
  };

  // ─── 대화 목록 뷰 ───
  if (viewMode === 'sessions') {
    return (
      <aside className="w-full flex-shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col h-full">
        {/* 헤더 — Claude 스타일 */}
        <div className="px-3 py-3 border-b border-slate-200 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">대화 목록</span>
          <button
            onClick={onCreateSession}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            title="새 대화"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
        </div>

        {/* 세션 목록 */}
        <div className="flex-1 overflow-y-auto">
          {Object.entries(groupedSessions).map(([group, groupSessions]) => (
            <div key={group}>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider px-3 pt-3 pb-1">
                {group}
              </p>
              {groupSessions.map((session) => {
                const isActive = session.id === activeSessionId;
                return (
                  <div key={session.id} className="px-2">
                    {editingSessionId === session.id ? (
                      /* 이름 수정 모드 */
                      <div className="flex gap-1 px-2 py-1.5">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(session.id);
                            if (e.key === 'Escape') setEditingSessionId(null);
                          }}
                          className="flex-1 text-xs px-2 py-1 border border-blue-300 rounded focus:outline-none min-w-0"
                          autoFocus
                        />
                        <button
                          onClick={() => handleRename(session.id)}
                          className="text-[10px] text-blue-600 px-1"
                        >
                          확인
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          onSelectSession(session.id);
                          setViewMode('files');
                        }}
                        className={`group w-full text-left px-3 py-2.5 rounded-lg mb-0.5 transition-colors flex items-center gap-2 ${
                          isActive
                            ? 'bg-slate-200 text-slate-800'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {/* 대화 아이콘 */}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-50">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        <span className="text-[13px] truncate flex-1">{session.title}</span>
                        {/* 호버 시 액션 */}
                        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSessionId(session.id);
                              setEditTitle(session.title);
                            }}
                            className="text-[10px] p-0.5 text-slate-400 hover:text-blue-500 rounded"
                            title="이름 변경"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                          </button>
                          {sessions.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`"${session.title}" 대화를 삭제하시겠습니까?`)) {
                                  onDeleteSession(session.id);
                                }
                              }}
                              className="text-[10px] p-0.5 text-slate-400 hover:text-red-500 rounded"
                              title="삭제"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {sessions.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-slate-400">대화가 없습니다</p>
              <button
                onClick={onCreateSession}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800"
              >
                새 대화 시작
              </button>
            </div>
          )}
        </div>
      </aside>
    );
  }

  // ─── 폴더/파일 관리 뷰 (세션 선택 후) ───
  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <aside className="w-full flex-shrink-0 border-r border-slate-200 bg-white flex flex-col h-full">
      {/* 뒤로가기 헤더 */}
      <div className="px-3 py-2 border-b border-slate-200 flex items-center gap-2">
        <button
          onClick={() => setViewMode('sessions')}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title="대화 목록으로"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-700 truncate">
            {activeSession?.title || '파일 관리'}
          </p>
          <p className="text-[10px] text-slate-400">
            {activeProjectId
              ? `📂 ${projects.find((p) => p.id === activeProjectId)?.name || ''}`
              : '설계문서를 업로드하세요'}
          </p>
        </div>
      </div>

      {/* 사업 폴더 관리 */}
      <div className="px-3 pt-3 pb-1">
        <ProjectManager
          projects={projects}
          activeProjectId={activeProjectId}
          onCreateProject={onCreateProject}
          onSelectProject={onSelectProject}
          onDeleteProject={onDeleteProject}
          onRenameProject={onRenameProject}
          fileCount={fileCount}
        />
      </div>

      {/* 드래그앤드롭 영역 */}
      <div className="px-3 py-2">
        <DropZone
          onFilesAdded={onFilesAdded}
          onFileProgress={onFileProgress}
          onFileStatusChange={onFileStatusChange}
        />
      </div>

      {/* 파일 목록 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-3">
        <FileList
          files={filteredFiles}
          onFileRemove={onFileRemove}
          onGroupChange={onGroupChange}
          projects={projects}
        />
        {/* 프로젝트 이동 드롭다운 */}
        {filteredFiles.length > 0 && projects.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 mb-1">파일을 폴더로 이동:</p>
            {filteredFiles.map((file) => {
              const currentProject = projects.find((p) => p.fileIds.includes(file.id));
              return (
                <div key={file.id} className="flex items-center gap-1 mb-1">
                  <span className="text-[10px] text-slate-500 truncate flex-1 min-w-0">
                    {file.name}
                  </span>
                  <select
                    value={currentProject?.id || ''}
                    onChange={(e) => onMoveFileToProject(file.id, e.target.value || null)}
                    className="text-[10px] px-1 py-0.5 border border-slate-200 rounded bg-white text-slate-600 max-w-[100px]"
                  >
                    <option value="">미분류</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 하단 정보 */}
      <div className="px-4 py-2 border-t border-slate-200 text-xs text-slate-400">
        {filteredFiles.length}개 파일 · {filteredFiles.filter((f) => f.status === 'ready').length}개 준비됨
        {activeProjectId && (
          <span className="ml-1 text-slate-300">
            (전체 {files.length})
          </span>
        )}
      </div>
    </aside>
  );
}
