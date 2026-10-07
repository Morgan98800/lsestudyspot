'use client';

import React from 'react';

interface HourlyChartProps {
  bars: { hour: number; avg_level: number; is_current: boolean }[];
  insightText: string;
}

export function HourlyChart({ bars, insightText }: HourlyChartProps) {
  return (
    <div
      role="img"
      aria-label={`Hourly busyness chart from 08:00 to 21:00. ${insightText}`}
      className="w-full pt-2 pb-1"
    >
      {/* 14 Bars */}
      <div className="h-14 flex items-end justify-between gap-1.5 sm:gap-2">
        {bars.map((bar) => {
          // avg_level is 0.0 to 2.0. Scale height from 8px (min) to 48px (max).
          const heightPx = Math.max(8, Math.round((bar.avg_level / 2.0) * 44 + 6));
          return (
            <div
              key={bar.hour}
              className="flex-1 flex flex-col items-center justify-end h-full"
            >
              <div
                style={{ height: `${heightPx}px` }}
                className={`w-full rounded-xs transition-all ${
                  bar.is_current
                    ? 'bg-[var(--brand)]'
                    : 'border border-dashed border-[var(--line)] bg-[var(--surface-2)]'
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* Axis Labels at 08, 12, 16, 20 */}
      <div className="flex justify-between text-[11px] text-[var(--ink-2)] pt-1 px-1 font-mono">
        <span>08</span>
        <span>12</span>
        <span>16</span>
        <span>20</span>
      </div>
    </div>
  );
}
