import { NextRequest, NextResponse } from 'next/server';
import { SpotsRepository } from '@/lib/db/repository';
import { isSupabaseConfigured, supabase } from '@/lib/db/supabase';
import { APP_CONFIG } from '@/lib/config/env';
import { getPeriod } from '@/lib/algo/calendar';
import { PredictionBucket } from '@/types/database';

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
    // 8 weeks cutoff (56 days)
    const [reports, zones, periods] = await Promise.all([
      SpotsRepository.getAllRecentReports(56 * 24 * 60),
      SpotsRepository.getZones(false),
      SpotsRepository.getAcademicPeriods(),
    ]);

    const nowMs = Date.now();
    let totalStatsRows = 0;

    for (const zone of zones) {
      const zoneReports = reports.filter((r) => r.zone_id === zone.id && !r.is_flagged);

      // Matrix keyed by: `${bucket}_${weekday}_${hour}`
      const matrix: Record<string, { weightedSum: number; totalWeight: number; count: number }> = {};

      for (const r of zoneReports) {
        const rDate = new Date(r.created_at);
        const w = rDate.getDay();
        const h = rDate.getHours();
        const periodInfo = getPeriod(rDate, periods);
        const bucket = periodInfo.bucket;

        // Weight recent weeks more (half-life of 4 weeks)
        const weeksAgo = Math.max(0, (nowMs - rDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        const weight = Math.pow(0.5, weeksAgo / 4);

        const key = `${bucket}_${w}_${h}`;
        if (!matrix[key]) {
          matrix[key] = { weightedSum: 0, totalWeight: 0, count: 0 };
        }
        matrix[key].weightedSum += r.level * weight;
        matrix[key].totalWeight += weight;
        matrix[key].count += 1;
      }

      // Upsert rows
      for (const [key, stat] of Object.entries(matrix)) {
        const [bucketStr, wStr, hStr] = key.split('_');
        const avg = stat.totalWeight > 0 ? Number((stat.weightedSum / stat.totalWeight).toFixed(2)) : 0.4;

        await SpotsRepository.upsertHourlyStat({
          zone_id: zone.id,
          bucket: bucketStr as PredictionBucket,
          weekday: parseInt(wStr, 10),
          hour: parseInt(hStr, 10),
          avg_level: avg,
          n_reports: stat.count,
          updated_at: new Date().toISOString(),
        });
        totalStatsRows++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Recomputed bucketed hourly stats from last 8 weeks',
      records: totalStatsRows,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Nightly cron error:', err);
    return NextResponse.json({ error: err.message || 'Failed to recompute stats' }, { status: 500 });
  }
}
