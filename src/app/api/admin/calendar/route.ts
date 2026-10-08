import { NextRequest, NextResponse } from 'next/server';
import { SpotsRepository } from '@/lib/db/repository';
import {
  validateNoPeriodOverlaps,
  parseAcademicPeriodsCsv,
  DEFAULT_MULTIPLIERS,
} from '@/lib/algo/calendar';
import { AcademicPeriodType, PredictionBucket } from '@/types/database';
import { z } from 'zod';

const periodSchema = z
  .object({
    id: z.string().optional(),
    academic_year: z.string().min(1, 'Academic year is required (e.g. 2026/27)'),
    name: z.string().min(1, 'Period name is required'),
    type: z.enum(['teaching', 'reading', 'exam', 'vacation']),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
    notes: z.string().optional().default(''),
  })
  .refine((data) => data.start_date <= data.end_date, {
    message: 'start_date must be on or before end_date',
    path: ['end_date'],
  });

export async function GET() {
  try {
    const [periods, multipliers] = await Promise.all([
      SpotsRepository.getAcademicPeriods(),
      SpotsRepository.getBucketMultipliers(),
    ]);

    return NextResponse.json({
      success: true,
      periods,
      multipliers,
    });
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. CSV import
    if (body.action === 'import_csv') {
      const csvText = body.csvText;
      if (typeof csvText !== 'string' || !csvText.trim()) {
        return NextResponse.json({ error: 'Missing or empty csvText' }, { status: 400 });
      }

      const parsedPeriods = parseAcademicPeriodsCsv(csvText);
      if (parsedPeriods.length === 0) {
        return NextResponse.json(
          { error: 'No valid periods found in CSV. Expected headers: academic_year,name,type,start_date,end_date,notes' },
          { status: 400 }
        );
      }

      const validation = validateNoPeriodOverlaps(parsedPeriods);
      if (!validation.isValid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      // Add each period
      const created = [];
      for (const p of parsedPeriods) {
        const item = await SpotsRepository.createAcademicPeriod(p);
        created.push(item);
      }

      return NextResponse.json({
        success: true,
        importedCount: created.length,
        periods: created,
      });
    }

    // 2. Multipliers update
    if (body.action === 'multipliers' || body.multipliers) {
      const rawMultipliers = body.multipliers || {};
      const clampedMultipliers: Partial<Record<PredictionBucket, number>> = {};

      const buckets: PredictionBucket[] = ['exam', 'reading', 'vacation', 'early', 'mid', 'late'];
      for (const b of buckets) {
        if (rawMultipliers[b] !== undefined) {
          const val = Number(rawMultipliers[b]);
          if (!isNaN(val)) {
            clampedMultipliers[b] = Math.max(0, Math.min(2, Number(val.toFixed(2))));
          }
        }
      }

      const updated = await SpotsRepository.updateBucketMultipliers(clampedMultipliers);
      return NextResponse.json({ success: true, multipliers: updated });
    }

    // 3. Create period
    const parsed = periodSchema.safeParse(body.period || body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid period data', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const newPeriod = parsed.data;

    // Check overlap against existing periods in the same academic year
    const existing = await SpotsRepository.getAcademicPeriods();
    const existingInYear = existing.filter((p) => p.academic_year === newPeriod.academic_year);
    const validation = validateNoPeriodOverlaps([...existingInYear, newPeriod]);

    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const created = await SpotsRepository.createAcademicPeriod({
      academic_year: newPeriod.academic_year,
      name: newPeriod.name,
      type: newPeriod.type as AcademicPeriodType,
      start_date: newPeriod.start_date,
      end_date: newPeriod.end_date,
      notes: newPeriod.notes || '',
    });

    return NextResponse.json({ success: true, period: created });
  } catch (error) {
    console.error('Error handling calendar POST:', error);
    return NextResponse.json({ error: 'Failed to process calendar request' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const id = body.id;
    if (!id) {
      return NextResponse.json({ error: 'Missing period id' }, { status: 400 });
    }

    const parsed = periodSchema.partial().safeParse(body.updates || body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid period updates', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const existing = await SpotsRepository.getAcademicPeriods();
    const target = existing.find((p) => p.id === id);
    if (!target) {
      return NextResponse.json({ error: 'Academic period not found' }, { status: 404 });
    }

    const updatedCandidate = {
      ...target,
      ...parsed.data,
    };

    if (updatedCandidate.start_date > updatedCandidate.end_date) {
      return NextResponse.json({ error: 'start_date cannot be after end_date' }, { status: 400 });
    }

    // Validate overlap excluding the current period
    const otherInYear = existing.filter(
      (p) => p.id !== id && p.academic_year === updatedCandidate.academic_year
    );
    const validation = validateNoPeriodOverlaps([...otherInYear, updatedCandidate]);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const updated = await SpotsRepository.updateAcademicPeriod(id, parsed.data);
    return NextResponse.json({ success: true, period: updated });
  } catch (error) {
    console.error('Error handling calendar PUT:', error);
    return NextResponse.json({ error: 'Failed to update academic period' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const id = body.id || url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing period id' }, { status: 400 });
    }

    const ok = await SpotsRepository.deleteAcademicPeriod(id);
    return NextResponse.json({ success: ok });
  } catch (error) {
    console.error('Error handling calendar DELETE:', error);
    return NextResponse.json({ error: 'Failed to delete academic period' }, { status: 500 });
  }
}
