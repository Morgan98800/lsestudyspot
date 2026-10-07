import { SpotsRepository } from '@/lib/db/repository';
import { computeZoneEstimate } from '@/lib/algo/estimate';
import { HomeView } from '@/components/HomeView';
import { ZoneWithEstimate } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
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

  return <HomeView initialZones={zonesWithEstimates} />;
}
