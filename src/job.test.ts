import { describe, it, expect, vi, afterEach } from 'vitest';
import { Job, Invocation } from './job.js';
import { RecurrenceRule } from './recurrence.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('Invocation', () => {
  it('holds fireDate and job reference', () => {
    const job = new Job('test');
    const date = new Date(2026, 0, 1);
    const inv = new Invocation(job, date);
    expect(inv.fireDate).toBe(date);
    expect(inv.job).toBe(job);
    expect(inv.timerID).toBeNull();
  });
});

describe('Job', () => {
  describe('construction', () => {
    it('creates with name', () => {
      const job = new Job('my-job');
      expect(job.name).toBe('my-job');
    });

    it('creates anonymous job', () => {
      const job = new Job();
      expect(job.name).toMatch(/^<anonymous-\d+>$/);
    });

    it('creates with name and callback', () => {
      const cb = vi.fn();
      const job = new Job('test', cb);
      expect(job.name).toBe('test');
    });
  });

  describe('schedule with Date', () => {
    it('schedules a one-time job', () => {
      vi.useFakeTimers({ now: new Date(2026, 0, 1, 0, 0, 0) });
      const cb = vi.fn();
      const job = new Job('once', cb);
      const fireDate = new Date(2026, 0, 1, 0, 0, 1);
      job.schedule(fireDate);

      expect(job.nextInvocation()).toEqual(fireDate);
      expect(job.pendingInvocations).toHaveLength(1);

      vi.advanceTimersByTime(1000);
      expect(cb).toHaveBeenCalledWith(fireDate);
    });

    it('does not schedule Date in the past', () => {
      vi.useFakeTimers({ now: new Date(2026, 0, 2) });
      const job = new Job('past');
      job.schedule(new Date(2026, 0, 1));
      expect(job.nextInvocation()).toBeNull();
    });
  });

  describe('schedule with cron', () => {
    it('schedules recurring cron job', () => {
      vi.useFakeTimers({ now: new Date(2026, 0, 1, 0, 0, 0) });
      const cb = vi.fn();
      const job = new Job('cron', cb);
      job.schedule('*/5 * * * *');

      expect(job.nextInvocation()).toEqual(new Date(2026, 0, 1, 0, 5, 0));

      vi.advanceTimersByTime(5 * 60 * 1000);
      expect(cb).toHaveBeenCalledTimes(1);

      // Should reschedule for next occurrence
      expect(job.nextInvocation()).toEqual(new Date(2026, 0, 1, 0, 10, 0));
    });
  });

  describe('schedule with RecurrenceRule', () => {
    it('schedules with rule', () => {
      vi.useFakeTimers({ now: new Date(2026, 0, 1, 0, 0, 0) });
      const cb = vi.fn();
      const job = new Job('rule', cb);
      const rule = new RecurrenceRule({ minute: 30, second: 0 });
      job.schedule(rule);

      expect(job.nextInvocation()).toEqual(new Date(2026, 0, 1, 0, 30, 0));
    });
  });

  describe('cancel', () => {
    it('cancels a job', () => {
      vi.useFakeTimers({ now: new Date(2026, 0, 1) });
      const cb = vi.fn();
      const job = new Job('cancel-me', cb);
      job.schedule('* * * * *');
      expect(job.pendingInvocations).toHaveLength(1);

      const result = job.cancel();
      expect(result).toBe(true);
      expect(job.pendingInvocations).toHaveLength(0);
      expect(job.nextInvocation()).toBeNull();

      vi.advanceTimersByTime(60000);
      expect(cb).not.toHaveBeenCalled();
    });

    it('cancel returns false if already canceled', () => {
      const job = new Job('x');
      job.cancel();
      expect(job.cancel()).toBe(false);
    });
  });

  describe('cancelNext', () => {
    it('cancels only the next invocation', () => {
      vi.useFakeTimers({ now: new Date(2026, 0, 1) });
      const job = new Job('cn');
      job.schedule('* * * * *');
      expect(job.pendingInvocations).toHaveLength(1);

      expect(job.cancelNext()).toBe(true);
      expect(job.pendingInvocations).toHaveLength(0);
    });

    it('returns false if no pending invocations', () => {
      const job = new Job('empty');
      expect(job.cancelNext()).toBe(false);
    });
  });

  describe('reschedule', () => {
    it('reschedules with new spec', () => {
      vi.useFakeTimers({ now: new Date(2026, 0, 1, 0, 0, 0) });
      const cb = vi.fn();
      const job = new Job('resched', cb);
      job.schedule('0 * * * *');
      expect(job.nextInvocation()).toEqual(new Date(2026, 0, 1, 1, 0, 0));

      job.reschedule('30 * * * *');
      expect(job.nextInvocation()).toEqual(new Date(2026, 0, 1, 0, 30, 0));
    });
  });

  describe('events', () => {
    it('emits scheduled event', () => {
      vi.useFakeTimers({ now: new Date(2026, 0, 1) });
      const job = new Job('ev');
      const handler = vi.fn();
      job.on('scheduled', handler);
      job.schedule(new Date(2026, 0, 2));
      expect(handler).toHaveBeenCalledWith(new Date(2026, 0, 2));
    });

    it('emits run event', () => {
      vi.useFakeTimers({ now: new Date(2026, 0, 1, 0, 0, 0) });
      const cb = vi.fn();
      const job = new Job('run-ev', cb);
      const handler = vi.fn();
      job.on('run', handler);
      job.schedule(new Date(2026, 0, 1, 0, 0, 1));
      vi.advanceTimersByTime(1000);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('emits canceled event', () => {
      const job = new Job('canc-ev');
      const handler = vi.fn();
      job.on('canceled', handler);
      job.cancel();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('emits error event on callback error', () => {
      vi.useFakeTimers({ now: new Date(2026, 0, 1, 0, 0, 0) });
      const err = new Error('boom');
      const job = new Job('err-ev', () => { throw err; });
      const handler = vi.fn();
      job.on('error', handler);
      job.schedule(new Date(2026, 0, 1, 0, 0, 1));
      vi.advanceTimersByTime(1000);
      expect(handler).toHaveBeenCalledWith(err);
    });
  });
});
