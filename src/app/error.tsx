'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error server-side / console; never display stack traces to users
    console.error('Unhandled client error:', error.message, error.digest);
  }, [error]);

  return (
    <div className="max-w-md mx-auto px-4 pt-[calc(3.5rem+env(safe-area-inset-top,0px)+3rem)] min-h-[60vh] flex flex-col justify-center text-center">
      <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[var(--ink)] mb-3">
        Something went wrong
      </h1>
      <p className="text-base text-[var(--ink-2)] mb-8 leading-relaxed">
        It&apos;s not you. Try again in a moment.
      </p>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="w-full min-h-[48px] inline-flex items-center justify-center rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] font-semibold text-base shadow-xs hover:opacity-95 transition-opacity cursor-pointer"
        >
          Try again
        </button>
        <Link
          href="/"
          className="w-full min-h-[48px] inline-flex items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--ink)] font-semibold text-base hover:opacity-90 transition-opacity"
        >
          See free spaces
        </Link>
        <Link
          href="/feedback?from=/error"
          className="text-xs text-[var(--ink-2)] hover:underline mt-2 inline-block"
        >
          Send feedback
        </Link>
      </div>
    </div>
  );
}
