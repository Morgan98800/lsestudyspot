import { NextRequest, NextResponse } from 'next/server';
import { SpotsRepository } from '@/lib/db/repository';
import { generatePosterPdf } from '@/lib/poster/generator';
import { APP_CONFIG } from '@/lib/config/env';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const zoneId = searchParams.get('zoneId');
  const sizeParam = searchParams.get('size') || 'a5';
  const size = sizeParam.toLowerCase() === 'a6' ? 'A6' : 'A5';

  // Find zone
  const zone = zoneId ? await SpotsRepository.getZoneById(zoneId) : null;

  if (!zone) {
    return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
  }

  try {
    const pdfBytes = await generatePosterPdf(zone, {
      size,
      baseUrl: APP_CONFIG.appUrl,
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="poster-${zone.slug}-${size.toLowerCase()}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Failed to generate poster PDF:', error);
    return NextResponse.json({ error: 'Failed to generate poster PDF' }, { status: 500 });
  }
}
