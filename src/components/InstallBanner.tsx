'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Share, X } from 'lucide-react';
import {
  detectInAppBrowser,
  detectPlatform,
  getStoredDismissal,
  getStoredVisitDays,
  recordAccepted,
  recordDismissal,
  recordVisitDay,
  shouldShowInstallPrompt,
} from '@/lib/pwa/install-prompt';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface InstallBannerProps {
  isSearchOpen?: boolean;
  isBottomSheetOpen?: boolean;
}

export function InstallBanner({ isSearchOpen = false, isBottomSheetOpen = false }: InstallBannerProps) {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | 'other'>('other');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Record today's visit day (YYYY-MM-DD in local time)
    const todayStr = new Date().toISOString().split('T')[0];
    const visitDays = recordVisitDay(todayStr);

    const ua = navigator.userAgent || '';
    const detected = detectPlatform(ua, navigator.maxTouchPoints);
    setPlatform(detected);

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).standalone === true;

    const isInApp = detectInAppBrowser(ua);
    const lastDismissedAt = getStoredDismissal();

    const canShow = shouldShowInstallPrompt({
      platform: detected,
      isStandalone,
      visitDays,
      lastDismissedAt,
      now: Date.now(),
      reportJustSubmitted: false,
      isInAppBrowser: isInApp,
      isSearchOpen,
      isBottomSheetOpen,
      isBeforeReportQR: false,
    });

    setVisible(canShow);

    // Capture beforeinstallprompt for Chromium
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, [isSearchOpen, isBottomSheetOpen]);

  if (!visible) return null;

  const handleDismiss = () => {
    recordDismissal();
    setVisible(false);
  };

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) {
      handleDismiss();
      return;
    }
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        recordAccepted();
        setVisible(false);
      } else {
        recordDismissal();
        setVisible(false);
      }
    } catch {
      handleDismiss();
    }
  };

  return (
    <div
      role="region"
      aria-label="Install app banner"
      className="w-full my-6 p-4 rounded-2xl bg-[var(--surface)] border-2 border-[var(--brand)] shadow-sm relative motion-reduce:transition-none"
    >
      <div className="flex items-start gap-3.5 pr-10">
        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-[var(--line)] bg-[var(--brand)] flex items-center justify-center">
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={48}
            height={48}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold font-heading text-[var(--ink)] leading-snug">
            Open LSE Spots faster
          </h2>
          <p className="text-xs text-[var(--ink-2)] mt-0.5">
            Add it to your home screen.
          </p>

          {/* iOS Instructions */}
          {platform === 'ios' ? (
            <div className="mt-2.5 text-xs text-[var(--ink)] font-medium leading-relaxed bg-[var(--surface-2)] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 flex-wrap">
              <span>Tap the Share button</span>
              <Share className="w-3.5 h-3.5 text-[var(--ink)] inline-block shrink-0" aria-label="Share icon" />
              <span>then &apos;Add to Home Screen&apos;.</span>
            </div>
          ) : (
            /* Android / Chrome primary button */
            <div className="mt-3">
              <button
                type="button"
                onClick={handleAndroidInstall}
                className="min-h-[44px] px-4 rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] font-semibold text-xs inline-flex items-center justify-center hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
              >
                Add to home screen
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 44px close target button */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Close"
        className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] rounded-full transition-colors cursor-pointer"
      >
        <X className="w-5 h-5" aria-hidden="true" />
      </button>
    </div>
  );
}
