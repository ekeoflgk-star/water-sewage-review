'use client';

import { MessageList } from '@/components/chat/MessageList';
import { ChatInput } from '@/components/chat/ChatInput';
import type { ChatMessage } from '@/types';

interface ChatPanelProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendMessage: (content: string) => void;
  onToggleLawPanel: () => void;
  onToggleFilePanel: () => void;
  showFilePanel: boolean;
  showLawPanel: boolean;
  fileCount: number;
  readyFileCount: number;
}

export function ChatPanel({
  messages,
  isStreaming,
  onSendMessage,
  onToggleLawPanel,
  onToggleFilePanel,
  showFilePanel,
  showLawPanel,
  fileCount,
  readyFileCount,
}: ChatPanelProps) {
  return (
    <main className="flex-1 flex flex-col h-full min-w-0">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-panel-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* 파일 패널 토글 */}
          <button
            onClick={onToggleFilePanel}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              showFilePanel
                ? 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
            }`}
            title={showFilePanel ? '파일 패널 숨기기' : '파일 패널 표시'}
          >
            {showFilePanel ? '◀ 파일' : '▶ 파일'}
            {fileCount > 0 && (
              <span className="ml-1 text-[10px] bg-blue-100 text-blue-600 px-1 rounded">
                {readyFileCount}/{fileCount}
              </span>
            )}
          </button>
          <div>
            <h1 className="text-sm font-semibold text-slate-800">
              설계 검토 AI
            </h1>
            <p className="text-xs text-slate-500">
              Gemini 2.5 Flash 기반
            </p>
          </div>
        </div>
        {/* 법령 패널 토글 */}
        <button
          onClick={onToggleLawPanel}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            showLawPanel
              ? 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
          }`}
          title={showLawPanel ? '법령 패널 숨기기' : '법령 패널 표시'}
        >
          {showLawPanel ? '법령 ▶' : '법령 ◀'}
        </button>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md px-6">
              <div className="text-5xl mb-4">🔍</div>
              <h2 className="text-lg font-semibold text-slate-700 mb-2">
                상하수도 설계 검토를 시작하세요
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                좌측에서 설계문서(PDF·DOCX·XLSX)를 업로드한 뒤,
                질문하거나 &ldquo;검토 시작&rdquo;을 입력하세요.
              </p>

              {/* 빠른 시작 가이드 */}
              <div className="grid grid-cols-1 gap-2 text-left">
                {[
                  { icon: '📄', title: '1. 문서 업로드', desc: '설계설명서, 수리계산서, 도면 등' },
                  { icon: '💬', title: '2. 질문 입력', desc: '"검토 시작" 또는 구체적 질문' },
                  { icon: '📋', title: '3. 결과 확인', desc: '적합/부적합 판정 및 근거 확인' },
                ].map((step) => (
                  <div key={step.title} className="flex items-start gap-3 bg-slate-50 rounded-lg px-3 py-2.5">
                    <span className="text-lg">{step.icon}</span>
                    <div>
                      <p className="text-xs font-medium text-slate-700">{step.title}</p>
                      <p className="text-xs text-slate-400">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <MessageList messages={messages} isStreaming={isStreaming} />
        )}
      </div>

      {/* 입력 영역 */}
      <ChatInput onSend={onSendMessage} isStreaming={isStreaming} />
    </main>
  );
}
