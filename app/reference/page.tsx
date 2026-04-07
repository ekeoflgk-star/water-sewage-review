'use client';

import { useState, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { LawNavigator } from '@/components/law/LawNavigator';
import { ReferenceChatPanel } from '@/components/chat/ReferenceChatPanel';
import { DocViewerModal } from '@/components/doc-viewer/DocViewerModal';

export default function ReferencePage() {
  const [currentContext, setCurrentContext] = useState('');

  // DocViewerModal 상태
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerDocId, setViewerDocId] = useState<string | null>(null);
  const [viewerPage, setViewerPage] = useState<number | undefined>();

  const handleContextChange = useCallback((ctx: string) => {
    setCurrentContext(ctx);
  }, []);

  // 설계기준 원문 열기 콜백
  const handleOpenDocViewer = useCallback((docId: string, page?: number) => {
    setViewerDocId(docId);
    setViewerPage(page);
    setViewerOpen(true);
  }, []);

  const handleCloseDocViewer = useCallback(() => {
    setViewerOpen(false);
  }, []);

  return (
    <div className="h-full overflow-hidden bg-white">
      <Group
        orientation="horizontal"
        style={{ width: '100%', height: '100%' }}
      >
        {/* 좌측 — 참고문서 탐색 (법령/시방서/설계기준) */}
        <Panel id="reference-panel" defaultSize="70%" minSize="40%">
          <div className="h-full flex flex-col overflow-hidden">
            <LawNavigator
              fullWidth
              onContextChange={handleContextChange}
              onOpenDocViewer={handleOpenDocViewer}
            />
          </div>
        </Panel>

        <Separator className="panel-resize-handle" />

        {/* 우측 — 법령·기준 해석 AI 챗봇 */}
        <Panel id="reference-chat-panel" defaultSize="30%" minSize="250px" maxSize="50%">
          <ReferenceChatPanel currentContext={currentContext} />
        </Panel>
      </Group>

      {/* 설계기준 원문 뷰어 모달 (전체화면) */}
      <DocViewerModal
        isOpen={viewerOpen}
        onClose={handleCloseDocViewer}
        initialDocId={viewerDocId}
        initialPage={viewerPage}
      />
    </div>
  );
}
