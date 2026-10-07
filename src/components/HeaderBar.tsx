import React from 'react';
import Link from 'next/link';

export function HeaderBar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[var(--brand)] text-[var(--brand-ink)] h-14 shadow-xs">
      <div className="max-w-xl mx-auto h-full px-4 flex items-center justify-between">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight font-heading hover:opacity-95 transition-opacity"
        >
          LSE Spots
        </Link>

        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border border-white/80 text-white select-none">
          Unofficial
        </span>
      </div>
    </header>
  );
}
