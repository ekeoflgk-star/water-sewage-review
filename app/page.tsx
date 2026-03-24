'use client';

import { useState, useCallback, useRef } from 'react';
import { FilePanel } from '@/components/layout/FilePanel';
import { ChatPanel } from '@/components/layout/ChatPanel';
import { LawPanel } from '@/components/layout/LawPanel';
import { useToast } from '@/components/ui/Toast';
import type { UploadedFile, ChatMessage, ReviewCard, PermitCard } from '@/types';

export default function Home() {
  // 파일 상태
  const [files, setFiles] = useState<UploadedFile[]>([]);

  // 채팅 상태
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // 검토 상태
  const [isReviewing, setIsReviewing] = useState(false);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

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

  /** "검토 시작" 키워드 감지 */
  const isReviewCommand = (text: string) => {
    const keywords = ['검토 시작', '검토시작', '설계 검토', '설계검토', '자동 검토', '자동검토'];
    return keywords.some((kw) => text.includes(kw));
  };

  /** 설계 검토 핸들러 — /api/review 호출 */
  const handleReview = useCallback(async () => {
    const readyFiles = files.filter((f) => f.status === 'ready' && f.content);

    if (readyFiles.length === 0) {
      addToast('warning', '검토할 파일이 없습니다. 파일을 먼저 업로드하세요.');
      return;
    }

    setIsReviewing(true);

    // 진행 중 메시지
    const progressMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `📋 업로드된 ${readyFiles.length}개 파일을 기반으로 설계 검토를 시작합니다...\n\n검토 항목: 유속, 관경, 토피, 경사, 충만도 등`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, progressMessage]);

    try {
      // 파일별 검토 결과 수집
      const allReviewCards: ReviewCard[] = [];
      const allPermitCards: PermitCard[] = [];

      for (const file of readyFiles) {
        const response = await fetch('/api/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileContent: file.content,
            fileName: file.name,
            fileGroup: file.group,
            sessionId: sessionIdRef.current,
            reviewScope: 'sewer-pipeline',
          }),
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => null);
          throw new Error(errBody?.error || `검토 API 오류: ${response.status}`);
        }

        const data = await response.json();
        if (data.reviewCards) allReviewCards.push(...data.reviewCards);
        if (data.permitCards) allPermitCards.push(...data.permitCards);
      }

      // 검토 결과 메시지 (카드 포함)
      const passCount = allReviewCards.filter((c) => c.verdict === 'pass').length;
      const failCount = allReviewCards.filter((c) => c.verdict === 'fail').length;
      const checkCount = allReviewCards.filter((c) => c.verdict === 'check').length;

      const resultMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `## 설계 검토 완료\n\n총 **${allReviewCards.length}개** 항목 검토 | 🟢 적합 ${passCount} | 🔴 부적합 ${failCount} | 🟡 확인필요 ${checkCount}\n\n인허가 판단: **${allPermitCards.length}개** 항목 확인\n\n---\n\n추가 질문이 있으시면 입력하세요.`,
        timestamp: new Date(),
        reviewCards: allReviewCards,
        permitCards: allPermitCards,
      };

      // 진행 메시지를 결과로 교체
      setMessages((prev) =>
        prev.map((m) =>
          m.id === progressMessage.id ? resultMessage : m
        )
      );

      addToast('success', `검토 완료: ${allReviewCards.length}개 항목`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '검토 중 오류 발생';
      addToast('error', errMsg);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === progressMessage.id
            ? { ...m, content: `❌ 검토 실패: ${errMsg}` }
            : m
        )
      );
    } finally {
      setIsReviewing(false);
    }
  }, [files, addToast]);

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

    // "검토 시작" 키워드 감지 → 검토 모드
    if (isReviewCommand(content)) {
      await handleReview();
      return;
    }

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
  }, [files, messages, addToast, handleReview]);

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
        isStreaming={isStreaming || isReviewing}
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
