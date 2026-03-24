'use client';

import { useEffect, useState, useCallback, createContext, useContext } from 'react';

// 토스트 타입 정의
export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  exiting?: boolean;
}

interface ToastContextType {
  addToast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast는 ToastProvider 내부에서 사용해야 합니다.');
  return ctx;
}

// 토스트 아이콘 매핑
const TOAST_CONFIG: Record<ToastType, { icon: string; bg: string; border: string; text: string }> = {
  success: { icon: '✅', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800' },
  error:   { icon: '❌', bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-800' },
  warning: { icon: '⚠️', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800' },
  info:    { icon: 'ℹ️', bg: 'bg-blue-50',  border: 'border-blue-200',  text: 'text-blue-800' },
};

function ToastMessage({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const config = TOAST_CONFIG[item.type];

  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`
        ${item.exiting ? 'toast-exit' : 'toast-enter'}
        ${config.bg} ${config.border} ${config.text}
        border rounded-lg px-4 py-3 shadow-lg flex items-center gap-2 text-sm max-w-sm
      `}
    >
      <span className="flex-shrink-0">{config.icon}</span>
      <span className="flex-1">{item.message}</span>
      <button
        onClick={onClose}
        className="flex-shrink-0 opacity-50 hover:opacity-100 text-xs ml-1"
      >
        ✕
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    // 퇴장 애니메이션
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* 토스트 컨테이너 */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map((toast) => (
            <ToastMessage
              key={toast.id}
              item={toast}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
