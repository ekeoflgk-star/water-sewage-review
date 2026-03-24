'use client';

import type { UploadedFile, FileGroup } from '@/types';
import { FILE_GROUP_LABELS } from '@/types';

interface FileListProps {
  files: UploadedFile[];
  onFileRemove: (fileId: string) => void;
  onGroupChange: (fileId: string, group: FileGroup | null) => void;
  onFileRetry?: (fileId: string) => void;
}

/** 파일 크기 포맷 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** 파일 타입 아이콘 */
function FileTypeIcon({ type }: { type: UploadedFile['type'] }) {
  const colors: Record<string, string> = {
    pdf: 'text-red-500 bg-red-50',
    docx: 'text-blue-500 bg-blue-50',
    xlsx: 'text-green-500 bg-green-50',
  };
  const labels: Record<string, string> = {
    pdf: 'PDF',
    docx: 'DOC',
    xlsx: 'XLS',
  };

  return (
    <span
      className={`inline-flex items-center justify-center w-8 h-8 rounded text-xs font-medium ${colors[type]}`}
    >
      {labels[type]}
    </span>
  );
}

/** 상태 표시기 */
function StatusIndicator({ status }: { status: UploadedFile['status'] }) {
  const config: Record<string, { color: string; label: string }> = {
    uploading: { color: 'bg-blue-400', label: '업로드 중' },
    parsing: { color: 'bg-yellow-400 animate-pulse', label: '파싱 중' },
    ready: { color: 'bg-green-400', label: '준비됨' },
    error: { color: 'bg-red-400', label: '오류' },
  };
  const { color, label } = config[status];

  return (
    <span className="flex items-center gap-1">
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-xs text-slate-400">{label}</span>
    </span>
  );
}

/** 인디터미네이트 프로그레스 바 */
function IndeterminateProgress() {
  return (
    <div className="mt-1.5 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
      <div className="h-full w-1/4 bg-blue-400 rounded-full progress-bar-indeterminate" />
    </div>
  );
}

export function FileList({
  files,
  onFileRemove,
  onGroupChange,
  onFileRetry,
}: FileListProps) {
  if (files.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-2xl opacity-20 mb-2">📁</div>
        <p className="text-xs text-slate-400">
          업로드된 파일이 없습니다
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div
          key={file.id}
          className={`
            bg-white rounded-lg border p-2.5 group transition-colors
            ${file.status === 'error' ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}
          `}
        >
          {/* 상단: 아이콘 + 파일명 + 삭제 */}
          <div className="flex items-start gap-2">
            <FileTypeIcon type={file.type} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700 truncate" title={file.name}>
                {file.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-400">
                  {formatSize(file.size)}
                </span>
                <StatusIndicator status={file.status} />
              </div>
            </div>
            <button
              onClick={() => onFileRemove(file.id)}
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all text-xs p-0.5"
              title="삭제"
            >
              ✕
            </button>
          </div>

          {/* 파싱 중 프로그레스 바 */}
          {(file.status === 'uploading' || file.status === 'parsing') && (
            <IndeterminateProgress />
          )}

          {/* 그룹 분류 선택 (준비 완료 시에만) */}
          {file.status === 'ready' && (
            <select
              value={file.group || ''}
              onChange={(e) =>
                onGroupChange(
                  file.id,
                  (e.target.value as FileGroup) || null
                )
              }
              className="mt-2 w-full text-xs border border-slate-200 rounded px-2 py-1 text-slate-600 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">그룹 선택...</option>
              {Object.entries(FILE_GROUP_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          )}

          {/* 에러 메시지 + 재시도 */}
          {file.status === 'error' && (
            <div className="mt-1.5 flex items-center gap-2">
              <p className="text-xs text-red-500 flex-1 truncate" title={file.errorMessage}>
                {file.errorMessage}
              </p>
              {onFileRetry && (
                <button
                  onClick={() => onFileRetry(file.id)}
                  className="text-xs text-blue-500 hover:text-blue-700 font-medium whitespace-nowrap"
                >
                  재시도
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
