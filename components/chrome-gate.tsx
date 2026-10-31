'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** Full-screen experiences own the whole screen: the site header, footer and chatbot are not rendered there. */
const IMMERSIVE = [/^\/demo(\/|$)/];

export function ChromeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  return IMMERSIVE.some((r) => r.test(pathname)) ? null : <>{children}</>;
}
