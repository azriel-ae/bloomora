'use client';

import { usePathname } from 'next/navigation';

export function AdminChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Prerendered pages may see the internal /{locale}/... path; accept both forms.
  return /^\/(?:(?:id|en)\/)?admin(\/|$)/.test(pathname ?? '') ? null : <>{children}</>;
}
