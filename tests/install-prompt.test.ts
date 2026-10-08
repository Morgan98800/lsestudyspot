import { describe, it, expect } from 'vitest';
import {
  shouldShowInstallPrompt,
  detectInAppBrowser,
  detectPlatform,
  THIRTY_DAYS_MS,
  ShouldShowInstallPromptParams,
} from '../src/lib/pwa/install-prompt';

describe('PWA Install Prompt Decision Function Tests', () => {
  const baseParams: ShouldShowInstallPromptParams = {
    platform: 'ios',
    isStandalone: false,
    visitDays: ['2026-10-06', '2026-10-07', '2026-10-08'],
    lastDismissedAt: null,
    now: 1791550000000,
    reportJustSubmitted: false,
    isInAppBrowser: false,
    isSearchOpen: false,
    isBottomSheetOpen: false,
    isBeforeReportQR: false,
  };

  it('shows prompt on 3rd distinct visit day on iOS mobile Safari', () => {
    expect(shouldShowInstallPrompt(baseParams)).toBe(true);
  });

  it('does NOT show prompt on first or second visit day', () => {
    expect(
      shouldShowInstallPrompt({
        ...baseParams,
        visitDays: ['2026-10-08'],
      })
    ).toBe(false);

    expect(
      shouldShowInstallPrompt({
        ...baseParams,
        visitDays: ['2026-10-07', '2026-10-08'],
      })
    ).toBe(false);
  });

  it('shows prompt immediately after a report is submitted even on first visit', () => {
    expect(
      shouldShowInstallPrompt({
        ...baseParams,
        visitDays: ['2026-10-08'],
        reportJustSubmitted: true,
      })
    ).toBe(true);
  });

  it('never shows prompt if app is already running in standalone mode', () => {
    expect(
      shouldShowInstallPrompt({
        ...baseParams,
        isStandalone: true,
      })
    ).toBe(false);

    expect(
      shouldShowInstallPrompt({
        ...baseParams,
        isStandalone: true,
        reportJustSubmitted: true,
      })
    ).toBe(false);
  });

  it('does NOT show prompt on desktop', () => {
    expect(
      shouldShowInstallPrompt({
        ...baseParams,
        platform: 'desktop',
      })
    ).toBe(false);

    expect(
      shouldShowInstallPrompt({
        ...baseParams,
        platform: 'desktop',
        reportJustSubmitted: true,
      })
    ).toBe(false);
  });

  it('does NOT show prompt in in-app browsers', () => {
    expect(
      shouldShowInstallPrompt({
        ...baseParams,
        isInAppBrowser: true,
      })
    ).toBe(false);

    expect(
      shouldShowInstallPrompt({
        ...baseParams,
        isInAppBrowser: true,
        reportJustSubmitted: true,
      })
    ).toBe(false);
  });

  it('does NOT show prompt on QR page before report is submitted', () => {
    expect(
      shouldShowInstallPrompt({
        ...baseParams,
        isBeforeReportQR: true,
      })
    ).toBe(false);
  });

  it('does NOT show prompt when search or bottom sheet is open', () => {
    expect(
      shouldShowInstallPrompt({
        ...baseParams,
        isSearchOpen: true,
      })
    ).toBe(false);

    expect(
      shouldShowInstallPrompt({
        ...baseParams,
        isBottomSheetOpen: true,
      })
    ).toBe(false);
  });

  it('backs off for 30 days after user dismisses the prompt', () => {
    const dismissedAt = baseParams.now - 1000 * 60; // 1 minute ago
    expect(
      shouldShowInstallPrompt({
        ...baseParams,
        lastDismissedAt: dismissedAt,
      })
    ).toBe(false);

    // After 30 days + 1 ms, it can show again
    const expiredDismissal = baseParams.now - (THIRTY_DAYS_MS + 1000);
    expect(
      shouldShowInstallPrompt({
        ...baseParams,
        lastDismissedAt: expiredDismissal,
      })
    ).toBe(true);
  });
});

describe('In-app Browser and Platform Detection Tests', () => {
  it('detects Instagram, TikTok, Facebook in-app user agents', () => {
    const instagramUA =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/20F66 Instagram 289.0.0.21.111';
    const fbUA =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/19A346 [FBAN/FBIOS;FBAV/340.0.0.28.113]';
    const tikTokUA =
      'Mozilla/5.0 (Linux; Android 12; Pixel 6 Build/SD2A.220105.001.A1; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36 trill_230103';

    expect(detectInAppBrowser(instagramUA)).toBe(true);
    expect(detectInAppBrowser(fbUA)).toBe(true);
    expect(detectInAppBrowser(tikTokUA)).toBe(true);
  });

  it('identifies standard Safari and Chrome as regular browsers', () => {
    const safariUA =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const chromeUA =
      'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36';

    expect(detectInAppBrowser(safariUA)).toBe(false);
    expect(detectInAppBrowser(chromeUA)).toBe(false);
  });

  it('detects platforms accurately', () => {
    const iphoneUA =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const androidUA =
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36';
    const macDesktopUA =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    expect(detectPlatform(iphoneUA)).toBe('ios');
    expect(detectPlatform(androidUA)).toBe('android');
    expect(detectPlatform(macDesktopUA, 0)).toBe('desktop');
  });
});
