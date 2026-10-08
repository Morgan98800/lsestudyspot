import { NextRequest, NextResponse } from 'next/server';
import { SpotsRepository } from '@/lib/db/repository';
import { generateDeviceHash } from '@/lib/anti-spam/device-hash';
import { verifyTurnstileToken } from '@/lib/anti-spam/turnstile';
import { getOpenState } from '@/lib/algo/opening-hours';
import { BusynessLevel } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      zone_id,
      slug,
      token,
      level,
      client_random_id,
      turnstile_token,
      honeypot,
      is_correction,
    } = body;

    // 1. Bot Honeypot
    if (honeypot && String(honeypot).trim().length > 0) {
      return NextResponse.json({ success: true });
    }

    // 2. Validate busyness level (0 = Plenty, 1 = Filling up, 2 = Full)
    if (level !== 0 && level !== 1 && level !== 2) {
      return NextResponse.json({ error: 'Invalid busyness level' }, { status: 400 });
    }

    // 3. Find zone
    const zone = zone_id
      ? await SpotsRepository.getZoneById(zone_id)
      : slug
      ? await SpotsRepository.getZoneBySlug(slug)
      : null;

    if (!zone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    if (!zone.is_active) {
      return NextResponse.json({ error: 'This study space is currently inactive' }, { status: 400 });
    }

    // Check if space is currently closed
    const exceptions = await SpotsRepository.getOpeningExceptions(zone.id);
    const openState = getOpenState(zone, exceptions, new Date());
    if (!openState.isOpen) {
      const opensText = openState.nextOpenAt
        ? (openState.nextOpenAt.day === 'today' ? openState.nextOpenAt.time : `${openState.nextOpenAt.day} ${openState.nextOpenAt.time}`)
        : 'later';
      return NextResponse.json(
        {
          error: `This space is closed. It opens at ${opensText}.`,
          is_closed: true,
        },
        { status: 400 }
      );
    }

    // 4. Token validation (proof of presence)
    if (!token || token !== zone.qr_token) {
      return NextResponse.json(
        {
          error:
            'This code is out of date. Ask the library desk, or open the app to find the space you are in.',
          invalid_token: true,
        },
        { status: 403 }
      );
    }

    // 5. Cloudflare Turnstile bot verification
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    const turnstileResult = await verifyTurnstileToken(turnstile_token, clientIp);
    if (!turnstileResult.success) {
      return NextResponse.json({ error: 'Security verification failed' }, { status: 400 });
    }

    // 6. Device hash & rate limiting
    const deviceHash = generateDeviceHash(client_random_id || 'anonymous_student', clientIp);
    const recentReports = await SpotsRepository.getRecentReports(zone.id, 10);
    const existingRecent = recentReports.find((r) => r.device_hash === deviceHash);

    // If user tapped "Wrong button? Change answer", replace previous report
    if (is_correction) {
      const updatedReport = await SpotsRepository.replaceLatestReportFromDevice(
        zone.id,
        deviceHash,
        level as BusynessLevel
      );
      return NextResponse.json({ success: true, report: updatedReport, replaced: true });
    }

    // Otherwise apply 10-minute rate limit
    if (existingRecent) {
      const elapsedMins = Math.floor(
        (Date.now() - new Date(existingRecent.created_at).getTime()) / (60 * 1000)
      );
      const remainingMins = Math.max(1, 10 - elapsedMins);
      return NextResponse.json(
        {
          error: `You already reported here. You can report again in ${remainingMins} min.`,
          rate_limited: true,
          remaining_minutes: remainingMins,
        },
        { status: 429 }
      );
    }

    // 7. Outlier Detection: flag report contradicting 3+ recent reports by 2 levels
    // e.g. level=2 (Full) while 3+ recent say 0 (Plenty), or level=0 while 3+ recent say 2
    let isFlagged = false;
    if (recentReports.length >= 3) {
      const allZeros = recentReports.slice(0, 3).every((r) => r.level === 0);
      const allTwos = recentReports.slice(0, 3).every((r) => r.level === 2);

      if (level === 2 && allZeros) {
        isFlagged = true;
      } else if (level === 0 && allTwos) {
        isFlagged = true;
      }
    }

    // 8. Create report
    const report = await SpotsRepository.createReport({
      zone_id: zone.id,
      level: level as BusynessLevel,
      device_hash: deviceHash,
      is_flagged: isFlagged,
    });

    return NextResponse.json({
      success: true,
      report,
      is_flagged: isFlagged,
    });
  } catch (error) {
    console.error('Error submitting report:', error);
    return NextResponse.json({ error: 'Failed to process report' }, { status: 500 });
  }
}
