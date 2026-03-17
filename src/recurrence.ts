export class Range {
  constructor(
    public start: number = 0,
    public end: number = 60,
    public step: number = 1,
  ) {}

  contains(value: number): boolean {
    if (value < this.start || value > this.end) return false;
    if (this.step === 1) return true;
    return (value - this.start) % this.step === 0;
  }

  toArray(): number[] {
    const result: number[] = [];
    for (let i = this.start; i <= this.end; i += this.step) {
      result.push(i);
    }
    return result;
  }
}

export type RecurrenceSegment = number | Range | number[] | null;

function matchesField(value: number, field: RecurrenceSegment): boolean {
  if (field === null || field === undefined) return true;
  if (typeof field === 'number') return value === field;
  if (field instanceof Range) return field.contains(value);
  if (Array.isArray(field)) return field.includes(value);
  return false;
}

function expandField(field: RecurrenceSegment, min: number, max: number): number[] {
  if (field === null || field === undefined) {
    const arr: number[] = [];
    for (let i = min; i <= max; i++) arr.push(i);
    return arr;
  }
  if (typeof field === 'number') return [field];
  if (field instanceof Range) return field.toArray();
  if (Array.isArray(field)) return [...field].sort((a, b) => a - b);
  return [];
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Convert a local date to a specific IANA timezone and return the components.
 */
function dateInTimezone(date: Date, tz: string): { year: number; month: number; day: number; hour: number; minute: number; second: number; dow: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string): number => {
    const p = parts.find(p => p.type === type);
    return p ? parseInt(p.value, 10) : 0;
  };

  // Get day-of-week from the timezone-adjusted date
  const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' });
  const weekdayStr = weekdayFmt.format(date);
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = dowMap[weekdayStr] ?? 0;

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') === 24 ? 0 : get('hour'),
    minute: get('minute'),
    second: get('second'),
    dow,
  };
}

/**
 * Create a Date from components in a specific timezone.
 */
function dateFromTimezone(year: number, month: number, day: number, hour: number, minute: number, second: number, tz: string): Date {
  // Start with a rough UTC estimate, then adjust
  const rough = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const parts = dateInTimezone(rough, tz);

  // Calculate offset in milliseconds between what we want and what we got
  const wantMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const gotMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const diff = wantMs - gotMs;

  const adjusted = new Date(rough.getTime() + diff);

  // Verify — DST spring-forward: the requested time may not exist
  const verify = dateInTimezone(adjusted, tz);
  if (verify.hour !== hour || verify.minute !== minute) {
    // Time doesn't exist (spring-forward gap), return null via NaN
    return adjusted;
  }

  return adjusted;
}

export class RecurrenceRule {
  second: RecurrenceSegment = null;
  minute: RecurrenceSegment = null;
  hour: RecurrenceSegment = null;
  date: RecurrenceSegment = null;
  month: RecurrenceSegment = null;
  year: RecurrenceSegment = null;
  dayOfWeek: RecurrenceSegment = null;
  tz: string | null = null;

  constructor(yearOrSpec?: number | null | Partial<{ second: RecurrenceSegment; minute: RecurrenceSegment; hour: RecurrenceSegment; date: RecurrenceSegment; month: RecurrenceSegment; year: RecurrenceSegment; dayOfWeek: RecurrenceSegment; tz: string | null }>, month?: RecurrenceSegment, date?: RecurrenceSegment, hour?: RecurrenceSegment, minute?: RecurrenceSegment, second?: RecurrenceSegment, dayOfWeek?: RecurrenceSegment) {
    if (yearOrSpec !== null && yearOrSpec !== undefined && typeof yearOrSpec === 'object') {
      const spec = yearOrSpec;
      if ('second' in spec) this.second = spec.second ?? null;
      if ('minute' in spec) this.minute = spec.minute ?? null;
      if ('hour' in spec) this.hour = spec.hour ?? null;
      if ('date' in spec) this.date = spec.date ?? null;
      if ('month' in spec) this.month = spec.month ?? null;
      if ('year' in spec) this.year = spec.year ?? null;
      if ('dayOfWeek' in spec) this.dayOfWeek = spec.dayOfWeek ?? null;
      if ('tz' in spec) this.tz = spec.tz ?? null;
    } else {
      this.year = yearOrSpec ?? null;
      this.month = month ?? null;
      this.date = date ?? null;
      this.hour = hour ?? null;
      this.minute = minute ?? null;
      this.second = second ?? null;
      this.dayOfWeek = dayOfWeek ?? null;
    }
  }

  nextInvocationDate(after?: Date): Date | null {
    const base = after ?? new Date();

    if (this.tz) {
      return this._nextInTimezone(base, this.tz);
    }

    return this._nextLocal(base);
  }

  private _nextLocal(after: Date): Date | null {
    const limit = new Date(after.getTime());
    limit.setFullYear(limit.getFullYear() + 5);

    const years = this.year !== null ? expandField(this.year, after.getFullYear(), after.getFullYear() + 5) : null;
    const months = expandField(this.month, 1, 12);
    const hours = expandField(this.hour, 0, 23);
    const minutes = expandField(this.minute, 0, 59);
    const seconds = expandField(this.second, 0, 59);

    const startYear = after.getFullYear();
    const endYear = startYear + 5;

    const yearList = years ?? Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

    for (const yr of yearList) {
      if (yr < startYear) continue;
      if (yr > endYear) break;

      for (const mo of months) {
        if (yr === startYear && mo < after.getMonth() + 1) continue;

        const maxDay = daysInMonth(yr, mo);
        const days = expandField(this.date, 1, 31).filter(d => d <= maxDay);

        for (const dy of days) {
          const d = new Date(yr, mo - 1, dy);
          if (!matchesField(d.getDay(), this.dayOfWeek)) continue;

          for (const hr of hours) {
            for (const mn of minutes) {
              for (const sc of seconds) {
                const candidate = new Date(yr, mo - 1, dy, hr, mn, sc);
                if (candidate.getTime() > after.getTime()) {
                  return candidate;
                }
              }
            }
          }
        }
      }
    }

    return null;
  }

  private _nextInTimezone(after: Date, tz: string): Date | null {
    const limit = new Date(after.getTime());
    limit.setFullYear(limit.getFullYear() + 5);

    const tzParts = dateInTimezone(after, tz);

    const months = expandField(this.month, 1, 12);
    const hours = expandField(this.hour, 0, 23);
    const minutes = expandField(this.minute, 0, 59);
    const seconds = expandField(this.second, 0, 59);

    const startYear = tzParts.year;
    const endYear = startYear + 5;
    const years = this.year !== null
      ? expandField(this.year, startYear, endYear)
      : Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

    for (const yr of years) {
      if (yr > endYear) break;

      for (const mo of months) {
        const maxDay = daysInMonth(yr, mo);
        const days = expandField(this.date, 1, 31).filter(d => d <= maxDay);

        for (const dy of days) {
          // Check day-of-week in target timezone
          const testDate = dateFromTimezone(yr, mo, dy, 12, 0, 0, tz);
          const testParts = dateInTimezone(testDate, tz);
          if (!matchesField(testParts.dow, this.dayOfWeek)) continue;

          for (const hr of hours) {
            for (const mn of minutes) {
              for (const sc of seconds) {
                const candidate = dateFromTimezone(yr, mo, dy, hr, mn, sc, tz);
                if (candidate.getTime() > after.getTime() && candidate.getTime() <= limit.getTime()) {
                  return candidate;
                }
              }
            }
          }
        }
      }
    }

    return null;
  }
}
