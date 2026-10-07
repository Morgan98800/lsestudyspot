/**
 * Application environment configuration
 */

export const APP_CONFIG = {
  appName: 'LSE Spots',
  appDescription: 'Real-time unofficial study seat estimator for LSE students.',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  adminSecret: process.env.ADMIN_SECRET || 'lsespots-admin-2026',
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '',
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY || '',
  // Half-life in minutes for exponential decay of crowdsourced reports
  halfLifeMinutes: 20,
  // Time window for live estimate calculation
  recentWindowMinutes: 90,
  // Rate limit: 1 report per zone per device per 10 minutes
  rateLimitMinutes: 10,
  // Disclaimer
  disclaimer: 'Student-built, not affiliated with LSE. Estimates only.',
};
