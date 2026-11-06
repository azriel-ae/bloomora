import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { hasSupabasePublicConfig, supabasePublicConfig } from '@/lib/env';
import { isLocale, localeCookie, defaultLocale } from '@/lib/i18n-core';
import type { Locale } from '@/lib/i18n-core';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split('/')[1];
  const cookieLocale = request.cookies.get(localeCookie)?.value;
  // An explicit /id or /en prefix wins; otherwise use the cookie, then the default.
  const locale: Locale = isLocale(first) ? first : isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  const prefixed = isLocale(first);
  const nextPath = prefixed ? pathname.slice(first.length + 1) || '/' : pathname;

  // Every page lives under app/[locale]. Rewriting (not redirecting) keeps the visible URL
  // unchanged, and lets pages that do not read cookies be prerendered once per locale.
  // The locale is also applied to this request so server code that still reads the cookie
  // (dynamic pages) agrees with the route segment.
  request.cookies.set(localeCookie, locale);
  const destination = request.nextUrl.clone();
  destination.pathname = nextPath === '/' ? `/${locale}` : `/${locale}${nextPath}`;
  const response = NextResponse.rewrite(destination, { request: { headers: request.headers } });
  if (prefixed || cookieLocale !== locale) {
    response.cookies.set(localeCookie, locale, { path: '/', maxAge: 31536000, sameSite: 'lax' });
  }

  const needsAuthRefresh = nextPath === '/login' || nextPath === '/register' || nextPath === '/admin' || nextPath.startsWith('/admin/');
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
