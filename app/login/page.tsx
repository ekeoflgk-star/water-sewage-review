'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push(from);
        router.refresh();
      } else {
        setError('비밀번호가 일치하지 않습니다.');
      }
    } catch {
      setError('서버 연결에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm mx-4">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          {/* 헤더 */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h1 className="text-lg font-bold text-slate-800">상하수도 설계 검토 플랫폼</h1>
            <p className="text-sm text-slate-500 mt-1">사내 전용 — 접근 비밀번호를 입력하세요</p>
          </div>

          {/* 폼 */}
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="비밀번호"
                autoFocus
                className="w-full px-4 py-3 text-sm border border-slate-300 rounded-xl
                           focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400
                           placeholder:text-slate-400"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 mb-4 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl
                         hover:bg-blue-700 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '확인 중...' : '입장'}
            </button>
          </form>

          <p className="text-xs text-slate-400 text-center mt-6">
            사내 네트워크에서는 자동 접속됩니다
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
