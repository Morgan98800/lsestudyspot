import { NextRequest, NextResponse } from 'next/server';
import { SpotsRepository } from '@/lib/db/repository';
import { purgeOldIpRateLimits } from '@/lib/anti-spam/ip-rate-limit';
import { APP_CONFIG } from '@/lib/config/env';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secretParam = request.nextUrl.searchParams.get('secret');
  const authHeader = request.headers.get('authorization');
  const cronHeader = request.headers.get('x-vercel-cron');

  const isAuthorized =
    secretParam === APP_CONFIG.adminSecret ||
    authHeader === `Bearer ${APP_CONFIG.adminSecret}` ||
    Boolean(cronHeader);

  if (!isAuthorized && APP_CONFIG.isProduction) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Purge reports > 12 months, recommendation events > 7 days
    const { deletedReports, deletedEvents } = await SpotsRepository.runDataRetentionPurge();

    // 2. Purge rate limit hashes older than 24 hours
    const purgedRateLimits = purgeOldIpRateLimits(24 * 60 * 60 * 1000);

    // 3. Log counts only (never raw identifiers or personal data)
    console.log(
      `[Retention Cron] Purged ${deletedReports} reports (>12m), ${deletedEvents} recommendation events (>7d), ${purgedRateLimits} IP rate-limit entries (>24h)`
    );

    return NextResponse.json({
      success: true,
      purged: {
        reports: deletedReports,
        recommendationEvents: deletedEvents,
        rateLimits: purgedRateLimits,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Retention cron error:', err);
    return NextResponse.json({ error: err.message || 'Failed to run retention job' }, { status: 500 });
  }
}
