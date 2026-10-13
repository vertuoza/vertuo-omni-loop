---
prd: 1723
title: Observability on Vercel at near-zero cost
blocked-by: none
spec: file
phase0: server
---

# Observability on Vercel at near-zero cost

**Date:** 2026-10-12 · **PRD:** #1723
**Touches:**
- `kit/lib/log/` (new: the structured logger, one JSON line to stdout)
- `apps/omni-app/entries/github.ts`, `entries/server-event.ts`, `entries/inngest.ts` (each run logs
  one line), `apps/omni-app/src/functions.ts` (every Inngest function run logs one line)
- `apps/omni-app/src/**` (the injected `log = console.error` / `console.log` defaults become the
  structured logger)
- `apps/omni-app/entries/health.ts` (new), `apps/omni-app/build.ts`, `apps/omni-app/vercel.json`,
  `apps/omni-app/api/` (rebuilt), `apps/omni-app/src/env.ts`
- `apps/galaxy/app/api/health/route.ts` (new) and its service and repository under `apps/galaxy/src/`
- `apps/galaxy/app/api/stages/sync/route.ts`, `apps/galaxy/src/stages/sync/` (the cron run logs one
  line), `apps/galaxy/src/env.ts`
- `scripts/health-check.ts` (new), `.github/workflows/health.yml` (new)
- `docs/guide/observability.md` (new), `.omni-loop/knowledge/adr/0102-observability-stays-on-vercel.md`
  (new), `.omni-loop/knowledge/playbook/conventions.md` (one line), both apps' READMEs (the
  environment and setup sections)

## Problem

Nobody hears when OMNI-LOOP breaks. The arcade (`apps/galaxy`) and the GitHub App
(`apps/omni-app`) run on Vercel Pro, and today:

- Every log is a free-text string (about 250 `console.error` calls), so Vercel's log search cannot
  filter by repository, PRD, outcome or duration, and nothing says how long a webhook or an
  Inngest run took.
- No alert fires on anything. A webhook handler throwing on every delivery, or the stages cron
  failing every 15 minutes, is found when someone notices the board is stale.
- Neither app has a health endpoint, so nothing tells a dead deployment from a quiet one.
- Runtime logs are kept for one day unless Observability Plus is on, and whether it is on, and what
  it costs, is not written anywhere.

The person who runs the Omni page and the App wants to know when it breaks, and why, without a new
vendor and without a bill beyond the Vercel Pro plan already paid.

## Solution

### Phase 0: Vercel's own tools, set by a person

Settings in the Vercel dashboard, written as a checklist in `docs/guide/observability.md`; no code
checks them.

- **Observability Plus stays on,** with a spend limit under Vercel's Spend Management, so the bill
  can never run away. It keeps runtime logs 30 days and is what Vercel's alerts need.
- **One error anomaly alert rule per project** (galaxy and omni-app), delivered by email to the team.
  It fires when a route's 5xx count over five minutes is unusually high.
- **One month after it ships,** someone reads the Usage tab and writes the real monthly cost of
  Observability Plus into the guide page.

### Phase 1: structured logs

- **`kit/lib/log`** writes one JSON line to stdout per call:
  `{ "level", "event", "outcome", "ms", "repo"?, "prd"?, "deliveryId"?, "runId"?, "fn"?, "status"?, "error"? }`.
  - `level` is `info`, `warn` or `error`; `event` names what ran (`webhook`, `server-event`,
    `inngest`, `stages-sync`); `outcome` is `ok`, `refused` or `failed`.
  - **An allow-list of fields.** A field outside the list is dropped and counted in `dropped`; its
    name and value are never written.
  - **An error** is written as `{ name, message }`, the message cut to 500 characters, with what
    looks like a credential masked as `***`: GitHub tokens (`ghp_`, `gho_`, `ghs_`, `ghu_`,
    `github_pat_`), kit tokens (`omk_`), keys starting `sk-`, a `Bearer` value, and the value of a
    URL query parameter named like a key, token, secret, code or signature. No stack trace.
  - **It never throws.** A value it cannot serialise, or a sink that fails, is swallowed: a log line
    never breaks a request.
- **One line per run, at the end of the run,** with its outcome and duration in milliseconds:
  - each GitHub webhook delivery (`event: webhook`, with the delivery id, the repository, and the
    GitHub event name in `fn`);
  - each `server-event` call (`event: server-event`);
  - each Inngest function run, success or failure (`event: inngest`, the function id in `fn`, the
    run id), its `onFailure` handlers included;
  - each `/api/stages/sync` cron run (`event: stages-sync`, with how many repositories it read).
  The wrapper rethrows what it caught: Vercel's 5xx responses and Inngest's retries and `onFailure`
  handlers behave exactly as today.
- **The App's injected loggers** (`log = console.error` in stage-forward, webhook, server-event,
  recheck, outbox-check, approved-check; `log = console.log` in pr-stats) default to the structured
  logger, at `warn` level, with today's sentence as `message`, so the App's whole output becomes
  JSON lines.
- **Galaxy's pages and other route handlers keep their `console.error` strings.** Vercel captures
  them, and its alerts count 5xx responses, not log lines.
- **The conventions form** gains one line: new server code logs through `kit/lib/log`.

### Phase 1: health endpoints

- **`GET /api/health`** in each app answers JSON with `Cache-Control: no-store`:
  `{ "ok": true|false, "app": "galaxy"|"omni-app", "commit": "<sha or null>", "checks": { "env": "ok"|"failed", "supabase"?: "ok"|"failed" } }`,
  status `200` when every check is `ok`, `503` otherwise.
  - `env`: the app's environment groups parse (the same read `register()` and the App's entries
    already make).
  - `supabase`, galaxy only: one read-only query that returns no row content, with a 3-second limit;
    a timeout is `failed`. It goes route → service → repository, as the layering guard requires.
  - `commit` is `VERCEL_GIT_COMMIT_SHA`, declared in each app's VERCEL environment group, `null`
    when unset.
- **It never shows** a value, an error's text or anything about a person, and **it never calls**
  GitHub, Inngest or OpenRouter. It is public: nothing in it is a secret.
- **omni-app** gets a fourth Vercel function, `entries/health.ts`, bundled to `api/health.mjs` by
  `build.ts`; `vercel.json` gives it a 10-second `maxDuration`.

### Phase 1: the hourly health check

- **`.github/workflows/health.yml`** runs at minute 23 of every hour and by hand
  (`workflow_dispatch`). Its job runs only when the repository variable `GALAXY_URL` or the new
  `OMNI_APP_URL` is set; it probes each app whose variable is set. It holds no secret; its
  permissions are `contents: read` and `issues: write`.
- **`scripts/health-check.ts`** does the work, with Node's built-ins and the `gh` command the runner
  already has, its URLs and repository passed as arguments (it reads no environment):
  - **Down** means two probes, 30 seconds apart, each failing: a status other than 200, a body
    whose `ok` is not `true`, or no answer within 10 seconds.
  - **Down, no open issue:** it opens one titled `Health: <app> is down`, its body the status, the
    failed checks and the commit when the body gave them, and the time.
  - **Down, the issue open:** it comments on it, once per run.
  - **Up, the issue open:** it comments that the app is back, with the commit, and closes it.
  - It finds its issue by that exact title among open issues. It adds no label: the repository does
    not create labels on its own (`labels.autoCreate: false`).
  - It exits 0 whatever it found: a down app is reported by its issue, never by a red run.

## Decisions

- **Vercel only, no Sentry,** chosen by the person: Sentry was proposed for error alerts and refused
  ("we said to leverage Vercel"). No third-party APM or log vendor; ADR-0102 records it.
- **Observability Plus kept on behind a spend limit,** chosen by the person over turning it off for a
  true $0: Vercel's error anomaly alerts require it, and it keeps logs 30 days. Its cost is read on
  the Usage tab a month after shipping and written into the guide.
- **Alerts reach the team by email (Vercel) and by a GitHub issue (the health check),** chosen by the
  person over Slack and over email alone.
- **The health endpoint checks alive and config, plus Supabase for galaxy,** chosen by the person over
  alive only and over deep checks: it never spends GitHub budget and never goes red on a vendor's
  blip.
- **One shared logger in `kit/lib/log`, used at every entry point, the App's injected loggers
  switched,** chosen by the person over wrappers alone and over a logging library. `kit/lib` is
  already imported by both apps, so no zone of the architecture changes.
- **The voice's objection, accepted.** persona:Lead Engineer objected: "If omni-app logs JSON while
  galaxy's pages still log plain strings, my teams get two ways to log and no rule saying which to
  use; I'd rather the playbook say which one new code uses." Settled `accepted`: the conventions
  form says new server code logs through `kit/lib/log`.
- **Hourly, two probes before "down", issues found by title and unlabelled,** chosen by the person.
  Hourly costs about 720 Actions minutes a month; every 15 minutes would cost about 2,900.
- **The health check exits 0 when an app is down** (decided while designing): the issue is the
  alert; a red scheduled run would email only whoever last edited the schedule.
- **Galaxy's 243 page and route `console.error` strings stay** (decided while designing): converting
  them is a large change for little gain; the conventions line moves new code over.
- **No proof video,** chosen by the person: nothing here is a screen.

## User stories

- As the person who runs the App, I get an email from Vercel when a route of galaxy or omni-app
  starts failing, without paying for a new vendor.
- As the person who runs the App, I search Vercel's logs for `outcome: failed` and a repository, and
  see every webhook and Inngest run for it in the last 30 days, with how long each took.
- As a member of the team, I see a `Health: galaxy is down` issue open within the hour when galaxy
  stops answering, and see it close by itself when it is back.
- As anyone deploying, I open `/api/health` and read which commit is live and whether its
  configuration and database answer.
- As a developer adding a server module, I read in the conventions form which logger to use.

## Scope

**In:** the phase 0 checklist page; `kit/lib/log`; one line per run at the App's three entries, every
Inngest function run and the stages cron; the App's injected loggers switched; `/api/health` in both
apps; the hourly health workflow and its script; ADR-0102; the conventions line; both READMEs'
environment and setup sections (`OMNI_APP_URL`, `VERCEL_GIT_COMMIT_SHA`).

**Out:** Sentry or any third-party monitoring; Log Drains; Speed Insights and Web Analytics; a
Supabase `ops_events` history and an `/ops` page (a later PRD); OpenTelemetry export; telemetry from
the `omni` CLI; converting galaxy's page and route `console.error` strings; checking the Vercel
dashboard settings from code.

## Test seams

All in vitest, beside the code (testing form); no test calls GitHub, Supabase or Vercel.

- **`kit/lib/log`, a pure module with an injected sink and clock:** one call writes exactly one line
  that parses as JSON; a field outside the allow-list is dropped and counted, its name and value
  absent from the line; each credential shape listed above is masked in an error's message and in a
  URL's query; a message over 500 characters is cut; a circular value and a throwing sink are
  swallowed without throwing.
- **The entry wrappers, with an injected logger:** a handled request, a refused one (401, 405) and a
  thrown error each log exactly one line with the right `event`, `outcome` and `ms`; the thrown
  error is rethrown unchanged.
- **The Inngest functions:** `apps/omni-app/src/functions.ts`'s functions, run through
  `@inngest/test`, log one line per run, `ok` or `failed`, with the function id.
- **The stages cron:** a run logs one `stages-sync` line, `refused` on a wrong bearer.
- **The App's injected loggers:** today's sentences come out as JSON lines with `message`, through the
  tests that already inject `log`.
- **The health handlers, with injected env reader and repository:** `200` and `ok: true` when every
  check passes; `503` when the env does not parse, when Supabase fails and when it times out; the
  body never holds a variable's value or an error's text; `Cache-Control: no-store`; `commit` is
  `null` when unset.
- **The omni-app bundle:** `src/vercel-functions.test.ts` holds `api/health.mjs` against a fresh build.
- **`scripts/health-check.ts`, with an injected `fetch`, `gh` runner and clock:** up with no issue does
  nothing; one failed probe then a good one is up (a blip); two failed probes with no issue open one;
  down with the issue open comments; up with the issue open comments and closes it; a timeout counts
  as a failed probe; it exits 0 in every case.
- **The workflow:** a guard test, in the manner of `scripts/checks-workflow.test.ts`, holds the
  schedule (`23 * * * *`), `workflow_dispatch`, the two permissions and the job's condition on the
  variables.
- **The environment docs:** `env-docs.test.ts` holds both READMEs against the new variables.

## Risks

- **What merging publishes:** both Vercel projects deploy (their inputs change), so `/api/health`
  goes live on both, and the App's logs change shape from strings to JSON lines; nothing in the
  database changes. The workflow probes an app only once its URL variable is set: galaxy
  from the first hourly run after merge when `GALAXY_URL` is set (the business recheck already
  reads it), omni-app once a person sets `OMNI_APP_URL`.
- **Cost:** Observability Plus bills per event; one line per run, never per call inside it, keeps the
  count near the number of requests. The spend limit caps it, and the guide's one-month reading
  checks it.
- **A secret in a log line:** the allow-list and the masking are the guard, held by tests; an error
  message is the one free-text field, and it is masked and cut.
- **A noisy health issue:** two probes 30 seconds apart before "down" absorb a cold start or a blip.
- **Rollback:** revert the feature PR's merge. Disabling the `health` workflow in the Actions tab
  stops its issues at once, without a deploy.

## Acceptance criteria

- `GET /api/health` on galaxy's and omni-app's production answers `200` with `ok: true`, the live
  commit and `Cache-Control: no-store`, and `503` with `ok: false` and the failed check's name when
  its environment does not parse or (galaxy) Supabase does not answer within 3 seconds; no body
  holds a variable's value or an error's text.
- Every GitHub webhook delivery, `server-event` call, Inngest function run and `/api/stages/sync`
  run writes exactly one JSON line to stdout with `event`, `outcome` and `ms`, and every other line
  the App writes is JSON too.
- A log line never holds a field outside the allow-list, and an error's message never holds a
  token, key or bearer value of the shapes listed in **Phase 1: structured logs**.
- A request, an Inngest run and a cron run behave as before when logging fails: the same status, the
  same retries, the same `onFailure`.
- With `GALAXY_URL` and `OMNI_APP_URL` set, the health workflow runs at minute 23 of every hour;
  an app failing two probes 30 seconds apart gets one open `Health: <app> is down` issue, commented
  on each later failing run and closed with a comment once the app answers again; the run exits 0
  in every case.
- `docs/guide/observability.md` holds the phase 0 checklist (Observability Plus on behind a spend
  limit, an error anomaly alert per project emailing the team, the Usage reading a month after
  shipping), how to search the JSON logs and what a `Health:` issue means.
- ADR-0102 records that observability stays on Vercel and why Sentry was refused; the conventions
  form says new server code logs through `kit/lib/log`.
