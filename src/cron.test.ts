import { describe, it, expect } from 'vitest';
import { CronExpression, parseCron } from './cron.js';

describe('CronExpression', () => {
  const ref = new Date(2026, 0, 1, 0, 0, 0); // 2026-01-01 00:00:00 Thursday

  describe('basic 5-field parsing', () => {
    it('every minute', () => {
      const cron = new CronExpression('* * * * *', ref);
      const next = cron.next();
      expect(next).toEqual(new Date(2026, 0, 1, 0, 1, 0));
    });

    it('specific minute', () => {
      const cron = new CronExpression('30 * * * *', ref);
      const next = cron.next();
      expect(next).toEqual(new Date(2026, 0, 1, 0, 30, 0));
    });

    it('specific hour and minute', () => {
      const cron = new CronExpression('0 12 * * *', ref);
      const next = cron.next();
      expect(next).toEqual(new Date(2026, 0, 1, 12, 0, 0));
    });

    it('specific day of month', () => {
      const cron = new CronExpression('0 0 15 * *', ref);
      const next = cron.next();
      expect(next).toEqual(new Date(2026, 0, 15, 0, 0, 0));
    });

    it('specific month', () => {
      const cron = new CronExpression('0 0 1 6 *', ref);
      const next = cron.next();
      expect(next).toEqual(new Date(2026, 5, 1, 0, 0, 0));
    });
  });

  describe('6-field (with seconds)', () => {
    it('every second', () => {
      const cron = new CronExpression('* * * * * *', ref);
      const next = cron.next();
      expect(next).toEqual(new Date(2026, 0, 1, 0, 0, 1));
    });

    it('specific second', () => {
      const cron = new CronExpression('30 * * * * *', ref);
      const next = cron.next();
      expect(next).toEqual(new Date(2026, 0, 1, 0, 0, 30));
    });

    it('at second 0 of every minute', () => {
      const cron = new CronExpression('0 * * * * *', ref);
      const next = cron.next();
      expect(next).toEqual(new Date(2026, 0, 1, 0, 1, 0));
    });
  });

  describe('ranges', () => {
    it('range of minutes', () => {
      const cron = new CronExpression('10-15 12 * * *', ref);
      const next = cron.next();
      expect(next).toEqual(new Date(2026, 0, 1, 12, 10, 0));
      expect(cron.next()).toEqual(new Date(2026, 0, 1, 12, 11, 0));
    });

    it('range of hours', () => {
      const cron = new CronExpression('0 9-11 * * *', ref);
      const next = cron.next();
      expect(next).toEqual(new Date(2026, 0, 1, 9, 0, 0));
      expect(cron.next()).toEqual(new Date(2026, 0, 1, 10, 0, 0));
      expect(cron.next()).toEqual(new Date(2026, 0, 1, 11, 0, 0));
    });
  });

  describe('steps', () => {
    it('every 5 minutes', () => {
      const cron = new CronExpression('*/5 * * * *', ref);
      const next = cron.next();
      expect(next).toEqual(new Date(2026, 0, 1, 0, 5, 0));
    });

    it('every 15 minutes', () => {
      const cron = new CronExpression('*/15 * * * *', ref);
      const results = [cron.next(), cron.next(), cron.next(), cron.next()];
      expect(results.map(d => d.getMinutes())).toEqual([15, 30, 45, 0]);
    });

    it('range with step', () => {
      const cron = new CronExpression('10-30/5 * * * *', ref);
      const next = cron.next();
      expect(next.getMinutes()).toBe(10);
      expect(cron.next().getMinutes()).toBe(15);
      expect(cron.next().getMinutes()).toBe(20);
    });
  });

  describe('lists', () => {
    it('list of minutes', () => {
      const cron = new CronExpression('5,10,15 * * * *', ref);
      expect(cron.next().getMinutes()).toBe(5);
      expect(cron.next().getMinutes()).toBe(10);
      expect(cron.next().getMinutes()).toBe(15);
    });

    it('list of hours', () => {
      const cron = new CronExpression('0 6,12,18 * * *', ref);
      expect(cron.next().getHours()).toBe(6);
      expect(cron.next().getHours()).toBe(12);
      expect(cron.next().getHours()).toBe(18);
    });
  });

  describe('day-of-week names', () => {
    it('MON-FRI', () => {
      const cron = new CronExpression('0 9 * * MON-FRI', ref);
      const next = cron.next();
      // 2026-01-01 is Thursday
      expect(next).toEqual(new Date(2026, 0, 1, 9, 0, 0));
      // Next is Friday
      expect(cron.next()).toEqual(new Date(2026, 0, 2, 9, 0, 0));
      // Skip weekend, next is Monday
      expect(cron.next()).toEqual(new Date(2026, 0, 5, 9, 0, 0));
    });

    it('SUN', () => {
      const cron = new CronExpression('0 0 * * SUN', ref);
      const next = cron.next();
      // 2026-01-04 is Sunday
      expect(next).toEqual(new Date(2026, 0, 4, 0, 0, 0));
    });
  });

  describe('month names', () => {
    it('JAN', () => {
      const cron = new CronExpression('0 0 1 JAN *', ref);
      const next = cron.next();
      expect(next).toEqual(new Date(2027, 0, 1, 0, 0, 0));
    });

    it('JUN,DEC', () => {
      const cron = new CronExpression('0 0 1 JUN,DEC *', ref);
      expect(cron.next()).toEqual(new Date(2026, 5, 1, 0, 0, 0));
      expect(cron.next()).toEqual(new Date(2026, 11, 1, 0, 0, 0));
    });
  });

  describe('edge cases', () => {
    it('last day of February in leap year', () => {
      // 2028 is a leap year
      const cron = new CronExpression('0 0 29 2 *', new Date(2026, 0, 1));
      const next = cron.next();
      expect(next).toEqual(new Date(2028, 1, 29, 0, 0, 0));
    });

    it('last day of February in non-leap year', () => {
      const cron = new CronExpression('0 0 28 2 *', new Date(2026, 0, 1));
      const next = cron.next();
      expect(next).toEqual(new Date(2026, 1, 28, 0, 0, 0));
    });

    it('31st day skips months without 31 days', () => {
      const cron = new CronExpression('0 0 31 * *', new Date(2026, 0, 1));
      const next = cron.next();
      expect(next).toEqual(new Date(2026, 0, 31, 0, 0, 0));
      // February has no 31st, March does
      expect(cron.next()).toEqual(new Date(2026, 2, 31, 0, 0, 0));
    });

    it('day 7 treated as Sunday', () => {
      const cron = new CronExpression('0 0 * * 7', ref);
      const next = cron.next();
      expect(next.getDay()).toBe(0); // Sunday
    });
  });

  describe('prev()', () => {
    it('previous minute', () => {
      const cron = new CronExpression('* * * * *', new Date(2026, 0, 1, 12, 30, 0));
      const prev = cron.prev();
      expect(prev).toEqual(new Date(2026, 0, 1, 12, 29, 0));
    });

    it('previous hour boundary', () => {
      const cron = new CronExpression('0 * * * *', new Date(2026, 0, 1, 12, 0, 0));
      const prev = cron.prev();
      expect(prev).toEqual(new Date(2026, 0, 1, 11, 0, 0));
    });
  });

  describe('iteration', () => {
    it('hasNext returns true for standard expressions', () => {
      const cron = new CronExpression('* * * * *', ref);
      expect(cron.hasNext()).toBe(true);
    });

    it('iterates multiple next values', () => {
      const cron = new CronExpression('0 * * * *', ref);
      const dates: Date[] = [];
      for (let i = 0; i < 24; i++) {
        dates.push(cron.next());
      }
      expect(dates).toHaveLength(24);
      expect(dates[0].getHours()).toBe(1);
      expect(dates[23].getHours()).toBe(0);
    });

    it('reset restores cursor', () => {
      const cron = new CronExpression('0 * * * *', ref);
      cron.next();
      cron.next();
      cron.reset(ref);
      expect(cron.next()).toEqual(new Date(2026, 0, 1, 1, 0, 0));
    });
  });

  describe('parseCron helper', () => {
    it('returns CronExpression', () => {
      const cron = parseCron('0 0 * * *', ref);
      expect(cron).toBeInstanceOf(CronExpression);
      expect(cron.next()).toEqual(new Date(2026, 0, 2, 0, 0, 0));
    });
  });

  describe('invalid expressions', () => {
    it('throws on too few fields', () => {
      expect(() => new CronExpression('* * *')).toThrow('Invalid cron expression');
    });

    it('throws on too many fields', () => {
      expect(() => new CronExpression('* * * * * * *')).toThrow('Invalid cron expression');
    });
  });
});
