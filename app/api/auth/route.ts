import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const sitePassword = process.env.SITE_PASSWORD;

    if (!sitePassword) {
      return NextResponse.json({ error: 'SITE_PASSWORD 환경변수가 설정되지 않았습니다.' }, { status: 500 });
    }

    if (password !== sitePassword) {
      return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    // 인증 성공 → 쿠키 설정 (7일)
    const response = NextResponse.json({ ok: true });
    response.cookies.set('site-auth', hashPassword(sitePassword), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: '요청 처리 실패' }, { status: 400 });
  }
}
