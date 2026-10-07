'use client';

import React from 'react';
import { Navigation } from 'lucide-react';
import { RecommendationCandidate } from '@/lib/algo/recommendation';

interface RecommendationCardProps {
  candidate: RecommendationCandidate | null;
  hasMultipleCandidates: boolean;
  onSelect: (zoneId: string) => void;
  onShowAnother: () => void;
}

export function RecommendationCard({
  candidate,
  hasMultipleCandidates,
  onSelect,
  onShowAnother,
}: RecommendationCardProps) {
  if (!candidate) return null;

  const { zone, reasonText } = candidate;

  return (
    <div className="relative mt-4 mb-2 p-4 rounded-2xl bg-[var(--surface)] border-2 border-[var(--brand)] shadow-xs flex items-start gap-3.5">
      {/* Brand-red circle with navigation-arrow icon */}
      <div
        className="w-11 h-11 rounded-full bg-[var(--brand)] text-white flex items-center justify-center shrink-0 mt-0.5"
        aria-hidden="true"
      >
        <Navigation className="w-5 h-5 fill-current transform rotate-45" />
      </div>

      <div className="flex-1 min-w-0">
        <h2 className="text-lg sm:text-xl font-extrabold font-heading text-[var(--ink)] leading-tight tracking-tight">
          <button
            type="button"
            onClick={() => onSelect(zone.id)}
            className="text-left hover:text-[var(--brand-text)] focus-visible:outline-none transition-colors cursor-pointer"
          >
            Try {zone.name}
          </button>
        </h2>

        <p className="text-sm text-[var(--ink-2)] mt-0.5 leading-snug">{reasonText}</p>

        {hasMultipleCandidates && (
          <div className="mt-2.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onShowAnother();
              }}
              className="text-xs sm:text-sm font-semibold text-[var(--ink-2)] hover:text-[var(--ink)] underline underline-offset-4 cursor-pointer min-h-[36px] flex items-center"
            >
              Show another
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
