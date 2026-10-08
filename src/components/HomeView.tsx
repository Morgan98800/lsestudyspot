'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, List, Map as MapIcon } from 'lucide-react';
import { ZoneWithEstimate } from '@/types/database';
import { SpaceRow } from './SpaceRow';
import { StatusCircleIcon } from './StatusIcon';
import { RecommendationCard } from './RecommendationCard';
import { SearchView } from './SearchView';
import { CampusMap } from './CampusMap';
import { getRankedRecommendations } from '@/lib/algo/recommendation';
import { getLondonTime } from '@/lib/algo/estimate';
import { getBuildingKeyForZone } from '@/lib/algo/map-color';

interface HomeViewProps {
  initialZones: ZoneWithEstimate[];
  initialSends?: Record<string, number>;
  serverTime?: string;
}

export function HomeView({ initialZones, initialSends = {}, serverTime }: HomeViewProps) {
  const [zones, setZones] = useState<ZoneWithEstimate[]>(initialZones);
  const [sends, setSends] = useState<Record<string, number>>(initialSends);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [quietOnly, setQuietOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [recIndex, setRecIndex] = useState(0);
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
        if (data.recommendationSends) {
          setSends(data.recommendationSends);
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

  // Listen for magnifier icon in HeaderBar
  useEffect(() => {
    const handleOpenSearch = () => {
      setSearchQuery((prev) => (prev === null ? '' : prev));
    };
    window.addEventListener('lse:open-search', handleOpenSearch);
    return () => window.removeEventListener('lse:open-search', handleOpenSearch);
  }, []);

  // Filter zones: Quiet only shows zones with noise = silent or quiet
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

  // Recommendations: top ranked candidate according to balance formula
  const recommendations = useMemo(() => {
    const currentHour = getLondonTime().hour;
    return getRankedRecommendations(zones, quietOnly, sends, currentHour);
  }, [zones, quietOnly, sends]);

  const currentRecommendation = useMemo(() => {
    if (recommendations.length === 0) return null;
    return recommendations[recIndex % recommendations.length];
  }, [recommendations, recIndex]);

  const recommendedBuildingKey = useMemo(() => {
    if (!currentRecommendation) return null;
    return getBuildingKeyForZone(currentRecommendation.zone.building);
  }, [currentRecommendation]);

  const handleRecommendationSelect = (zoneId: string) => {
    // 1. Record send to API asynchronously
    try {
      const clientId =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem('lse_spots_device_id') || 'dev_guest'
          : 'dev_guest';
      fetch('/api/recommendation-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zoneId, client_random_id: clientId }),
      }).catch(() => {});
    } catch {
      // ignore
    }

    // 2. Increment local sends count so next rotation steers elsewhere
    setSends((prev) => ({
      ...prev,
      [zoneId]: (prev[zoneId] || 0) + 1,
    }));

    // 3. Open that space's row, switch to list view, and scroll to it
    setView('list');
    setOpenRowId(zoneId);

    setTimeout(() => {
      const el = document.getElementById(`row-${zoneId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);
  };

  const handleToggleRow = (id: string) => {
    setOpenRowId((prev) => (prev === id ? null : id));
  };

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

  // Hero headline
  const getHeroHeadline = () => {
    if (spacesWithSeatsCount === 0) return 'Everything is full';
    if (spacesWithSeatsCount === 1) return '1 space has seats';
    return `${spacesWithSeatsCount} spaces have seats`;
  };

  return (
    <div className="max-w-xl mx-auto px-4 pt-18 pb-[calc(96px+env(safe-area-inset-bottom,0px))]">
      {/* SEARCH VIEW OVERLAY */}
      {searchQuery !== null ? (
        <SearchView
          zones={zones}
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onClose={() => setSearchQuery(null)}
          quietOnly={quietOnly}
          openRowId={openRowId}
          onToggleRow={handleToggleRow}
        />
      ) : (
        <>
          {/* 1. HERO */}
          <section className="pt-4 pb-2" aria-label="Current seat summary">
            <h1 className="text-3xl sm:text-4xl font-extrabold font-heading text-[var(--ink)] tracking-tight">
              {getHeroHeadline()}
            </h1>
            <p className="text-sm sm:text-base font-normal text-[var(--ink-2)] mt-1">
              Right now, reported by students.
            </p>
          </section>

          {/* 2. WHERE TO GO (Recommendation Card - list view only) */}
          {view === 'list' && currentRecommendation && (
            <RecommendationCard
              candidate={currentRecommendation}
              hasMultipleCandidates={recommendations.length > 1}
              onSelect={handleRecommendationSelect}
              onShowAnother={() => setRecIndex((prev) => prev + 1)}
            />
          )}

          {/* 3. CONTROLS: List / Map segmented control + Quiet only button */}
          <div className="flex items-center gap-2.5 mt-4 mb-6">
            <div
              role="tablist"
              aria-label="View options"
              className="flex-1 min-h-[48px] p-1 rounded-xl bg-[var(--surface-2)] flex items-center"
            >
              <button
                type="button"
                role="tab"
                aria-selected={view === 'list'}
                onClick={() => setView('list')}
                className={`flex-1 min-h-[40px] rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  view === 'list'
                    ? 'bg-[var(--brand)] text-[var(--brand-ink)] shadow-xs'
                    : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                }`}
              >
                <List className="w-4 h-4" aria-hidden="true" />
                <span>List</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={view === 'map'}
                onClick={() => setView('map')}
                className={`flex-1 min-h-[40px] rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  view === 'map'
                    ? 'bg-[var(--brand)] text-[var(--brand-ink)] shadow-xs'
                    : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                }`}
              >
                <MapIcon className="w-4 h-4" aria-hidden="true" />
                <span>Map</span>
              </button>
            </div>

            <button
              type="button"
              aria-pressed={quietOnly}
              onClick={() => setQuietOnly((prev) => !prev)}
              className={`min-h-[48px] px-4 rounded-xl border-2 text-sm font-semibold transition-all cursor-pointer select-none ${
                quietOnly
                  ? 'bg-[var(--ink)] text-[var(--surface)] border-[var(--ink)]'
                  : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--ink-2)]'
              }`}
            >
              Quiet only
            </button>
          </div>

          {/* 4. MAIN CONTENT: Map or List */}
          {view === 'map' ? (
            <CampusMap
              zones={zones}
              quietOnly={quietOnly}
              recommendedBuildingKey={recommendedBuildingKey}
              openRowId={openRowId}
              onToggleRow={handleToggleRow}
            />
          ) : (
            <div className="flex flex-col gap-6">
              {/* SECTION: PLENTY OF SEATS */}
              {plentyZones.length > 0 && (
                <section aria-labelledby="section-plenty">
                  <div className="flex items-center justify-between pb-2 px-1 text-sm font-bold font-heading text-[var(--status-plenty-text)]">
                    <div className="flex items-center gap-2">
                      <StatusCircleIcon level={0} className="w-5 h-5 shrink-0" />
                      <span id="section-plenty">Plenty of seats</span>
                    </div>
                    <span className="font-sans font-bold text-xs text-[var(--ink-2)]">
                      {plentyZones.length}
                    </span>
                  </div>

                  <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)] bg-[var(--surface)] rounded-2xl overflow-hidden shadow-xs">
                    {plentyZones.map((z) => (
                      <SpaceRow
                        key={z.id}
                        zone={z}
                        isOpen={openRowId === z.id}
                        onToggle={() => handleToggleRow(z.id)}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {/* SECTION: FILLING UP */}
              {fillingZones.length > 0 && (
                <section aria-labelledby="section-filling">
                  <div className="flex items-center justify-between pb-2 px-1 text-sm font-bold font-heading text-[var(--status-filling-text)]">
                    <div className="flex items-center gap-2">
                      <StatusCircleIcon level={1} className="w-5 h-5 shrink-0" />
                      <span id="section-filling">Filling up</span>
                    </div>
                    <span className="font-sans font-bold text-xs text-[var(--ink-2)]">
                      {fillingZones.length}
                    </span>
                  </div>

                  <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)] bg-[var(--surface)] rounded-2xl overflow-hidden shadow-xs">
                    {fillingZones.map((z) => (
                      <SpaceRow
                        key={z.id}
                        zone={z}
                        isOpen={openRowId === z.id}
                        onToggle={() => handleToggleRow(z.id)}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {/* Quiet filter empty state */}
              {plentyZones.length === 0 && fillingZones.length === 0 && quietOnly && (
                <p className="text-sm text-[var(--ink-2)] text-center py-4">
                  No quiet spaces have seats.{' '}
                  <button
                    type="button"
                    onClick={() => setQuietOnly(false)}
                    className="font-bold underline text-[var(--brand-text)] cursor-pointer"
                  >
                    Show all spaces
                  </button>
                </p>
              )}

              {/* SECTION: FULL (Collapsed by default into single accordion row) */}
              {fullZones.length > 0 && (
                <section aria-labelledby="section-full-header">
                  <div className="bg-[var(--surface)] rounded-2xl border border-[var(--line)] overflow-hidden shadow-xs">
                    <button
                      type="button"
                      id="section-full-header"
                      aria-expanded={isFullExpanded}
                      onClick={() => setIsFullExpanded((prev) => !prev)}
                      className="w-full min-h-[56px] px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--surface-2)] transition-colors cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2.5 font-bold font-heading text-sm text-[var(--status-full-text)]">
                        <StatusCircleIcon level={2} className="w-5 h-5 shrink-0" />
                        <span>Full</span>
                        <span className="font-sans text-xs text-[var(--ink-2)] font-semibold ml-1">
                          {fullZones.length}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[var(--ink-2)]">
                        <span className="text-xs font-semibold">
                          {isFullExpanded ? 'Hide' : 'Show'}
                        </span>
                        {isFullExpanded ? (
                          <ChevronUp className="w-4 h-4 shrink-0" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
                        )}
                      </div>
                    </button>

                    {isFullExpanded && (
                      <div className="border-t border-[var(--line)] divide-y divide-[var(--line)] animate-in fade-in duration-150">
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
          )}

          {/* 5. CLOSED NOW: One line of text at the bottom */}
          {closedZones.length > 0 && !quietOnly && (
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

          {/* 6. FOOTER DISCLAIMER & PRIVACY */}
          <footer className="mt-12 pt-6 pb-[calc(96px+env(safe-area-inset-bottom))] border-t border-[var(--line)] text-center text-xs text-[var(--ink-2)] space-y-2">
            <p>Student-built, not affiliated with LSE. Estimates only.</p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/privacy" className="hover:underline">
                Privacy
              </Link>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
