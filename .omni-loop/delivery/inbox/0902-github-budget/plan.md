# Plan: Call GitHub only when needed

PRD #902, spec beside this plan (`spec.md`). The feature branch `feat/github-budget` merges into
`main` through the feature PR (`Closes #902`); each slice is a sub-PR from
`feat/github-budget--<slice>` into the feature branch (`Part of #902`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The shared client ends the 403 storms: `packages/github` (ETags in `github_etags`, one budget per installation in `github_budget`, priorities with the 20% background floor, one pause on a rate-limit answer), and galaxy's PRD reader and stages sync call GitHub through it | `packages/github/` `supabase/migrations/20261028090000_github_budget*` `supabase/checks/github_budget*` `apps/galaxy/src/dossier/github/` `apps/galaxy/src/stages/sync/` `apps/galaxy/package.json` `apps/omni-app/package.json` `pnpm-lock.yaml` | — | 1 |
| s2 | Pages read a snapshot: `dossier_github`, the PRD page rendering from it with `GitHub as of HH:MM` (and `resumes at` when paused), a first visit's one interactive read, a stale snapshot refreshed after the response under the lease, the outbox recount and outbox send deriving from it, fix pages from `fix_facts`, `readLiveGithub` deleted | `supabase/migrations/20261029090000_dossier_github*` `supabase/checks/dossier_github*` `apps/galaxy/src/dossier/snapshot/` `apps/galaxy/src/dossier/page/` `apps/galaxy/src/stages/outbox/` `apps/galaxy/src/outbox/` | s1 | 2 |
| s5 | omni-app spends the same budget through the same door: `installationOctokit` builds its Octokit on the shared `fetch`, with `background` priority for its checks, and its end-to-end test proves the traffic goes through it | `apps/omni-app/src/outbox-check/` | s1 | 2 |
| s3 | Webhooks say what changed: the five new events in the manifest, a touch per event from the payload alone, forwarded signed to `POST /api/github/touched`, which marks the dossiers stale and refreshes them under the lease with one follow-up read | `apps/omni-app/app.yml` `apps/omni-app/test/app-yml.test.ts` `apps/omni-app/src/webhook/` `apps/omni-app/src/stage-forward/` `apps/galaxy/app/api/github/` `apps/galaxy/src/touched/` | s2 | 3 |
| s4 | The sync is the safety net: it marks stale only the dossiers whose issue or pull requests changed, and any snapshot older than 6 hours, refreshes only stale dossiers, and drops ETag rows unread for 7 days | `apps/galaxy/src/stages/sync/` | s2 | 3 |
| s6 | Every other installation-token call in galaxy goes through the client (knowledge, business draft, Settings › Repositories), and a test lists the call sites of both apps so nothing calls `api.github.com` with an installation token around it | `apps/galaxy/src/knowledge/github` `apps/galaxy/src/business/draft/github` `apps/galaxy/src/repositories/load` `apps/galaxy/src/github-call-sites.test.ts` | s5 | 3 |

**Shared ground.**
- `apps/galaxy/src/stages/sync/` is declared by s1 (the sync's calls go through the client) and s4
  (what the sync refreshes). s4 is blocked by s2, which is blocked by s1, so they never share a wave.
- `pnpm-lock.yaml`, `apps/galaxy/package.json` and `apps/omni-app/package.json` are s1's alone: s1
  adds `packages/github` to the workspace and to both apps' dependencies at once, so no later slice
  changes a manifest or the lockfile.
- `apps/galaxy/src/stages/event/` is read by s3 (it reuses the stage event's signature check) and
  changed by no slice.

## Per slice: done when

**s1**
- `githubFetch` sends `If-None-Match` for a GET whose ETag is stored, and answers a 304 with the
  stored body (acceptance 2).
- After any answer, `github_budget` holds the installation's `limit`, `remaining` and `reset_at` for
  its resource (acceptance 3).
- Below 20% of `limit`, a `background` call is refused with `GithubDeferred` and not sent; an
  `interactive` call is sent (acceptance 4).
- After a 403 or 429 with `remaining: 0`, a `retry-after`, or the secondary-limit message, no call for
  that installation and resource is sent before `paused_until`, at either priority, and one log line
  says so (acceptance 5, galaxy side).
- A 403 that is not a rate limit passes through untouched; a store failure falls back to a plain
  request.
- The PRD reader (`interactive` from a page, `background` from a recount) and the stages sync
  (`background`) call GitHub only through `githubFetch`.
- The migration's tables are readable by no browser role (a check under `supabase/checks/`).
- `pnpm test` is green.

**s2**
- A PRD page with a snapshot renders without calling GitHub and shows `GitHub as of HH:MM`; a paused
  budget adds `GitHub resumes at HH:MM` (acceptance 6), tested as the page's four states: fresh,
  stale, none, paused.
- A first visit with no snapshot makes one `interactive` read and stores it.
- A stale snapshot is refreshed once after the response, under the lease; the open page's poll sees
  `read_at` move and refreshes.
- A refresh that fails keeps the previous snapshot and leaves it stale (acceptance 8).
- The outbox recount derives `prd_outbox` from the snapshot; outbox send forces one `interactive`
  read.
- Fix pages render from `fix_facts` and refresh it when stale.
- A member reads their workspace's `dossier_github` rows and nobody else does (a check under
  `supabase/checks/`).
- `readLiveGithub` is gone.

**s5**
- Every Octokit omni-app builds goes through `githubFetch`; the end-to-end test
  (`src/outbox-check/end-to-end.test.ts`) sees its stubbed traffic pass through the shared `fetch`.
- A paused budget refuses omni-app's calls as it refuses galaxy's (acceptance 5, omni-app side); a
  refused check logs one line and posts nothing new.
- pr-stats keeps its own 50% GraphQL guard.

**s3**
- `test/app-yml.test.ts` accepts `issues`, `issue_comment`, `push`, `check_suite` and
  `pull_request_review`, and no permission beyond today's.
- Each event maps to a touch from its payload alone (one test per event); a `push` is a touch only
  when it changes the delivery folder or lands on a feature or phase-0 branch.
- `POST /api/github/touched` refuses a bad signature (401), answers an unknown repository 202, and
  marks the matching dossiers stale.
- Touches during a refresh lead to exactly one follow-up read (acceptance 7, with a stubbed clock).

**s4**
- A sync with no change on GitHub refreshes no snapshot (acceptance 9).
- A sync that sees a changed issue or pull request marks its dossier stale and refreshes it.
- A snapshot older than 6 hours is marked stale and refreshed.
- ETag rows unread for 7 days are deleted.

**s6**
- The knowledge reader, the business draft and Settings › Repositories call GitHub through
  `githubFetch`.
- `github-call-sites.test.ts` lists every file in `apps/galaxy` and `apps/omni-app` that names
  `api.github.com` or builds an Octokit, and fails on any that is not the client, a JWT call, or a
  person's-token call (acceptance 1).
