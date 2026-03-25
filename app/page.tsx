'use client';

import { useState, useCallback, useRef } from 'react';
import { FilePanel } from '@/components/layout/FilePanel';
import { ChatPanel } from '@/components/layout/ChatPanel';
import { LawPanel } from '@/components/layout/LawPanel';
import { useToast } from '@/components/ui/Toast';
import type { UploadedFile, ChatMessage, ReviewCard, PermitCard } from '@/types';
import type { DxfAnalysisResult } from '@/types/dxf';

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

  /** "인허가 분석" 키워드 감지 */
  const isDxfAnalyzeCommand = (text: string) => {
    const keywords = ['인허가 분석', '인허가분석', 'DXF 분석', 'DXF분석', 'dxf 분석', '도면 분석', '도면분석'];
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

  /** DXF 인허가 분석 핸들러 */
  const handleDxfAnalyze = useCallback(async () => {
    const dxfFiles = files.filter((f) => f.type === 'dxf' && f.status === 'ready');

    if (dxfFiles.length === 0) {
      addToast('warning', 'DXF 파일이 없습니다. .dxf 파일을 먼저 업로드하세요.');
      return;
    }

    const progressMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `📐 DXF 파일 ${dxfFiles.length}개의 인허가 분석을 시작합니다...\n\n레이어 접두사: **$**(설계), **#**(인허가) 기반으로 분석합니다.`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, progressMessage]);
    setIsReviewing(true);

    try {
      // 원본 DXF 파일을 다시 업로드하여 분석 API 호출
      // (parse된 content가 아니라 원본 파일이 필요하므로 DropZone에서 원본을 보관하는 방식 대신
      //  사용자에게 재업로드 안내 또는 파일 참조 사용)
      // 현재는 parse된 텍스트 기반으로 간이 분석 수행

      // 파싱된 내용에서 레이어 정보 추출하여 간이 분석
      for (const dxfFile of dxfFiles) {
        const formData = new FormData();

        // content에서 레이어 정보가 있으면 직접 분석 API에 DXF 파일 전달
        // DropZone에서 File 객체를 보관하지 않으므로, 사용자에게 분석 전용 업로드 안내
        // 대안: parse API에서 이미 파싱한 결과를 활용

        const content = dxfFile.content || '';

        // DXF 요약 텍스트에서 레이어 정보 파싱
        const layerSection = content.split('[레이어 목록]')[1]?.split('[텍스트 내용]')[0] || '';
        const layerNames = layerSection.split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2).trim());

        const permitLayers = layerNames.filter(n => n.startsWith('#'));
        const designLayers = layerNames.filter(n => n.startsWith('$'));
        const cadastralLayers = layerNames.filter(n => n.includes('지적'));

        // 간이 인허가 매핑
        const PERMIT_MAP: Record<string, string> = {
          '#도로구역': '도로 점용 허가', '#하천구역': '하천 점용 허가',
          '#소하천구역': '소하천 점용 허가', '#영구점용선': '도로 점용 허가',
          '#일시점용선': '도로 점용 허가', '#농지': '농지 전용 허가',
          '#산지': '산지 전용 허가', '#철도보호지구': '철도 보호지구 행위허가',
          '#군사시설보호구역': '군사시설 보호구역 행위허가', '#문화재보호구역': '문화재 현상변경 허가',
        };

        const permits = permitLayers
          .filter(n => PERMIT_MAP[n])
          .map((n, i) => ({
            permitName: PERMIT_MAP[n],
            source: 'layer' as const,
            sourceDetail: `${n} 레이어 존재`,
            layerName: n,
          }));

        // 중복 제거
        const uniquePermits = Array.from(
          new Map(permits.map(p => [p.permitName, p])).values()
        );

        const dxfResult: DxfAnalysisResult = {
          fileName: dxfFile.name,
          layerSummary: {
            total: layerNames.length,
            design: designLayers.map(n => ({ name: n, role: 'design' as const, prefix: '$' as const, baseName: n.slice(1), entityCount: 0, hasPolylines: false, hasTexts: false })),
            permit: permitLayers.map(n => ({ name: n, role: 'permit' as const, prefix: '#' as const, baseName: n.slice(1), entityCount: 0, hasPolylines: false, hasTexts: false })),
            cadastral: cadastralLayers.map(n => ({ name: n, role: 'cadastral' as const, prefix: '' as const, baseName: n, entityCount: 0, hasPolylines: false, hasTexts: false })),
            general: layerNames.filter(n => !n.startsWith('$') && !n.startsWith('#') && !n.includes('지적')).map(n => ({ name: n, role: 'general' as const, prefix: '' as const, baseName: n, entityCount: 0, hasPolylines: false, hasTexts: false })),
          },
          parcels: [],
          permits: uniquePermits,
          warnings: cadastralLayers.length === 0
            ? ['지적 레이어가 없어 지목 기반 분석을 건너뛰었습니다.']
            : [],
          analyzedAt: new Date().toISOString(),
        };

        const resultMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `## DXF 인허가 분석 완료\n\n**${dxfFile.name}** — ${layerNames.length}개 레이어 | 설계($) ${designLayers.length} | 인허가(#) ${permitLayers.length}\n\n감지된 인허가: **${uniquePermits.length}건**`,
          timestamp: new Date(),
          dxfAnalysis: dxfResult,
        };

        setMessages((prev) =>
          prev.map((m) =>
            m.id === progressMessage.id ? resultMessage : m
          )
        );
      }

      addToast('success', 'DXF 인허가 분석 완료');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '분석 중 오류 발생';
      addToast('error', errMsg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === progressMessage.id
            ? { ...m, content: `❌ DXF 분석 실패: ${errMsg}` }
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

    // "인허가 분석" 키워드 감지 → DXF 분석 모드
    if (isDxfAnalyzeCommand(content)) {
      await handleDxfAnalyze();
      return;
    }

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
  }, [files, messages, addToast, handleReview, handleDxfAnalyze]);

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
