// RecurrenceRule engine — placeholder for Phase 3

export class Range {
  constructor(
    public start: number = 0,
    public end: number = 0,
    public step: number = 1,
  ) {}

  contains(value: number): boolean {
    if (this.step === 1) {
      return value >= this.start && value <= this.end;
    }
    for (let i = this.start; i <= this.end; i += this.step) {
      if (i === value) return true;
    }
    return false;
  }
}

export class RecurrenceRule {
  second: number | Range | number[] | null = null;
  minute: number | Range | number[] | null = null;
  hour: number | Range | number[] | null = null;
  date: number | Range | number[] | null = null;
  month: number | Range | number[] | null = null;
  year: number | Range | number[] | null = null;
  dayOfWeek: number | Range | number[] | null = null;
  tz: string | null = null;

  constructor() {
    // TODO: Phase 3
  }

  nextInvocationDate(_after?: Date): Date | null {
    return null;
  }
}
