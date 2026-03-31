'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useToast } from '@/components/ui/Toast';
import { parseFileOnClient, canParseOnClient } from '@/lib/parsers/client';
import type { UploadedFile } from '@/types';

interface DropZoneProps {
  onFilesAdded: (files: UploadedFile[]) => void;
  onFileProgress?: (fileId: string, progress: number) => void;
  onFileStatusChange?: (fileId: string, status: UploadedFile['status'], content?: string, error?: string) => void;
}

/** 파일 확장자 → 타입 변환 */
function getFileType(name: string): UploadedFile['type'] | null {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'dxf') return 'dxf';
  return null;
}

/** 파일 크기 포맷 */
function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/** XHR 기반 파일 업로드 (진행률 + 타임아웃 지원) */
const UPLOAD_TIMEOUT_MS = 120_000; // 2분 (대용량 PDF 파싱 고려)

function uploadWithProgress(
  file: File,
  onProgress: (percent: number) => void
): Promise<{ content: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    // 타임아웃 설정 (밀리초)
    xhr.timeout = UPLOAD_TIMEOUT_MS;

    // 업로드 진행률 (0~90% 구간)
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 90);
        onProgress(percent);
      }
    });

    // 업로드 완료 → 파싱 대기 (90%)
    xhr.upload.addEventListener('load', () => {
      onProgress(90);
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText);
          onProgress(100);
          resolve(result);
        } catch {
          reject(new Error('응답 파싱 실패'));
        }
      } else {
        let errMsg = `파싱 실패 (${xhr.status})`;
        try {
          const errBody = JSON.parse(xhr.responseText);
          if (errBody.error) errMsg = errBody.error;
        } catch { /* 무시 */ }
        reject(new Error(errMsg));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('네트워크 오류 — 인터넷 연결을 확인해주세요.'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('업로드 취소됨'));
    });

    xhr.addEventListener('timeout', () => {
      reject(new Error(`업로드 시간 초과 (${UPLOAD_TIMEOUT_MS / 1000}초) — 파일이 너무 크거나 서버 응답이 없습니다.`));
    });

    xhr.open('POST', '/api/parse');
    xhr.send(formData);
  });
}

export function DropZone({ onFilesAdded, onFileProgress, onFileStatusChange }: DropZoneProps) {
  const { addToast } = useToast();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newFiles: UploadedFile[] = [];

      for (const file of acceptedFiles) {
        const fileType = getFileType(file.name);
        if (!fileType) {
          addToast('warning', `지원하지 않는 형식: ${file.name}`);
          continue;
        }

        if (file.size > MAX_FILE_SIZE) {
          addToast('error', `파일이 너무 큽니다 (${formatSize(file.size)}): ${file.name} — 50MB 이하만 가능`);
          continue;
        }

        const uploadedFile: UploadedFile = {
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: fileType,
          group: null,
          uploadedAt: new Date(),
          status: 'uploading',
          uploadProgress: 0,
        };
        newFiles.push(uploadedFile);
      }

      if (newFiles.length > 0) {
        onFilesAdded(newFiles);
      }

      // 각 파일을 파싱 (클라이언트 우선 → 서버 fallback)
      const uploadPromises = newFiles.map((uploadedFile, i) => {
        const file = acceptedFiles[i];

        return (async () => {
          // 1) 클라이언트 파싱 가능하면 먼저 시도 (4.5MB 제한 우회)
          if (canParseOnClient(file.name)) {
            try {
              onFileStatusChange?.(uploadedFile.id, 'parsing');
              onFileProgress?.(uploadedFile.id, 10);

              const result = await parseFileOnClient(file, (percent) => {
                onFileProgress?.(uploadedFile.id, percent);
              });

              onFileStatusChange?.(uploadedFile.id, 'ready', result.content);
              addToast('success', `파싱 완료: ${file.name}`);
              return; // 성공 — 서버 업로드 불필요
            } catch {
              // 클라이언트 파싱 실패 → 서버 fallback
              console.log(`클라이언트 파싱 실패, 서버 fallback: ${file.name}`);
            }
          }

          // 2) 서버 API 업로드 (DOCX, DXF, 또는 클라이언트 실패 시)
          return uploadWithProgress(file, (percent) => {
            if (percent < 90) {
              onFileProgress?.(uploadedFile.id, percent);
            } else if (percent < 100) {
              onFileStatusChange?.(uploadedFile.id, 'parsing');
              onFileProgress?.(uploadedFile.id, percent);
            }
          }).then((result) => {
            onFileStatusChange?.(uploadedFile.id, 'ready', result.content);
            addToast('success', `파싱 완료: ${file.name}`);
          });
        })().catch((error: unknown) => {
          const errMsg = error instanceof Error ? error.message : '파싱 오류';
          onFileStatusChange?.(uploadedFile.id, 'error', undefined, errMsg);
          addToast('error', `파싱 실패: ${file.name}`);
        });
      });

      // 모든 업로드 완료 대기 (개별 실패는 catch에서 처리됨)
      await Promise.allSettled(uploadPromises);
    },
    [onFilesAdded, onFileProgress, onFileStatusChange, addToast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        '.xlsx',
      ],
      'application/vnd.ms-excel': ['.xls'],
      'application/dxf': ['.dxf'],
      'image/vnd.dxf': ['.dxf'],
    },
    multiple: true,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
        transition-all duration-200 min-h-[120px] flex flex-col items-center justify-center
        ${
          isDragActive
            ? 'border-blue-500 bg-blue-50 scale-[1.02] shadow-lg shadow-blue-100'
            : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/30 bg-white'
        }
      `}
    >
      <input {...getInputProps()} />
      <div className={`text-3xl mb-2 transition-transform duration-200 ${isDragActive ? 'scale-125 animate-bounce' : ''}`}>
        {isDragActive ? '📥' : '📄'}
      </div>
      <p className="text-sm text-slate-600 font-medium">
        {isDragActive ? (
          <span className="text-blue-600">여기에 놓으세요!</span>
        ) : (
          <>
            파일을 드래그하거나{' '}
            <span className="text-blue-500 underline underline-offset-2 cursor-pointer">클릭하여 선택</span>
          </>
        )}
      </p>
      <p className="text-xs text-slate-400 mt-1.5">PDF · DOCX · XLSX · DXF (50MB 이하)</p>
    </div>
  );
}
