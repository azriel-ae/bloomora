import Link from 'next/link';

type AuthCalloutProps = {
  title?: string;
  eyebrow?: string;
  body?: string;
  registerLabel?: string;
  loginLabel?: string;
};

export function AuthCallout({
  title = 'Your gift starts here.',
  eyebrow = 'A quiet first step',
  body = 'Create an account so Bloomora can save your work, keep your private memories private, and make publishing feel effortless.',
  registerLabel = 'Create a free account',
  loginLabel = 'I already have an account',
}: AuthCalloutProps) {
  return (
    <div className="rounded-[2rem] border border-line bg-paper p-8 shadow-soft">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl">{title}</h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-ink/60">{body}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/register" className="rounded-full bg-moss px-5 py-3 text-sm font-semibold text-ivory">{registerLabel}</Link>
        <Link href="/login" className="rounded-full border border-line px-5 py-3 text-sm font-semibold">{loginLabel}</Link>
      </div>
    </div>
  );
}
