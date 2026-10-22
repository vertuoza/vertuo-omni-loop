# ADR-0102 — Observability stays on Vercel: Observability Plus behind a spend limit, JSON lines through kit/lib/log

**Status:** accepted · **Date:** 2026-10-12 · **PRD:** #1723 · **Layers:** infra

## Context

The arcade (`apps/galaxy`) and the Omni GitHub App (`apps/omni-app`) run on Vercel Pro. Nobody heard
when either broke: every log was a free-text string (about 250 `console.error` calls), so Vercel's log
search could not filter by repository, PRD, outcome or duration; no alert fired on anything; neither
app had a health endpoint; and runtime logs were kept one day, unless Observability Plus was on, which
nothing recorded. The person who runs both wants to know when they break, and why, without a new
vendor and without a bill beyond the Vercel Pro plan already paid.

## Decision

1. **Vercel only.** Alerts, log search and log retention come from Vercel's own tools. No third-party
   APM, error tracker or log vendor is added.
2. **Observability Plus stays on, behind a spend limit** set under Vercel's Spend Management, so the
   bill cannot run away. It keeps runtime logs 30 days, and Vercel's error anomaly alerts need it. One
   error anomaly alert rule per project emails the team. Someone reads the Usage tab a month after
   shipping and writes the real cost into `docs/guide/observability.md`.
3. **Logs are JSON lines written through `kit/lib/log`,** the repository's own module: one line to
   stdout per call, only allow-listed fields (others dropped and counted), an error as
   `{ name, message }` with the message cut to 500 characters and credential shapes masked, no stack,
   and it never throws. The App's entries, its Inngest functions and galaxy's stages cron each write
   one line per run, at its end; the App's injected loggers default to it. New server code logs
   through it (conventions form).
4. **Health is a public `/api/health` per app,** probed hourly by a GitHub workflow that opens, comments
   on and closes a `Health: <app> is down` issue. These settings live in the Vercel dashboard, written
   as a checklist in the guide; no code checks them.

## Alternatives

- **Sentry** for error alerts: proposed and refused by the person ("we said to leverage Vercel"). A
  new vendor, a new SDK in both apps and a second bill.
- **Log Drains** to a log vendor: refused. A second store and a second bill for what Observability
  Plus's 30 days of search already give.
- **A logging library** (pino or the like): refused. The App needs one line per run with a fixed
  allow-list and masking, a few dozen lines of its own code; `kit/lib` is already imported by both
  apps, so no zone of the architecture changes.
- **Observability Plus off, for a true $0:** refused by the person. Logs would be kept one day and
  Vercel's anomaly alerts would not run.

## Consequences

- The App's whole output, and galaxy's stages cron, becomes JSON lines that Vercel's search filters by
  field. Galaxy's other page and route strings stay plain; its alert counts 5xx responses, not lines.
- Observability Plus bills per event: one line per run, never per call inside it, keeps the count near
  the number of requests, and the spend limit caps the bill.
- An error's message is the one free-text field a line carries; the allow-list and the masking,
  held by the logger's tests, are the guard against a secret in a log line.
- Changing vendor later is a new ADR superseding this one; every line already goes through one module,
  so a drain or an SDK would be wired there.
