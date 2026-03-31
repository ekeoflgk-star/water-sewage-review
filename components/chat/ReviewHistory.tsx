'use client';

import { useState, useCallback, useEffect } from 'react';

/** 이력 목록 아이템 (경량) */
interface HistoryItem {
  id: string;
  file_name: string;
  file_size: number | null;
  total_items: number;
  pass_count: number;
  fail_count: number;
  check_count: number;
  total_permits: number;
  required_permits: number;
  memo: string | null;
  created_at: string;
}

interface ReviewHistoryProps {
  /** 이력 선택 시 상세 데이터를 채팅에 표시 */
  onSelectHistory?: (historyId: string) => void;
}

export function ReviewHistory({ onSelectHistory }: ReviewHistoryProps) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // 이력 목록 조회
  const fetchHistory = useCallback(async (p: number = 1) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/history?page=${p}&limit=10`);
      if (!res.ok) throw new Error('조회 실패');
      const data = await res.json();
      setItems(data.items || []);
      setTotalCount(data.totalCount || 0);
      setPage(p);
    } catch {
      console.error('이력 조회 실패');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 패널 열 때 자동 조회
  useEffect(() => {
    if (isOpen) fetchHistory(1);
  }, [isOpen, fetchHistory]);

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // 파일 크기 포맷
  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('이 검토 이력을 삭제하시겠습니까?')) return;
    try {
      await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
      fetchHistory(page);
    } catch {
      alert('삭제 실패');
    }
  };

  const totalPages = Math.ceil(totalCount / 10);

  return (
    <div className="mb-3">
      {/* 토글 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-50
                   border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors w-full"
      >
        <span>{isOpen ? '▼' : '▶'}</span>
        <span>검토 이력</span>
        {totalCount > 0 && (
          <span className="ml-auto px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded-full">
            {totalCount}건
          </span>
        )}
      </button>

      {/* 이력 패널 */}
      {isOpen && (
        <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden bg-white">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="ml-2 text-xs text-slate-500">조회 중...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              검토 이력이 없습니다. 문서를 업로드하고 &quot;검토 시작&quot;을 입력하세요.
            </div>
          ) : (
            <>
              {/* 이력 목록 */}
              <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {items.map((item) => (
                  <li key={item.id} className="px-3 py-2.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      {/* 파일명 + 날짜 */}
                      <button
                        onClick={() => onSelectHistory?.(item.id)}
                        className="text-left flex-1 min-w-0"
                      >
                        <p className="text-xs font-medium text-slate-800 truncate">
                          {item.file_name}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {formatDate(item.created_at)}
                          {item.file_size ? ` · ${formatSize(item.file_size)}` : ''}
                        </p>
                      </button>

                      {/* 삭제 버튼 */}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="shrink-0 text-[10px] text-slate-300 hover:text-red-500 transition-colors p-1"
                        title="삭제"
                      >
                        ✕
                      </button>
                    </div>

                    {/* 결과 배지 */}
                    <div className="flex gap-1.5 mt-1.5">
                      {item.pass_count > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-green-100 text-green-700 rounded">
                          적합 {item.pass_count}
                        </span>
                      )}
                      {item.fail_count > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-red-100 text-red-700 rounded">
                          부적합 {item.fail_count}
                        </span>
                      )}
                      {item.check_count > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded">
                          확인 {item.check_count}
                        </span>
                      )}
                      {item.required_permits > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded">
                          인허가 {item.required_permits}종
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 py-2 border-t border-slate-100">
                  <button
                    disabled={page <= 1}
                    onClick={() => fetchHistory(page - 1)}
                    className="px-2 py-1 text-[10px] text-slate-600 border border-slate-200 rounded
                               hover:bg-slate-50 disabled:opacity-40"
                  >
                    이전
                  </button>
                  <span className="text-[10px] text-slate-500">
                    {page} / {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => fetchHistory(page + 1)}
                    className="px-2 py-1 text-[10px] text-slate-600 border border-slate-200 rounded
                               hover:bg-slate-50 disabled:opacity-40"
                  >
                    다음
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
