'use client';

import { useEffect, useRef, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ReviewCard } from '@/components/chat/ReviewCard';
import { PermitCard } from '@/components/chat/PermitCard';
import { PermitChecklist } from '@/components/chat/PermitChecklist';
import { ReportButton } from '@/components/chat/ReportButton';
import type { ChatMessage } from '@/types';

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
        // 코드블록
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
        // 테이블
        table({ children }) {
          return (
            <div className="my-2 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          );
        },
        thead({ children }) {
          return <thead className="bg-slate-100">{children}</thead>;
        },
        th({ children }) {
          return <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">{children}</th>;
        },
        td({ children }) {
          return <td className="px-3 py-1.5 border-b border-slate-100 text-slate-600">{children}</td>;
        },
        tr({ children }) {
          return <tr className="hover:bg-slate-50/50 transition-colors">{children}</tr>;
        },
        // 리스트
        ul({ children }) {
          return <ul className="list-disc ml-5 my-1.5 space-y-0.5">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal ml-5 my-1.5 space-y-0.5">{children}</ol>;
        },
        li({ children }) {
          return <li className="text-slate-700 leading-relaxed">{children}</li>;
        },
        // 제목
        h1({ children }) {
          return <h1 className="text-base font-bold mt-3 mb-1.5 text-slate-800 border-b border-slate-200 pb-1">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="text-sm font-bold mt-3 mb-1 text-slate-800">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="text-sm font-semibold mt-2 mb-1 text-slate-700">{children}</h3>;
        },
        // 링크
        a({ href, children }) {
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              {children}
            </a>
          );
        },
        // 강조
        strong({ children }) {
          return <strong className="font-semibold text-slate-900">{children}</strong>;
        },
        // 인용
        blockquote({ children }) {
          return (
            <blockquote className="border-l-[3px] border-blue-300 pl-3 my-2 text-slate-600 italic bg-blue-50/30 py-1 rounded-r">
              {children}
            </blockquote>
          );
        },
        // 구분선
        hr() {
          return <hr className="my-3 border-slate-200" />;
        },
        // 단락
        p({ children }) {
          return <p className="my-1 leading-relaxed">{children}</p>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
});

/** 검토 카드 요약 배지 — 판정별 개수 표시 */
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

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

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
  const hasCards = hasReviewCards || hasPermitCards;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {/* AI 아바타 */}
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs flex-shrink-0 mr-2 mt-0.5">
          🔍
        </div>
      )}
      <div
        className={`
          max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
          ${
            isUser
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

        {/* 카드 섹션 구분선 */}
        {hasCards && (
          <div className="border-t border-slate-200/80 mt-3 pt-3" />
        )}

        {/* 설계 검토 카드 */}
        {hasReviewCards && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <span>🔍</span>
                <span>설계 검토 결과 — {message.reviewCards!.length}개 항목</span>
              </div>
              <ReviewSummaryBadge cards={message.reviewCards!} />
            </div>
            <div className="space-y-1.5">
              {message.reviewCards!.map((card) => (
                <ReviewCard key={card.id} card={card} />
              ))}
            </div>
          </div>
        )}

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

            {/* 인허가 원스톱 체크리스트 */}
            <PermitChecklist permitCards={message.permitCards!} />
          </div>
        )}

        {/* 검토 보고서 다운로드 버튼 — 검토 카드가 있는 메시지에 표시 */}
        {hasCards && (
          <ReportButton
            reviewCards={message.reviewCards || []}
            permitCards={message.permitCards || []}
          />
        )}
      </div>
    </div>
  );
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 새 메시지가 추가되면 스크롤 하단으로
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="px-4 py-4 max-w-3xl mx-auto">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* 스트리밍 중 표시 */}
      {isStreaming && (
        <div className="flex justify-start mb-4">
          <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.1s]" />
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
