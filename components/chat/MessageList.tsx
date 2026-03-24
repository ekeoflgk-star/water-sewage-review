'use client';

import { useEffect, useRef, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
        // 리스트
        ul({ children }) {
          return <ul className="list-disc ml-5 my-1.5 space-y-0.5">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal ml-5 my-1.5 space-y-0.5">{children}</ol>;
        },
        // 제목
        h1({ children }) {
          return <h1 className="text-base font-bold mt-3 mb-1.5 text-slate-800">{children}</h1>;
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
            <blockquote className="border-l-3 border-blue-300 pl-3 my-2 text-slate-600 italic">
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

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg max-w-md flex items-center gap-2">
          <span>⚠️</span>
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

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
          max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
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
