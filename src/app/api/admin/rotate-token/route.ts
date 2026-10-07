import { NextRequest, NextResponse } from 'next/server';
import { SpotsRepository } from '@/lib/db/repository';

export async function POST(request: NextRequest) {
  try {
    const { zone_id } = await request.json();
    if (!zone_id) {
      return NextResponse.json({ error: 'Missing zone_id' }, { status: 400 });
    }

    const newToken = await SpotsRepository.rotateZoneToken(zone_id);
    return NextResponse.json({ success: true, new_token: newToken });
  } catch (error) {
    console.error('Error rotating token:', error);
    return NextResponse.json({ error: 'Failed to rotate token' }, { status: 500 });
  }
}
