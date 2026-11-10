import type { Metadata } from 'next';
import { AuthCallout } from '@/components/auth-callout';
import { TemplatesManager } from '@/components/admin/templates-manager';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Template Dinamis · Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default async function AdminTemplatesPage() {
  const user = await getCurrentUser();
  if (!user?.admin) return <div className="mx-auto max-w-3xl py-16"><AuthCallout title="Akses admin diperlukan" /></div>;
  return <TemplatesManager />;
}
