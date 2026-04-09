import { NextRequest, NextResponse } from 'next/server';

// 보호 제외 경로 (로그인 페이지, 정적 파일, favicon 등)
const PUBLIC_PATHS = ['/login', '/api/auth', '/_next', '/favicon.ico', '/pdf.worker.min.mjs'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 공개 경로는 통과
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 1) IP 화이트리스트 체크
  const allowedIps = (process.env.ALLOWED_IPS || '').split(',').map((ip) => ip.trim()).filter(Boolean);
  if (allowedIps.length > 0) {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '';
    if (allowedIps.includes(clientIp)) {
      return NextResponse.next();
    }
  }

  // 2) 인증 쿠키 체크
  const authCookie = request.cookies.get('site-auth')?.value;
  const sitePassword = process.env.SITE_PASSWORD || '';
  if (sitePassword && authCookie === hashPassword(sitePassword)) {
    return NextResponse.next();
  }

  // 3) 미인증 → 로그인 페이지로 리다이렉트
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

/** 간단한 해시 (비밀번호 원문을 쿠키에 저장하지 않기 위함) */
function hashPassword(pw: string): string {
  let hash = 0;
  for (let i = 0; i < pw.length; i++) {
    const ch = pw.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return 'auth_' + Math.abs(hash).toString(36);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|pdf.worker.min.mjs).*)'],
};
