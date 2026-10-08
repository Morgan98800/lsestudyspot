import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Offline — LSE Spots',
  description: 'You are currently offline. Connect to the internet to see free spaces.',
};

export default function OfflinePage() {
  return (
    <div className="max-w-md mx-auto px-4 pt-[calc(3.5rem+env(safe-area-inset-top,0px)+3rem)] min-h-[60vh] flex flex-col justify-center text-center">
      <div className="w-14 h-14 rounded-full bg-[var(--surface-2)] text-[var(--ink-2)] mx-auto mb-5 flex items-center justify-center">
        <svg
          className="w-7 h-7"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </div>

      <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[var(--ink)] mb-3">
        You&apos;re offline
      </h1>
      <p className="text-base text-[var(--ink-2)] mb-8 leading-relaxed">
        Connect to the internet to see free spaces.
      </p>

      <div className="flex flex-col gap-3">
        <Link
          href="/"
          className="w-full min-h-[48px] inline-flex items-center justify-center rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] font-semibold text-base shadow-xs hover:opacity-95 transition-opacity"
        >
          See free spaces
        </Link>
        <Link
          href="/feedback?from=/offline"
          className="text-xs text-[var(--ink-2)] hover:underline mt-2 inline-block"
        >
          Send feedback
        </Link>
      </div>
    </div>
  );
}
