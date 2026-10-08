import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as deleteRoute } from '../src/app/api/privacy/delete/route';
import { GET as retentionRoute } from '../src/app/api/cron/retention/route';
import { SpotsRepository } from '../src/lib/db/repository';
import { generateDeviceHash } from '../src/lib/anti-spam/device-hash';
import { resetIpRateLimits } from '../src/lib/anti-spam/ip-rate-limit';
import strings from '../src/messages/en.json';

describe('Task C: Privacy Policy & Data Deletion', () => {
  beforeEach(() => {
    resetIpRateLimits();
  });

  it('contains all 9 required privacy sections in plain English', () => {
    const p = strings.privacy;
    expect(p.whoRuns.heading).toContain('1. Who runs this');
    expect(p.whoRuns.body).toContain('student project');
    expect(p.whoRuns.body).toContain('privacy@lsespots.app');

    expect(p.whatCollect.heading).toContain('2. What we collect');
    expect(p.whatCollect.tableZone).toBeDefined();
    expect(p.whatCollect.tableDevice).toBeDefined();

    expect(p.whatNotCollect.heading).toContain('3. What we do not collect');
    expect(p.whatNotCollect.body).toContain('name');
    expect(p.whatNotCollect.body).toContain('email');

    expect(p.whyCollect.heading).toContain('4. Why we collect it');
    expect(p.whyCollect.body).toContain('legitimate interests');

    expect(p.howLong.heading).toContain('5. How long we keep it');
    expect(p.howLong.body).toContain('12 months');
    expect(p.howLong.body).toContain('24 hours');

    expect(p.whoHandles.heading).toContain('6. Who else handles it');
    expect(p.whoHandles.body).toContain('Vercel');
    expect(p.whoHandles.body).toContain('Supabase');

    expect(p.storage.heading).toContain('7. Cookies and device storage');
    expect(p.storage.body).toContain('lse_client_random_id');

    expect(p.yourRights.heading).toContain('8. Your rights');
    expect(p.yourRights.body).toContain('ico.org.uk');

    expect(p.lastUpdated.heading).toContain('9. Changes and last updated');
    expect(p.lastUpdated.body).toContain('October 2026');
  });

  it('successfully deletes only reports matching the device hash and clears related events', async () => {
    const testDeviceId = 'device_test_delete_123';
    const otherDeviceId = 'device_test_other_456';
    const testIp = '192.168.10.50';

    const testHash = generateDeviceHash(testDeviceId, testIp);
    const otherHash = generateDeviceHash(otherDeviceId, testIp);

    // Seed 2 reports from test device and 2 reports from other device
    await SpotsRepository.createReport({
      zone_id: 'zone_library_f1',
      level: 0,
      device_hash: testHash,
      is_flagged: false,
    });
    await SpotsRepository.createReport({
      zone_id: 'zone_library_f2',
      level: 1,
      device_hash: testHash,
      is_flagged: false,
    });
    await SpotsRepository.createReport({
      zone_id: 'zone_library_f1',
      level: 2,
      device_hash: otherHash,
      is_flagged: false,
    });

    // Record recommendation event for test device
    await SpotsRepository.recordRecommendationSend('zone-lib-f1', testHash);

    // Call POST /api/privacy/delete
    const req = new NextRequest('http://localhost:3000/api/privacy/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': testIp,
      },
      body: JSON.stringify({ client_random_id: testDeviceId }),
    });

    const res = await deleteRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.deletedReports).toBeGreaterThanOrEqual(2);
    expect(data.deletedEvents).toBeGreaterThanOrEqual(1);

    // Verify other device's reports were NOT deleted
    const allRecent = await SpotsRepository.getAllRecentReports(1000);
    const otherReports = allRecent.filter((r) => r.device_hash === otherHash);
    expect(otherReports.length).toBeGreaterThanOrEqual(1);

    // Verify test device's reports are completely gone
    const testReports = allRecent.filter((r) => r.device_hash === testHash);
    expect(testReports.length).toBe(0);
  });

  it('rate limits the delete endpoint to 5 requests per hour per IP hash', async () => {
    const ip = '10.20.30.40';

    for (let i = 1; i <= 5; i++) {
      const req = new NextRequest('http://localhost:3000/api/privacy/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': ip,
        },
        body: JSON.stringify({ client_random_id: `device_rl_${i}` }),
      });
      const res = await deleteRoute(req);
      expect(res.status).toBe(200);
    }

    // 6th request from the same IP should be blocked with 429
    const reqBlocked = new NextRequest('http://localhost:3000/api/privacy/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': ip,
      },
      body: JSON.stringify({ client_random_id: 'device_rl_6' }),
    });
    const resBlocked = await deleteRoute(reqBlocked);
    expect(resBlocked.status).toBe(429);

    const data = await resBlocked.json();
    expect(data.error).toContain('Too many deletion requests');
  });

  it('rejects deletion requests with missing client_random_id', async () => {
    const req = new NextRequest('http://localhost:3000/api/privacy/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await deleteRoute(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Missing device random identifier');
  });

  it('retention cron job deletes reports older than 12 months and leaves aggregates intact', async () => {
    const now = Date.now();
    const thirteenMonthsAgoIso = new Date(now - 400 * 24 * 60 * 60 * 1000).toISOString();
    const oneMonthAgoIso = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Insert an old report (> 12 months)
    const oldReport = await SpotsRepository.createReport({
      zone_id: 'zone_library_f1',
      level: 1,
      device_hash: 'old_device_hash_12m',
      is_flagged: false,
    });
    // Manually set created_at back in store
    oldReport.created_at = thirteenMonthsAgoIso;

    // Insert a recent report
    const recentReport = await SpotsRepository.createReport({
      zone_id: 'zone_library_f1',
      level: 0,
      device_hash: 'recent_device_hash',
      is_flagged: false,
    });
    recentReport.created_at = oneMonthAgoIso;

    // Run retention cron
    const req = new NextRequest('http://localhost:3000/api/cron/retention', {
      headers: {
        'x-vercel-cron': '1',
      },
    });

    const res = await retentionRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.purged.reports).toBeGreaterThanOrEqual(1);

    // Verify recent report still exists
    const allReports = await SpotsRepository.getAllRecentReports(500 * 24 * 60);
    const foundRecent = allReports.find((r) => r.device_hash === 'recent_device_hash');
    expect(foundRecent).toBeDefined();

    // Verify old report is purged
    const foundOld = allReports.find((r) => r.device_hash === 'old_device_hash_12m');
    expect(foundOld).toBeUndefined();

    // Verify hourly aggregate stats are preserved
    const stats = await SpotsRepository.getHourlyStatsForZone('zone-lib-f1');
    expect(stats.length).toBeGreaterThan(0);
  });
});
