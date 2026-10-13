# Plan: Observability on Vercel at near-zero cost

PRD #1723, specified in `spec.md` beside this plan. The feature branch `feat/vercel-observability`
merges into `main` through one feature PR (`Closes #1723`); each slice is a sub-PR from
`feat/vercel-observability--<slice>` into the feature branch (`Part of #1723`). One landing: no
migration and no data; both Vercel projects deploy from the one merge, and the health workflow
probes an app only once its URL variable is set. `apps/omni-app/api/` is generated: a slice
rebuilds it only to test, and the wave rebuilds it once after merging.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `kit/lib/log` writes one JSON line to stdout per call, with only the allow-listed fields (others dropped and counted), an error as its name and a message cut to 500 characters with every credential shape masked, no stack, and it never throws | `kit/lib/log/` | — | 1 |
| s2 | omni-app's `/api/health` answers `200` or `503` with `ok`, `app`, `commit` and the `env` check, `no-store`, no value or error text, calling nothing outside; a fourth Vercel function bundled by `build.ts` with a 10-second `maxDuration`; `VERCEL_GIT_COMMIT_SHA` declared in the App's VERCEL group; the App's README documents the endpoint and `OMNI_APP_URL` | `apps/omni-app/entries/health.` `apps/omni-app/src/health/` `apps/omni-app/src/env.` `apps/omni-app/src/env-docs.test.ts` `apps/omni-app/src/vercel-functions.test.ts` `apps/omni-app/build.ts` `apps/omni-app/vercel.json` `apps/omni-app/README.md` | — | 1 |
| s3 | galaxy's `/api/health` answers `200` or `503` with `ok`, `app`, `commit` and the `env` and `supabase` checks (one read-only query returning no rows' content, 3-second limit), `no-store`, no value or error text, through route → service → repository; `VERCEL_GIT_COMMIT_SHA` declared in galaxy's env and documented | `apps/galaxy/app/api/health/` `apps/galaxy/src/health/` `apps/galaxy/src/env.` `apps/galaxy/src/env-docs.test.ts` `apps/galaxy/.env.example` `apps/galaxy/README.md` | — | 1 |
| s4 | the hourly health check: `.github/workflows/health.yml` at minute 23 and by hand, gated on `GALAXY_URL` or `OMNI_APP_URL`, `contents: read` and `issues: write`; `scripts/health-check.ts` probes twice 30 seconds apart (10-second limit), opens `Health: <app> is down`, comments while down, comments and closes when back, finds its issue by title with no label, and exits 0 | `.github/workflows/health.yml` `scripts/health-` | — | 1 |
| s5 | the guide page `docs/guide/observability.md` (the phase 0 checklist, searching the JSON logs, what a `Health:` issue means, setting `OMNI_APP_URL`) in the guide's navigation; ADR-0102 "observability stays on Vercel"; the conventions form's line that new server code logs through `kit/lib/log` | `docs/guide/observability.md` `docs/guide/meta.json` `.omni-loop/knowledge/adr/0102-` `.omni-loop/knowledge/playbook/conventions.md` | — | 1 |
| s6 | every GitHub webhook delivery, `server-event` call and Inngest function run (its `onFailure` handlers included) writes exactly one `kit/lib/log` line with `event`, `outcome`, `ms` and its ids, rethrowing unchanged; the App's injected `log` defaults become the structured logger at `warn`, today's sentence as `message` | `apps/omni-app/entries/github.` `apps/omni-app/entries/server-event.` `apps/omni-app/entries/inngest.` `apps/omni-app/src/run-log/` `apps/omni-app/src/functions.` `apps/omni-app/src/webhook/` `apps/omni-app/src/server-event/` `apps/omni-app/src/stage-forward/` `apps/omni-app/src/outbox-check/` `apps/omni-app/src/approved-check/` `apps/omni-app/src/pr-stats/` | s1 | 2 |
| s7 | each `/api/stages/sync` cron run writes exactly one `stages-sync` line with its outcome, duration and how many repositories it read, `refused` on a wrong bearer, the run's answer unchanged | `apps/galaxy/app/api/stages/sync/` `apps/galaxy/src/stages/sync/` | s1 | 2 |

**Shared ground.** No prefix is declared by two slices.

- The two health slices stay apart: s2 holds only omni-app's entry for health, its env module and
  its build files; s3 only galaxy's health route, its env module and its docs. s6 touches omni-app's
  other entries and the `src/` folders of the existing handlers, never `src/env.` nor the build.
- `apps/omni-app/src/vercel-functions.test.ts` and `build.ts` read every entry; s2 is the only slice
  that adds an entry, so they are s2's alone. The generated `apps/omni-app/api/` is in no territory.
- s6 and s7 depend on s1's logger, so they build in wave 2, after it merges.

## Per slice: done when

**s1, the logger**
- `kit/lib/log/*.test.ts`, with an injected sink and clock: one call writes exactly one line that
  `JSON.parse` reads, with `level`, `event`, `outcome` and `ms`.
- A field outside the allow-list is absent from the line, its name included, and `dropped` counts it.
- An error comes out as `{ name, message }`, with no stack; a message over 500 characters is cut to
  500.
- Each credential shape is masked as `***` in an error's message and in a URL's query: `ghp_`,
  `gho_`, `ghs_`, `ghu_`, `github_pat_`, `omk_`, `sk-`, a `Bearer` value, and a query parameter
  named like a key, token, secret, code or signature.
- A circular value and a throwing sink are swallowed: the call returns and throws nothing.

**s2, omni-app's health**
- `GET /api/health` answers `200` with `{ ok: true, app: "omni-app", commit, checks: { env: "ok" } }`
  and `Cache-Control: no-store` when the env parses, and `503` with `ok: false` and
  `env: "failed"` when it does not; `commit` is `null` when `VERCEL_GIT_COMMIT_SHA` is unset.
- No body holds a variable's value or an error's text (asserted on a broken env carrying a
  recognisable fake value).
- A method other than GET answers `405`; the handler calls no `fetch`.
- `build.ts` lists `health`; `src/vercel-functions.test.ts` holds `api/health.mjs` against a fresh
  build; `vercel.json` gives it `maxDuration: 10`.
- `src/env-docs.test.ts` is green with `VERCEL_GIT_COMMIT_SHA` declared, and the README names
  `/api/health` and the `OMNI_APP_URL` repository variable.

**s3, galaxy's health**
- `GET /api/health` answers `200` with `{ ok: true, app: "galaxy", commit, checks: { env: "ok", supabase: "ok" } }`
  and `no-store`; `503` with `ok: false` when the env does not parse, when the repository's query
  fails and when it takes longer than 3 seconds (an injected clock or a never-settling stub).
- The query returns no row content and the body never holds a value or an error's text.
- The route imports only its service, the service only its repository:
  `scripts/layering-guard.test.ts` stays green with `layering/baseline.json` unchanged.
- `src/env-docs.test.ts` is green with `VERCEL_GIT_COMMIT_SHA` declared in `.env.example` and the
  README.

**s4, the hourly health check**
- `scripts/health-check.test.ts`, with an injected `fetch`, `gh` runner and clock:
  - up, no issue open: no `gh` call that writes;
  - one failed probe then a good one: up, nothing written;
  - two failed probes (a 503, a body with `ok: false`, or no answer within 10 seconds), no issue:
    one issue opened titled `Health: <app> is down`, its body the status, the failed checks and the
    commit when the body gave them, and the time;
  - down with the issue open: one comment, no new issue;
  - up with the issue open: one comment naming the commit, and the issue closed;
  - every case exits 0, and no label is passed.
- The script reads no environment (`scripts/env-guard.test.ts` green); its URLs and repository are
  arguments.
- A guard test holds `health.yml`: schedule `23 * * * *`, `workflow_dispatch`, permissions exactly
  `contents: read` and `issues: write`, the job's condition on `vars.GALAXY_URL` or
  `vars.OMNI_APP_URL`, and no secret used.

**s5, the guide, the ADR and the convention**
- `docs/guide/observability.md` holds: Observability Plus on behind a Spend Management limit; one
  error anomaly alert rule per project, emailing the team; reading the Usage tab a month after
  shipping and writing the cost there; how to search the JSON logs by `event`, `outcome`, `repo`
  and `prd`; what a `Health: <app> is down` issue means and what to do; setting `OMNI_APP_URL`.
- It appears in `docs/guide/meta.json`, and `apps/galaxy/src/docs/guide.test.ts` stays green.
- ADR-0102 records the decision (Vercel only, Observability Plus behind a limit, JSON lines through
  `kit/lib/log`), the options refused (Sentry, Log Drains, a logging library) and its consequences.
- `omni kb show conventions` prints the line that new server code logs through `kit/lib/log`.

**s6, the App's run lines**
- With an injected logger, a webhook delivery logs exactly one `webhook` line, `ok` with the
  delivery id, repository and GitHub event; `refused` on a bad signature or a GET (405); `failed`
  on a thrown error, which is rethrown unchanged.
- A `server-event` call logs exactly one `server-event` line, `ok`, `refused` (bad signature, 405) or
  `failed` (rethrown).
- Each Inngest function of `src/functions.ts`, run through `@inngest/test`, logs exactly one
  `inngest` line with its id in `fn` and the run id, `ok` on success and `failed` on a thrown
  error; an `onFailure` handler's run logs its own line; retries and `onFailure` fire as before.
- A logger that throws changes no status, retry or `onFailure`.
- The tests that inject `log` into stage-forward, webhook, server-event, recheck, outbox-check,
  approved-check and pr-stats see today's sentences as `message` in JSON lines at `warn`; no
  `console.error` or `console.log` default remains in those modules.

**s7, the stages cron line**
- A sync run logs exactly one `stages-sync` line with `outcome: ok`, `ms` and the count of
  repositories read; a wrong bearer logs one `refused` line and still answers `401`; a run that
  throws logs `failed` and answers as today.
- The per-repository `console.error` sentences the sync already logs are unchanged.
