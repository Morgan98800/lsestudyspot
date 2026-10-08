import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as feedbackPostRoute } from '../src/app/api/feedback/route';
import {
  GET as adminFeedbackGetRoute,
  PATCH as adminFeedbackPatchRoute,
  DELETE as adminFeedbackDeleteRoute,
} from '../src/app/api/admin/feedback/route';
import { GET as retentionRoute } from '../src/app/api/cron/retention/route';
import { SpotsRepository } from '../src/lib/db/repository';
import { resetIpRateLimits } from '../src/lib/anti-spam/ip-rate-limit';

describe('Task 1: Feedback API & Admin Management', () => {
  beforeEach(() => {
    resetIpRateLimits();
  });

  it('successfully creates feedback and sanitizes relative from path', async () => {
    const req = new NextRequest('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '128.0.0.1',
      },
      body: JSON.stringify({
        kind: 'idea',
        message: 'It would be great to have quiet floor filters!',
        email: 'student@lse.ac.uk',
        from: '/privacy',
        zone: 'library-first-floor',
        deviceId: 'device-test-1',
      }),
    });

    const res = await feedbackPostRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.feedback).toBeDefined();
    expect(data.feedback.kind).toBe('idea');
    expect(data.feedback.message).toBe('It would be great to have quiet floor filters!');
    expect(data.feedback.email).toBe('student@lse.ac.uk');
    expect(data.feedback.page_path).toBe('/privacy');
    expect(data.feedback.zone_slug).toBe('library-first-floor');
    expect(data.feedback.status).toBe('new');

    // Verify raw IP is NOT stored anywhere
    expect(data.feedback.ip_hash).not.toBe('128.0.0.1');
    expect(data.feedback.ip_hash).toHaveLength(32); // coarse salted hash
    expect((data.feedback as Record<string, unknown>).ip).toBeUndefined();
    expect((data.feedback as Record<string, unknown>).user_agent).toBeUndefined();
  });

  it('strips HTML tags and trims whitespace from message', async () => {
    const req = new NextRequest('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '128.0.0.2',
      },
      body: JSON.stringify({
        kind: 'wrong',
        message: '   <script>alert("xss")</script>There are no seats left here!   ',
        deviceId: 'device-test-html',
      }),
    });

    const res = await feedbackPostRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.feedback.message).toBe('alert("xss")There are no seats left here!');
    expect(data.feedback.message).not.toContain('<script>');
  });

  it('rejects feedback with message shorter than 10 characters', async () => {
    const req = new NextRequest('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'wrong',
        message: 'Too short',
        deviceId: 'device-short',
      }),
    });

    const res = await feedbackPostRoute(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain('10 characters');
  });

  it('rejects feedback with message longer than 500 characters', async () => {
    const longMsg = 'A'.repeat(501);
    const req = new NextRequest('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'wrong',
        message: longMsg,
        deviceId: 'device-long',
      }),
    });

    const res = await feedbackPostRoute(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain('500 characters');
  });

  it('rejects feedback with invalid email', async () => {
    const req = new NextRequest('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'wrong',
        message: 'Valid message describing the problem',
        email: 'not-an-email',
        deviceId: 'device-bad-email',
      }),
    });

    const res = await feedbackPostRoute(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain('email');
  });

  it('rejects honeypot submission', async () => {
    const req = new NextRequest('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'idea',
        message: 'This is spam from an automated bot',
        honeypot: 'bot filled value',
        deviceId: 'bot-device',
      }),
    });

    const res = await feedbackPostRoute(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe('Spam submission detected');
  });

  it('sanitizes ?from= path to null if external URL, protocol-relative, or too long', async () => {
    // 1. External URL
    const req1 = new NextRequest('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'other',
        message: 'Testing external URL sanitization',
        from: 'https://evil.com/phishing',
        deviceId: 'device-sanitize-1',
      }),
    });
    const res1 = await feedbackPostRoute(req1);
    const data1 = await res1.json();
    expect(data1.feedback.page_path).toBeNull();

    // 2. Protocol-relative //evil.com
    const req2 = new NextRequest('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'other',
        message: 'Testing protocol-relative path sanitization',
        from: '//evil.com',
        deviceId: 'device-sanitize-2',
      }),
    });
    const res2 = await feedbackPostRoute(req2);
    const data2 = await res2.json();
    expect(data2.feedback.page_path).toBeNull();

    // 3. Excessively long path > 200 chars
    const req3 = new NextRequest('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'other',
        message: 'Testing long path sanitization',
        from: '/' + 'a'.repeat(205),
        deviceId: 'device-sanitize-3',
      }),
    });
    const res3 = await feedbackPostRoute(req3);
    const data3 = await res3.json();
    expect(data3.feedback.page_path).toBeNull();
  });

  it('enforces device rate limit (3 per hour per device)', async () => {
    const deviceId = 'rate-limited-device-test';
    const ip = '192.168.1.100';

    for (let i = 1; i <= 3; i++) {
      const req = new NextRequest('http://localhost:3000/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': ip,
        },
        body: JSON.stringify({
          kind: 'other',
          message: `Feedback message number ${i} from test device`,
          deviceId,
        }),
      });
      const res = await feedbackPostRoute(req);
      expect(res.status).toBe(200);
    }

    // 4th request from same device should be rate limited with 429
    const reqBlocked = new NextRequest('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': ip,
      },
      body: JSON.stringify({
        kind: 'other',
        message: '4th feedback message that exceeds rate limit',
        deviceId,
      }),
    });
    const resBlocked = await feedbackPostRoute(reqBlocked);
    expect(resBlocked.status).toBe(429);

    const data = await resBlocked.json();
    expect(data.error).toContain('Too many feedback submissions');
  });

  it('enforces IP ceiling (60 per hour per IP hash)', async () => {
    const sharedCampusIp = '158.143.1.50'; // eduRoam IP simulation

    // Simulate 60 submissions from 60 distinct devices on the same eduroam IP
    for (let i = 1; i <= 60; i++) {
      const req = new NextRequest('http://localhost:3000/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': sharedCampusIp,
        },
        body: JSON.stringify({
          kind: 'wrong',
          message: `Feedback message from unique device ${i} on campus`,
          deviceId: `eduroam-device-${i}`,
        }),
      });
      const res = await feedbackPostRoute(req);
      expect(res.status).toBe(200);
    }

    // 61st submission should hit the eduroam IP ceiling
    const reqBlocked = new NextRequest('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': sharedCampusIp,
      },
      body: JSON.stringify({
        kind: 'wrong',
        message: 'Feedback message from device 61 hitting the IP ceiling',
        deviceId: 'eduroam-device-61',
      }),
    });
    const resBlocked = await feedbackPostRoute(reqBlocked);
    expect(resBlocked.status).toBe(429);

    const data = await resBlocked.json();
    expect(data.error).toContain('Too many submissions from this network');
  });

  it('admin feedback endpoints allow listing, status updates, and deletion', async () => {
    // 1. Create a feedback item
    const created = await SpotsRepository.createFeedback({
      kind: 'wrong',
      message: 'The quiet room on 3rd floor is actually very loud today.',
      email: 'student_admin_test@lse.ac.uk',
      page_path: '/z/library-third-floor',
      zone_slug: 'library-third-floor',
      app_version: '0.1.0',
      device_hash: 'admin_test_device_hash',
      ip_hash: 'admin_test_ip_hash',
    });

    // 2. List feedback
    const listReq = new NextRequest('http://localhost:3000/api/admin/feedback');
    const listRes = await adminFeedbackGetRoute(listReq);
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.success).toBe(true);
    expect(listData.counts).toBeDefined();
    expect(listData.counts.new).toBeGreaterThanOrEqual(1);

    const found = listData.feedback.find((f: { id: string }) => f.id === created.id);
    expect(found).toBeDefined();
    expect(found.status).toBe('new');

    // 3. Mark as seen
    const patchReq1 = new NextRequest('http://localhost:3000/api/admin/feedback', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: created.id, status: 'seen' }),
    });
    const patchRes1 = await adminFeedbackPatchRoute(patchReq1);
    expect(patchRes1.status).toBe(200);
    const patchData1 = await patchRes1.json();
    expect(patchData1.feedback.status).toBe('seen');

    // 4. Mark as done
    const patchReq2 = new NextRequest('http://localhost:3000/api/admin/feedback', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: created.id, status: 'done' }),
    });
    const patchRes2 = await adminFeedbackPatchRoute(patchReq2);
    expect(patchRes2.status).toBe(200);
    const patchData2 = await patchRes2.json();
    expect(patchData2.feedback.status).toBe('done');

    // 5. Delete feedback
    const delReq = new NextRequest('http://localhost:3000/api/admin/feedback', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: created.id }),
    });
    const delRes = await adminFeedbackDeleteRoute(delReq);
    expect(delRes.status).toBe(200);
    const delData = await delRes.json();
    expect(delData.success).toBe(true);

    // Verify gone from list
    const finalList = await SpotsRepository.getFeedbackList();
    expect(finalList.find((f) => f.id === created.id)).toBeUndefined();
  });

  it('retention job nulls feedback ip_hash after 24h and deletes feedback older than 12m', async () => {
    const now = Date.now();
    const thirteenMonthsAgo = new Date(now - 400 * 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(now - 48 * 60 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();

    // 1. Feedback older than 12 months (should be deleted)
    const oldFeedback = await SpotsRepository.createFeedback({
      kind: 'idea',
      message: 'Old feedback message from 13 months ago',
      email: null,
      page_path: '/',
      zone_slug: null,
      app_version: '0.1.0',
      device_hash: 'device_old_13m',
      ip_hash: 'ip_hash_old_13m',
    });
    oldFeedback.created_at = thirteenMonthsAgo;

    // 2. Feedback from 2 days ago (ip_hash should be nulled, feedback kept)
    const mediumFeedback = await SpotsRepository.createFeedback({
      kind: 'other',
      message: 'Feedback from two days ago with ip hash to be nulled',
      email: null,
      page_path: '/privacy',
      zone_slug: null,
      app_version: '0.1.0',
      device_hash: 'device_med_48h',
      ip_hash: 'ip_hash_to_null_48h',
    });
    mediumFeedback.created_at = twoDaysAgo;

    // 3. Recent feedback from 1 hour ago (kept intact, ip_hash preserved)
    const recentFeedback = await SpotsRepository.createFeedback({
      kind: 'wrong',
      message: 'Recent feedback message from 1 hour ago',
      email: null,
      page_path: '/',
      zone_slug: null,
      app_version: '0.1.0',
      device_hash: 'device_recent_1h',
      ip_hash: 'ip_hash_recent_1h',
    });
    recentFeedback.created_at = oneHourAgo;

    // Run retention cron
    const req = new NextRequest('http://localhost:3000/api/cron/retention', {
      headers: { 'x-vercel-cron': '1' },
    });
    const res = await retentionRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.purged.feedback).toBeGreaterThanOrEqual(1);
    expect(data.purged.nulledFeedbackIps).toBeGreaterThanOrEqual(1);

    // Verify 13m old feedback deleted
    const all = await SpotsRepository.getFeedbackList();
    expect(all.find((f) => f.id === oldFeedback.id)).toBeUndefined();

    // Verify 2 days old feedback kept, but ip_hash nulled
    const foundMed = all.find((f) => f.id === mediumFeedback.id);
    expect(foundMed).toBeDefined();
    expect(foundMed?.ip_hash).toBeNull();

    // Verify 1 hour old feedback kept, ip_hash preserved
    const foundRecent = all.find((f) => f.id === recentFeedback.id);
    expect(foundRecent).toBeDefined();
    expect(foundRecent?.ip_hash).toBe('ip_hash_recent_1h');
  });
});
