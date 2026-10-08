import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto px-4 pt-[calc(3.5rem+env(safe-area-inset-top,0px)+3rem)] min-h-[60vh] flex flex-col justify-center text-center">
      <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[var(--ink)] mb-3">
        We can&apos;t find that page
      </h1>
      <p className="text-base text-[var(--ink-2)] mb-8 leading-relaxed">
        The link may be old or mistyped.
      </p>
      <div className="flex flex-col gap-3">
        <Link
          href="/"
          className="w-full min-h-[48px] inline-flex items-center justify-center rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] font-semibold text-base shadow-xs hover:opacity-95 transition-opacity"
        >
          See free spaces
        </Link>
        <Link
          href="/feedback?from=/404"
          className="text-xs text-[var(--ink-2)] hover:underline mt-2 inline-block"
        >
          Send feedback
        </Link>
      </div>
    </div>
  );
}
