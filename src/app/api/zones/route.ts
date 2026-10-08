import { NextRequest, NextResponse } from 'next/server';
import { SpotsRepository } from '@/lib/db/repository';
import { computeZoneEstimate } from '@/lib/algo/estimate';
import { ZoneWithEstimate } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const [zones, reports, sends, exceptions] = await Promise.all([
      SpotsRepository.getZones(true),
      SpotsRepository.getAllRecentReports(90),
      SpotsRepository.getRecentRecommendationSends(15),
      SpotsRepository.getOpeningExceptions(),
    ]);

    const url = new URL(req.url);
    const nowParam = url.searchParams.get('now');
    const cookieNow = req.cookies.get('mock_now')?.value;
    const now = nowParam
      ? new Date(nowParam)
      : cookieNow
      ? new Date(cookieNow)
      : process.env.PLAYWRIGHT_TEST_TIME
      ? new Date(process.env.PLAYWRIGHT_TEST_TIME)
      : new Date();

    const zonesWithEstimates: ZoneWithEstimate[] = await Promise.all(
      zones.map(async (zone) => {
        const stats = await SpotsRepository.getHourlyStatsForZone(zone.id);
        const zoneReports = reports.filter((r) => r.zone_id === zone.id);
        const estimate = computeZoneEstimate(zone, zoneReports, stats, now, exceptions);
        return {
          ...zone,
          estimate,
        };
      })
    );

    return NextResponse.json({
      success: true,
      zones: zonesWithEstimates,
      recommendationSends: sends,
      serverTime: now.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching zones:', error);
    return NextResponse.json({ error: 'Failed to fetch zones' }, { status: 500 });
  }
}
