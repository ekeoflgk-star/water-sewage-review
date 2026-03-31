'use client';

import type { UploadedFile, FileGroup, Project } from '@/types';
import { FILE_GROUP_LABELS, FILE_GROUP_DESCRIPTIONS, suggestFileGroup } from '@/types';

interface FileListProps {
  files: UploadedFile[];
  onFileRemove: (fileId: string) => void;
  onGroupChange: (fileId: string, group: FileGroup | null) => void;
  onFileRetry?: (fileId: string) => void;
  /** 프로젝트 목록 (추가참고문서 사업명 표시용) */
  projects?: Project[];
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

/** 진행률 바 (퍼센트 또는 인디터미네이트) */
function ProgressBar({ progress, status }: { progress?: number; status: string }) {
  const hasProgress = typeof progress === 'number' && progress > 0;
  const isParsing = status === 'parsing';

  return (
    <div className="mt-1.5">
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        {hasProgress ? (
          <div
            className={`h-full rounded-full transition-all duration-300 ease-out ${
              isParsing ? 'bg-amber-400' : progress >= 100 ? 'bg-green-400' : 'bg-blue-400'
            }`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        ) : (
          <div className="h-full w-1/4 bg-blue-400 rounded-full progress-bar-indeterminate" />
        )}
      </div>
      {hasProgress && (
        <p className="text-[10px] text-slate-400 mt-0.5 text-right">
          {isParsing ? '파싱 중...' : `${Math.round(progress)}%`}
          {status === 'uploading' && progress < 90 && ' 업로드 중'}
        </p>
      )}
    </div>
  );
}

export function FileList({
  files,
  onFileRemove,
  onGroupChange,
  onFileRetry,
  projects,
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

          {/* 업로드/파싱 진행률 바 */}
          {(file.status === 'uploading' || file.status === 'parsing') && (
            <ProgressBar progress={file.uploadProgress} status={file.status} />
          )}

          {/* 그룹 분류 선택 (준비 완료 시에만) (#4 — 툴팁 + 자동 추천) */}
          {file.status === 'ready' && (() => {
            const suggested = suggestFileGroup(file.name);
            return (
              <div className="mt-2">
                {/* 자동 추천 배지 */}
                {suggested && !file.group && (
                  <button
                    onClick={() => onGroupChange(file.id, suggested)}
                    className="mb-1 w-full text-xs text-left px-2 py-1 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                    title={`파일명 기반 추천: ${FILE_GROUP_DESCRIPTIONS[suggested]}`}
                  >
                    <span className="text-blue-500">💡</span>
                    <span className="text-blue-600">추천: <strong>{FILE_GROUP_LABELS[suggested]}</strong></span>
                    <span className="text-blue-400 ml-auto text-[10px]">클릭하여 적용</span>
                  </button>
                )}
                <select
                  value={file.group || ''}
                  onChange={(e) =>
                    onGroupChange(
                      file.id,
                      (e.target.value as FileGroup) || null
                    )
                  }
                  className="w-full text-xs border border-slate-200 rounded px-2 py-1 text-slate-600 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  title="문서 유형을 선택하면 검토 시 참고됩니다"
                >
                  <option value="">그룹 선택...</option>
                  {Object.entries(FILE_GROUP_LABELS).map(([key, label]) => (
                    <option key={key} value={key} title={FILE_GROUP_DESCRIPTIONS[key as FileGroup]}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            );
          })()}

          {/* 추가참고문서 임베딩 상태 표시 */}
          {file.group === 'guideline' && file.status === 'ready' && (
            <div className="mt-1.5">
              {file.embedStatus === 'embedding' && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  검토 기준 임베딩 중...
                </div>
              )}
              {file.embedStatus === 'embedded' && (() => {
                const projName = projects?.find((p) => p.id === file.embedProjectId)?.name;
                return (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 rounded px-2 py-1">
                    <span>📌</span>
                    <span>
                      검토 기준 적용됨 ({file.embedChunks}개 청크)
                      {projName && <span className="text-emerald-500 ml-1">— 📂 {projName} 전용</span>}
                    </span>
                  </div>
                );
              })()}
              {file.embedStatus === 'embed-error' && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                  <span>⚠️</span>
                  임베딩 실패
                </div>
              )}
              {(!file.embedStatus || file.embedStatus === 'none') && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 rounded px-2 py-1">
                  <span>📌</span>
                  추가참고문서 — 그룹 저장 시 자동 임베딩
                </div>
              )}
            </div>
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
