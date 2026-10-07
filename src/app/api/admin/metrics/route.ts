import { NextResponse } from 'next/server';
import { SpotsRepository } from '@/lib/db/repository';

export async function GET() {
  try {
    const volume = await SpotsRepository.getReportVolumePerZone();
    return NextResponse.json({ success: true, volume });
  } catch (error) {
    console.error('Error fetching admin metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
