import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { scheduleJob, cancelJob, scheduledJobs, gracefulShutdown } from './scheduler.js';
import { Job } from './job.js';
import { RecurrenceRule } from './recurrence.js';

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 0, 1, 0, 0, 0) });
  // Clear scheduled jobs
  for (const name of Object.keys(scheduledJobs)) {
    scheduledJobs[name].cancel();
  }
});

afterEach(() => {
  vi.useRealTimers();
});

describe('scheduleJob', () => {
  it('scheduleJob(cron, callback)', () => {
    const cb = vi.fn();
    const job = scheduleJob('*/5 * * * *', cb);
    expect(job).toBeInstanceOf(Job);
    expect(job.nextInvocation()).toEqual(new Date(2026, 0, 1, 0, 5, 0));
  });

  it('scheduleJob(name, cron, callback)', () => {
    const cb = vi.fn();
    const job = scheduleJob('my-job', '0 * * * *', cb);
    expect(job.name).toBe('my-job');
    expect(scheduledJobs['my-job']).toBe(job);
  });

  it('scheduleJob(Date, callback)', () => {
    const cb = vi.fn();
    const date = new Date(2026, 0, 1, 12, 0, 0);
    const job = scheduleJob(date, cb);
    expect(job.nextInvocation()).toEqual(date);

    vi.advanceTimersByTime(12 * 60 * 60 * 1000);
    expect(cb).toHaveBeenCalledWith(date);
  });

  it('scheduleJob(RecurrenceRule, callback)', () => {
    const cb = vi.fn();
    const rule = new RecurrenceRule({ hour: 12, minute: 0, second: 0 });
    const job = scheduleJob(rule, cb);
    expect(job.nextInvocation()).toEqual(new Date(2026, 0, 1, 12, 0, 0));
  });

  it('scheduleJob(object spec, callback)', () => {
    const cb = vi.fn();
    const job = scheduleJob({ hour: 12, minute: 0, second: 0 }, cb);
    expect(job.nextInvocation()).toEqual(new Date(2026, 0, 1, 12, 0, 0));
  });

  it('fires callback and reschedules', () => {
    const cb = vi.fn();
    scheduleJob('0 * * * *', cb);

    vi.advanceTimersByTime(60 * 60 * 1000); // 1 hour
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('cancelJob', () => {
  it('cancel by name', () => {
    const cb = vi.fn();
    scheduleJob('cancel-me', '* * * * *', cb);
    expect(scheduledJobs['cancel-me']).toBeDefined();

    const result = cancelJob('cancel-me');
    expect(result).toBe(true);
    expect(scheduledJobs['cancel-me']).toBeUndefined();
  });

  it('cancel by job instance', () => {
    const cb = vi.fn();
    const job = scheduleJob('0 * * * *', cb);
    const result = cancelJob(job);
    expect(result).toBe(true);
  });

  it('returns false for unknown name', () => {
    expect(cancelJob('nonexistent')).toBe(false);
  });
});

describe('scheduledJobs', () => {
  it('tracks named jobs', () => {
    const cb = vi.fn();
    scheduleJob('a', '* * * * *', cb);
    scheduleJob('b', '0 * * * *', cb);
    expect(Object.keys(scheduledJobs)).toContain('a');
    expect(Object.keys(scheduledJobs)).toContain('b');
  });

  it('removes job on cancel', () => {
    const cb = vi.fn();
    scheduleJob('temp', '* * * * *', cb);
    cancelJob('temp');
    expect(scheduledJobs['temp']).toBeUndefined();
  });
});

describe('gracefulShutdown', () => {
  it('cancels all jobs', async () => {
    const cb = vi.fn();
    scheduleJob('g1', '* * * * *', cb);
    scheduleJob('g2', '0 * * * *', cb);

    await gracefulShutdown();

    expect(Object.keys(scheduledJobs).filter(k => k.startsWith('g'))).toHaveLength(0);
  });

  it('waits for running callbacks', async () => {
    let resolved = false;
    const cb = vi.fn(async () => {
      await new Promise(r => setTimeout(r, 100));
      resolved = true;
    });

    scheduleJob('async-job', new Date(2026, 0, 1, 0, 0, 1), cb);
    vi.advanceTimersByTime(1000);

    const shutdown = gracefulShutdown();
    await vi.advanceTimersByTimeAsync(200);
    await shutdown;
    expect(resolved).toBe(true);
  });
});
