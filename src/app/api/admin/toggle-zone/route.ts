import { NextRequest, NextResponse } from 'next/server';
import { SpotsRepository } from '@/lib/db/repository';

export async function POST(request: NextRequest) {
  try {
    const { zone_id, is_active } = await request.json();
    if (!zone_id || typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'Missing zone_id or is_active' }, { status: 400 });
    }

    const success = await SpotsRepository.toggleZoneActive(zone_id, is_active);
    return NextResponse.json({ success });
  } catch (error) {
    console.error('Error toggling zone status:', error);
    return NextResponse.json({ error: 'Failed to update zone' }, { status: 500 });
  }
}
