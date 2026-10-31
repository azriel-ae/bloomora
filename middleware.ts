import { NextRequest, NextResponse } from 'next/server';
import { isLocale, localeCookie, defaultLocale } from '@/lib/i18n-core';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split('/')[1];

  if (isLocale(first)) {
    const nextPath = pathname.slice(first.length + 1) || '/';
    // Apply the locale to this request as well as the response cookie. Otherwise
    // server components can render once with a stale locale from the prior page.
    request.cookies.set(localeCookie, first);
    const destination = request.nextUrl.clone();
    destination.pathname = nextPath;
    const response = NextResponse.rewrite(destination, {
      request: { headers: request.headers },
    });
    response.cookies.set(localeCookie, first, { path: '/', maxAge: 31536000, sameSite: 'lax' });
    return response;
  }

  if (!request.cookies.has(localeCookie)) {
    const response = NextResponse.next();
    response.cookies.set(localeCookie, defaultLocale, { path: '/', maxAge: 31536000, sameSite: 'lax' });
    return response;
  }

  return NextResponse.next();
}

export const config = { matcher: ['/((?!api|_next|manus-storage|favicon.ico|robots.txt|sitemap.xml).*)'] };
