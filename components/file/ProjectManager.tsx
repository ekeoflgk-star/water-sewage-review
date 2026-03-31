'use client';

import { useState } from 'react';
import type { Project } from '@/types';

interface ProjectManagerProps {
  projects: Project[];
  activeProjectId: string | null;
  onCreateProject: (name: string, parentId?: string) => void;
  onSelectProject: (projectId: string | null) => void;
  onDeleteProject: (projectId: string) => void;
  onRenameProject: (projectId: string, newName: string) => void;
  fileCount?: Record<string, number>;  // projectId → 파일 수
}

export function ProjectManager({
  projects,
  activeProjectId,
  onCreateProject,
  onSelectProject,
  onDeleteProject,
  onRenameProject,
  fileCount = {},
}: ProjectManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [creatingParentId, setCreatingParentId] = useState<string | undefined>(undefined);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // 최상위 폴더 (parentId 없는 것)
  const rootProjects = projects.filter((p) => !p.parentId);

  // 특정 폴더의 하위 폴더
  const getChildren = (parentId: string) =>
    projects.filter((p) => p.parentId === parentId);

  // 하위 포함 전체 파일 수
  const getTotalFileCount = (projectId: string): number => {
    const own = fileCount[projectId] ?? 0;
    const childCount = getChildren(projectId).reduce(
      (sum, c) => sum + getTotalFileCount(c.id), 0
    );
    return own + childCount;
  };

  // 접기/펼치기
  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 새 폴더 생성
  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreateProject(trimmed, creatingParentId);
    setNewName('');
    setIsCreating(false);
    setCreatingParentId(undefined);
    // 부모 폴더 자동 펼치기
    if (creatingParentId) {
      setExpanded((prev) => { const next = new Set(Array.from(prev)); next.add(creatingParentId); return next; });
    }
  };

  // 하위 폴더 생성 시작
  const startCreateChild = (parentId: string) => {
    setCreatingParentId(parentId);
    setIsCreating(true);
    setNewName('');
    // 부모 자동 펼치기
    setExpanded((prev) => { const next = new Set(Array.from(prev)); next.add(parentId); return next; });
  };

  // 이름 수정
  const handleRename = (projectId: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    onRenameProject(projectId, trimmed);
    setEditingId(null);
    setEditName('');
  };

  // 폴더 아이템 렌더링 (재귀)
  const renderProject = (project: Project, depth: number = 0) => {
    const children = getChildren(project.id);
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(project.id);
    const isActive = activeProjectId === project.id;
    const totalFiles = getTotalFileCount(project.id);
    const isRoot = !project.parentId;

    return (
      <div key={project.id}>
        <div
          className={`group flex items-center gap-1 text-xs rounded-md transition-colors ${
            isActive
              ? 'bg-blue-100 text-blue-700 font-medium'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          {editingId === project.id ? (
            /* 이름 수정 모드 */
            <div className="flex-1 flex gap-1 py-1 pr-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename(project.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="flex-1 text-xs px-1.5 py-0.5 border border-blue-300 rounded focus:outline-none min-w-0"
                autoFocus
              />
              <button
                onClick={() => handleRename(project.id)}
                className="text-[10px] text-blue-600 shrink-0"
              >
                확인
              </button>
            </div>
          ) : (
            /* 일반 모드 */
            <>
              {/* 펼침/접힘 화살표 */}
              <button
                onClick={() => hasChildren && toggleExpanded(project.id)}
                className={`text-[10px] w-3 text-center shrink-0 ${
                  hasChildren ? 'text-slate-400 hover:text-slate-600' : 'text-transparent'
                }`}
              >
                {hasChildren ? (isExpanded ? '▾' : '▸') : '·'}
              </button>

              {/* 폴더 아이콘 + 이름 */}
              <button
                onClick={() => onSelectProject(project.id)}
                className="flex-1 text-left flex items-center gap-1.5 py-1.5 min-w-0"
              >
                <span className="text-xs">{isRoot ? '📂' : '📁'}</span>
                <span className="truncate">{project.name}</span>
                {totalFiles > 0 && (
                  <span className="text-[10px] bg-slate-200 text-slate-500 px-1 rounded-full ml-auto shrink-0">
                    {totalFiles}
                  </span>
                )}
              </button>

              {/* 호버 시 액션 버튼 */}
              <div className="hidden group-hover:flex items-center gap-0.5 shrink-0 pr-1">
                {/* 하위 폴더 추가 (최대 3레벨까지) */}
                {depth < 2 && (
                  <button
                    onClick={() => startCreateChild(project.id)}
                    className="text-[10px] text-slate-400 hover:text-green-600 px-0.5"
                    title="하위 폴더 추가"
                  >
                    +
                  </button>
                )}
                <button
                  onClick={() => { setEditingId(project.id); setEditName(project.name); }}
                  className="text-[10px] text-slate-400 hover:text-blue-500 px-0.5"
                  title="이름 변경"
                >
                  ✏
                </button>
                <button
                  onClick={() => {
                    const childCount = getChildren(project.id).length;
                    const msg = childCount > 0
                      ? `"${project.name}" 폴더와 하위 ${childCount}개 폴더를 삭제하시겠습니까?\n(파일은 삭제되지 않습니다)`
                      : `"${project.name}" 폴더를 삭제하시겠습니까?\n(파일은 삭제되지 않습니다)`;
                    if (confirm(msg)) onDeleteProject(project.id);
                  }}
                  className="text-[10px] text-slate-400 hover:text-red-500 px-0.5"
                  title="폴더 삭제"
                >
                  🗑
                </button>
              </div>
            </>
          )}
        </div>

        {/* 하위 폴더 (펼쳐진 경우) */}
        {hasChildren && isExpanded && (
          <div>
            {children.map((child) => renderProject(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mb-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          사업 폴더
        </span>
        <button
          onClick={() => { setIsCreating(!isCreating); setCreatingParentId(undefined); }}
          className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
          title="새 사업 폴더"
        >
          + 새 폴더
        </button>
      </div>

      {/* 새 폴더 생성 입력 */}
      {isCreating && (
        <div className="mb-2">
          {creatingParentId && (
            <p className="text-[10px] text-slate-400 mb-1 px-1">
              📂 {projects.find((p) => p.id === creatingParentId)?.name} 하위에 생성
            </p>
          )}
          <div className="flex gap-1">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') { setIsCreating(false); setCreatingParentId(undefined); }
              }}
              placeholder={creatingParentId ? '하위 폴더명' : '사업명 입력'}
              className="flex-1 text-xs px-2 py-1 border border-slate-200 rounded focus:border-blue-400 focus:outline-none"
              autoFocus
            />
            <button
              onClick={handleCreate}
              className="text-[10px] px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              생성
            </button>
            <button
              onClick={() => { setIsCreating(false); setNewName(''); setCreatingParentId(undefined); }}
              className="text-[10px] px-1.5 py-1 text-slate-400 hover:text-slate-600"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 전체 보기 */}
      <button
        onClick={() => onSelectProject(null)}
        className={`w-full text-left text-xs px-2.5 py-1.5 rounded-md mb-1 transition-colors flex items-center gap-2 ${
          activeProjectId === null
            ? 'bg-blue-100 text-blue-700 font-medium'
            : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        <span className="text-sm">📁</span>
        <span>전체 파일</span>
      </button>

      {/* 프로젝트 트리 */}
      <div className="space-y-0.5">
        {rootProjects.map((project) => renderProject(project, 0))}
      </div>

      {projects.length === 0 && !isCreating && (
        <p className="text-[10px] text-slate-400 px-2 py-1">
          사업별로 파일을 정리하세요
        </p>
      )}
    </div>
  );
}
