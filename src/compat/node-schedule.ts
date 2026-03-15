export { CronExpression, parseCron } from '../cron.js';
export { Range, RecurrenceRule } from '../recurrence.js';
export { Job, Invocation } from '../job.js';
export { scheduleJob, cancelJob, scheduledJobs, gracefulShutdown } from '../scheduler.js';

export type { JobCallback, RecurrenceSegment, RecurrenceSpecObject, DateRangeSpec, ScheduleSpec } from '../types.js';

// Default export matching `import schedule from 'node-schedule'` pattern
import { scheduleJob, cancelJob, scheduledJobs, gracefulShutdown } from '../scheduler.js';
import { RecurrenceRule, Range } from '../recurrence.js';
import { Job, Invocation } from '../job.js';

export default {
  scheduleJob,
  cancelJob,
  scheduledJobs,
  gracefulShutdown,
  RecurrenceRule,
  Range,
  Job,
  Invocation,
};
