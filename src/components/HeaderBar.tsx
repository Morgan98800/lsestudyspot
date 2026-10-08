'use client';

import React from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';

export function HeaderBar() {
  const handleOpenSearch = () => {
    window.dispatchEvent(new CustomEvent('lse:open-search'));
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[var(--brand)] text-[var(--brand-ink)] pt-[env(safe-area-inset-top,0px)] shadow-xs">
      <div className="max-w-xl mx-auto h-14 px-4 flex items-center justify-between">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight font-heading hover:opacity-95 transition-opacity"
        >
          LSE Spots
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border border-white/80 text-white select-none">
            Unofficial
          </span>

          <button
            type="button"
            onClick={handleOpenSearch}
            aria-label="Search buildings and floors"
            className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:bg-white/20 transition-colors cursor-pointer"
          >
            <Search className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
