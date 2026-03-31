'use client';

import { useEffect, useRef, memo, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ReviewCard } from '@/components/chat/ReviewCard';
import { PermitCard } from '@/components/chat/PermitCard';
import { PermitChecklist } from '@/components/chat/PermitChecklist';
import { PermitGuide } from '@/components/chat/PermitGuide';
import { ReportButton } from '@/components/chat/ReportButton';
import { DxfAnalysisCard } from '@/components/chat/DxfAnalysisCard';
import { ReviewOpinionTable } from '@/components/chat/ReviewOpinionTable';
import { DocumentCompare } from '@/components/chat/DocumentCompare';
import type { ChatMessage, ReferenceAnnotation } from '@/types';

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
}

/** AI 응답용 마크다운 렌더러 */
const MarkdownContent = memo(function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="bg-slate-200/60 text-slate-800 px-1.5 py-0.5 rounded text-[13px] font-mono" {...props}>
                {children}
              </code>
            );
          }
          const lang = className?.replace('language-', '') || '';
          return (
            <div className="my-2 rounded-lg overflow-hidden border border-slate-200">
              {lang && (
                <div className="bg-slate-200 px-3 py-1 text-xs text-slate-600 font-mono">
                  {lang}
                </div>
              )}
              <pre className="bg-slate-50 p-3 overflow-x-auto">
                <code className="text-[13px] font-mono leading-relaxed" {...props}>
                  {children}
                </code>
              </pre>
            </div>
          );
        },
        table({ children }) {
          return (
            <div className="my-2 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          );
        },
        thead({ children }) { return <thead className="bg-slate-100">{children}</thead>; },
        th({ children }) { return <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">{children}</th>; },
        td({ children }) { return <td className="px-3 py-1.5 border-b border-slate-100 text-slate-600">{children}</td>; },
        tr({ children }) { return <tr className="hover:bg-slate-50/50 transition-colors">{children}</tr>; },
        ul({ children }) { return <ul className="list-disc ml-5 my-1.5 space-y-0.5">{children}</ul>; },
        ol({ children }) { return <ol className="list-decimal ml-5 my-1.5 space-y-0.5">{children}</ol>; },
        li({ children }) { return <li className="text-slate-700 leading-relaxed">{children}</li>; },
        h1({ children }) { return <h1 className="text-base font-bold mt-3 mb-1.5 text-slate-800 border-b border-slate-200 pb-1">{children}</h1>; },
        h2({ children }) { return <h2 className="text-sm font-bold mt-3 mb-1 text-slate-800">{children}</h2>; },
        h3({ children }) { return <h3 className="text-sm font-semibold mt-2 mb-1 text-slate-700">{children}</h3>; },
        a({ href, children }) {
          return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{children}</a>;
        },
        strong({ children }) { return <strong className="font-semibold text-slate-900">{children}</strong>; },
        blockquote({ children }) {
          return <blockquote className="border-l-[3px] border-blue-300 pl-3 my-2 text-slate-600 italic bg-blue-50/30 py-1 rounded-r">{children}</blockquote>;
        },
        hr() { return <hr className="my-3 border-slate-200" />; },
        p({ children }) { return <p className="my-1 leading-relaxed">{children}</p>; },
      }}
    >
      {content}
    </ReactMarkdown>
  );
});

/** 검토 카드 요약 배지 */
function ReviewSummaryBadge({ cards }: { cards: NonNullable<ChatMessage['reviewCards']> }) {
  const passCount = cards.filter(c => c.verdict === 'pass').length;
  const failCount = cards.filter(c => c.verdict === 'fail').length;
  const checkCount = cards.filter(c => c.verdict === 'check').length;

  return (
    <div className="flex items-center gap-3 text-xs">
      {passCount > 0 && (
        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
          <span>🟢</span> 적합 {passCount}
        </span>
      )}
      {failCount > 0 && (
        <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
          <span>🔴</span> 부적합 {failCount}
        </span>
      )}
      {checkCount > 0 && (
        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
          <span>🟡</span> 확인필요 {checkCount}
        </span>
      )}
    </div>
  );
}

/** 검토 카드 필터 탭 (#5) */
type ReviewFilter = 'all' | 'fail' | 'check' | 'pass';

function ReviewFilterTabs({
  cards,
  filter,
  onFilterChange,
}: {
  cards: NonNullable<ChatMessage['reviewCards']>;
  filter: ReviewFilter;
  onFilterChange: (f: ReviewFilter) => void;
}) {
  const counts = {
    all: cards.length,
    fail: cards.filter(c => c.verdict === 'fail').length,
    check: cards.filter(c => c.verdict === 'check').length,
    pass: cards.filter(c => c.verdict === 'pass').length,
  };

  const tabs: { key: ReviewFilter; label: string; color: string; activeColor: string }[] = [
    { key: 'all', label: '전체', color: 'text-slate-500 hover:bg-slate-100', activeColor: 'bg-slate-600 text-white' },
    { key: 'fail', label: '부적합', color: 'text-red-500 hover:bg-red-50', activeColor: 'bg-red-500 text-white' },
    { key: 'check', label: '확인필요', color: 'text-amber-500 hover:bg-amber-50', activeColor: 'bg-amber-500 text-white' },
    { key: 'pass', label: '적합', color: 'text-green-500 hover:bg-green-50', activeColor: 'bg-green-500 text-white' },
  ];

  return (
    <div className="flex gap-1 mb-2">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onFilterChange(tab.key)}
          className={`text-[11px] px-2 py-0.5 rounded-full transition-all font-medium
            ${filter === tab.key ? tab.activeColor : tab.color}
          `}
        >
          {tab.label} {counts[tab.key] > 0 && <span className="ml-0.5">({counts[tab.key]})</span>}
        </button>
      ))}
    </div>
  );
}

const MessageBubble = memo(function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // 근거 비교 모달 상태
  const [compareRefs, setCompareRefs] = useState<ReferenceAnnotation[] | null>(null);
  // DOCX 내보내기 상태
  const [isExporting, setIsExporting] = useState(false);
  // 검토 결과 필터 (#5)
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');

  /** DOCX 내보내기 핸들러 */
  const handleExportDocx = useCallback(async () => {
    if (!message.reviewCards && !message.permitCards) return;
    setIsExporting(true);
    try {
      const response = await fetch('/api/export-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewCards: message.reviewCards || [],
          permitCards: message.permitCards || [],
          projectName: '',
          date: new Date().toISOString().slice(0, 10),
        }),
      });

      if (!response.ok) throw new Error('DOCX 생성 실패');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `검토의견서_${new Date().toISOString().slice(0, 10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('DOCX 내보내기 오류:', error);
      alert('파일 생성 중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  }, [message.reviewCards, message.permitCards]);

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg max-w-md flex items-center gap-2 border border-red-100">
          <span>⚠️</span>
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  const hasReviewCards = message.reviewCards && message.reviewCards.length > 0;
  const hasPermitCards = message.permitCards && message.permitCards.length > 0;
  const hasDxfAnalysis = !!message.dxfAnalysis;
  const hasCards = hasReviewCards || hasPermitCards || hasDxfAnalysis;

  return (
    <>
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 group`}>
        {!isUser && (
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs flex-shrink-0 mr-2 mt-0.5">
            🔍
          </div>
        )}
        <div className="flex flex-col max-w-[85%]">
          <div
            className={`
              rounded-2xl px-4 py-2.5 text-sm leading-relaxed
              ${isUser
                ? 'bg-blue-600 text-white rounded-br-md'
                : 'bg-slate-100 text-slate-800 rounded-bl-md'
              }
            `}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="chat-markdown">
                <MarkdownContent content={message.content} />
              </div>
            )}

          {hasCards && <div className="border-t border-slate-200/80 mt-3 pt-3" />}

          {/* 설계 검토 카드 (#5 — 필터 탭 적용) */}
          {hasReviewCards && (() => {
            const filteredCards = reviewFilter === 'all'
              ? message.reviewCards!
              : message.reviewCards!.filter(c => c.verdict === reviewFilter);
            return (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <span>🔍</span>
                    <span>설계 검토 결과 — {message.reviewCards!.length}개 항목</span>
                  </div>
                  <ReviewSummaryBadge cards={message.reviewCards!} />
                </div>
                <ReviewFilterTabs
                  cards={message.reviewCards!}
                  filter={reviewFilter}
                  onFilterChange={setReviewFilter}
                />
                <div className="space-y-1.5">
                  {filteredCards.map((card) => (
                    <ReviewCard
                      key={card.id}
                      card={card}
                      onCompare={(refs) => setCompareRefs(refs)}
                    />
                  ))}
                  {filteredCards.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-3">
                      해당 판정 결과가 없습니다.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 인허가 카드 */}
          {hasPermitCards && (
            <div className={hasReviewCards ? 'mt-3' : ''}>
              <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                <span>⚖️</span>
                <span>인허가 판단 결과 — {message.permitCards!.length}개 항목</span>
              </div>
              <div className="space-y-1.5">
                {message.permitCards!.map((card) => (
                  <PermitCard key={card.id} card={card} />
                ))}
              </div>
              <PermitChecklist permitCards={message.permitCards!} />
              <PermitGuide
                permitCards={message.permitCards!}
                dxfPermits={message.dxfAnalysis?.permits}
              />
            </div>
          )}

          {/* DXF 인허가 분석 결과 */}
          {hasDxfAnalysis && (
            <DxfAnalysisCard result={message.dxfAnalysis!} />
          )}

          {/* 검토의견서 양식 테이블 — 검토 카드가 있으면 표시 */}
          {(hasReviewCards || hasPermitCards) && (
            <ReviewOpinionTable
              reviewCards={message.reviewCards || []}
              permitCards={message.permitCards || []}
              onExportDocx={handleExportDocx}
              isExporting={isExporting}
            />
          )}

          {/* 검토 보고서 PDF 다운로드 버튼 */}
          {(hasReviewCards || hasPermitCards) && (
            <ReportButton
              reviewCards={message.reviewCards || []}
              permitCards={message.permitCards || []}
            />
          )}
          </div>
          {/* 메시지 시간 표시 (호버 시 표시) */}
          <span className={`text-[10px] text-slate-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'text-right' : 'text-left'}`}>
            {message.timestamp instanceof Date
              ? message.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
              : ''}
          </span>
        </div>
      </div>

      {/* 근거 비교 모달 */}
      {compareRefs && (
        <DocumentCompare
          references={compareRefs}
          onClose={() => setCompareRefs(null)}
        />
      )}
    </>
  );
});

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // 자동 스크롤 (새 메시지 / 스트리밍 시)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 스크롤 위치 감지 — 하단에서 멀면 스크롤 버튼 표시
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 200);
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div ref={containerRef} onScroll={handleScroll} className="relative h-full overflow-y-auto custom-scrollbar">
      <div className="px-4 py-4 max-w-3xl mx-auto">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isStreaming && (
          <div className="flex justify-start mb-4">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs flex-shrink-0 mr-2 mt-0.5">
              🔍
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5 items-center">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                <span className="text-[11px] text-slate-400 ml-2">분석 중...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 하단 스크롤 버튼 */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 w-9 h-9 bg-white border border-slate-200 rounded-full shadow-lg flex items-center justify-center hover:bg-blue-50 hover:border-blue-300 transition-all z-10"
          title="최신 메시지로 스크롤"
        >
          <span className="text-sm">↓</span>
        </button>
      )}
    </div>
  );
}
