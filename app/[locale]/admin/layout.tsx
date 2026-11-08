import { AdminShell } from '@/components/admin/admin-shell';
import { getCurrentUser } from '@/lib/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return <AdminShell email={user?.email}>{children}</AdminShell>;
}

// Reads per-request data (cookies, DB, search params, or secrets): never prerender or cache.
export const dynamic = 'force-dynamic';
