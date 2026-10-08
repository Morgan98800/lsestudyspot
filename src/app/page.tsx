import { cookies } from 'next/headers';
import { SpotsRepository } from '@/lib/db/repository';
import { computeZoneEstimate } from '@/lib/algo/estimate';
import { HomeView } from '@/components/HomeView';
import { ZoneWithEstimate } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ now?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const cookieStore = await cookies();
  const cookieNow = cookieStore.get('mock_now')?.value;

  const [zones, reports, sends, exceptions] = await Promise.all([
    SpotsRepository.getZones(true),
    SpotsRepository.getAllRecentReports(90),
    SpotsRepository.getRecentRecommendationSends(15),
    SpotsRepository.getOpeningExceptions(),
  ]);

  const now = sp.now
    ? new Date(sp.now)
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

  return (
    <HomeView
      initialZones={zonesWithEstimates}
      initialSends={sends}
      serverTime={now.toISOString()}
    />
  );
}
