'use client';

import { MessageList } from '@/components/chat/MessageList';
import { ChatInput } from '@/components/chat/ChatInput';
import { ReviewHistory } from '@/components/chat/ReviewHistory';
import type { ChatMessage } from '@/types';

interface ChatPanelProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendMessage: (content: string) => void;
  onToggleLawPanel?: () => void;
  onToggleFilePanel: () => void;
  filePanelCollapsed: boolean;
  lawPanelCollapsed?: boolean;
  fileCount: number;
  readyFileCount: number;
  /** 파일 업로드 트리거 (빠른 시작에서 사용) */
  onTriggerUpload?: () => void;
  /** 새 세션 시작 (상태 초기화) */
  onNewSession?: () => void;
}

export function ChatPanel({
  messages,
  isStreaming,
  onSendMessage,
  onToggleLawPanel,
  onToggleFilePanel,
  filePanelCollapsed,
  lawPanelCollapsed,
  fileCount,
  readyFileCount,
  onTriggerUpload,
  onNewSession,
}: ChatPanelProps) {
  return (
    <main className="flex-1 flex flex-col h-full min-w-0 bg-white">
      {/* 헤더 — Claude 스타일 미니멀 */}
      <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* 파일 패널 토글 */}
          <button
            onClick={onToggleFilePanel}
            className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              filePanelCollapsed
                ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
            title={filePanelCollapsed ? '파일 패널 펼치기' : '파일 패널 접기'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
            {fileCount > 0 && (
              <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">
                {readyFileCount}/{fileCount}
              </span>
            )}
          </button>

          {/* 타이틀 */}
          <span className="text-sm font-semibold text-slate-700">
            설계 검토 AI
          </span>
          {isStreaming && (
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* 새 세션 버튼 */}
          {onNewSession && messages.length > 0 && (
            <button
              onClick={onNewSession}
              className="text-[11px] p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
              title="새 세션 시작"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
          )}
          {/* 법령 패널 토글 (3-panel 모드에서만 표시) */}
          {onToggleLawPanel && (
            <button
              onClick={onToggleLawPanel}
              className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                lawPanelCollapsed
                  ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
              title={lawPanelCollapsed ? '참고 문서 펼치기' : '참고 문서 접기'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 메시지 영역 — Claude 스타일 중앙 정렬 */}
      <div className={`flex-1 ${messages.length === 0 ? 'overflow-y-auto' : 'overflow-hidden'}`}>
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="text-center max-w-md px-6">
              {/* Claude 스타일 로고 + 인사 */}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-200">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                무엇을 도와드릴까요?
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-8">
                설계문서를 업로드하고 검토를 요청하거나,<br/>
                상하수도 설계 기준에 대해 자유롭게 질문하세요.
              </p>

              {/* Claude 스타일 제안 카드 */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => {
                    if (filePanelCollapsed) onToggleFilePanel();
                    onTriggerUpload?.();
                  }}
                  className="group flex items-start gap-3 text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3.5 transition-all"
                >
                  <span className="text-lg mt-0.5">📄</span>
                  <div>
                    <p className="text-sm font-medium text-slate-700 group-hover:text-slate-900">문서 업로드</p>
                    <p className="text-xs text-slate-400 mt-0.5">PDF, DOCX, XLSX, DXF</p>
                  </div>
                </button>
                <button
                  onClick={() => readyFileCount > 0 ? onSendMessage('검토 시작') : undefined}
                  disabled={readyFileCount === 0}
                  className={`group flex items-start gap-3 text-left rounded-xl px-4 py-3.5 transition-all border
                    ${readyFileCount > 0
                      ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 hover:border-slate-300'
                      : 'bg-slate-50 border-slate-100 opacity-40 cursor-not-allowed'
                    }`}
                >
                  <span className="text-lg mt-0.5">🔍</span>
                  <div>
                    <p className="text-sm font-medium text-slate-700">설계 검토</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {readyFileCount > 0 ? `${readyFileCount}개 파일 준비됨` : '파일 업로드 필요'}
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => onSendMessage('상수도 관로 설계 시 유속 기준은?')}
                  className="group flex items-start gap-3 text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3.5 transition-all"
                >
                  <span className="text-lg mt-0.5">📐</span>
                  <div>
                    <p className="text-sm font-medium text-slate-700">설계 기준 질문</p>
                    <p className="text-xs text-slate-400 mt-0.5">유속, 관경, 토피 등</p>
                  </div>
                </button>
                <button
                  onClick={() => onSendMessage('인허가 판단')}
                  disabled={readyFileCount === 0}
                  className={`group flex items-start gap-3 text-left rounded-xl px-4 py-3.5 transition-all border
                    ${readyFileCount > 0
                      ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 hover:border-slate-300'
                      : 'bg-slate-50 border-slate-100 opacity-40 cursor-not-allowed'
                    }`}
                >
                  <span className="text-lg mt-0.5">⚖️</span>
                  <div>
                    <p className="text-sm font-medium text-slate-700">인허가 판단</p>
                    <p className="text-xs text-slate-400 mt-0.5">도로점용, 하천점용 등</p>
                  </div>
                </button>
              </div>

              {/* 검토 이력 */}
              <ReviewHistory onSelectHistory={(id) => onSendMessage(`이력 조회: ${id}`)} />
            </div>
          </div>
        ) : (
          <MessageList messages={messages} isStreaming={isStreaming} />
        )}
      </div>

      {/* 입력 영역 — Claude 스타일 */}
      <ChatInput
        onSend={onSendMessage}
        isStreaming={isStreaming}
        hasReadyFiles={readyFileCount > 0}
        onTriggerUpload={() => {
          if (filePanelCollapsed) onToggleFilePanel();
          onTriggerUpload?.();
        }}
      />
    </main>
  );
}
