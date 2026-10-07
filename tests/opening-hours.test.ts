import { describe, it, expect } from 'vitest';
import { checkZoneOpen, getLondonTime } from '../src/lib/algo/estimate';
import { WeekdayHours } from '../src/types/database';

describe('Opening Hours in Europe/London Timezone', () => {
  const standardHours: WeekdayHours = {
    mon: { open: '08:00', close: '22:00' },
    tue: { open: '08:00', close: '22:00' },
    wed: { open: '08:00', close: '22:00' },
    thu: { open: '08:00', close: '22:00' },
    fri: { open: '08:00', close: '22:00' },
    sat: { open: '09:00', close: '18:00' },
    sun: { open: '08:00', close: '20:00' },
  };

  it('correctly evaluates open at 11:46 on a Wednesday in London', () => {
    // 2026-10-07 is a Wednesday. In October (BST, UTC+1), 10:46 UTC is 11:46 London time.
    const wednesday1146 = new Date('2026-10-07T10:46:00Z');
    const london = getLondonTime(wednesday1146);

    expect(london.weekdayKey).toBe('wed');
    expect(london.hour).toBe(11);
    expect(london.minute).toBe(46);

    const check = checkZoneOpen(standardHours, wednesday1146);
    expect(check.isOpen).toBe(true);
  });

  it('correctly evaluates closed at 07:59 (opens at 08:00)', () => {
    // Wednesday 07:59 BST is 06:59 UTC
    const wednesday0759 = new Date('2026-10-07T06:59:00Z');
    const london = getLondonTime(wednesday0759);

    expect(london.weekdayKey).toBe('wed');
    expect(london.hour).toBe(7);
    expect(london.minute).toBe(59);

    const check = checkZoneOpen(standardHours, wednesday0759);
    expect(check.isOpen).toBe(false);
    expect(check.opensAt).toBe('08:00');
  });

  it('correctly evaluates open exactly at 08:00', () => {
    // Wednesday 08:00 BST is 07:00 UTC
    const wednesday0800 = new Date('2026-10-07T07:00:00Z');
    const london = getLondonTime(wednesday0800);

    expect(london.weekdayKey).toBe('wed');
    expect(london.hour).toBe(8);
    expect(london.minute).toBe(0);

    const check = checkZoneOpen(standardHours, wednesday0800);
    expect(check.isOpen).toBe(true);
  });

  it('handles the Spring clock change in March (jumping forward to BST)', () => {
    // In 2026, the UK clocks jump forward on Sunday March 29 from 01:00 GMT to 02:00 BST.
    // 06:59 UTC on March 29 is 07:59 BST in London (closed)
    const beforeOpen = new Date('2026-03-29T06:59:00Z');
    const londonBefore = getLondonTime(beforeOpen);
    expect(londonBefore.weekdayKey).toBe('sun');
    expect(londonBefore.hour).toBe(7);
    expect(londonBefore.minute).toBe(59);

    const checkBefore = checkZoneOpen(standardHours, beforeOpen);
    expect(checkBefore.isOpen).toBe(false);
    expect(checkBefore.opensAt).toBe('08:00');

    // 07:00 UTC on March 29 is 08:00 BST in London (open)
    const atOpen = new Date('2026-03-29T07:00:00Z');
    const londonAt = getLondonTime(atOpen);
    expect(londonAt.weekdayKey).toBe('sun');
    expect(londonAt.hour).toBe(8);
    expect(londonAt.minute).toBe(0);

    const checkAt = checkZoneOpen(standardHours, atOpen);
    expect(checkAt.isOpen).toBe(true);
  });

  it('handles the Autumn clock change in October (falling back to GMT)', () => {
    // In 2026, the UK clocks fall back on Sunday October 25 from 02:00 BST to 01:00 GMT.
    // After 01:00 UTC, London is in GMT (UTC+0).
    // 07:59 UTC on October 25 is 07:59 GMT in London (closed)
    const beforeOpen = new Date('2026-10-25T07:59:00Z');
    const londonBefore = getLondonTime(beforeOpen);
    expect(londonBefore.weekdayKey).toBe('sun');
    expect(londonBefore.hour).toBe(7);
    expect(londonBefore.minute).toBe(59);

    const checkBefore = checkZoneOpen(standardHours, beforeOpen);
    expect(checkBefore.isOpen).toBe(false);
    expect(checkBefore.opensAt).toBe('08:00');

    // 08:00 UTC on October 25 is 08:00 GMT in London (open)
    const atOpen = new Date('2026-10-25T08:00:00Z');
    const londonAt = getLondonTime(atOpen);
    expect(londonAt.weekdayKey).toBe('sun');
    expect(londonAt.hour).toBe(8);
    expect(londonAt.minute).toBe(0);

    const checkAt = checkZoneOpen(standardHours, atOpen);
    expect(checkAt.isOpen).toBe(true);
  });
});
