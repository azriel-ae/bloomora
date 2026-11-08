import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { hasSupabasePublicConfig, supabasePublicConfig } from '@/lib/env';

const LEGACY_LOCALE_COOKIE = 'bloomora_locale';

function clearLegacyLocaleCookie(request: NextRequest, response: NextResponse) {
  if (request.cookies.has(LEGACY_LOCALE_COOKIE)) {
    response.cookies.set(LEGACY_LOCALE_COOKIE, '', { path: '/', maxAge: 0, expires: new Date(0), sameSite: 'lax' });
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const prefix = /^\/(?:id|en)(?=\/|$)/.exec(pathname);

  // URL lama berprefiks locale tetap dapat dibuka, tetapi dialihkan ke URL tunggal.
  if (prefix) {
    const destination = request.nextUrl.clone();
    destination.pathname = pathname.slice(prefix[0].length) || '/';
    return clearLegacyLocaleCookie(request, NextResponse.redirect(destination, 301));
  }

  const destination = request.nextUrl.clone();
  destination.pathname = pathname === '/' ? '/id' : `/id${pathname}`;
  const requestHeaders = new Headers(request.headers);
  const response = NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
  clearLegacyLocaleCookie(request, response);

  const needsAuthRefresh = pathname === '/login' || pathname === '/register' || pathname === '/admin' || pathname.startsWith('/admin/');
  if (needsAuthRefresh && hasSupabasePublicConfig()) {
    const { url, anonKey } = supabasePublicConfig();
    if (url && anonKey) {
      const client = createServerClient(url, anonKey, {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            for (const { name, value, options } of cookiesToSet) {
              request.cookies.set(name, value);
              response.cookies.set(name, value, options);
            }
          },
        },
      });
      await client.auth.getUser();
    }
  }

  return response;
}

export const config = { matcher: ['/((?!api|_next|manus-storage|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)'] };
