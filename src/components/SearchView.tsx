'use client';

import React, { useRef, useEffect } from 'react';
import { Search, ChevronRight, Building2 } from 'lucide-react';
import { ZoneWithEstimate } from '@/types/database';
import { searchZones } from '@/lib/algo/search';
import { computeBuildingSummary, BUILDINGS_METADATA } from '@/lib/algo/map-color';
import { SpaceRow } from './SpaceRow';

interface SearchViewProps {
  zones: ZoneWithEstimate[];
  query: string;
  onQueryChange: (q: string) => void;
  onClose: () => void;
  quietOnly: boolean;
  openRowId: string | null;
  onToggleRow: (id: string) => void;
}

export function SearchView({
  zones,
  query,
  onQueryChange,
  onClose,
  quietOnly,
  openRowId,
  onToggleRow,
}: SearchViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus automatically on mount
    inputRef.current?.focus();
  }, []);

  const trimmedQuery = query.trim();
  const searchResults = searchZones(zones, query, quietOnly);

  // Buildings summary list for empty query
  const buildingsList = Object.keys(BUILDINGS_METADATA).map((bKey) => {
    const summary = computeBuildingSummary(bKey, zones, quietOnly);
    return summary;
  });

  return (
    <div className="pt-2 animate-in fade-in duration-150">
      {/* Search Header Bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--ink-2)] pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            autoComplete="off"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search a building or floor"
            aria-label="Search a building or floor"
            className="w-full min-h-[50px] pl-11 pr-4 rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--ink-2)] text-base font-medium focus:border-[var(--brand-text)] focus:outline-none transition-colors"
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="min-h-[48px] px-2 text-base font-bold text-[var(--brand-text)] hover:opacity-80 transition-opacity cursor-pointer"
        >
          Cancel
        </button>
      </div>

      {/* 1. Empty Query State: Buildings List */}
      {!trimmedQuery ? (
        <div className="mt-4">
          <h2 className="text-lg font-bold font-heading text-[var(--ink)] mb-3">Buildings</h2>

          <ul className="divide-y divide-[var(--line)] bg-[var(--surface)] rounded-2xl border border-[var(--line)] overflow-hidden">
            {buildingsList.map((b) => (
              <li key={b.buildingKey}>
                <button
                  type="button"
                  onClick={() => onQueryChange(b.shortName)}
                  className="w-full min-h-[64px] px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--surface-2)] text-[var(--ink-2)] flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                      <strong className="block text-base font-extrabold font-heading text-[var(--ink)]">
                        {b.name}
                      </strong>
                      <span className="text-xs text-[var(--ink-2)]">
                        {b.isClosed
                          ? 'Closed now'
                          : `${b.spacesWithSeats} of ${b.totalSpaces} spaces have seats`}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-[var(--ink-2)] shrink-0" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          <p className="text-xs text-[var(--ink-2)] mt-4 text-center">
            You can also search a floor, like &ldquo;floor 2&rdquo;.
          </p>
        </div>
      ) : searchResults.length === 0 ? (
        /* 2. No Match State */
        <div className="mt-8 p-6 text-center rounded-2xl bg-[var(--surface)] border border-[var(--line)]">
          <h3 className="text-lg font-extrabold font-heading text-[var(--ink)] mb-1">No match</h3>
          <p className="text-sm text-[var(--ink-2)] leading-relaxed">
            Try a building name, like &ldquo;Marshall&rdquo;, or a floor, like &ldquo;floor 2&rdquo;.
          </p>
        </div>
      ) : (
        /* 3. Results List */
        <div className="mt-4">
          <h2 className="text-base font-extrabold font-heading text-[var(--ink-2)] mb-2">
            {searchResults.length} {searchResults.length === 1 ? 'space' : 'spaces'}
          </h2>

          <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)] bg-[var(--surface)] rounded-2xl overflow-hidden shadow-xs">
            {searchResults.map((z) => (
              <SpaceRow
                key={z.id}
                zone={z}
                isOpen={openRowId === z.id}
                onToggle={() => onToggleRow(z.id)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
