// Scheduler — placeholder for Phase 4

import type { JobCallback, ScheduleSpec } from './types.js';
import { Job } from './job.js';

export const scheduledJobs: Record<string, Job> = {};

export function scheduleJob(
  nameOrSpec: string | ScheduleSpec,
  specOrCallback?: ScheduleSpec | JobCallback,
  _callback?: JobCallback,
): Job {
  const name = typeof nameOrSpec === 'string' && specOrCallback !== undefined && _callback !== undefined
    ? nameOrSpec
    : '';
  return new Job(name);
}

export function cancelJob(_nameOrJob: string | Job): boolean {
  return false;
}

export async function gracefulShutdown(): Promise<void> {
  // TODO: Phase 4
}
