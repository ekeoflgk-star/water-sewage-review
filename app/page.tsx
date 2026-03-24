'use client';

import { useState, useCallback } from 'react';
import { FilePanel } from '@/components/layout/FilePanel';
import { ChatPanel } from '@/components/layout/ChatPanel';
import { LawPanel } from '@/components/layout/LawPanel';
import { useToast } from '@/components/ui/Toast';
import type { UploadedFile, ChatMessage } from '@/types';

export default function Home() {
  // 파일 상태
  const [files, setFiles] = useState<UploadedFile[]>([]);

  // 채팅 상태
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // 패널 표시 상태
  const [showLawPanel, setShowLawPanel] = useState(true);
  const [showFilePanel, setShowFilePanel] = useState(true);

  const { addToast } = useToast();

  /** 파일 업로드 핸들러 */
  const handleFilesAdded = useCallback((newFiles: UploadedFile[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  /** 파일 삭제 핸들러 */
  const handleFileRemove = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  /** 파일 그룹 변경 핸들러 */
  const handleGroupChange = useCallback((fileId: string, group: UploadedFile['group']) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, group } : f))
    );
  }, []);

  /** 채팅 메시지 전송 핸들러 */
  const handleSendMessage = useCallback(async (content: string) => {
    // 사용자 메시지 추가
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);

    try {
      // 업로드된 파일들의 내용을 컨텍스트에 포함
      const fileContexts = files
        .filter((f) => f.status === 'ready' && f.content)
        .map((f) => `[파일: ${f.name}]\n${f.content}`)
        .join('\n\n---\n\n');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          fileContext: fileContexts || undefined,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        const errMsg = errBody?.error || `API 오류: ${response.status}`;

        // 429 에러 시 토스트로도 표시
        if (response.status === 429) {
          addToast('warning', '무료 사용량 한도 도달 — 잠시 후 다시 시도하세요');
        }

        throw new Error(errMsg);
      }

      // 스트리밍 응답 처리
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          assistantContent += chunk;

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, content: assistantContent }
                : m
            )
          );
        }
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'system',
        content: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsStreaming(false);
    }
  }, [files, messages, addToast]);

  return (
    <div className="h-screen flex overflow-hidden bg-white">
      {/* 좌측 — 파일관리 패널 (반응형: 모바일에서 숨김 가능) */}
      {showFilePanel && (
        <FilePanel
          files={files}
          onFilesAdded={handleFilesAdded}
          onFileRemove={handleFileRemove}
          onGroupChange={handleGroupChange}
        />
      )}

      {/* 중앙 — 채팅 영역 */}
      <ChatPanel
        messages={messages}
        isStreaming={isStreaming}
        onSendMessage={handleSendMessage}
        onToggleLawPanel={() => setShowLawPanel(!showLawPanel)}
        onToggleFilePanel={() => setShowFilePanel(!showFilePanel)}
        showFilePanel={showFilePanel}
        showLawPanel={showLawPanel}
        fileCount={files.length}
        readyFileCount={files.filter((f) => f.status === 'ready').length}
      />

      {/* 우측 — 법령참조 패널 */}
      {showLawPanel && <LawPanel />}
    </div>
  );
}
