'use client';

import { DropZone } from '@/components/file/DropZone';
import { FileList } from '@/components/file/FileList';
import { ProjectManager } from '@/components/file/ProjectManager';
import type { UploadedFile, FileGroup, Project } from '@/types';

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
}: FilePanelProps) {
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

  return (
    <aside className="w-full flex-shrink-0 border-r border-panel-border bg-panel-bg flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-panel-border">
        <h2 className="text-sm font-semibold text-slate-800">
          파일 관리
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {activeProjectId
            ? `📂 ${projects.find((p) => p.id === activeProjectId)?.name || ''}`
            : '설계문서를 업로드하세요'}
        </p>
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
        {/* 프로젝트 이동 드롭다운 (파일이 있고 프로젝트가 있을 때) */}
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
      <div className="px-4 py-2 border-t border-panel-border text-xs text-slate-400">
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
