import type { JobCallback, ScheduleSpec, RecurrenceSpecObject } from './types.js';
import { Job } from './job.js';
import { RecurrenceRule } from './recurrence.js';

export const scheduledJobs: Record<string, Job> = {};

function isRecurrenceSpecObject(spec: unknown): spec is RecurrenceSpecObject {
  if (typeof spec !== 'object' || spec === null) return false;
  if (spec instanceof Date || spec instanceof RecurrenceRule) return false;
  if ('rule' in spec) return false;
  const keys = ['second', 'minute', 'hour', 'date', 'month', 'year', 'dayOfWeek', 'tz'];
  return Object.keys(spec).some(k => keys.includes(k));
}

export function scheduleJob(spec: ScheduleSpec, callback: JobCallback): Job;
export function scheduleJob(name: string, spec: ScheduleSpec, callback: JobCallback): Job;
export function scheduleJob(
  nameOrSpec: string | ScheduleSpec,
  specOrCallback: ScheduleSpec | JobCallback,
  maybeCallback?: JobCallback,
): Job {
  let name: string | undefined;
  let spec: ScheduleSpec;
  let callback: JobCallback;

  if (typeof nameOrSpec === 'string' && maybeCallback !== undefined) {
    // scheduleJob(name, spec, callback)
    name = nameOrSpec;
    spec = specOrCallback as ScheduleSpec;
    callback = maybeCallback;
  } else if (typeof nameOrSpec === 'string' && typeof specOrCallback === 'function') {
    // scheduleJob(cronString, callback)
    spec = nameOrSpec;
    callback = specOrCallback as JobCallback;
  } else {
    // scheduleJob(spec, callback)
    spec = nameOrSpec as ScheduleSpec;
    callback = specOrCallback as JobCallback;
  }

  const job = new Job(name);
  job['_callback'] = callback;

  // Convert spec object to RecurrenceRule if needed
  if (isRecurrenceSpecObject(spec)) {
    spec = new RecurrenceRule(spec);
  }

  job.schedule(spec);

  if (job.name) {
    scheduledJobs[job.name] = job;
    job.on('canceled', () => {
      delete scheduledJobs[job.name];
    });
  }

  return job;
}

export function cancelJob(nameOrJob: string | Job): boolean {
  if (typeof nameOrJob === 'string') {
    const job = scheduledJobs[nameOrJob];
    if (!job) return false;
    return job.cancel();
  }
  return nameOrJob.cancel();
}

export async function gracefulShutdown(): Promise<void> {
  const jobs = Object.values(scheduledJobs);
  for (const job of jobs) {
    job.cancel();
  }

  // Wait for any running callbacks to finish
  await Promise.all(jobs.map(j => j._waitForRunning()));
}
