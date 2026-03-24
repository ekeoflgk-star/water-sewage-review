'use client';

import { DropZone } from '@/components/file/DropZone';
import { FileList } from '@/components/file/FileList';
import type { UploadedFile, FileGroup } from '@/types';

interface FilePanelProps {
  files: UploadedFile[];
  onFilesAdded: (files: UploadedFile[]) => void;
  onFileRemove: (fileId: string) => void;
  onGroupChange: (fileId: string, group: FileGroup | null) => void;
}

export function FilePanel({
  files,
  onFilesAdded,
  onFileRemove,
  onGroupChange,
}: FilePanelProps) {
  return (
    <aside className="w-file-panel flex-shrink-0 border-r border-panel-border bg-panel-bg flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-panel-border">
        <h2 className="text-sm font-semibold text-slate-800">
          파일 관리
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          설계문서를 업로드하세요
        </p>
      </div>

      {/* 드래그앤드롭 영역 */}
      <div className="px-3 py-3">
        <DropZone onFilesAdded={onFilesAdded} />
      </div>

      {/* 파일 목록 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-3">
        <FileList
          files={files}
          onFileRemove={onFileRemove}
          onGroupChange={onGroupChange}
        />
      </div>

      {/* 하단 정보 */}
      <div className="px-4 py-2 border-t border-panel-border text-xs text-slate-400">
        {files.length}개 파일 · {files.filter((f) => f.status === 'ready').length}개 준비됨
      </div>
    </aside>
  );
}
