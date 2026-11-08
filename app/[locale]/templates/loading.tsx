import { getLocale, getMessages } from '@/lib/i18n';

export default async function TemplatesLoading() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  return (
    <div aria-busy="true" className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
      <p role="status" className="sr-only">{messages.templatesPage.loading}</p>
      <div className="h-4 w-40 animate-pulse rounded bg-line" />
      <div className="mt-5 h-12 max-w-xl animate-pulse rounded bg-line sm:h-16" />
      <div className="mt-4 h-5 max-w-2xl animate-pulse rounded bg-line" />
      <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((item) => <div key={item} className="space-y-4"><div className="h-72 animate-pulse rounded-[2rem] bg-line" /><div className="h-6 w-2/3 animate-pulse rounded bg-line" /><div className="h-4 w-full animate-pulse rounded bg-line" /></div>)}
      </div>
    </div>
  );
}
