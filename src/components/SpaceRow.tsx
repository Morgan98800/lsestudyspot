'use client';

import React from 'react';
import { ZoneWithEstimate } from '@/types/database';
import { StatusSquare } from './StatusIcon';
import { HourlyChart } from './HourlyChart';

interface SpaceRowProps {
  zone: ZoneWithEstimate;
  isOpen: boolean;
  onToggle: () => void;
}

export function SpaceRow({ zone, isOpen, onToggle }: SpaceRowProps) {
  const { estimate } = zone;

  const getScreenReaderLabel = () => {
    const statusText =
      estimate.level === 0 ? 'plenty of seats' : estimate.level === 1 ? 'filling up' : 'full';
    const timeText = estimate.is_predicted ? 'usual level' : `updated ${estimate.freshness_text}`;
    return `${zone.name}, ${zone.descriptor}, ${statusText}, ${timeText}`;
  };

  return (
    <div className="border-b border-[var(--line)] bg-[var(--surface)] transition-colors">
      {/* 76px tall row button */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`details-${zone.id}`}
        aria-label={getScreenReaderLabel()}
        className="w-full min-h-[76px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)] transition-colors cursor-pointer select-none"
      >
        {/* Left: 44px status square */}
        <StatusSquare level={estimate.level} isPredicted={estimate.is_predicted} />

        {/* Middle: name + descriptor */}
        <div className="flex-1 min-w-0 pr-2">
          <div className="font-bold font-heading text-base sm:text-lg text-[var(--ink)] truncate">
            {zone.name}
          </div>
          <div className="text-xs sm:text-sm text-[var(--ink-2)] truncate mt-0.5">
            {zone.descriptor}
          </div>
        </div>

        {/* Right: Freshness text only */}
        <div className="shrink-0 text-right">
          <span
            className={`text-xs font-medium ${
              estimate.is_predicted ? 'text-[var(--ink-2)] italic' : 'text-[var(--ink-2)]'
            }`}
          >
            {estimate.freshness_text}
          </span>
        </div>
      </button>

      {/* Accordion Expandable Content */}
      {isOpen && (
        <div
          id={`details-${zone.id}`}
          role="region"
          aria-labelledby={`row-${zone.id}`}
          className="px-4 pb-5 pt-2 bg-[var(--surface)] flex flex-col gap-3.5 animate-in fade-in duration-150"
        >

          {/* Prediction banner if prediction */}
          {estimate.is_predicted && (
            <p className="text-xs text-[var(--ink-2)] italic bg-[var(--surface-2)] p-2.5 rounded-lg border border-[var(--line)]">
              No reports in the last 90 minutes, so this is the usual level for now.
            </p>
          )}

          {/* Plain-Language Insight Line */}
          <p className="text-xs sm:text-sm font-medium text-[var(--ink)] leading-snug">
            {estimate.insight_text}
          </p>

          {/* 14-bar Hourly Chart */}
          <HourlyChart bars={estimate.hourly_bars} insightText={estimate.insight_text} />

          {/* Looks wrong hint */}
          <p className="text-[11px] text-[var(--ink-2)] pt-1">
            Looks wrong? Scan the QR code at the spot to correct it.
          </p>
        </div>
      )}
    </div>
  );
}
