---
prd: 902
title: Call GitHub only when needed
blocked-by: none
spec: file
---

# Call GitHub only when needed

**Date:** 2026-10-01 · **PRD:** #902
**Touches:**
- `packages/github/` (new): the shared, budget-aware GitHub client
- `supabase/migrations/` (one new file): `github_etags`, `github_budget`, `dossier_github`
- `apps/galaxy/src/dossier/github/` (reader through the client, snapshot store),
  `apps/galaxy/src/dossier/page/` (render from the snapshot), `apps/galaxy/src/stages/` (sync, event,
  outbox recount), `apps/galaxy/src/knowledge/github.ts`, `apps/galaxy/src/business/draft/github.ts`,
  `apps/galaxy/src/signup/github-app.ts`, `apps/galaxy/src/repositories/load.ts`
- `apps/galaxy/app/api/github/touched/route.ts` (new)
- `apps/omni-app/app.yml`, `apps/omni-app/test/app-yml.test.ts`, `apps/omni-app/src/webhook/`,
  `apps/omni-app/src/stage-forward/` (touches), every Octokit built in `apps/omni-app/src/`

## Problem

On 2026-10-01, from 07:00 to 11:59 UTC, GitHub answered **403** to the omni-loop App's installation
on the vertuoza workspace: the PRD page, the fix pages, the stage events and the 15-minute stages
sync all logged `GitHub answered 403`, and even `/installation/repositories` was refused, which only
a spent rate limit explains. People opening a PRD page saw "Reading GitHub…" turn into unread tabs.

The App's hourly budget belongs to the installation, and one workspace has exactly one installation
(`workspaces.github_installation_id` is unique), so galaxy and omni-app spend one budget together.
They spend it blindly:

- **No shared client.** Galaxy has seven separate `fetch` sites, each with its own headers, errors
  and token keeper; omni-app builds its own Octokits.
- **No conditional requests.** Nothing sends `If-None-Match`, so an unchanged answer costs as much as
  a new one; GitHub does not count a 304 against the limit.
- **No rate-limit awareness.** Nothing reads `x-ratelimit-*` or `retry-after`; a 403 is thrown,
  logged, cached as "unread" for 60 s, and the next caller asks again.
- **Re-reads with no change.** Every 15-minute sync re-reads the whole GitHub summary (about 13 REST
  calls plus one per outbox item, plus one GraphQL) of every PRD in building or outbox, whether or
  not anything moved. Every forwarded stage event and every page render on a cold server instance
  does it again, under cache keys that never meet.
- **Nothing says what changed.** omni-app subscribes to `pull_request` and `check_run` only, so
  issues, comments and pushes reach galaxy only through polling.

## Solution

### 1. One budget-aware client: `packages/github`

`githubFetch(request, { installation, priority })`, a `fetch` with the same signature plus two
options, used by every installation-token call in both apps:

- **Galaxy** calls it directly from every module that reads GitHub with the App's installation token.
- **omni-app** plugs it into Octokit as its `fetch`
  (`Octokit.defaults({ request: { fetch } })`), so its outbox check, inbox check, retro, harvest,
  canon action and pr-stats go through the same door.

What it does on every call:

- **ETags, shared across instances.** A GET is sent with `If-None-Match` from `github_etags`, one row
  per (installation, URL): `etag`, `body`, `read_at`. A 304 returns the stored body. A 200 with an
  `ETag` stores it. GraphQL carries no ETag and goes through the budget only.
- **One budget per installation.** Every answer's `x-ratelimit-limit`, `-remaining`, `-reset` and
  `-resource` update `github_budget`, one row per (installation, resource), `core` or `graphql`:
  `limit`, `remaining`, `reset_at`, `paused_until`, `updated_at`.
- **Priorities.** `interactive`, a person waiting on the answer, may spend the budget down to 0.
  `background` (the sync, the recounts, snapshot refreshes, omni-app's checks) is refused with
  `GithubDeferred { until }` once `remaining` is below **20% of `limit`**.
- **One pause for everyone.** A 403 or 429 that says the limit is spent (`x-ratelimit-remaining: 0`,
  a `retry-after` header, or GitHub's secondary-rate-limit message) sets `paused_until` to the reset
  time (or `now + retry-after`). Until then every call for that installation and resource, from either
  app and at either priority, is refused with `GithubPaused { until }` without being sent. Nothing
  retries in a loop.
- **The store never blocks a read.** When `github_etags` or `github_budget` cannot be read or
  written, the call goes out as a plain request and the failure is logged once.

What it does not touch: minting installation tokens and the App-JWT calls (they spend the App's own
budget), and calls made with a person's token (outbox send's comment, sign-in), which spend that
person's budget. omni-app's pr-stats keeps its own 50% GraphQL guard on top.

### 2. Pages read a snapshot: `dossier_github`

One row per dossier: `summary jsonb` (exactly what `reader.summary()` returns today), `read_at`,
`stale_since` (null while current), `refreshing_until` (a lease). Members of the dossier's workspace
read it; the galaxy server writes it with the service role, as `prd_stages` and `fix_facts` are
written today.

- **The PRD page renders from the snapshot** and shows `GitHub as of HH:MM`.
- **No snapshot yet** (a first visit): one `interactive` read through the client, stored, then
  rendered. It is the only case where a page waits on GitHub.
- **A stale snapshot** renders at once; one `background` refresh runs after the response, under the
  lease.
- **The open page follows.** The existing 2-second Supabase poll (`LiveRefresh`) also watches the
  snapshot's `read_at` and calls `router.refresh()` when it moves.
- **Low or paused budget:** the page keeps the snapshot and adds `GitHub resumes at HH:MM`.
- **One read, one source.** The outbox recount (sync, stage event, outbox send) no longer reads
  GitHub itself: it refreshes the snapshot when stale and derives `prd_outbox` from it. Outbox send
  still forces a fresh read, `interactive`, since the person just acted.
- **Fix pages** render from `fix_facts` the same way and refresh it when stale.
- The per-instance 60-second `keptFor` cache only shares one in-flight read between concurrent
  callers; the unused `readLiveGithub` is deleted.

### 3. Webhooks say what changed

- **omni-app subscribes to five more events,** all within the permissions it already holds:
  `issues`, `issue_comment`, `push`, `check_suite`, `pull_request_review`; and it handles every
  `pull_request` action.
- **Each event becomes a touch,** `{ repository, issue?, pr?, branch? }`, read from the payload alone,
  with no call to GitHub. A `push` is a touch only when its commits' file lists touch
  `paths.delivery`, or its branch is a feature or phase-0 branch.
- **omni-app forwards each touch** to `POST /api/github/touched` on galaxy, signed with the same
  HMAC as the stage event (`x-omni-signature-256`, `STAGE_EVENT_SECRET`). The stage event stays as it
  is.
- **Galaxy resolves a touch to dossiers** through `prd_topics` and the issue and PR numbers each
  snapshot holds, sets `stale_since` where it is null, and starts one refresh after the response,
  under the lease.
- **Bursts coalesce.** Touches that land during a refresh leave `stale_since` set, and a single
  follow-up read runs when the refresh ends: a wave of ten sub-PRs costs about two reads per minute
  per dossier, most of them answered 304.
- A touch that matches no dossier is logged and answered 202.

### 4. The sync is the safety net

The 15-minute `POST /api/stages/sync` keeps its incremental issue and pull request listings
(`since`), now through the client and its ETags. It marks stale only the dossiers whose issue or pull
requests changed since the last sync (a webhook that never arrived), marks stale any snapshot older
than **6 hours**, and refreshes only stale dossiers, all `background`. It no longer re-reads every
building or outbox PRD on every run.

## Decisions

- **Approach A of three** (asked): a shared client, a Supabase read model, and webhook-driven
  refresh. Rejected: B, the client alone (pages still wait on GitHub and nothing says when to
  re-read); C, A plus the PRD reader rewritten as one GraphQL query (the biggest cut in calls, but a
  rewrite with no ETags; a later PRD once A is in).
- **Freshness** (asked): within about a minute, event-driven.
- **Scope** (asked): galaxy and omni-app, every installation-token call.
- **The budget is the installation's** (asked, and checked): GitHub's limit is per App installation,
  and `workspaces.github_installation_id` is unique, so one workspace has one budget that both apps
  spend.
- **The background floor is 20%** of the installation's limit; interactive reads may spend the rest.
- **The voice:** persona:Paul - Product Manager objected that a two-app rework that leaves the 403s
  in place until it all lands is a delay he cannot sell. **Accepted:** the plan's first slice is the
  client with the galaxy budget guard, which ends the 403 storms on its own.
- **The writes follow `prd_stages`:** the galaxy server writes `dossier_github`, `github_etags` and
  `github_budget` with the service role it already uses for `prd_stages` and `fix_facts`; no new
  holder of the key, ADR-0051 untouched. omni-app already holds the service role for pr-stats.
- **No proof video** (asked).

## User stories

1. As someone opening a PRD page, I see its outbox, pull requests and retro at once, with when GitHub
   was last read, instead of "Reading GitHub…".
2. As someone watching a PRD while a wave runs, I see a merged sub-PR or an answered outbox item on
   the page within about a minute, without reloading.
3. As a workspace whose GitHub budget runs low, the background work steps back first, and the pages
   keep working on what they last read.
4. As a workspace whose GitHub budget is spent, nothing keeps knocking: both apps wait for the reset,
   and the page says when GitHub resumes.
5. As an operator reading the logs, I see one line per pause, not one per refused call.

## Scope

**In:** the `packages/github` client and its two tables; every installation-token call in galaxy and
omni-app moved onto it; `dossier_github` and the PRD and fix pages rendering from snapshots; the
outbox recount derived from the snapshot; five new webhook events, touches, and
`/api/github/touched`; the sync as safety net.

**Out:** rewriting the PRD reader as GraphQL (approach C); a screen showing the budget; the game
layer's `gh` calls with `OMNI_GAME_TOKEN` (a personal token, another budget); calls made with a
person's token; the JWT calls and token minting.

## Test seams

Every test runs on fixtures: no test calls GitHub or Supabase (`omni kb show testing`).

- **`packages/github`**, unit tests against a stubbed `fetch` and an in-memory store: `If-None-Match`
  sent and a 304 answered from the stored body; budget headers recorded per resource; `background`
  refused below 20%, `interactive` still sent; a 403 with `remaining: 0`, a 429 with `retry-after`,
  and a secondary-limit 403 each set the pause; every call refused while paused, at both priorities,
  and sent again after `paused_until`; a store failure falls back to a plain request; a 403 that is
  not a rate limit (no access) passes through untouched.
- **The migration**, with realistic rows: the three tables, their RLS (a member reads their
  workspace's `dossier_github`, nobody else; `github_etags` and `github_budget` readable by no
  browser role).
- **omni-app:** `test/app-yml.test.ts` for the five events; the touch mapping per event, payload
  only; its end-to-end test (`src/outbox-check/end-to-end.test.ts`) proving its Octokit traffic goes
  through the shared `fetch`.
- **galaxy:** the touched endpoint (signature, resolution, stale marking, the lease and the single
  follow-up read); the PRD page's four states (fresh, stale, none, paused) as page tests; the recount
  deriving `prd_outbox` from a snapshot; the sync refreshing only stale or changed dossiers and the
  6-hour last resort; a failed refresh keeping the previous snapshot.

## Risks

- **What merging publishes** (`omni kb show releasing`): the migration reaches production Supabase
  through the `supabase` workflow on merge; galaxy and omni-app redeploy on Vercel. Rollback: revert
  the PR. The migration only adds tables, so a revert leaves them unused and changes no stored shape.
- **A manual step after the merge:** an org admin ticks the five new events in the omni-loop App's
  settings on GitHub; a manifest is read only when an App is registered. Until then the sync carries
  freshness at about 15 minutes, and nothing breaks.
- **A stale page.** A missed webhook keeps a snapshot old for up to 15 minutes (the sync), and at
  worst 6 hours. The `GitHub as of HH:MM` stamp says so.
- **How we know it worked, after the ship:** over a working day of waves on the vertuoza workspace,
  galaxy's production logs hold no `GitHub answered 403`, and background work never takes the
  installation's `github_budget` below its 20% floor.
- **The ETag store's size:** one row per (installation, URL) read; bodies of folder listings and
  item files. Rows not read for 7 days may be deleted by the sync.

## Acceptance criteria

1. Every installation-token call in `apps/galaxy` and `apps/omni-app` goes through
   `packages/github`'s `githubFetch`; no other module calls `api.github.com` with an installation
   token (a test lists the call sites).
2. A GET whose ETag is stored is sent with `If-None-Match`, and a 304 answers the stored body.
3. After any GitHub answer, `github_budget` holds that installation's `limit`, `remaining` and
   `reset_at` for the answer's resource.
4. With `remaining` below 20% of `limit`, a `background` call is refused with `GithubDeferred` and
   not sent; an `interactive` call is sent.
5. After a rate-limit 403 or 429, no call for that installation and resource is sent before
   `paused_until`, from either app, and one log line says so.
6. A PRD page with a snapshot renders without calling GitHub, and shows `GitHub as of HH:MM`; a
   paused budget adds `GitHub resumes at HH:MM`.
7. A webhook touching a PRD's issue, pull requests or delivery folder marks its snapshot stale, and
   the open page shows the change within about a minute.
8. A refresh that fails keeps the previous snapshot and leaves it stale.
9. A stages sync with no change on GitHub refreshes no snapshot.
