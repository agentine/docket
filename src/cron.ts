const MONTH_NAMES: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

const DOW_NAMES: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

/**
 * Parsed set of allowed values for a single cron field.
 */
type FieldSet = Set<number>;

function parseField(field: string, min: number, max: number, names?: Record<string, number>): FieldSet {
  const set = new Set<number>();
  for (const part of field.split(',')) {
    parsePart(part.trim(), min, max, names, set);
  }
  return set;
}

function parsePart(part: string, min: number, max: number, names: Record<string, number> | undefined, set: FieldSet): void {
  // Replace names (e.g., MON, JAN)
  let p = part.toUpperCase();
  if (names) {
    for (const [name, val] of Object.entries(names)) {
      p = p.replace(new RegExp(`\\b${name}\\b`, 'g'), String(val));
    }
  }

  // Step: X/step or */step
  const stepMatch = p.match(/^(.+)\/(\d+)$/);
  if (stepMatch) {
    const step = parseInt(stepMatch[2], 10);
    const base = stepMatch[1];
    if (base === '*') {
      for (let i = min; i <= max; i += step) set.add(i);
    } else if (base.includes('-')) {
      const [lo, hi] = base.split('-').map(Number);
      for (let i = lo; i <= hi; i += step) set.add(i);
    } else {
      const start = parseInt(base, 10);
      for (let i = start; i <= max; i += step) set.add(i);
    }
    return;
  }

  // Range: X-Y
  if (p.includes('-')) {
    const [lo, hi] = p.split('-').map(Number);
    for (let i = lo; i <= hi; i++) set.add(i);
    return;
  }

  // Wildcard
  if (p === '*') {
    for (let i = min; i <= max; i++) set.add(i);
    return;
  }

  // Single value
  const val = parseInt(p, 10);
  if (!isNaN(val)) set.add(val);
}

interface CronFields {
  seconds: FieldSet;
  minutes: FieldSet;
  hours: FieldSet;
  daysOfMonth: FieldSet;
  months: FieldSet;
  daysOfWeek: FieldSet;
  hasSeconds: boolean;
}

function parseExpression(expression: string): CronFields {
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) {
    throw new Error(`Invalid cron expression: expected 5 or 6 fields, got ${parts.length}`);
  }

  const hasSeconds = parts.length === 6;
  let idx = 0;

  const seconds = hasSeconds
    ? parseField(parts[idx++], 0, 59)
    : new Set([0]);
  const minutes = parseField(parts[idx++], 0, 59);
  const hours = parseField(parts[idx++], 0, 23);
  const daysOfMonth = parseField(parts[idx++], 1, 31);
  const months = parseField(parts[idx++], 1, 12, MONTH_NAMES);
  const daysOfWeek = parseField(parts[idx++], 0, 6, DOW_NAMES);

  // Normalize day-of-week 7 -> 0 (Sunday)
  if (daysOfWeek.has(7)) {
    daysOfWeek.add(0);
    daysOfWeek.delete(7);
  }

  return { seconds, minutes, hours, daysOfMonth, months, daysOfWeek, hasSeconds };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function nextOccurrence(fields: CronFields, after: Date): Date | null {
  // Search up to 5 years ahead
  const limit = new Date(after.getTime());
  limit.setFullYear(limit.getFullYear() + 5);

  let year = after.getFullYear();
  let month = after.getMonth() + 1; // 1-based
  let day = after.getDate();
  let hour = after.getHours();
  let minute = after.getMinutes();
  let second = after.getSeconds() + 1; // Start after the given time

  // Carry forward
  if (second > 59) { second = 0; minute++; }
  if (minute > 59) { minute = 0; hour++; }
  if (hour > 23) { hour = 0; day++; }

  for (; year <= limit.getFullYear(); year++) {
    for (; month <= 12; month++) {
      if (!fields.months.has(month)) {
        day = 1; hour = 0; minute = 0; second = 0;
        continue;
      }

      const maxDay = daysInMonth(year, month);
      for (; day <= maxDay; day++) {
        if (!fields.daysOfMonth.has(day)) {
          hour = 0; minute = 0; second = 0;
          continue;
        }

        const d = new Date(year, month - 1, day);
        if (!fields.daysOfWeek.has(d.getDay())) {
          hour = 0; minute = 0; second = 0;
          continue;
        }

        for (; hour <= 23; hour++) {
          if (!fields.hours.has(hour)) {
            minute = 0; second = 0;
            continue;
          }

          for (; minute <= 59; minute++) {
            if (!fields.minutes.has(minute)) {
              second = 0;
              continue;
            }

            for (; second <= 59; second++) {
              if (!fields.seconds.has(second)) continue;

              const candidate = new Date(year, month - 1, day, hour, minute, second);
              if (candidate.getTime() > after.getTime() && candidate.getTime() <= limit.getTime()) {
                return candidate;
              }
            }
            second = 0;
          }
          minute = 0; second = 0;
        }
        hour = 0; minute = 0; second = 0;
      }
      day = 1; hour = 0; minute = 0; second = 0;
    }
    month = 1; day = 1; hour = 0; minute = 0; second = 0;
  }

  return null;
}

function prevOccurrence(fields: CronFields, before: Date): Date | null {
  // Search up to 5 years back
  const limit = new Date(before.getTime());
  limit.setFullYear(limit.getFullYear() - 5);

  let year = before.getFullYear();
  let month = before.getMonth() + 1;
  let day = before.getDate();
  let hour = before.getHours();
  let minute = before.getMinutes();
  let second = before.getSeconds() - 1;

  if (second < 0) { second = 59; minute--; }
  if (minute < 0) { minute = 59; hour--; }
  if (hour < 0) { hour = 23; day--; }

  for (; year >= limit.getFullYear(); year--) {
    for (; month >= 1; month--) {
      if (!fields.months.has(month)) {
        if (month > 1) {
          day = daysInMonth(year, month - 1);
        } else {
          day = 31;
        }
        hour = 23; minute = 59; second = 59;
        continue;
      }

      const maxDay = daysInMonth(year, month);
      if (day > maxDay) day = maxDay;

      for (; day >= 1; day--) {
        if (!fields.daysOfMonth.has(day)) {
          hour = 23; minute = 59; second = 59;
          continue;
        }

        const d = new Date(year, month - 1, day);
        if (!fields.daysOfWeek.has(d.getDay())) {
          hour = 23; minute = 59; second = 59;
          continue;
        }

        for (; hour >= 0; hour--) {
          if (!fields.hours.has(hour)) {
            minute = 59; second = 59;
            continue;
          }

          for (; minute >= 0; minute--) {
            if (!fields.minutes.has(minute)) {
              second = 59;
              continue;
            }

            for (; second >= 0; second--) {
              if (!fields.seconds.has(second)) continue;

              const candidate = new Date(year, month - 1, day, hour, minute, second);
              if (candidate.getTime() < before.getTime() && candidate.getTime() >= limit.getTime()) {
                return candidate;
              }
            }
            second = 59;
          }
          minute = 59; second = 59;
        }
        hour = 23; minute = 59; second = 59;
      }
      day = daysInMonth(year, month > 1 ? month - 1 : 12);
      hour = 23; minute = 59; second = 59;
    }
    month = 12;
    day = 31;
    hour = 23; minute = 59; second = 59;
  }

  return null;
}

export class CronExpression {
  private fields: CronFields;
  private _cursor: Date;
  private _expression: string;

  constructor(expression: string, after?: Date) {
    this._expression = expression;
    this.fields = parseExpression(expression);
    this._cursor = after ?? new Date();
  }

  next(): Date {
    const d = nextOccurrence(this.fields, this._cursor);
    if (!d) throw new Error('No next occurrence found within 5-year search window');
    this._cursor = d;
    return d;
  }

  prev(): Date {
    const d = prevOccurrence(this.fields, this._cursor);
    if (!d) throw new Error('No previous occurrence found within 5-year search window');
    this._cursor = d;
    return d;
  }

  hasNext(): boolean {
    return nextOccurrence(this.fields, this._cursor) !== null;
  }

  hasPrev(): boolean {
    return prevOccurrence(this.fields, this._cursor) !== null;
  }

  reset(date?: Date): void {
    this._cursor = date ?? new Date();
  }

  get expression(): string {
    return this._expression;
  }
}

export function parseCron(expression: string, after?: Date): CronExpression {
  return new CronExpression(expression, after);
}
