import { NextResponse } from 'next/server';
import { SpotsRepository } from '@/lib/db/repository';
import { computeZoneEstimate } from '@/lib/algo/estimate';
import { ZoneWithEstimate } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [zones, reports] = await Promise.all([
      SpotsRepository.getZones(true),
      SpotsRepository.getAllRecentReports(90),
    ]);

    const now = new Date();
    const zonesWithEstimates: ZoneWithEstimate[] = await Promise.all(
      zones.map(async (zone) => {
        const stats = await SpotsRepository.getHourlyStatsForZone(zone.id);
        const zoneReports = reports.filter((r) => r.zone_id === zone.id);
        const estimate = computeZoneEstimate(zone, zoneReports, stats, now);
        return {
          ...zone,
          estimate,
        };
      })
    );

    return NextResponse.json({ success: true, zones: zonesWithEstimates });
  } catch (error) {
    console.error('Error fetching zones:', error);
    return NextResponse.json({ error: 'Failed to fetch zones' }, { status: 500 });
  }
}
