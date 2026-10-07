import { NextRequest, NextResponse } from 'next/server';
import { SpotsRepository } from '@/lib/db/repository';
import { isSupabaseConfigured, supabase } from '@/lib/db/supabase';
import { APP_CONFIG } from '@/lib/config/env';

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
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.rpc('recompute_hourly_stats');
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    // Also recompute memory store from the last 6 weeks (42 days)
    const reports = await SpotsRepository.getAllRecentReports(42 * 24 * 60);
    const zones = await SpotsRepository.getZones(false);

    let count = 0;
    for (const zone of zones) {
      const zoneReports = reports.filter((r) => r.zone_id === zone.id && !r.is_flagged);
      const matrix: Record<string, { sum: number; count: number }> = {};
      const hourlyAgnostic: Record<number, { sum: number; count: number }> = {};

      for (const r of zoneReports) {
        const d = new Date(r.created_at);
        const w = d.getDay();
        const h = d.getHours();
        const key = `${w}_${h}`;

        if (!matrix[key]) matrix[key] = { sum: 0, count: 0 };
        matrix[key].sum += r.level;
        matrix[key].count += 1;

        if (!hourlyAgnostic[h]) hourlyAgnostic[h] = { sum: 0, count: 0 };
        hourlyAgnostic[h].sum += r.level;
        hourlyAgnostic[h].count += 1;
      }

      for (let w = 0; w <= 6; w++) {
        for (let h = 0; h <= 23; h++) {
          const key = `${w}_${h}`;
          const stat = matrix[key];
          let avg = 0.4;
          let nReports = 0;

          if (stat && stat.count >= 5) {
            avg = Number((stat.sum / stat.count).toFixed(2));
            nReports = stat.count;
          } else if (hourlyAgnostic[h] && hourlyAgnostic[h].count > 0) {
            // Fall back to weekday-agnostic hourly average when n < 5
            avg = Number((hourlyAgnostic[h].sum / hourlyAgnostic[h].count).toFixed(2));
            nReports = hourlyAgnostic[h].count;
          }

          if (isSupabaseConfigured && supabase) {
            await supabase.from('hourly_stats').upsert({
              zone_id: zone.id,
              weekday: w,
              hour: h,
              avg_level: avg,
              n_reports: nReports,
              updated_at: new Date().toISOString(),
            });
          }
          count++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Recomputed hourly stats from last 6 weeks',
      records: count,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Nightly cron error:', err);
    return NextResponse.json({ error: 'Failed to recompute stats' }, { status: 500 });
  }
}
