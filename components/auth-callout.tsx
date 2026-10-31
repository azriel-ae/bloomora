import Link from 'next/link';

export function AuthCallout({ title = 'Your gift starts here.' }: { title?: string }) {
  return <div className="rounded-[2rem] border border-line bg-paper p-8 shadow-soft"><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">A quiet first step</p><h2 className="mt-3 font-display text-3xl">{title}</h2><p className="mt-3 max-w-md text-sm leading-6 text-ink/60">Create an account so Bloomora can save your work, keep your private memories private, and make publishing feel effortless.</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/register" className="rounded-full bg-moss px-5 py-3 text-sm font-semibold text-ivory">Create a free account</Link><Link href="/login" className="rounded-full border border-line px-5 py-3 text-sm font-semibold">I already have an account</Link></div></div>;
}
