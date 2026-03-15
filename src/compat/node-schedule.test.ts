import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import schedule, {
  scheduleJob,
  cancelJob,
  scheduledJobs,
  gracefulShutdown,
  RecurrenceRule,
  Range,
  Job,
  Invocation,
} from './node-schedule.js';

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 0, 1, 0, 0, 0) });
  for (const name of Object.keys(scheduledJobs)) {
    scheduledJobs[name].cancel();
  }
});

afterEach(() => {
  vi.useRealTimers();
});

describe('node-schedule compatibility layer', () => {
  describe('default export', () => {
    it('exposes scheduleJob', () => {
      expect(typeof schedule.scheduleJob).toBe('function');
    });

    it('exposes cancelJob', () => {
      expect(typeof schedule.cancelJob).toBe('function');
    });

    it('exposes scheduledJobs', () => {
      expect(typeof schedule.scheduledJobs).toBe('object');
    });

    it('exposes gracefulShutdown', () => {
      expect(typeof schedule.gracefulShutdown).toBe('function');
    });

    it('exposes RecurrenceRule', () => {
      expect(schedule.RecurrenceRule).toBe(RecurrenceRule);
    });

    it('exposes Range', () => {
      expect(schedule.Range).toBe(Range);
    });

    it('exposes Job', () => {
      expect(schedule.Job).toBe(Job);
    });

    it('exposes Invocation', () => {
      expect(schedule.Invocation).toBe(Invocation);
    });
  });

  describe('named exports match node-schedule API', () => {
    it('scheduleJob is a function', () => {
      expect(typeof scheduleJob).toBe('function');
    });

    it('cancelJob is a function', () => {
      expect(typeof cancelJob).toBe('function');
    });

    it('scheduledJobs is an object', () => {
      expect(typeof scheduledJobs).toBe('object');
    });

    it('gracefulShutdown is a function', () => {
      expect(typeof gracefulShutdown).toBe('function');
    });
  });
});

describe('node-schedule API contract tests', () => {
  describe('scheduleJob with cron string', () => {
    it('fires at the right time', () => {
      const cb = vi.fn();
      const job = scheduleJob('*/10 * * * *', cb);
      expect(job).toBeInstanceOf(Job);
      expect(job.nextInvocation()).toEqual(new Date(2026, 0, 1, 0, 10, 0));

      vi.advanceTimersByTime(10 * 60 * 1000);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('supports 6-field cron (seconds)', () => {
      const cb = vi.fn();
      const job = scheduleJob('*/30 * * * * *', cb);
      expect(job.nextInvocation()).toEqual(new Date(2026, 0, 1, 0, 0, 30));

      vi.advanceTimersByTime(30 * 1000);
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe('scheduleJob with Date', () => {
    it('fires once at specified date', () => {
      const cb = vi.fn();
      const date = new Date(2026, 0, 1, 0, 5, 0);
      scheduleJob(date, cb);

      vi.advanceTimersByTime(5 * 60 * 1000);
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith(date);
    });

    it('does not fire for past dates', () => {
      vi.setSystemTime(new Date(2026, 0, 2));
      const cb = vi.fn();
      const job = scheduleJob(new Date(2026, 0, 1), cb);
      expect(job.nextInvocation()).toBeNull();
    });
  });

  describe('scheduleJob with RecurrenceRule', () => {
    it('fires at rule-specified times', () => {
      const cb = vi.fn();
      const rule = new RecurrenceRule();
      rule.minute = 30;
      rule.second = 0;
      const job = scheduleJob(rule, cb);

      expect(job.nextInvocation()).toEqual(new Date(2026, 0, 1, 0, 30, 0));
    });

    it('rule with Range', () => {
      const cb = vi.fn();
      const rule = new RecurrenceRule();
      rule.minute = new Range(0, 59, 15);
      rule.second = 0;
      const job = scheduleJob(rule, cb);

      expect(job.nextInvocation()).toEqual(new Date(2026, 0, 1, 0, 15, 0));
    });

    it('rule with dayOfWeek', () => {
      const cb = vi.fn();
      const rule = new RecurrenceRule();
      rule.dayOfWeek = [1, 3, 5]; // Mon, Wed, Fri
      rule.hour = 9;
      rule.minute = 0;
      rule.second = 0;
      const job = scheduleJob(rule, cb);

      // 2026-01-01 is Thursday (not in list), 2026-01-02 is Friday
      expect(job.nextInvocation()).toEqual(new Date(2026, 0, 2, 9, 0, 0));
    });
  });

  describe('scheduleJob with object literal', () => {
    it('interprets as RecurrenceRule', () => {
      const cb = vi.fn();
      const job = scheduleJob({ hour: 14, minute: 30, second: 0 }, cb);
      expect(job.nextInvocation()).toEqual(new Date(2026, 0, 1, 14, 30, 0));
    });
  });

  describe('named jobs', () => {
    it('scheduleJob(name, spec, callback) registers in scheduledJobs', () => {
      const cb = vi.fn();
      const job = scheduleJob('daily-report', '0 9 * * *', cb);
      expect(job.name).toBe('daily-report');
      expect(scheduledJobs['daily-report']).toBe(job);
    });

    it('cancelJob by name removes from scheduledJobs', () => {
      const cb = vi.fn();
      scheduleJob('temp', '* * * * *', cb);
      cancelJob('temp');
      expect(scheduledJobs['temp']).toBeUndefined();
    });
  });

  describe('Job methods', () => {
    it('cancel() stops future invocations', () => {
      const cb = vi.fn();
      const job = scheduleJob('cancelable', '* * * * *', cb);
      job.cancel();

      vi.advanceTimersByTime(60000);
      expect(cb).not.toHaveBeenCalled();
    });

    it('cancelNext() cancels only next invocation', () => {
      const cb = vi.fn();
      const job = scheduleJob('cn', '* * * * *', cb);
      expect(job.pendingInvocations).toHaveLength(1);

      job.cancelNext();
      expect(job.pendingInvocations).toHaveLength(0);
    });

    it('reschedule() changes the schedule', () => {
      const cb = vi.fn();
      const job = scheduleJob('resched', '0 * * * *', cb);
      expect(job.nextInvocation()!.getMinutes()).toBe(0);

      job.reschedule('30 * * * *');
      expect(job.nextInvocation()!.getMinutes()).toBe(30);
    });

    it('nextInvocation() returns next fire date', () => {
      const cb = vi.fn();
      const job = scheduleJob('ni', '0 12 * * *', cb);
      expect(job.nextInvocation()).toEqual(new Date(2026, 0, 1, 12, 0, 0));
    });

    it('pendingInvocations returns array of Invocation', () => {
      const cb = vi.fn();
      const job = scheduleJob('pi', '0 12 * * *', cb);
      const invs = job.pendingInvocations;
      expect(invs).toHaveLength(1);
      expect(invs[0]).toBeInstanceOf(Invocation);
      expect(invs[0].fireDate).toEqual(new Date(2026, 0, 1, 12, 0, 0));
    });
  });

  describe('Job events', () => {
    it('emits scheduled when armed', () => {
      const handler = vi.fn();
      const cb = vi.fn();
      const job = new Job('ev-test');
      job.on('scheduled', handler);
      job['_callback'] = cb;
      job.schedule('0 12 * * *');
      expect(handler).toHaveBeenCalled();
    });

    it('emits run when fired', () => {
      const handler = vi.fn();
      const cb = vi.fn();
      const job = scheduleJob('run-ev', new Date(2026, 0, 1, 0, 0, 1), cb);
      job.on('run', handler);
      vi.advanceTimersByTime(1000);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('emits canceled when canceled', () => {
      const handler = vi.fn();
      const cb = vi.fn();
      const job = scheduleJob('c-ev', '* * * * *', cb);
      job.on('canceled', handler);
      job.cancel();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('emits error on callback exception', () => {
      const error = new Error('test error');
      const handler = vi.fn();
      const job = scheduleJob('err-ev', new Date(2026, 0, 1, 0, 0, 1), () => { throw error; });
      job.on('error', handler);
      vi.advanceTimersByTime(1000);
      expect(handler).toHaveBeenCalledWith(error);
    });
  });

  describe('gracefulShutdown', () => {
    it('cancels all scheduled jobs', async () => {
      const cb = vi.fn();
      scheduleJob('s1', '* * * * *', cb);
      scheduleJob('s2', '0 * * * *', cb);

      await gracefulShutdown();

      vi.advanceTimersByTime(60 * 60 * 1000);
      expect(cb).not.toHaveBeenCalled();
    });

    it('waits for running async callbacks', async () => {
      let completed = false;
      scheduleJob('async', new Date(2026, 0, 1, 0, 0, 1), async () => {
        await new Promise(r => setTimeout(r, 50));
        completed = true;
      });

      vi.advanceTimersByTime(1000);

      const shutdownPromise = gracefulShutdown();
      await vi.advanceTimersByTimeAsync(100);
      await shutdownPromise;
      expect(completed).toBe(true);
    });
  });

  describe('concurrent job management', () => {
    it('multiple jobs run independently', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      scheduleJob('job1', '*/5 * * * *', cb1);
      scheduleJob('job2', '*/10 * * * *', cb2);

      vi.advanceTimersByTime(10 * 60 * 1000);
      expect(cb1).toHaveBeenCalledTimes(2); // at 5 and 10 minutes
      expect(cb2).toHaveBeenCalledTimes(1); // at 10 minutes only
    });

    it('canceling one job does not affect others', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      scheduleJob('indep1', '*/5 * * * *', cb1);
      scheduleJob('indep2', '*/5 * * * *', cb2);

      cancelJob('indep1');

      vi.advanceTimersByTime(5 * 60 * 1000);
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('leap year February 29', () => {
      const cb = vi.fn();
      const rule = new RecurrenceRule();
      rule.month = 1; // February (0-indexed? no, 1-indexed in our impl)
      rule.date = 29;
      rule.hour = 0;
      rule.minute = 0;
      rule.second = 0;
      // node-schedule uses 0-indexed months... let's use 2 for Feb
      const rule2 = new RecurrenceRule();
      rule2.month = 2;
      rule2.date = 29;
      rule2.hour = 0;
      rule2.minute = 0;
      rule2.second = 0;
      const job = scheduleJob(rule2, cb);
      // 2028 is the next leap year
      expect(job.nextInvocation()).toEqual(new Date(2028, 1, 29, 0, 0, 0));
    });

    it('month-end boundary (31st)', () => {
      const cb = vi.fn();
      const rule = new RecurrenceRule();
      rule.date = 31;
      rule.hour = 0;
      rule.minute = 0;
      rule.second = 0;
      const job = scheduleJob(rule, cb);
      // January 31
      expect(job.nextInvocation()).toEqual(new Date(2026, 0, 31, 0, 0, 0));
    });

    it('handles job with past Date gracefully', () => {
      const cb = vi.fn();
      const job = scheduleJob(new Date(2020, 0, 1), cb);
      expect(job.nextInvocation()).toBeNull();
      vi.advanceTimersByTime(10000);
      expect(cb).not.toHaveBeenCalled();
    });

    it('cron with specific day-of-week', () => {
      const cb = vi.fn();
      // Every Monday at noon
      const job = scheduleJob('0 12 * * 1', cb);
      // 2026-01-05 is Monday
      expect(job.nextInvocation()).toEqual(new Date(2026, 0, 5, 12, 0, 0));
    });
  });

  describe('RecurrenceRule with timezone', () => {
    it('schedules in specified timezone', () => {
      const cb = vi.fn();
      const rule = new RecurrenceRule();
      rule.hour = 12;
      rule.minute = 0;
      rule.second = 0;
      rule.tz = 'America/New_York';
      const job = scheduleJob(rule, cb);
      const next = job.nextInvocation();
      expect(next).not.toBeNull();

      // Verify the time is 12:00 in New York
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

    it('schedules in UTC', () => {
      const cb = vi.fn();
      const rule = new RecurrenceRule();
      rule.hour = 0;
      rule.minute = 0;
      rule.second = 0;
      rule.tz = 'UTC';
      const job = scheduleJob(rule, cb);
      const next = job.nextInvocation();
      expect(next).not.toBeNull();

      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const parts = fmt.formatToParts(next!);
      const hour = parseInt(parts.find(p => p.type === 'hour')!.value, 10);
      expect(hour).toBe(0);
    });
  });
});
