import { describe, it, expect } from 'vitest';
import { Range, RecurrenceRule } from './recurrence.js';

describe('Range', () => {
  it('creates with start, end, step', () => {
    const r = new Range(1, 10, 2);
    expect(r.start).toBe(1);
    expect(r.end).toBe(10);
    expect(r.step).toBe(2);
  });

  it('contains values in range', () => {
    const r = new Range(0, 59, 1);
    expect(r.contains(0)).toBe(true);
    expect(r.contains(30)).toBe(true);
    expect(r.contains(59)).toBe(true);
    expect(r.contains(60)).toBe(false);
    expect(r.contains(-1)).toBe(false);
  });

  it('contains with step', () => {
    const r = new Range(0, 59, 15);
    expect(r.contains(0)).toBe(true);
    expect(r.contains(15)).toBe(true);
    expect(r.contains(30)).toBe(true);
    expect(r.contains(45)).toBe(true);
    expect(r.contains(10)).toBe(false);
    expect(r.contains(60)).toBe(false);
  });

  it('toArray', () => {
    const r = new Range(0, 10, 3);
    expect(r.toArray()).toEqual([0, 3, 6, 9]);
  });

  it('defaults', () => {
    const r = new Range();
    expect(r.start).toBe(0);
    expect(r.end).toBe(60);
    expect(r.step).toBe(1);
  });
});

describe('RecurrenceRule', () => {
  const ref = new Date(2026, 0, 1, 0, 0, 0); // 2026-01-01 00:00:00 Thursday

  describe('construction', () => {
    it('creates with defaults (all null)', () => {
      const rule = new RecurrenceRule();
      expect(rule.second).toBeNull();
      expect(rule.minute).toBeNull();
      expect(rule.hour).toBeNull();
    });

    it('creates from object spec', () => {
      const rule = new RecurrenceRule({ hour: 12, minute: 30 });
      expect(rule.hour).toBe(12);
      expect(rule.minute).toBe(30);
      expect(rule.second).toBeNull();
    });

    it('creates from positional args', () => {
      const rule = new RecurrenceRule(2026, 1, 15, 12, 30, 0);
      expect(rule.year).toBe(2026);
      expect(rule.month).toBe(1);
      expect(rule.date).toBe(15);
    });
  });

  describe('nextInvocationDate', () => {
    it('specific hour and minute', () => {
      const rule = new RecurrenceRule({ hour: 12, minute: 0, second: 0 });
      const next = rule.nextInvocationDate(ref);
      expect(next).toEqual(new Date(2026, 0, 1, 12, 0, 0));
    });

    it('every second of every minute', () => {
      const rule = new RecurrenceRule();
      const next = rule.nextInvocationDate(ref);
      // All null = every second, next is 1 second after ref
      expect(next).toEqual(new Date(2026, 0, 1, 0, 0, 1));
    });

    it('specific minute each hour', () => {
      const rule = new RecurrenceRule({ minute: 30, second: 0 });
      const next = rule.nextInvocationDate(ref);
      expect(next).toEqual(new Date(2026, 0, 1, 0, 30, 0));
    });

    it('specific day of month', () => {
      const rule = new RecurrenceRule({ date: 15, hour: 0, minute: 0, second: 0 });
      const next = rule.nextInvocationDate(ref);
      expect(next).toEqual(new Date(2026, 0, 15, 0, 0, 0));
    });

    it('with array of values', () => {
      const rule = new RecurrenceRule({ hour: [9, 17], minute: 0, second: 0 });
      const next = rule.nextInvocationDate(ref);
      expect(next).toEqual(new Date(2026, 0, 1, 9, 0, 0));
    });

    it('with Range', () => {
      const rule = new RecurrenceRule({ hour: new Range(9, 17, 4), minute: 0, second: 0 });
      const next = rule.nextInvocationDate(ref);
      expect(next).toEqual(new Date(2026, 0, 1, 9, 0, 0));
      const next2 = rule.nextInvocationDate(next);
      expect(next2).toEqual(new Date(2026, 0, 1, 13, 0, 0));
      const next3 = rule.nextInvocationDate(next2 ?? undefined);
      expect(next3).toEqual(new Date(2026, 0, 1, 17, 0, 0));
    });

    it('dayOfWeek filter', () => {
      // Only Mondays
      const rule = new RecurrenceRule({ dayOfWeek: 1, hour: 9, minute: 0, second: 0 });
      const next = rule.nextInvocationDate(ref);
      // 2026-01-05 is Monday
      expect(next).toEqual(new Date(2026, 0, 5, 9, 0, 0));
    });

    it('dayOfWeek array', () => {
      // Monday and Friday
      const rule = new RecurrenceRule({ dayOfWeek: [1, 5], hour: 9, minute: 0, second: 0 });
      const next = rule.nextInvocationDate(ref);
      // 2026-01-01 is Thursday, 2026-01-02 is Friday
      expect(next).toEqual(new Date(2026, 0, 2, 9, 0, 0));
    });

    it('specific month', () => {
      const rule = new RecurrenceRule({ month: 6, date: 1, hour: 0, minute: 0, second: 0 });
      const next = rule.nextInvocationDate(ref);
      expect(next).toEqual(new Date(2026, 5, 1, 0, 0, 0));
    });

    it('specific year', () => {
      const rule = new RecurrenceRule({ year: 2027, month: 1, date: 1, hour: 0, minute: 0, second: 0 });
      const next = rule.nextInvocationDate(ref);
      expect(next).toEqual(new Date(2027, 0, 1, 0, 0, 0));
    });

    it('returns null when no match within 5 years', () => {
      const rule = new RecurrenceRule({ year: 2020, month: 1, date: 1, hour: 0, minute: 0, second: 0 });
      expect(rule.nextInvocationDate(ref)).toBeNull();
    });

    it('leap year Feb 29', () => {
      const rule = new RecurrenceRule({ month: 2, date: 29, hour: 12, minute: 0, second: 0 });
      const next = rule.nextInvocationDate(ref);
      // 2028 is the next leap year
      expect(next).toEqual(new Date(2028, 1, 29, 12, 0, 0));
    });
  });

  describe('timezone support', () => {
    it('with tz property', () => {
      const rule = new RecurrenceRule({ hour: 12, minute: 0, second: 0, tz: 'America/New_York' });
      const next = rule.nextInvocationDate(ref);
      expect(next).not.toBeNull();
      // Verify it fires at 12:00 in New York time
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const parts = fmt.formatToParts(next!);
      const hour = parseInt(parts.find(p => p.type === 'hour')!.value, 10);
      expect(hour).toBe(12);
    });

    it('with tz via object constructor', () => {
      const rule = new RecurrenceRule({ hour: 0, minute: 0, second: 0, tz: 'UTC' });
      const next = rule.nextInvocationDate(ref);
      expect(next).not.toBeNull();
    });
  });
});
