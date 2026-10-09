import { NextRequest, NextResponse } from 'next/server';
import { SpotsRepository } from '@/lib/db/repository';
import { weekdayIntervalsSchema } from '@/lib/algo/opening-hours';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { zone_id, opening_hours } = body;

    if (!zone_id || !opening_hours) {
      return NextResponse.json({ error: 'Missing zone_id or opening_hours' }, { status: 400 });
    }

    const validation = weekdayIntervalsSchema.safeParse(opening_hours);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid opening hours schema', details: validation.error.format() },
        { status: 400 }
      );
    }

    const updated = await SpotsRepository.updateZoneOpeningHours(zone_id, validation.data);
    if (!updated) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, zone: updated });
  } catch (error: unknown) {
    console.error('Error updating zone hours:', error);
    const message = error instanceof Error ? error.message : 'Failed to update hours';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
