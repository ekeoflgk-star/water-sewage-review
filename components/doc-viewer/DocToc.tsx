'use client';

import { useState, useEffect, useRef } from 'react';
import { DocEntry, TocItem } from '@/lib/docs/types';

interface DocTocProps {
  documents: DocEntry[];
  activeDocId: string | null;
  activeTocId: string | null;
  onSelectDoc: (docId: string) => void;
  onSelectTocPage: (page: number) => void;
}

// 분야별 색상
const FIELD_COLORS: Record<string, { dot: string; text: string; bg: string }> = {
  '상수도': { dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50' },
  '하수도': { dot: 'bg-teal-500', text: 'text-teal-700', bg: 'bg-teal-50' },
  '공통': { dot: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-50' },
};

export function DocToc({ documents, activeDocId, activeTocId, onSelectDoc, onSelectTocPage }: DocTocProps) {
  // 펼쳐진 분야 (기본: 현재 선택된 문서의 분야)
  const activeDoc = documents.find(d => d.id === activeDocId);
  const [expandedField, setExpandedField] = useState<string | null>(activeDoc?.field || null);
  // 펼쳐진 TOC level-1 항목
  const [expandedTocIds, setExpandedTocIds] = useState<Set<string>>(new Set());
  const activeTocRef = useRef<HTMLButtonElement>(null);

  // 활성 문서 변경 시 해당 분야 펼치기
  useEffect(() => {
    if (activeDoc) {
      setExpandedField(activeDoc.field);
    }
  }, [activeDoc]);

  // activeTocId 변경 시 해당 부모 펼치기 + 스크롤
  useEffect(() => {
    if (!activeTocId || !activeDoc) return;
    // 부모 TOC 찾아서 펼치기
    for (const item of activeDoc.toc) {
      if (item.id === activeTocId) {
        setExpandedTocIds(prev => new Set(prev).add(item.id));
        break;
      }
      if (item.children?.some(c => c.id === activeTocId)) {
        setExpandedTocIds(prev => new Set(prev).add(item.id));
        break;
      }
    }
    // 활성 항목으로 스크롤
    setTimeout(() => {
      activeTocRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }, [activeTocId, activeDoc]);

  const toggleTocExpand = (id: string) => {
    setExpandedTocIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // 분야별 그룹핑
  const fields = ['상수도', '하수도', '공통'] as const;
  const docsByField = Object.fromEntries(
    fields.map(f => [f, documents.filter(d => d.field === f)])
  );

  return (
    <div className="text-sm">
      {/* ── 영역 1: 문서 선택 ── */}
      <div className="px-3 pt-3 pb-2 border-b border-slate-200">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">문서 선택</p>
        {fields.map(field => {
          const docs = docsByField[field];
          if (!docs || docs.length === 0) return null;
          const c = FIELD_COLORS[field] || FIELD_COLORS['공통'];
          const isExpanded = expandedField === field;
          return (
            <div key={field} className="mb-1">
              <button
                onClick={() => setExpandedField(isExpanded ? null : field)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs font-semibold transition-colors ${
                  isExpanded ? `${c.bg} ${c.text}` : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                {isExpanded ? '▼' : '▶'} {field}
                <span className="text-[10px] text-slate-400 ml-auto">{docs.length}</span>
              </button>
              {isExpanded && (
                <div className="ml-4 mt-0.5 space-y-0.5">
                  {docs.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => onSelectDoc(doc.id)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                        doc.id === activeDocId
                          ? 'bg-blue-100 text-blue-800 font-bold'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="font-mono text-[10px] text-slate-400 mr-1">{doc.code.replace('KDS ', '').replace(/ 00$/, '')}</span>
                      {doc.shortTitle}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 영역 2: 선택 문서 목차 ── */}
      {activeDoc && (
        <div className="px-3 pt-2 pb-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            목차 — {activeDoc.shortTitle}
          </p>
          <div className="space-y-0.5">
            {activeDoc.toc.map(item => (
              <TocNode
                key={item.id}
                item={item}
                activeTocId={activeTocId}
                expandedTocIds={expandedTocIds}
                onToggleExpand={toggleTocExpand}
                onSelectPage={onSelectTocPage}
                activeTocRef={activeTocRef}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** 재귀적 TOC 노드 렌더링 */
function TocNode({
  item,
  activeTocId,
  expandedTocIds,
  onToggleExpand,
  onSelectPage,
  activeTocRef,
  depth = 0,
}: {
  item: TocItem;
  activeTocId: string | null;
  expandedTocIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelectPage: (page: number) => void;
  activeTocRef: React.RefObject<HTMLButtonElement>;
  depth?: number;
}) {
  const isActive = item.id === activeTocId;
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedTocIds.has(item.id);

  const paddingLeft = item.level === 1 ? 4 : item.level === 2 ? 20 : 36;

  return (
    <>
      <button
        ref={isActive ? activeTocRef : undefined}
        onClick={() => {
          onSelectPage(item.page);
          if (hasChildren) onToggleExpand(item.id);
        }}
        className={`w-full text-left py-1.5 rounded transition-colors flex items-center gap-1 ${
          isActive
            ? 'bg-blue-50 text-blue-700 font-bold border-l-[3px] border-blue-500'
            : 'text-slate-600 hover:bg-slate-100 border-l-[3px] border-transparent'
        }`}
        style={{ paddingLeft: `${paddingLeft}px`, paddingRight: '8px' }}
      >
        {/* 토글 아이콘 */}
        {hasChildren && (
          <span className="text-[10px] text-slate-400 shrink-0 w-3">
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
        {!hasChildren && <span className="w-3" />}

        {/* 제목 */}
        <span className={`flex-1 truncate ${item.level === 1 ? 'text-xs font-bold' : 'text-[11px]'}`}>
          {item.title}
        </span>

        {/* 페이지 번호 */}
        <span className="text-[10px] text-slate-400 shrink-0 ml-1">
          {item.page}
        </span>
      </button>

      {/* 자식 항목 */}
      {hasChildren && isExpanded && (
        <div>
          {item.children!.map(child => (
            <TocNode
              key={child.id}
              item={child}
              activeTocId={activeTocId}
              expandedTocIds={expandedTocIds}
              onToggleExpand={onToggleExpand}
              onSelectPage={onSelectPage}
              activeTocRef={activeTocRef}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </>
  );
}
