// Cron expression parser — placeholder for Phase 2

export class CronExpression {
  constructor(_expression: string) {
    // TODO: Phase 2
  }

  next(): Date | null {
    return null;
  }

  prev(): Date | null {
    return null;
  }

  hasNext(): boolean {
    return false;
  }
}

export function parseCron(_expression: string): CronExpression {
  return new CronExpression(_expression);
}
