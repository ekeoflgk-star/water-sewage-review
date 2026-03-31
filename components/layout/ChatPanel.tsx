'use client';

import { MessageList } from '@/components/chat/MessageList';
import { ChatInput } from '@/components/chat/ChatInput';
import { ReviewHistory } from '@/components/chat/ReviewHistory';
import type { ChatMessage } from '@/types';

interface ChatPanelProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendMessage: (content: string) => void;
  onToggleLawPanel: () => void;
  onToggleFilePanel: () => void;
  filePanelCollapsed: boolean;
  lawPanelCollapsed: boolean;
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
    <main className="flex-1 flex flex-col h-full min-w-0">
      {/* 헤더 */}
      <div className="px-3 py-2 border-b border-panel-border flex items-center justify-between bg-white">
        <div className="flex items-center gap-2">
          {/* 파일 패널 토글 */}
          <button
            onClick={onToggleFilePanel}
            className={`text-xs px-2 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
              filePanelCollapsed
                ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
            title={filePanelCollapsed ? '파일 패널 펼치기' : '파일 패널 접기'}
          >
            <span className="text-sm">{filePanelCollapsed ? '📁' : '📂'}</span>
            <span className="hidden sm:inline">{filePanelCollapsed ? '파일' : '파일'}</span>
            {fileCount > 0 && (
              <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">
                {readyFileCount}/{fileCount}
              </span>
            )}
          </button>

          {/* 타이틀 + 상태 */}
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-slate-800">
              🔍 설계 검토 AI
            </h1>
            {isStreaming && (
              <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full animate-pulse font-medium">
                응답 중...
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* 새 세션 버튼 */}
          {onNewSession && messages.length > 0 && (
            <button
              onClick={onNewSession}
              className="text-[11px] px-2 py-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="새 세션 시작 (대화 초기화)"
            >
              🔄 새 세션
            </button>
          )}
          {/* 법령 패널 토글 */}
          <button
            onClick={onToggleLawPanel}
            className={`text-xs px-2 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
              lawPanelCollapsed
                ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
            title={lawPanelCollapsed ? '참고 문서 펼치기' : '참고 문서 접기'}
          >
            <span className="hidden sm:inline">{lawPanelCollapsed ? '참고' : '참고'}</span>
            <span className="text-sm">📚</span>
          </button>
        </div>
      </div>

      {/* 메시지 목록 */}
      <div className={`flex-1 ${messages.length === 0 ? 'overflow-y-auto custom-scrollbar' : 'overflow-hidden'}`}>
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-lg px-6">
              <div className="text-5xl mb-4">🔍</div>
              <h2 className="text-lg font-semibold text-slate-700 mb-2">
                상하수도 설계 검토를 시작하세요
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                설계문서를 업로드하고, 아래 버튼을 눌러 바로 시작할 수 있습니다.
              </p>

              {/* 빠른 시작 액션 버튼 (#1) */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <button
                  onClick={() => {
                    if (filePanelCollapsed) onToggleFilePanel();
                    onTriggerUpload?.();
                  }}
                  className="flex flex-col items-center gap-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl px-4 py-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="text-2xl">📄</span>
                  <span className="text-xs font-semibold text-blue-700">문서 업로드</span>
                  <span className="text-[10px] text-blue-500">PDF·DOCX·XLSX·DXF</span>
                </button>
                <button
                  onClick={() => readyFileCount > 0 ? onSendMessage('검토 시작') : undefined}
                  disabled={readyFileCount === 0}
                  className={`flex flex-col items-center gap-2 rounded-xl px-4 py-4 transition-all border
                    ${readyFileCount > 0
                      ? 'bg-green-50 hover:bg-green-100 border-green-200 hover:scale-[1.02] active:scale-[0.98]'
                      : 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                    }`}
                >
                  <span className="text-2xl">🔍</span>
                  <span className={`text-xs font-semibold ${readyFileCount > 0 ? 'text-green-700' : 'text-slate-400'}`}>검토 시작</span>
                  <span className={`text-[10px] ${readyFileCount > 0 ? 'text-green-500' : 'text-slate-400'}`}>
                    {readyFileCount > 0 ? `${readyFileCount}개 파일 준비됨` : '파일 업로드 필요'}
                  </span>
                </button>
                <button
                  onClick={() => onSendMessage('무엇을 할 수 있나요?')}
                  className="flex flex-col items-center gap-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl px-4 py-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="text-2xl">💬</span>
                  <span className="text-xs font-semibold text-purple-700">질문하기</span>
                  <span className="text-[10px] text-purple-500">자유롭게 질문</span>
                </button>
              </div>

              {/* 단계 안내 */}
              <div className="grid grid-cols-3 gap-2 text-left mb-6">
                {[
                  { step: '1', title: '문서 업로드', desc: '설계설명서, 수리계산서, 도면 등' },
                  { step: '2', title: '검토 요청', desc: '"검토 시작" 또는 구체적 질문' },
                  { step: '3', title: '결과 확인', desc: '적합/부적합 판정 + 근거' },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-2 bg-slate-50 rounded-lg px-3 py-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center mt-0.5">{item.step}</span>
                    <div>
                      <p className="text-xs font-medium text-slate-700">{item.title}</p>
                      <p className="text-[10px] text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* 검토 이력 */}
              <ReviewHistory onSelectHistory={(id) => onSendMessage(`이력 조회: ${id}`)} />
            </div>
          </div>
        ) : (
          <MessageList messages={messages} isStreaming={isStreaming} />
        )}
      </div>

      {/* 입력 영역 */}
      <ChatInput onSend={onSendMessage} isStreaming={isStreaming} hasReadyFiles={readyFileCount > 0} />
    </main>
  );
}
