'use client';

import { useState, useRef, useCallback } from 'react';

interface ChatInputProps {
  onSend: (content: string) => void;
  isStreaming: boolean;
  /** 파일이 준비된 상태인지 (빠른 명령 활성화 조건) */
  hasReadyFiles?: boolean;
  /** 파일 업로드 트리거 */
  onTriggerUpload?: () => void;
}

export function ChatInput({ onSend, isStreaming, hasReadyFiles = false, onTriggerUpload }: ChatInputProps) {
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
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="max-w-3xl mx-auto">
        {/* Claude 스타일 입력창 — 둥근 컨테이너 */}
        <div className={`
          relative flex items-end gap-0
          bg-white border border-slate-200 rounded-2xl shadow-sm
          transition-all duration-200
          focus-within:border-slate-300 focus-within:shadow-md
          ${isStreaming ? 'opacity-70' : ''}
        `}>
          {/* 파일 첨부 버튼 (좌측) */}
          {onTriggerUpload && (
            <button
              onClick={onTriggerUpload}
              className="flex-shrink-0 p-3 text-slate-400 hover:text-slate-600 transition-colors"
              title="파일 업로드"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
          )}

          {/* 텍스트 입력 */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming
                ? '응답 생성 중...'
                : '설계 검토에 대해 질문하세요...'
            }
            disabled={isStreaming}
            rows={1}
            className={`
              flex-1 resize-none bg-transparent py-3 text-sm leading-relaxed
              focus:outline-none
              disabled:cursor-not-allowed
              placeholder:text-slate-400
              ${onTriggerUpload ? 'pl-0' : 'pl-4'}
            `}
          />

          {/* 전송 버튼 (우측) */}
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isStreaming}
            className={`
              flex-shrink-0 m-1.5 p-2 rounded-xl transition-all
              ${input.trim() && !isStreaming
                ? 'bg-slate-800 text-white hover:bg-slate-700 active:scale-95'
                : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }
            `}
            title="전송 (Enter)"
          >
            {isStreaming ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            )}
          </button>
        </div>

        {/* 하단 도움말 텍스트 */}
        <p className="text-center text-[10px] text-slate-400 mt-2">
          상하수도 설계 검토 AI
          {hasReadyFiles && (
            <span className="ml-2 text-blue-400">
              파일 준비됨 — &quot;검토 시작&quot;을 입력하세요
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
