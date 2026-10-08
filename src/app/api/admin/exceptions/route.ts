import { NextRequest, NextResponse } from 'next/server';
import { SpotsRepository } from '@/lib/db/repository';
import { z } from 'zod';

const exceptionInputSchema = z
  .object({
    zone_id: z.string().nullable().optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
    is_closed: z.boolean(),
    open_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/).nullable().optional(),
    close_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/).nullable().optional(),
    reason: z.string().min(1, 'Reason is required'),
  })
  .refine((data) => data.start_date <= data.end_date, {
    message: 'start_date must be on or before end_date',
    path: ['end_date'],
  });

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const zoneId = url.searchParams.get('zone_id') || undefined;
    const exceptions = await SpotsRepository.getOpeningExceptions(zoneId);
    return NextResponse.json({ success: true, exceptions });
  } catch (error) {
    console.error('Error fetching exceptions:', error);
    return NextResponse.json({ error: 'Failed to fetch exceptions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = exceptionInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid exception data', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const created = await SpotsRepository.createOpeningException({
      zone_id: parsed.data.zone_id || null,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      is_closed: parsed.data.is_closed,
      open_time: parsed.data.open_time || null,
      close_time: parsed.data.close_time || null,
      reason: parsed.data.reason,
    });

    return NextResponse.json({ success: true, exception: created });
  } catch (error) {
    console.error('Error creating exception:', error);
    return NextResponse.json({ error: 'Failed to create exception' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing exception id' }, { status: 400 });
    }

    const ok = await SpotsRepository.deleteOpeningException(id);
    return NextResponse.json({ success: ok });
  } catch (error) {
    console.error('Error deleting exception:', error);
    return NextResponse.json({ error: 'Failed to delete exception' }, { status: 500 });
  }
}
