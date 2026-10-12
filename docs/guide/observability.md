---
title: Observability
description: How the team hears that the arcade or the Omni App broke, on Vercel alone — the dashboard settings, searching the JSON logs, the Health issue and OMNI_APP_URL.
---

This page is for whoever runs this repository's two Vercel projects: the arcade and docs site
(`apps/galaxy`) and the Omni GitHub App (`apps/omni-app`). It says how you hear that one of them
broke, and why, with Vercel's own tools and nothing else: no Sentry, no log vendor, no logging
library (ADR-0102). Three things tell you:

- **Vercel emails the team** when a route starts failing (the phase 0 settings below).
- **The logs say what each run did,** one JSON line per run, searchable for 30 days.
- **A `Health: <app> is down` issue opens** within the hour when an app stops answering, and closes
  itself when it is back.

## Phase 0: the Vercel dashboard

These are settings a person makes in the Vercel dashboard, once per team. No code checks them, so
tick them here when they are done.

1. **Observability Plus stays on, behind a spend limit.** In the team's settings, keep
   Observability Plus on, and set a limit for it under **Spend Management**, so the bill can never
   run away. It keeps runtime logs for 30 days instead of one, and the alerts below need it.
2. **One error anomaly alert rule per project,** one for galaxy and one for omni-app, delivered
   **by email** to the team. It fires when a route's 5xx responses over five minutes are unusually
   many. It counts responses, not log lines, so it covers every route of both apps, the ones that
   still log plain strings included.
3. **Read the Usage tab one month after this ships.** Open the team's **Usage** tab, read what
   Observability Plus cost over the month, and write the figure on the line below, with the date.
   Each run writes one line, never one per call inside it, so the count stays close to the number of
   requests.

   Monthly cost of Observability Plus: _not read yet_.

## Search the logs

The App writes every line as JSON, through `kit/lib/log`: one line at the end of each run, with
what ran and how it ended.

| field | what it holds |
|---|---|
| `event` | what ran: `webhook`, `server-event`, `inngest` or `stages-sync` |
| `outcome` | `ok`, `refused` (a bad signature, a wrong bearer, a wrong method) or `failed` |
| `ms` | how long the run took, in milliseconds |
| `repo` | the repository the run was about, when it had one |
| `prd` | the PRD the run was about, when it had one |
| `deliveryId`, `runId`, `fn` | the GitHub delivery id; the Inngest run id; the Inngest function id, or the GitHub event's name |
| `level` | `info`, `warn` or `error` |
| `error` | `{ name, message }`: the message cut to 500 characters, any token, key or bearer value in it shown as `***`, never a stack |

A field outside this list is never written: the line says how many it dropped in `dropped`. The
App's other lines, its warnings, are JSON too, today's sentence in `message`, at `warn`.

To find a run, open the project's **Logs** in Vercel and search for a field and its value as they
appear in the line, quotes included: `"outcome":"failed"` lists every run that failed in the last 30
days; add a repository's name to narrow it to that repository, or `"event":"inngest"` for the
Inngest runs alone. Each line's `ms` tells a slow run from a quick one.

Galaxy's pages and its other routes still log plain strings: Vercel keeps them, and the alert above
counts their 5xx responses. New server code logs through `kit/lib/log` (the conventions form says
so).

## A `Health: <app> is down` issue

Each app answers `GET /api/health` with whether it is up, which commit is live and which check
failed, never a value or an error's text:

- `env`: the app's environment variables read as the app expects;
- `supabase`, galaxy only: one query to the database answered within 3 seconds.

Every hour, at minute 23, the `health` workflow asks each app. An app is down when **two probes**,
**30 seconds** apart, both fail: a status other than 200, an answer whose `ok` is not `true`, or no
answer within 10 seconds. One failed probe then a good one is a blip, and nothing is written.

- **Down, and no issue open:** it opens one, titled `Health: galaxy is down` or
  `Health: omni-app is down`. The issue says the status, the checks that failed and the commit, when
  the app gave them, and the time.
- **Still down an hour later:** it comments on the same issue, once per run.
- **Back up:** it comments that the app answers again, naming the live commit, and closes it.

The workflow run itself stays green either way: the issue is the alert. When one opens, open the
app's `/api/health` in a browser: `env: failed` means a variable is missing or malformed in that
project's Vercel settings, so fix it and redeploy; `supabase: failed` means the database did not
answer, so look at the Supabase project; no answer at all means the deployment itself is down, so
look at the project's latest deployment in Vercel. To stop the issues at once, disable the `health`
workflow in the repository's **Actions** tab: no deploy is needed.

## Set `OMNI_APP_URL`

The workflow probes an app only once its URL is set, as a repository variable (a variable, not a
secret: nothing in it is a secret). Galaxy's is `GALAXY_URL`, which the business recheck already
reads. The App's is `OMNI_APP_URL`, the App's production address on Vercel, with no path:

```bash terminal
gh variable set OMNI_APP_URL --body https://<the App's production domain>
```

Or set it in the repository's **Settings › Secrets and variables › Actions › Variables**. With
neither variable set, the workflow's job does not run. To check the address first, open
`<the App's production domain>/api/health`: it answers `"app":"omni-app"`.

[Next → Getting started](/docs)
