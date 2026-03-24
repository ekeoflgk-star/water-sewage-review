'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useToast } from '@/components/ui/Toast';
import type { UploadedFile } from '@/types';

interface DropZoneProps {
  onFilesAdded: (files: UploadedFile[]) => void;
}

/** 파일 확장자 → 타입 변환 */
function getFileType(name: string): UploadedFile['type'] | null {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  return null;
}

/** 파일 크기 포맷 */
function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function DropZone({ onFilesAdded }: DropZoneProps) {
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
          status: 'parsing',
        };
        newFiles.push(uploadedFile);

        // 파일 파싱 API 호출
        const formData = new FormData();
        formData.append('file', file);

        try {
          const response = await fetch('/api/parse', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errBody = await response.json().catch(() => null);
            throw new Error(errBody?.error || `파싱 실패 (${response.status})`);
          }

          const result = await response.json();
          uploadedFile.content = result.content;
          uploadedFile.status = 'ready';
          addToast('success', `파싱 완료: ${file.name}`);
        } catch (error) {
          uploadedFile.status = 'error';
          uploadedFile.errorMessage =
            error instanceof Error ? error.message : '파싱 오류';
          addToast('error', `파싱 실패: ${file.name}`);
        }
      }

      if (newFiles.length > 0) {
        onFilesAdded(newFiles);
      }
    },
    [onFilesAdded, addToast]
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
    },
    multiple: true,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-4 text-center cursor-pointer
        transition-all duration-200
        ${
          isDragActive
            ? 'border-blue-500 bg-blue-50 scale-[1.02]'
            : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50 bg-white'
        }
      `}
    >
      <input {...getInputProps()} />
      <div className={`text-2xl mb-1 transition-transform ${isDragActive ? 'scale-110' : ''}`}>
        {isDragActive ? '📥' : '📄'}
      </div>
      <p className="text-xs text-slate-500">
        {isDragActive ? (
          <span className="text-blue-600 font-medium">여기에 놓으세요</span>
        ) : (
          <>
            파일을 드래그하거나
            <br />
            <span className="text-blue-500 underline underline-offset-2">클릭하여 선택</span>
          </>
        )}
      </p>
      <p className="text-[10px] text-slate-400 mt-1">PDF · DOCX · XLSX (50MB 이하)</p>
    </div>
  );
}
