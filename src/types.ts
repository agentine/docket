import type { Range } from './recurrence.js';
import type { RecurrenceRule } from './recurrence.js';
export type { Range, RecurrenceRule };

/**
 * Callback function invoked when a job fires.
 */
export type JobCallback = (fireDate: Date) => void | Promise<void>;

/**
 * A single field in a recurrence rule can be a number, a Range, an array, or null (wildcard).
 */
export type RecurrenceSegment = number | Range | number[] | null;

/**
 * Object literal for specifying a recurrence rule inline.
 */
export interface RecurrenceSpecObject {
  second?: RecurrenceSegment;
  minute?: RecurrenceSegment;
  hour?: RecurrenceSegment;
  date?: RecurrenceSegment;
  month?: RecurrenceSegment;
  year?: RecurrenceSegment;
  dayOfWeek?: RecurrenceSegment;
  tz?: string;
}

/**
 * Date range specification with optional rule and timezone.
 */
export interface DateRangeSpec {
  start?: Date;
  end?: Date;
  rule: string | RecurrenceRule | RecurrenceSpecObject;
  tz?: string;
}

/**
 * All valid schedule specification types.
 */
export type ScheduleSpec = string | Date | RecurrenceRule | RecurrenceSpecObject | DateRangeSpec;

