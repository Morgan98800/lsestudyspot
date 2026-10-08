import { describe, it, expect } from 'vitest';
import {
  getOpenState,
  OpeningException,
  WeekdayIntervals,
  weekdayIntervalsSchema,
  timeIntervalSchema,
} from '../src/lib/algo/opening-hours';

describe('Task A: getOpenState in Europe/London Timezone', () => {
  const zoneWithStandardHours = {
    id: 'zone-standard',
    opening_hours: {
      mon: [{ open: '08:00', close: '22:00' }],
      tue: [{ open: '08:00', close: '22:00' }],
      wed: [{ open: '08:00', close: '22:00' }],
      thu: [{ open: '08:00', close: '22:00' }],
      fri: [{ open: '08:00', close: '22:00' }],
      sat: [{ open: '09:00', close: '18:00' }],
      sun: [{ open: '08:00', close: '20:00' }],
    } as WeekdayIntervals,
  };

  // 1. Regression test: Wednesday 11:46 London time with 08:00-22:00
  it('Wednesday 11:46 London time with hours 08:00-22:00 => open', () => {
    // 2026-10-07 is Wednesday. In October BST (UTC+1), 10:46 UTC is 11:46 London time.
    const wednesday1146 = new Date('2026-10-07T10:46:00Z');
    const state = getOpenState(zoneWithStandardHours, [], wednesday1146);

    expect(state.isOpen).toBe(true);
    expect(state.closesAt).toBe('22:00');
    expect(state.nextOpenAt).toBeNull();
  });

  // 2. Exact boundary tests: 07:59 closed, 08:00 open, 21:59 open, 22:00 closed
  it('07:59 closed, 08:00 open, 21:59 open, 22:00 closed on Wednesday', () => {
    // 07:59 BST = 06:59 UTC
    const state0759 = getOpenState(zoneWithStandardHours, [], '2026-10-07T06:59:00Z');
    expect(state0759.isOpen).toBe(false);
    expect(state0759.nextOpenAt).toEqual({ day: 'today', time: '08:00' });

    // 08:00 BST = 07:00 UTC
    const state0800 = getOpenState(zoneWithStandardHours, [], '2026-10-07T07:00:00Z');
    expect(state0800.isOpen).toBe(true);
    expect(state0800.closesAt).toBe('22:00');

    // 21:59 BST = 20:59 UTC
    const state2159 = getOpenState(zoneWithStandardHours, [], '2026-10-07T20:59:00Z');
    expect(state2159.isOpen).toBe(true);
    expect(state2159.closesAt).toBe('22:00');

    // 22:00 BST = 21:00 UTC
    const state2200 = getOpenState(zoneWithStandardHours, [], '2026-10-07T21:00:00Z');
    expect(state2200.isOpen).toBe(false);
    expect(state2200.nextOpenAt).toEqual({ day: 'tomorrow', time: '08:00' });
  });

  // 3. Overnight interval: 18:00 to 02:00 at 01:00 the next day
  it('Overnight interval (e.g. 18:00 to 02:00) at 01:00 the next day is open and closes at 02:00', () => {
    const overnightZone = {
      id: 'zone-overnight',
      opening_hours: {
        tue: [{ open: '18:00', close: '02:00' }],
        wed: [{ open: '18:00', close: '02:00' }],
      } as WeekdayIntervals,
    };

    // Tuesday evening at 23:00 BST (22:00 UTC)
    const tue2300 = getOpenState(overnightZone, [], '2026-10-06T22:00:00Z');
    expect(tue2300.isOpen).toBe(true);
    expect(tue2300.closesAt).toBe('02:00');

    // Wednesday morning at 01:00 BST (00:00 UTC) -> should still be open from Tuesday night!
    const wed0100 = getOpenState(overnightZone, [], '2026-10-07T00:00:00Z');
    expect(wed0100.isOpen).toBe(true);
    expect(wed0100.closesAt).toBe('02:00');

    // Wednesday morning at 02:00 BST (01:00 UTC) -> closed! Next opens today at 18:00
    const wed0200 = getOpenState(overnightZone, [], '2026-10-07T01:00:00Z');
    expect(wed0200.isOpen).toBe(false);
    expect(wed0200.nextOpenAt).toEqual({ day: 'today', time: '18:00' });
  });

  // 4. 24-hour zone
  it('24-hour zone (00:00 to 24:00) is open all day with closesAt null when continuous', () => {
    const zone24h = {
      id: 'zone-24h',
      opening_hours: {
        mon: [{ open: '00:00', close: '24:00' }],
        tue: [{ open: '00:00', close: '24:00' }],
        wed: [{ open: '00:00', close: '24:00' }],
        thu: [{ open: '00:00', close: '24:00' }],
        fri: [{ open: '00:00', close: '24:00' }],
        sat: [{ open: '00:00', close: '24:00' }],
        sun: [{ open: '00:00', close: '24:00' }],
      } as WeekdayIntervals,
    };

    const midDay = getOpenState(zone24h, [], '2026-10-07T12:00:00Z');
    expect(midDay.isOpen).toBe(true);
    expect(midDay.closesAt).toBeNull();
    expect(midDay.nextOpenAt).toBeNull();

    const midnight = getOpenState(zone24h, [], '2026-10-07T23:30:00Z');
    expect(midnight.isOpen).toBe(true);
    expect(midnight.closesAt).toBeNull();
  });

  // 5. Exception that closes a zone for one day; exception that extends hours
  it('Exception that closes a zone for one day; exception that extends hours', () => {
    const exceptions: OpeningException[] = [
      {
        id: 'exc-bank-holiday',
        zone_id: null, // applies to all zones
        start_date: '2026-12-25',
        end_date: '2026-12-25',
        is_closed: true,
        open_time: null,
        close_time: null,
        reason: 'Christmas Day closure',
      },
      {
        id: 'exc-exam-extended',
        zone_id: 'zone-standard',
        start_date: '2026-05-15',
        end_date: '2026-05-20',
        is_closed: false,
        open_time: '06:00',
        close_time: '23:30',
        reason: 'Exam period extended hours',
      },
    ];

    // Check Christmas Day closure (2026-12-25 is Friday, London is GMT)
    const xmasNoon = getOpenState(zoneWithStandardHours, exceptions, '2026-12-25T12:00:00Z');
    expect(xmasNoon.isOpen).toBe(false);
    expect(xmasNoon.reason).toBe('Christmas Day closure');
    expect(xmasNoon.nextOpenAt).toEqual({ day: 'tomorrow', time: '09:00' }); // Saturday opens at 09:00

    // Check extended exam hours at 06:30 BST on May 15 (2026-05-15 is Friday)
    // Normally opens at 08:00, but with exception opens at 06:00
    const examMorning = getOpenState(zoneWithStandardHours, exceptions, '2026-05-15T05:30:00Z'); // 06:30 BST
    expect(examMorning.isOpen).toBe(true);
    expect(examMorning.closesAt).toBe('23:30');
    expect(examMorning.reason).toBe('Exam period extended hours');
  });

  // 6. BST starts Sunday 29 March 2026 and ends Sunday 25 October 2026
  it('BST starts Sunday 29 March 2026 (clocks forward at 01:00 GMT to 02:00 BST)', () => {
    // Before transition: 2026-03-29 00:59 UTC is 00:59 GMT (Sunday)
    // At 01:00 UTC, clocks leap to 02:00 BST.
    // Sunday hours: 08:00-20:00.
    // 06:59 UTC = 07:59 BST -> closed, opens at 08:00
    const justBeforeOpen = getOpenState(zoneWithStandardHours, [], '2026-03-29T06:59:00Z');
    expect(justBeforeOpen.isOpen).toBe(false);
    expect(justBeforeOpen.nextOpenAt).toEqual({ day: 'today', time: '08:00' });

    // 07:00 UTC = 08:00 BST -> open!
    const atOpen = getOpenState(zoneWithStandardHours, [], '2026-03-29T07:00:00Z');
    expect(atOpen.isOpen).toBe(true);
    expect(atOpen.closesAt).toBe('20:00');
  });

  it('BST ends Sunday 25 October 2026 (clocks fall back at 02:00 BST to 01:00 GMT)', () => {
    // Clocks fall back at 01:00 UTC (02:00 BST -> 01:00 GMT).
    // In morning: 07:59 UTC = 07:59 GMT -> closed, opens at 08:00
    const justBeforeOpen = getOpenState(zoneWithStandardHours, [], '2026-10-25T07:59:00Z');
    expect(justBeforeOpen.isOpen).toBe(false);
    expect(justBeforeOpen.nextOpenAt).toEqual({ day: 'today', time: '08:00' });

    // 08:00 UTC = 08:00 GMT -> open!
    const atOpen = getOpenState(zoneWithStandardHours, [], '2026-10-25T08:00:00Z');
    expect(atOpen.isOpen).toBe(true);
    expect(atOpen.closesAt).toBe('20:00');
  });

  // 7. Server in UTC but request at 23:30 UTC in summer (= 00:30 BST next day)
  it('Server in UTC but request at 23:30 UTC in summer (= 00:30 BST next day)', () => {
    // Tuesday 2026-07-07 23:30:00 UTC is Wednesday 2026-07-08 00:30:00 BST!
    // Zone standard hours: Wednesday opens at 08:00.
    const summerLateUtc = getOpenState(zoneWithStandardHours, [], '2026-07-07T23:30:00Z');
    expect(summerLateUtc.isOpen).toBe(false);
    // Because in London it is ALREADY Wednesday 00:30, it opens "today" at 08:00 (not tomorrow!)
    expect(summerLateUtc.nextOpenAt).toEqual({ day: 'today', time: '08:00' });
  });

  // 8. Weekday mapping for all 7 days
  it('correctly maps all 7 weekdays in London time', () => {
    const schedule: WeekdayIntervals = {
      mon: [{ open: '08:01', close: '20:00' }],
      tue: [{ open: '08:02', close: '20:00' }],
      wed: [{ open: '08:03', close: '20:00' }],
      thu: [{ open: '08:04', close: '20:00' }],
      fri: [{ open: '08:05', close: '20:00' }],
      sat: [{ open: '08:06', close: '20:00' }],
      sun: [{ open: '08:07', close: '20:00' }],
    };
    const testZone = { id: 'zone-weekdays', opening_hours: schedule };

    // 2026-10-05 is Monday, 2026-10-06 Tuesday, ..., 2026-10-11 Sunday
    const weekDates = [
      { date: '2026-10-05T06:00:00Z', expected: '08:01' }, // Mon 07:00 BST -> opens 08:01
      { date: '2026-10-06T06:00:00Z', expected: '08:02' }, // Tue
      { date: '2026-10-07T06:00:00Z', expected: '08:03' }, // Wed
      { date: '2026-10-08T06:00:00Z', expected: '08:04' }, // Thu
      { date: '2026-10-09T06:00:00Z', expected: '08:05' }, // Fri
      { date: '2026-10-10T06:00:00Z', expected: '08:06' }, // Sat
      { date: '2026-10-11T06:00:00Z', expected: '08:07' }, // Sun
    ];

    for (const testCase of weekDates) {
      const state = getOpenState(testZone, [], testCase.date);
      expect(state.isOpen).toBe(false);
      expect(state.nextOpenAt).toEqual({ day: 'today', time: testCase.expected });
    }
  });

  // 9. Null value means "hours unknown": treat as open, and never show it as closed
  it('null opening_hours treats zone as open without closing time', () => {
    const unknownZone = { id: 'zone-unknown', opening_hours: null };
    const state = getOpenState(unknownZone, [], '2026-10-07T03:00:00Z');
    expect(state.isOpen).toBe(true);
    expect(state.closesAt).toBeNull();
    expect(state.nextOpenAt).toBeNull();
  });

  // 10. Zod validation on write
  it('validates intervals and rejects overlapping intervals on write', () => {
    // Valid interval
    expect(timeIntervalSchema.safeParse({ open: '08:00', close: '22:00' }).success).toBe(true);
    // Invalid time format
    expect(timeIntervalSchema.safeParse({ open: '8:00', close: '22:00' }).success).toBe(false);
    expect(timeIntervalSchema.safeParse({ open: '08:00', close: '25:00' }).success).toBe(false);

    // Valid non-overlapping weekday intervals
    const validSchedule = {
      mon: [
        { open: '08:00', close: '12:00' },
        { open: '13:00', close: '22:00' },
      ],
      tue: [],
    };
    expect(weekdayIntervalsSchema.safeParse(validSchedule).success).toBe(true);

    // Overlapping intervals
    const overlappingSchedule = {
      mon: [
        { open: '08:00', close: '14:00' },
        { open: '13:00', close: '22:00' },
      ],
    };
    expect(weekdayIntervalsSchema.safeParse(overlappingSchedule).success).toBe(false);
  });
});
