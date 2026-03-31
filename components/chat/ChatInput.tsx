'use client';

import { useState, useRef, useCallback } from 'react';

interface ChatInputProps {
  onSend: (content: string) => void;
  isStreaming: boolean;
  /** 파일이 준비된 상태인지 (빠른 명령 활성화 조건) */
  hasReadyFiles?: boolean;
}

/** 빠른 명령 칩 목록 */
const QUICK_COMMANDS = [
  { label: '🔍 검토 시작', command: '검토 시작', requiresFiles: true },
  { label: '📐 DXF 분석', command: 'DXF 분석', requiresFiles: true },
  { label: '📋 보고서 생성', command: '보고서 생성', requiresFiles: false },
  { label: '⚖️ 인허가 판단', command: '인허가 판단', requiresFiles: true },
];

export function ChatInput({ onSend, isStreaming, hasReadyFiles = false }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    onSend(trimmed);
    setInput('');

    // textarea 높이 리셋
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isStreaming, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // 자동 높이 조절
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  };

  const handleQuickCommand = (command: string) => {
    if (isStreaming) return;
    onSend(command);
  };

  return (
    <div className="border-t border-panel-border p-3">
      <div className="max-w-3xl mx-auto">
        {/* 빠른 명령 칩 (#2) */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {QUICK_COMMANDS.map((cmd) => {
            const disabled = isStreaming || (cmd.requiresFiles && !hasReadyFiles);
            return (
              <button
                key={cmd.command}
                onClick={() => handleQuickCommand(cmd.command)}
                disabled={disabled}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all
                  ${disabled
                    ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                    : 'border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 active:scale-95'
                  }`}
                title={cmd.requiresFiles && !hasReadyFiles ? '파일을 먼저 업로드하세요' : cmd.command}
              >
                {cmd.label}
              </button>
            );
          })}
        </div>

        {/* 입력창 */}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming
                ? '응답 생성 중...'
                : '질문을 입력하세요 (Shift+Enter: 줄바꿈)'
            }
            disabled={isStreaming}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              placeholder:text-slate-400"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isStreaming}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white
              bg-blue-600 hover:bg-blue-700 transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed
              flex-shrink-0"
          >
            {isStreaming ? '...' : '전송'}
          </button>
        </div>
      </div>
    </div>
  );
}
