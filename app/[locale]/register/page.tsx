import { redirect } from 'next/navigation';

export default function LegacyRegisterRedirect() { redirect('/admin/login'); }

// Reads per-request data (cookies, DB, search params, or secrets): never prerender or cache.
export const dynamic = 'force-dynamic';
