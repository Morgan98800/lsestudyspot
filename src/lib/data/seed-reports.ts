import { BusynessLevel, Report } from '@/types/database';
import { STARTER_ZONES } from './starter-zones';

/**
 * Generates 3 weeks of realistic term-time reports:
 * - Peak rush: 11:00 - 14:00 (Mostly Filling up / Full)
 * - Quiet early morning and evenings (Mostly Plenty)
 * - Fresh reports for active zones in the last 5-45 minutes
 * - Zones left without recent reports to demo the predicted state (dashed outline + "Usual level")
 */
export function generateSeedReports(now: Date = new Date()): Report[] {
  const reports: Report[] = [];
  let idCounter = 1;
  const totalDays = 21; // 3 weeks

  for (let dayOffset = totalDays; dayOffset >= 0; dayOffset--) {
    const targetDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
    const dayOfWeek = targetDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    for (const zone of STARTER_ZONES) {
      if (!zone.is_active) continue;
      // Skip closed weekend zones
      if (zone.id === 'zone-shaw' && isWeekend) continue;
      if (zone.id === 'zone-nab-seating' && isWeekend) continue;

      for (let h = 8; h <= 21; h++) {
        // Busyness probabilities
        let fullProb = 0.08;
        let fillingProb = 0.25;

        if (h >= 11 && h <= 14) {
          // Peak rush hours
          fullProb = zone.noise === 'silent' ? 0.6 : 0.45;
          fillingProb = 0.35;
        } else if (h >= 15 && h <= 17) {
          fullProb = 0.25;
          fillingProb = 0.4;
        } else if (h >= 18) {
          fullProb = 0.05;
          fillingProb = 0.2;
        }

        if (isWeekend) {
          fullProb *= 0.6;
          fillingProb *= 0.7;
        }

        // Add 1-2 reports per zone during peak hours
        const count = h >= 11 && h <= 14 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const minute = Math.floor(Math.random() * 60);
          const reportTime = new Date(targetDate);
          reportTime.setHours(h, minute, Math.floor(Math.random() * 60), 0);

          if (reportTime.getTime() > now.getTime()) continue;

          const rand = Math.random();
          let level: BusynessLevel = 0; // Plenty
          if (rand < fullProb) {
            level = 2; // Full
          } else if (rand < fullProb + fillingProb) {
            level = 1; // Filling up
          }

          reports.push({
            id: `rep-${idCounter++}`,
            zone_id: zone.id,
            level,
            created_at: reportTime.toISOString(),
            device_hash: `dev_hash_${(idCounter % 50) + 1}`,
            is_flagged: false,
          });
        }
      }
    }
  }

  // Add deliberate FRESH reports for current live demo
  // 1. Library Floor 1: Plenty (live, 8 min ago)
  // 2. Library Floor 2: Full (live, 4 min ago)
  // 3. Marshall Atrium: Filling up (live, 12 min ago)
  // 4. Saw Swee Hock: Plenty (live, 18 min ago)
  // 5. Centre Building: Filling up (live, 25 min ago)
  // (Library Floor 3 & NAB left with NO reports in 90 mins -> demonstrates PREDICTED "Usual level"!)
  const liveDemoSeeds: { zone_id: string; level: BusynessLevel; minsAgo: number }[] = [
    { zone_id: 'zone-lib-f1', level: 0, minsAgo: 8 },
    { zone_id: 'zone-lib-f1', level: 0, minsAgo: 22 },
    { zone_id: 'zone-lib-f2', level: 2, minsAgo: 4 },
    { zone_id: 'zone-lib-f2', level: 2, minsAgo: 16 },
    { zone_id: 'zone-mar-atrium', level: 1, minsAgo: 12 },
    { zone_id: 'zone-saw-f2', level: 0, minsAgo: 18 },
    { zone_id: 'zone-cb-atrium', level: 1, minsAgo: 25 },
  ];

  for (const s of liveDemoSeeds) {
    reports.push({
      id: `rep-live-${idCounter++}`,
      zone_id: s.zone_id,
      level: s.level,
      created_at: new Date(now.getTime() - s.minsAgo * 60 * 1000).toISOString(),
      device_hash: `dev_live_${idCounter}`,
      is_flagged: false,
    });
  }

  return reports;
}
