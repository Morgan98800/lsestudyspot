'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { BusynessLevel, Zone } from '@/types/database';
import { StatusCircleIcon } from './StatusIcon';

interface QRReportFlowProps {
  zone: Zone;
  token: string;
  isTokenValid: boolean;
  isZoneClosed: boolean;
  opensAt?: string;
}

export function QRReportFlow({
  zone,
  token,
  isTokenValid,
  isZoneClosed,
  opensAt,
}: QRReportFlowProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submittedLevel, setSubmittedLevel] = useState<BusynessLevel | null>(null);
  const [isCorrectionMode, setIsCorrectionMode] = useState(false);
  const [rateLimitMins, setRateLimitMins] = useState<number | null>(null);
  const [clientRandomId, setClientRandomId] = useState<string>('');

  useEffect(() => {
    let id = localStorage.getItem('lse_client_random_id') || localStorage.getItem('lse_spots_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('lse_client_random_id', id);
    }
    setClientRandomId(id);
  }, []);

  // 1. Edge state: Invalid or expired token
  if (!isTokenValid) {
    return (
      <main className="max-w-md mx-auto px-4 pt-20 pb-8 min-h-[85vh] flex flex-col justify-center text-center">
        <h1 className="text-2xl font-bold font-heading text-[var(--ink)] mb-3">
          This code is out of date
        </h1>
        <p className="text-base text-[var(--ink-2)] mb-8 leading-relaxed">
          Ask the library desk, or open the app to find the space you are in.
        </p>
        <Link
          href="/"
          className="w-full min-h-[48px] inline-flex items-center justify-center rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] font-semibold text-base shadow-xs hover:opacity-95 transition-opacity"
        >
          Open the app
        </Link>
        <Link href="/privacy" className="text-xs text-[var(--ink-2)] hover:underline mt-4">
          Privacy
        </Link>
      </main>
    );
  }

  // 2. Edge state: Zone is closed
  if (isZoneClosed) {
    return (
      <main className="max-w-md mx-auto px-4 pt-20 pb-8 min-h-[85vh] flex flex-col justify-center text-center">
        <h1 className="text-2xl font-bold font-heading text-[var(--ink)] mb-3">
          {zone.name}
        </h1>
        <p className="text-base text-[var(--ink-2)] mb-8">
          This space is closed. It opens at {opensAt || '08:30'}.
        </p>
        <Link
          href="/"
          className="w-full min-h-[48px] inline-flex items-center justify-center rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] font-semibold text-base hover:opacity-95 transition-opacity"
        >
          See free spaces
        </Link>
        <Link href="/privacy" className="text-xs text-[var(--ink-2)] hover:underline mt-4">
          Privacy
        </Link>
      </main>
    );
  }

  // 3. Edge state: Rate limited
  if (rateLimitMins !== null) {
    return (
      <main className="max-w-md mx-auto px-4 pt-20 pb-8 min-h-[85vh] flex flex-col justify-center text-center">
        <h1 className="text-2xl font-bold font-heading text-[var(--ink)] mb-3">
          You already reported here
        </h1>
        <p className="text-base text-[var(--ink-2)] mb-8">
          You can report again in {rateLimitMins} min.
        </p>
        <Link
          href="/"
          className="w-full min-h-[48px] inline-flex items-center justify-center rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] font-semibold text-base hover:opacity-95 transition-opacity"
        >
          See free spaces
        </Link>
        <Link href="/privacy" className="text-xs text-[var(--ink-2)] hover:underline mt-4">
          Privacy
        </Link>
      </main>
    );
  }

  // Submit report immediately upon tap
  const handleSubmit = async (level: BusynessLevel) => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zone_id: zone.id,
          token,
          level,
          client_random_id: clientRandomId,
          is_correction: isCorrectionMode,
        }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setRateLimitMins(data.remaining_minutes || 8);
        return;
      }

      if (!res.ok) {
        console.error('Report submission error:', data.error);
      }

      setSubmittedLevel(level);
      setIsCorrectionMode(false);
    } catch {
      // Offline fallback: optimistically assume submission
      setSubmittedLevel(level);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusWord = (level: BusynessLevel) => {
    if (level === 0) return 'Plenty of seats';
    if (level === 1) return 'Filling up';
    return 'Full';
  };

  // 4. Thank-you screen
  if (submittedLevel !== null) {
    return (
      <main className="max-w-md mx-auto px-4 pt-24 pb-8 min-h-[85vh] flex flex-col items-center justify-between text-center">
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Animated checkmark icon */}
          <div className="w-16 h-16 rounded-full bg-[var(--status-plenty-bg)] text-[var(--status-plenty-text)] flex items-center justify-center mb-6 animate-check">
            <svg
              className="w-9 h-9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h1 className="text-3xl font-extrabold font-heading text-[var(--ink)] mb-2">
            Thanks!
          </h1>
          <p className="text-base text-[var(--ink-2)] max-w-xs">
            You said {zone.name} is {getStatusWord(submittedLevel)}.
          </p>
        </div>

        {/* Buttons at bottom */}
        <div className="w-full flex flex-col gap-3">
          <Link
            href="/"
            className="w-full min-h-[48px] inline-flex items-center justify-center rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] font-semibold text-base hover:opacity-95 transition-opacity"
          >
            See free spaces
          </Link>

          <button
            type="button"
            onClick={() => {
              setIsCorrectionMode(true);
              setSubmittedLevel(null);
            }}
            className="w-full min-h-[48px] inline-flex items-center justify-center text-sm font-medium text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
          >
            Wrong button? Change answer
          </button>

          <Link href="/privacy" className="text-xs text-[var(--ink-2)] hover:underline text-center">
            Privacy
          </Link>
        </div>
      </main>
    );
  }

  // 5. Main Reporting View
  return (
    <main className="max-w-md mx-auto px-4 pt-20 pb-8 min-h-[90vh] flex flex-col justify-between">
      {/* Top Heading */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[var(--ink)] tracking-tight">
          {zone.name}
        </h1>
        <p className="text-lg font-medium text-[var(--ink-2)] mt-1">
          How busy is it?
        </p>
      </div>

      {/* Three huge full-width stacked buttons (>= 96px tall, 3px outline) */}
      <div className="flex flex-col gap-3.5 my-auto py-4">
        {/* Plenty */}
        <button
          type="button"
          onClick={() => handleSubmit(0)}
          disabled={submitting}
          className="w-full min-h-[96px] p-5 rounded-2xl bg-[var(--status-plenty-bg)] text-[var(--status-plenty-text)] border-[3px] border-[var(--status-plenty-text)] flex items-center justify-center gap-3.5 active:scale-[0.98] transition-transform cursor-pointer"
        >
          <StatusCircleIcon level={0} className="w-8 h-8 shrink-0" />
          <span className="text-2xl font-bold font-heading">Plenty of seats</span>
        </button>

        {/* Filling up */}
        <button
          type="button"
          onClick={() => handleSubmit(1)}
          disabled={submitting}
          className="w-full min-h-[96px] p-5 rounded-2xl bg-[var(--status-filling-bg)] text-[var(--status-filling-text)] border-[3px] border-[var(--status-filling-text)] flex items-center justify-center gap-3.5 active:scale-[0.98] transition-transform cursor-pointer"
        >
          <StatusCircleIcon level={1} className="w-8 h-8 shrink-0" />
          <span className="text-2xl font-bold font-heading">Filling up</span>
        </button>

        {/* Full */}
        <button
          type="button"
          onClick={() => handleSubmit(2)}
          disabled={submitting}
          className="w-full min-h-[96px] p-5 rounded-2xl bg-[var(--status-full-bg)] text-[var(--status-full-text)] border-[3px] border-[var(--status-full-text)] flex items-center justify-center gap-3.5 active:scale-[0.98] transition-transform cursor-pointer"
        >
          <StatusCircleIcon level={2} className="w-8 h-8 shrink-0" />
          <span className="text-2xl font-bold font-heading">Full</span>
        </button>
      </div>

      {/* Small text and Privacy link at bottom */}
      <div className="text-center text-xs text-[var(--ink-2)] space-y-1">
        <p>No sign-up. Takes 3 seconds.</p>
        <Link href="/privacy" className="hover:underline text-[11px] opacity-80 inline-block">
          Privacy
        </Link>
      </div>
    </main>
  );
}
