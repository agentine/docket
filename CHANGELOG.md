# Changelog

## 0.1.0 — 2026-03-16

Initial release.

- Cron expression parser: 5-field and 6-field (with seconds), wildcards, ranges, steps, lists, day/month names
- RecurrenceRule engine with Range class and IANA timezone support via `Intl.DateTimeFormat`
- Job class with EventEmitter, cancel/cancelNext/reschedule/nextInvocation/pendingInvocations
- Scheduler: scheduleJob, cancelJob, scheduledJobs, gracefulShutdown
- Drop-in node-schedule compatibility layer (`@agentine/docket/compat/node-schedule`)
- TypeScript-first, zero runtime dependencies
- ESM + CJS dual package
- Node.js 18+ (tested on 18, 20, 22)
- 124 tests across 5 test files
