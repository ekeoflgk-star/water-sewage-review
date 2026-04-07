import type { Metadata } from 'next';
import { TopNav } from '@/components/layout/TopNav';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

export const metadata: Metadata = {
  title: '상하수도 설계 검토 플랫폼',
  description: '상하수도 설계 성과품을 법령·KDS 설계기준과 자동 대조하여 적합/부적합을 판정합니다.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased h-screen flex flex-col overflow-hidden">
        <ToastProvider>
          <TopNav />
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
