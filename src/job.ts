// Job class — placeholder for Phase 4

import { EventEmitter } from 'node:events';
import type { JobCallback, ScheduleSpec } from './types.js';

export class Invocation {
  fireDate: Date;
  timerID: ReturnType<typeof setTimeout> | null = null;

  constructor(fireDate: Date) {
    this.fireDate = fireDate;
  }
}

export class Job extends EventEmitter {
  name: string;
  private _pendingInvocations: Invocation[] = [];

  constructor(name?: string | ScheduleSpec, _callback?: JobCallback) {
    super();
    this.name = typeof name === 'string' ? name : '';
    // TODO: Phase 4
  }

  get pendingInvocations(): Invocation[] {
    return this._pendingInvocations;
  }

  cancel(): boolean {
    return false;
  }

  cancelNext(): boolean {
    return false;
  }

  reschedule(_spec: ScheduleSpec): boolean {
    return false;
  }

  nextInvocation(): Date | null {
    return null;
  }
}
