/**
 * PWA Install Prompt Decision Logic & Storage
 * Pure functions and browser detection helpers.
 */

export interface ShouldShowInstallPromptParams {
  platform: 'ios' | 'android' | 'desktop' | 'other';
  isStandalone: boolean;
  visitDays: string[];
  lastDismissedAt: number | null;
  now: number;
  reportJustSubmitted: boolean;
  isInAppBrowser: boolean;
  isSearchOpen?: boolean;
  isBottomSheetOpen?: boolean;
  isBeforeReportQR?: boolean;
}

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Pure decision function determining whether the install banner / action should be visible.
 */
export function shouldShowInstallPrompt(params: ShouldShowInstallPromptParams): boolean {
  // 1. Never show if already running standalone or installed
  if (params.isStandalone) {
    return false;
  }

  // 2. Desktop: do not show
  if (params.platform === 'desktop') {
    return false;
  }

  // 3. In-app browsers: do not show
  if (params.isInAppBrowser) {
    return false;
  }

  // 4. Never show in search, while bottom sheet is open, or on QR page before reporting
  if (params.isBeforeReportQR || params.isSearchOpen || params.isBottomSheetOpen) {
    return false;
  }

  // 5. Check 30-day dismissal backoff
  if (params.lastDismissedAt !== null) {
    const elapsed = params.now - params.lastDismissedAt;
    if (elapsed < THIRTY_DAYS_MS) {
      return false;
    }
  }

  // 6. Trigger condition: After report submission OR on 3rd distinct visit day
  if (params.reportJustSubmitted) {
    return true;
  }

  // Otherwise, must have visited on at least 3 distinct calendar days
  if (params.visitDays && params.visitDays.length >= 3) {
    return true;
  }

  return false;
}

/**
 * Detects if the current user agent is an embedded in-app browser
 * (Instagram, TikTok, Facebook, LinkedIn, WhatsApp/Telegram webview).
 */
export function detectInAppBrowser(ua: string): boolean {
  if (!ua) return false;
  const inAppPatterns = [
    /FBAN/i,
    /FBAV/i,
    /Instagram/i,
    /TikTok/i,
    /musical_ly/i,
    /LinkedInApp/i,
    /Snapchat/i,
    /MicroMessenger/i,
    /Line\//i,
    /WhatsApp/i,
    /Telegram/i,
    /; wv\)/i, // Android System WebView indicator
  ];
  return inAppPatterns.some((pattern) => pattern.test(ua));
}

/**
 * Detects platform: 'ios' | 'android' | 'desktop' | 'other'
 */
export function detectPlatform(ua: string, maxTouchPoints = 0): 'ios' | 'android' | 'desktop' | 'other' {
  if (!ua) return 'other';

  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && maxTouchPoints > 1); // iPadOS Safari reports as Macintosh

  if (isIOS) return 'ios';

  if (/Android/i.test(ua)) return 'android';

  if (/Windows|Macintosh|Linux/i.test(ua) && !/Mobile/i.test(ua)) {
    return 'desktop';
  }

  return 'other';
}

/**
 * Storage helpers with safe try/catch guards.
 * Returns null / defaults if localStorage is disabled or throws.
 */
const STORAGE_KEY_VISIT_DAYS = 'lse_pwa_visit_days';
const STORAGE_KEY_DISMISSED = 'lse_pwa_dismissed_at';

export function getStoredVisitDays(): string[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY_VISIT_DAYS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordVisitDay(todayIsoDate: string): string[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const days = getStoredVisitDays();
    if (!days.includes(todayIsoDate)) {
      days.push(todayIsoDate);
      localStorage.setItem(STORAGE_KEY_VISIT_DAYS, JSON.stringify(days));
    }
    return days;
  } catch {
    return [];
  }
}

export function getStoredDismissal(): number | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY_DISMISSED);
    if (!raw) return null;
    const ts = parseInt(raw, 10);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

export function recordDismissal(now = Date.now()): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_DISMISSED, String(now));
  } catch {
    // ignore storage error
  }
}

export function recordAccepted(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    // Hide forever: set timestamp to far future
    localStorage.setItem(STORAGE_KEY_DISMISSED, String(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000));
  } catch {
    // ignore
  }
}
