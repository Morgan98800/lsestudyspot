import { NextRequest, NextResponse } from 'next/server';
import { SpotsRepository } from '@/lib/db/repository';
import { generateDeviceHash } from '@/lib/anti-spam/device-hash';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { zone_id, client_random_id } = body;

    if (!zone_id) {
      return NextResponse.json({ error: 'Missing zone_id' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
    const deviceHash = generateDeviceHash(client_random_id || 'anonymous', ip);

    await SpotsRepository.recordRecommendationSend(zone_id, deviceHash);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording recommendation send:', error);
    return NextResponse.json({ error: 'Failed to record send' }, { status: 500 });
  }
}
