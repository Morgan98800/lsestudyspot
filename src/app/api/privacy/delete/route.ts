import { NextRequest, NextResponse } from 'next/server';
import { SpotsRepository } from '@/lib/db/repository';
import { generateDeviceHash } from '@/lib/anti-spam/device-hash';
import { checkIpRateLimit } from '@/lib/anti-spam/ip-rate-limit';

export async function POST(req: NextRequest) {
  try {
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';

    // 1. Rate limiting: 5 requests per hour per IP hash
    const rateLimit = checkIpRateLimit(clientIp, 5, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many deletion requests from this network. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const clientRandomId = body.client_random_id;

    if (!clientRandomId || typeof clientRandomId !== 'string' || clientRandomId.trim().length === 0) {
      return NextResponse.json({ error: 'Missing device random identifier' }, { status: 400 });
    }

    // 2. Hash device ID using standard pseudonymous derivation
    // (Never log clientRandomId or raw IP)
    const hashWithIp = generateDeviceHash(clientRandomId.trim(), clientIp);
    const hashWithoutIp = generateDeviceHash(clientRandomId.trim(), null);

    // 3. Delete matching reports and recommendation events
    const { deletedReports, deletedEvents } = await SpotsRepository.deleteDataByDeviceHashes([
      hashWithIp,
      hashWithoutIp,
    ]);

    return NextResponse.json({
      success: true,
      deletedReports,
      deletedEvents,
      message:
        deletedReports > 0
          ? `Deleted ${deletedReports} ${deletedReports === 1 ? 'report' : 'reports'}.`
          : 'We found no reports from this device.',
    });
  } catch (error) {
    console.error('Error handling privacy deletion request:', error);
    return NextResponse.json({ error: 'Failed to process deletion request' }, { status: 500 });
  }
}
