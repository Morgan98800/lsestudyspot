'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ZoneWithEstimate } from '@/types/database';
import { SpaceRow } from './SpaceRow';
import { StatusCircleIcon } from './StatusIcon';

interface HomeViewProps {
  initialZones: ZoneWithEstimate[];
}

export function HomeView({ initialZones }: HomeViewProps) {
  const [zones, setZones] = useState<ZoneWithEstimate[]>(initialZones);
  const [quietOnly, setQuietOnly] = useState(false);
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [isFullExpanded, setIsFullExpanded] = useState(false);

  // Poll for fresh data every 60s while visible, refetch on focus
  const refreshData = useCallback(async () => {
    try {
      const res = await fetch('/api/zones');
      if (res.ok) {
        const data = await res.json();
        if (data.zones) {
          setZones(data.zones);
        }
      }
    } catch {
      // Offline fallback: keep existing data
    }
  }, []);

  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        refreshData();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshData();
      }
    }, 60000);

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      clearInterval(interval);
    };
  }, [refreshData]);

  // Filter zones: Quiet spaces only shows zones with noise = silent or quiet
  const filteredZones = useMemo(() => {
    if (!quietOnly) return zones;
    return zones.filter((z) => z.noise === 'silent' || z.noise === 'quiet');
  }, [zones, quietOnly]);

  // Separate active zones vs closed zones
  const { openZones, closedZones } = useMemo(() => {
    const open: ZoneWithEstimate[] = [];
    const closed: ZoneWithEstimate[] = [];

    for (const z of filteredZones) {
      if (z.estimate.is_closed) {
        closed.push(z);
      } else {
        open.push(z);
      }
    }

    return { openZones: open, closedZones: closed };
  }, [filteredZones]);

  // Count open spaces with seats (Plenty + Filling up)
  const spacesWithSeatsCount = useMemo(() => {
    return openZones.filter((z) => z.estimate.level === 0 || z.estimate.level === 1).length;
  }, [openZones]);

  // Group sections by status level
  // Sort within a section: live reports first, then most recently updated, then name
  const sortSectionZones = (items: ZoneWithEstimate[]) => {
    return [...items].sort((a, b) => {
      // 1. Live reports before predictions
      if (!a.estimate.is_predicted && b.estimate.is_predicted) return -1;
      if (a.estimate.is_predicted && !b.estimate.is_predicted) return 1;

      // 2. Most recently updated
      if (a.estimate.minutes_ago !== null && b.estimate.minutes_ago !== null) {
        if (a.estimate.minutes_ago !== b.estimate.minutes_ago) {
          return a.estimate.minutes_ago - b.estimate.minutes_ago;
        }
      }

      // 3. Name alphabetically
      return a.name.localeCompare(b.name);
    });
  };

  const plentyZones = useMemo(
    () => sortSectionZones(openZones.filter((z) => z.estimate.level === 0)),
    [openZones]
  );

  const fillingZones = useMemo(
    () => sortSectionZones(openZones.filter((z) => z.estimate.level === 1)),
    [openZones]
  );

  const fullZones = useMemo(
    () => sortSectionZones(openZones.filter((z) => z.estimate.level === 2)),
    [openZones]
  );

  const handleToggleRow = (id: string) => {
    setOpenRowId((prev) => (prev === id ? null : id));
  };

  // Hero headline
  const getHeroHeadline = () => {
    if (spacesWithSeatsCount === 0) return 'Everything is full';
    if (spacesWithSeatsCount === 1) return '1 space has seats';
    return `${spacesWithSeatsCount} spaces have seats`;
  };

  return (
    <div className="max-w-xl mx-auto px-4 pt-18 pb-[calc(96px+env(safe-area-inset-bottom,0px))]">
      {/* 1. HERO */}
      <section className="pt-4 pb-6" aria-label="Current seat summary">
        <h1 className="text-3xl sm:text-4xl font-extrabold font-heading text-[var(--ink)] tracking-tight">
          {getHeroHeadline()}
        </h1>
        <p className="text-sm sm:text-base font-normal text-[var(--ink-2)] mt-1">
          Right now, reported by students.
        </p>
      </section>

      {/* 2. ONE TOGGLE SWITCH: "Quiet spaces only" */}
      <div className="flex items-center justify-between min-h-[48px] py-1 mb-6">
        <label
          htmlFor="quiet-toggle"
          className="text-base font-semibold text-[var(--ink)] cursor-pointer select-none"
        >
          Quiet spaces only
        </label>
        <button
          id="quiet-toggle"
          type="button"
          role="switch"
          aria-checked={quietOnly}
          onClick={() => setQuietOnly((prev) => !prev)}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] ${
            quietOnly ? 'bg-[var(--brand)]' : 'bg-[var(--line)]'
          }`}
        >
          <span className="sr-only">Quiet spaces only</span>
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
              quietOnly ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* 3. GROUP SECTIONS (in order: Plenty of seats -> Filling up) */}
      <div className="flex flex-col gap-6">
        {/* SECTION: PLENTY OF SEATS */}
        {plentyZones.length > 0 && (
          <section aria-labelledby="section-plenty">
            <div className="flex items-center justify-between pb-2 px-1 text-sm font-bold font-heading text-[var(--status-plenty-text)]">
              <div className="flex items-center gap-2">
                <StatusCircleIcon level={0} className="w-5 h-5 shrink-0" />
                <h2 id="section-plenty">Plenty of seats</h2>
              </div>
              <span className="text-xs font-mono font-normal text-[var(--ink-2)]">
                {plentyZones.length}
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--line)] overflow-hidden divide-y divide-[var(--line)]">
              {plentyZones.map((z) => (
                <SpaceRow
                  key={z.id}
                  zone={z}
                  isOpen={openRowId === z.id}
                  onToggle={() => handleToggleRow(z.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* SECTION: FILLING UP */}
        {fillingZones.length > 0 && (
          <section aria-labelledby="section-filling">
            <div className="flex items-center justify-between pb-2 px-1 text-sm font-bold font-heading text-[var(--status-filling-text)]">
              <div className="flex items-center gap-2">
                <StatusCircleIcon level={1} className="w-5 h-5 shrink-0" />
                <h2 id="section-filling">Filling up</h2>
              </div>
              <span className="text-xs font-mono font-normal text-[var(--ink-2)]">
                {fillingZones.length}
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--line)] overflow-hidden divide-y divide-[var(--line)]">
              {fillingZones.map((z) => (
                <SpaceRow
                  key={z.id}
                  zone={z}
                  isOpen={openRowId === z.id}
                  onToggle={() => handleToggleRow(z.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* 4. FULL SECTION: Collapsed by default into a single row */}
        {fullZones.length > 0 && (
          <section aria-labelledby="section-full" className="pt-1">
            <div className="rounded-2xl border border-[var(--line)] overflow-hidden">
              <button
                type="button"
                id="section-full"
                onClick={() => setIsFullExpanded((prev) => !prev)}
                aria-expanded={isFullExpanded}
                className="w-full min-h-[56px] px-4 py-3 bg-[var(--surface-2)] flex items-center justify-between text-left cursor-pointer hover:opacity-90 transition-opacity"
              >
                <div className="flex items-center gap-2 text-sm font-bold font-heading text-[var(--status-full-text)]">
                  <StatusCircleIcon level={2} className="w-5 h-5 shrink-0" />
                  <span>Full, {fullZones.length}</span>
                </div>

                <div className="text-[var(--ink-2)]">
                  {isFullExpanded ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </button>

              {isFullExpanded && (
                <div className="divide-y divide-[var(--line)] animate-in fade-in duration-150">
                  {fullZones.map((z) => (
                    <SpaceRow
                      key={z.id}
                      zone={z}
                      isOpen={openRowId === z.id}
                      onToggle={() => handleToggleRow(z.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* 5. CLOSED NOW: One line of text at the bottom */}
      {closedZones.length > 0 && (
        <div className="mt-8 text-xs text-[var(--ink-2)] text-center leading-relaxed">
          <span>Closed now: </span>
          {closedZones.map((z, idx) => (
            <span key={z.id}>
              {z.name} ({z.estimate.closed_reason || 'closed'})
              {idx < closedZones.length - 1 ? ', ' : ''}
            </span>
          ))}
        </div>
      )}

      {/* 6. FOOTER DISCLAIMER */}
      <footer className="mt-12 pt-6 border-t border-[var(--line)] text-center text-xs text-[var(--ink-2)]">
        Student-built, not affiliated with LSE. Estimates only.
      </footer>
    </div>
  );
}
