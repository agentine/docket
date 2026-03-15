import { EventEmitter } from 'node:events';
import type { JobCallback, ScheduleSpec, RecurrenceSpecObject, DateRangeSpec } from './types.js';
import { CronExpression } from './cron.js';
import { RecurrenceRule } from './recurrence.js';

export class Invocation {
  fireDate: Date;
  timerID: ReturnType<typeof setTimeout> | null = null;
  job: Job;

  constructor(job: Job, fireDate: Date) {
    this.job = job;
    this.fireDate = fireDate;
  }
}

let jobCounter = 0;

function isDateRangeSpec(spec: unknown): spec is DateRangeSpec {
  return typeof spec === 'object' && spec !== null && 'rule' in spec;
}

function isRecurrenceSpecObject(spec: unknown): spec is RecurrenceSpecObject {
  if (typeof spec !== 'object' || spec === null) return false;
  if (spec instanceof Date || spec instanceof RecurrenceRule) return false;
  if ('rule' in spec) return false; // DateRangeSpec
  const keys = ['second', 'minute', 'hour', 'date', 'month', 'year', 'dayOfWeek', 'tz'];
  return Object.keys(spec).some(k => keys.includes(k));
}

export class Job extends EventEmitter {
  name: string;
  private _callback: JobCallback | null;
  private _pendingInvocations: Invocation[] = [];
  private _spec: ScheduleSpec | null = null;
  private _startDate: Date | null = null;
  private _endDate: Date | null = null;
  private _tz: string | null = null;
  private _running: Promise<void>[] = [];
  private _canceled = false;

  constructor(name?: string | ScheduleSpec, callback?: JobCallback | ScheduleSpec, maybeCallback?: JobCallback) {
    super();
    if (typeof name === 'string' && (callback === undefined || typeof callback === 'function')) {
      this.name = name;
      this._callback = (callback as JobCallback) ?? null;
    } else if (typeof name === 'string' && callback !== undefined && typeof callback !== 'function') {
      this.name = name;
      this._spec = callback as ScheduleSpec;
      this._callback = maybeCallback ?? null;
    } else {
      this.name = `<anonymous-${++jobCounter}>`;
      this._spec = name as ScheduleSpec ?? null;
      this._callback = (callback as JobCallback) ?? null;
    }
  }

  get pendingInvocations(): Invocation[] {
    return [...this._pendingInvocations];
  }

  schedule(spec: ScheduleSpec): boolean {
    if (this._canceled) return false;

    this._spec = spec;
    this._parseSpec(spec);
    this._scheduleNext();
    return this._pendingInvocations.length > 0;
  }

  private _parseSpec(spec: ScheduleSpec): void {
    if (isDateRangeSpec(spec)) {
      this._startDate = spec.start ?? null;
      this._endDate = spec.end ?? null;
      this._tz = spec.tz ?? null;
      // The actual rule is in spec.rule
      if (typeof spec.rule === 'string') {
        this._spec = spec.rule;
      } else if (spec.rule instanceof RecurrenceRule) {
        this._spec = spec.rule;
        if (this._tz && !spec.rule.tz) {
          spec.rule.tz = this._tz;
        }
      } else {
        const rule = new RecurrenceRule(spec.rule);
        if (this._tz && !rule.tz) rule.tz = this._tz;
        this._spec = rule;
      }
    }
  }

  _scheduleNext(): void {
    if (this._canceled) return;

    const now = new Date();
    const next = this._computeNext(now);

    if (!next) return;

    if (this._endDate && next.getTime() > this._endDate.getTime()) return;
    if (this._startDate && next.getTime() < this._startDate.getTime()) {
      // Schedule from start date instead
      const fromStart = this._computeNext(this._startDate);
      if (fromStart) {
        this._arm(fromStart);
      }
      return;
    }

    this._arm(next);
  }

  private _computeNext(after: Date): Date | null {
    const spec = this._spec;

    if (spec instanceof Date) {
      return spec.getTime() > after.getTime() ? spec : null;
    }

    if (typeof spec === 'string') {
      try {
        const cron = new CronExpression(spec, after);
        return cron.next();
      } catch {
        return null;
      }
    }

    if (spec instanceof RecurrenceRule) {
      return spec.nextInvocationDate(after);
    }

    if (isRecurrenceSpecObject(spec)) {
      const rule = new RecurrenceRule(spec);
      return rule.nextInvocationDate(after);
    }

    return null;
  }

  private _arm(date: Date): void {
    const now = Date.now();
    const delay = Math.max(0, date.getTime() - now);
    const invocation = new Invocation(this, date);

    invocation.timerID = setTimeout(() => {
      this._fire(invocation);
    }, delay);

    this._pendingInvocations.push(invocation);
    this.emit('scheduled', date);
  }

  private _fire(invocation: Invocation): void {
    // Remove from pending
    const idx = this._pendingInvocations.indexOf(invocation);
    if (idx !== -1) this._pendingInvocations.splice(idx, 1);

    if (this._canceled) return;

    this.emit('run', invocation.fireDate);

    if (this._callback) {
      try {
        const result = this._callback(invocation.fireDate);
        if (result && typeof result.then === 'function') {
          const p = result
            .catch((err: unknown) => { this.emit('error', err); })
            .finally(() => {
              const ri = this._running.indexOf(p);
              if (ri !== -1) this._running.splice(ri, 1);
            });
          this._running.push(p);
        }
      } catch (err) {
        this.emit('error', err);
      }
    }

    // Schedule next occurrence for recurring jobs
    if (!(this._spec instanceof Date)) {
      this._scheduleNext();
    }
  }

  cancel(): boolean {
    if (this._canceled) return false;
    this._canceled = true;

    for (const inv of this._pendingInvocations) {
      if (inv.timerID !== null) {
        clearTimeout(inv.timerID);
        inv.timerID = null;
      }
    }
    this._pendingInvocations = [];
    this.emit('canceled');
    return true;
  }

  cancelNext(): boolean {
    if (this._pendingInvocations.length === 0) return false;
    const inv = this._pendingInvocations[0];
    if (inv.timerID !== null) {
      clearTimeout(inv.timerID);
      inv.timerID = null;
    }
    this._pendingInvocations.splice(0, 1);
    return true;
  }

  reschedule(spec: ScheduleSpec): boolean {
    // Cancel existing invocations but don't mark as canceled
    for (const inv of this._pendingInvocations) {
      if (inv.timerID !== null) {
        clearTimeout(inv.timerID);
        inv.timerID = null;
      }
    }
    this._pendingInvocations = [];
    this._canceled = false;
    return this.schedule(spec);
  }

  nextInvocation(): Date | null {
    if (this._pendingInvocations.length === 0) return null;
    return this._pendingInvocations[0].fireDate;
  }

  /** Wait for all currently running callbacks to complete. */
  async _waitForRunning(): Promise<void> {
    await Promise.all(this._running);
  }
}
