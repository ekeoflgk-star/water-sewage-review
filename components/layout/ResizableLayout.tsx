'use client';

import { useCallback, useState } from 'react';
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels';
import { FilePanel } from '@/components/layout/FilePanel';
import { ChatPanel } from '@/components/layout/ChatPanel';
import { LawPanel } from '@/components/layout/LawPanel';
import type { UploadedFile, ChatMessage, Project, Session } from '@/types';

interface ResizableLayoutProps {
  files: UploadedFile[];
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendMessage: (content: string) => void;
  onFilesAdded: (files: UploadedFile[]) => void;
  onFileRemove: (fileId: string) => void;
  onGroupChange: (fileId: string, group: UploadedFile['group']) => void;
  onFileProgress: (fileId: string, progress: number) => void;
  onFileStatusChange: (fileId: string, status: UploadedFile['status'], content?: string, error?: string) => void;
  projects: Project[];
  activeProjectId: string | null;
  onCreateProject: (name: string, parentId?: string) => void;
  onSelectProject: (id: string | null) => void;
  onDeleteProject: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onMoveFileToProject: (fileId: string, projectId: string | null) => void;
  onNewSession?: () => void;
  // 세션 관리
  sessions: Session[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
}

export function ResizableLayout({
  files,
  messages,
  isStreaming,
  onSendMessage,
  onFilesAdded,
  onFileRemove,
  onGroupChange,
  onFileProgress,
  onFileStatusChange,
  projects,
  activeProjectId,
  onCreateProject,
  onSelectProject,
  onDeleteProject,
  onRenameProject,
  onMoveFileToProject,
  onNewSession,
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onRenameSession,
}: ResizableLayoutProps) {
  // 패널 접힘 상태 추적
  const [filePanelCollapsed, setFilePanelCollapsed] = useState(false);
  const [lawPanelCollapsed, setLawPanelCollapsed] = useState(false);
  const filePanelRef = usePanelRef();
  const lawPanelRef = usePanelRef();

  // 패널 토글 — collapse/expand
  const handleToggleFilePanel = useCallback(() => {
    if (filePanelCollapsed) {
      filePanelRef.current?.expand();
      setFilePanelCollapsed(false);
    } else {
      filePanelRef.current?.collapse();
      setFilePanelCollapsed(true);
    }
  }, [filePanelCollapsed, filePanelRef]);

  const handleToggleLawPanel = useCallback(() => {
    if (lawPanelCollapsed) {
      lawPanelRef.current?.expand();
      setLawPanelCollapsed(false);
    } else {
      lawPanelRef.current?.collapse();
      setLawPanelCollapsed(true);
    }
  }, [lawPanelCollapsed, lawPanelRef]);

  return (
    <div className="h-screen overflow-hidden bg-white">
      <Group
        orientation="horizontal"
        style={{ width: '100%', height: '100%' }}
      >
        {/* 좌측 — 파일관리 패널 */}
        <Panel
          id="file-panel"
          defaultSize="240px"
          minSize="180px"
          maxSize="400px"
          collapsible
          collapsedSize="0px"
          panelRef={filePanelRef}
          onResize={(size) => {
            const collapsed = size.inPixels === 0 || (filePanelRef.current?.isCollapsed() ?? false);
            setFilePanelCollapsed(collapsed);
          }}
        >
          <FilePanel
            files={files}
            onFilesAdded={onFilesAdded}
            onFileRemove={onFileRemove}
            onGroupChange={onGroupChange}
            onFileProgress={onFileProgress}
            onFileStatusChange={onFileStatusChange}
            projects={projects}
            activeProjectId={activeProjectId}
            onCreateProject={onCreateProject}
            onSelectProject={onSelectProject}
            onDeleteProject={onDeleteProject}
            onRenameProject={onRenameProject}
            onMoveFileToProject={onMoveFileToProject}
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={onSelectSession}
            onCreateSession={onCreateSession}
            onDeleteSession={onDeleteSession}
            onRenameSession={onRenameSession}
          />
        </Panel>
        <Separator className="panel-resize-handle" />

        {/* 중앙 — 채팅 영역 */}
        <Panel id="chat-panel" minSize="30%">
          <ChatPanel
            messages={messages}
            isStreaming={isStreaming}
            onSendMessage={onSendMessage}
            onToggleLawPanel={handleToggleLawPanel}
            onToggleFilePanel={handleToggleFilePanel}
            filePanelCollapsed={filePanelCollapsed}
            lawPanelCollapsed={lawPanelCollapsed}
            fileCount={files.length}
            readyFileCount={files.filter((f) => f.status === 'ready').length}
            onNewSession={onNewSession}
            onTriggerUpload={() => {
              // 파일 패널이 접혀있으면 펼치기
              if (filePanelCollapsed) {
                filePanelRef.current?.expand();
                setFilePanelCollapsed(false);
              }
            }}
          />
        </Panel>

        {/* 우측 — 참고 문서 패널 */}
        <Separator className="panel-resize-handle" />
        <Panel
          id="law-panel"
          defaultSize="280px"
          minSize="200px"
          maxSize="70%"
          collapsible
          collapsedSize="0px"
          panelRef={lawPanelRef}
          onResize={(size) => {
            const collapsed = size.inPixels === 0 || (lawPanelRef.current?.isCollapsed() ?? false);
            setLawPanelCollapsed(collapsed);
          }}
        >
          <LawPanel />
        </Panel>
      </Group>
    </div>
  );
}
