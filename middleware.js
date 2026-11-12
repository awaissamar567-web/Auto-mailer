import { NextResponse } from 'next/server';
import { verifyToken, COOKIE } from './lib/auth';

// Everything except the login page, the login API and static assets needs a valid session.
export async function middleware(request) {
  const { pathname } = request.nextUrl;
  if (pathname === '/login' || pathname === '/api/login') return NextResponse.next();

  const session = await verifyToken(request.cookies.get(COOKIE)?.value);
  if (session) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, code: 'unauthorized', message: 'Log in again.' }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  if (pathname !== '/') url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)'],
};
