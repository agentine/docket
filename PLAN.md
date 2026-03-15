# docket — Drop-in Replacement for node-schedule

## Target

**Package:** [node-schedule](https://github.com/node-schedule/node-schedule)
**Downloads:** 3.4M weekly (npm), 2,116 dependents, 9.2k GitHub stars
**Status:** Last feature commit Nov 2021, last npm release 3+ years ago (v2.1.1), 154 open issues, 17 unmerged PRs, single inactive maintainer
**License:** MIT

## Why Replace

node-schedule is a widely-used Node.js job scheduler that supports cron expressions, Date-based scheduling, and RecurrenceRule objects. It has been effectively unmaintained since November 2021 — no new features, no bug fixes published, 154 open issues unaddressed. The single remaining maintainer (Igor Savin) has minimal activity.

**Existing alternatives are NOT drop-in:**
- **node-cron:** Cron-only, no RecurrenceRule, no Date scheduling, no job management (cancel/reschedule)
- **Bree:** Worker thread-based, much heavier, completely different paradigm
- **BullMQ:** Requires Redis, completely different architecture
- **croner:** Different API, different scheduling model
- **@nestjs/schedule:** Framework-specific, not general purpose

No maintained drop-in replacement exists for node-schedule's full API surface.

## Package

- **Name:** `@agentine/docket`
- **Registry:** npm (verified available)
- **Language:** TypeScript
- **Module:** ESM + CJS dual package
- **Node.js:** 18+ (LTS)
- **Dependencies:** Zero runtime dependencies

## Architecture

### Core Modules

#### 1. `src/cron.ts` — Cron Expression Parser
- Parse standard 5-field and extended 6-field (with seconds) cron expressions
- Support: `*`, ranges (`1-5`), steps (`*/5`), lists (`1,3,5`), day-of-week names (`MON-FRI`), month names
- `nextDate(expr, after?)` — compute next occurrence from a cron expression
- `CronExpression` class with `.next()`, `.prev()`, `.hasNext()` iterator

#### 2. `src/recurrence.ts` — RecurrenceRule Engine
- `RecurrenceRule` class matching node-schedule's API:
  - Properties: `second`, `minute`, `hour`, `date`, `month`, `year`, `dayOfWeek`
  - Each property accepts: number, `Range`, array of numbers, or `null` (wildcard)
- `Range` class: `new Range(start, end, step)`
- `nextDate(rule, after?)` — compute next occurrence from a RecurrenceRule
- Timezone support via `tz` property (IANA timezone names, uses `Intl.DateTimeFormat`)

#### 3. `src/job.ts` — Job Class
- `Job` class:
  - `name: string` — optional job name
  - `cancel(): boolean` — cancel the job
  - `cancelNext(): boolean` — cancel next pending invocation only
  - `reschedule(spec): boolean` — reschedule with new spec
  - `nextInvocation(): Date | null` — next scheduled run time
  - `pendingInvocations: Invocation[]` — list of pending invocations
  - Event emitter: `scheduled`, `run`, `canceled`, `error`
- `Invocation` class: represents a single pending invocation with `fireDate` and `timerID`

#### 4. `src/scheduler.ts` — Scheduler (main export)
- `scheduleJob(spec, callback): Job` — schedule a job
- `scheduleJob(name, spec, callback): Job` — schedule a named job
- `cancelJob(name | job): boolean` — cancel a job
- `scheduledJobs: Record<string, Job>` — map of all active named jobs
- `gracefulShutdown(): Promise<void>` — cancel all jobs, wait for running callbacks
- Spec types: cron string, Date, RecurrenceRule, object literal `{ hour, minute, ... }`, or `{ start, end, rule, tz }`

#### 5. `src/compat/node-schedule.ts` — Compatibility Layer
- Re-export all public APIs matching `node-schedule` signatures exactly
- Drop-in module replacement: users can alias `@agentine/docket/compat/node-schedule` as `node-schedule`
- Passes node-schedule's existing test suite as baseline

### Type System
- Full TypeScript with strict mode
- Exported types: `Job`, `JobCallback`, `RecurrenceRule`, `RecurrenceSegment`, `Range`, `Invocation`, `CronExpression`, `ScheduleSpec`
- `py.typed` equivalent: `types` field in package.json

### Project Structure
```
src/
  index.ts          # Main exports
  cron.ts           # Cron expression parser
  recurrence.ts     # RecurrenceRule engine
  job.ts            # Job class + Invocation
  scheduler.ts      # Scheduler functions
  types.ts          # Shared type definitions
  compat/
    node-schedule.ts  # Drop-in compatibility layer
```

## Deliverables

1. **Scaffolding** — package.json, tsconfig, ESM+CJS build, src layout
2. **Cron parser** — 5/6-field cron expression parsing with next-date computation
3. **RecurrenceRule engine** — RecurrenceRule, Range, timezone support, next-date computation
4. **Job + Scheduler** — Job class, event emitter, scheduler functions, gracefulShutdown
5. **Compatibility layer + Tests** — node-schedule compat module, ported test suite, edge case coverage

## Key Design Decisions

- **Zero dependencies:** Cron parsing built-in (node-schedule uses `cron-parser` dependency). Timezone via `Intl.DateTimeFormat` (no moment-timezone).
- **Timer precision:** Use `setTimeout` for scheduling (same as node-schedule). Avoid `setInterval` to prevent drift.
- **Event emitter:** Extend Node's `EventEmitter` for job events (matching node-schedule behavior).
- **Graceful shutdown:** Track running callbacks via Promise, resolve when all complete.
- **ESM+CJS:** Use `tsup` or similar for dual builds. `exports` field in package.json.
