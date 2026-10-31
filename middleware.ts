import { NextRequest, NextResponse } from 'next/server';
import { isLocale, localeCookie, defaultLocale } from '@/lib/i18n-core';

export function middleware(request: NextRequest) { const { pathname } = request.nextUrl; const first = pathname.split('/')[1]; if (isLocale(first)) { const nextPath = pathname.slice(first.length + 1) || '/'; const response = NextResponse.rewrite(new URL(nextPath, request.url)); response.cookies.set(localeCookie, first, { path: '/', maxAge: 31536000, sameSite: 'lax' }); return response; } if (!request.cookies.has(localeCookie)) { const response = NextResponse.next(); response.cookies.set(localeCookie, defaultLocale, { path: '/', maxAge: 31536000, sameSite: 'lax' }); return response; } return NextResponse.next(); }
export const config = { matcher: ['/((?!api|_next|manus-storage|favicon.ico|robots.txt|sitemap.xml).*)'] };
