---
prd: 2573
title: Every runner job runs as the Omni GitHub App, never as a person
blocked-by: none
spec: file
phase0: server
---

## Problem

A job a runner runs pushes, commits and opens pull requests as whatever GitHub account its machine is
signed in to. The runner can already run a job as a GitHub App (PRD 2433): it gives the job the App's
bot as its identity, a credential helper and a `gh` that read the App's token, and keeps that token
fresh. But the server only gives a job an App when an API key that holds its own App sent it. Every
other job, which includes every job sent from the Omni page, reaches the runner with `github: null`
and runs as the machine's own login.

So when a team's runner box is signed in as one maintainer, every slice another member sends from
the Omni page is pushed and opened under the maintainer's name. GitHub shows the maintainer as the
author, the maintainer cannot approve those pull requests, and only a line in each body says who
really sent them. That breaks never#10 ("an agent always signs
as an agent, and never speaks or answers in a person's name") and L-AIACT-1.

## Solution

Every job a runner runs, however it was sent, runs as the Omni GitHub App: the App this Omni
deployment signs in with (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`; `omni-loop-invader` on
`www.omni-loop.xyz`).

- **At claim, the server mints the Omni App's token for every job.** It finds the Omni App's
  installation on the job's repository, checks that it holds write access to contents, pull requests
  and issues, and mints an installation token. The token covers the job's repository and, for a mega
  bug fix, the other repositories of its plan repository's product that the installation holds, as
  PRD 2433 does today, and never a repository outside an API key's allow-list (BR-PRODUCT-63). The
  claim answers the job with `github`: the token, its expiry, and the bot as the job's identity,
  `<slug>[bot]` and `<bot id>+<slug>[bot]@users.noreply.github.com`. The bot id is read from GitHub
  by the App's slug, once per server process.
- **An API key's own App is no longer read for a job's identity.** A job an API key sent runs as the
  Omni App too. The key's App, its Settings form and its stored rows stay as they are, unused; a later
  PRD decides whether to remove them. A key that no longer works (revoked, or its maker left the
  workspace) still ends its job failed, as today (BR-PRODUCT-64).
- **A token is refreshed from the Omni App.** `githubToken` mints a fresh Omni App token, for the same
  repositories, for the job's own runner while the job is claimed or running and for 10 minutes after
  it ends, as today.
- **A runner that cannot run a job as an App takes no job.** `runner_claim()` hands no job to a runner
  registered with `github_app = false` (a kit older than PRD 2433 s2). It stays online. The Runners
  page says of a queued job that only such runners could take: `Update the runner's kit`.
- **A job is never answered without `github`.** When the server cannot mint (the App not configured on
  this deployment, not installed on the repository, lacking a permission, or its bot id unreadable),
  the job ends `failed`, `github app: <why>`, before any runner starts it.
- **The runner refuses a job without its App.** A job that reaches a runner with `github: null` ends
  `failed`, `github app: the job came without its App`, before its session starts: it never runs as the
  machine's login, whatever the server sent.

Out of scope: a person's own terminal, where they run `/omni:yolo` themselves, signs as that person, as
today. A runner box already in use keeps running as it is until this ships; it is then reinstalled on the
current kit.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | db | `<timestamp>_runner_claim_omni_app.sql` | `api_key_github_apps.sql` ← supabase/migrations/20261228090000_api_key_github_apps.sql:1 |
| vertuo-omni-loop | db | `public.runner_claim(p_runner uuid)`, replaced in place | ← supabase/migrations/20261228090000_api_key_github_apps.sql:326 |
| vertuo-omni-loop | galaxy | `OmniApp` (the deployment's App: its credentials, slug and bot id) | no written convention: follows `KeyApp` ← apps/galaxy/src/runners/runners.service.ts:133 |
| vertuo-omni-loop | galaxy | `github app: the Omni App is not configured on this server` | no written convention: follows `NO_MASTER` ← apps/galaxy/src/runners/runners.service.ts:124 |
| vertuo-omni-loop | kit | `github app: the job came without its App` | no written convention: follows `github app: this runner cannot give the job its token` ← kit/lib/runner/runner.ts:493 |

## Decisions

- **Always the Omni App**, decided by the person: a key's own App (PRD 2433) no longer decides a job's
  identity, so every job of every workspace signs as one bot.
- **The key's App stays, unused**, decided by the person: no column, form or row is removed here.
- **Old-kit runners take no job and stay online**, decided by the person; the page names why.
- **The runner fails a job that came without `github`**, decided by the person: a second guard behind
  the server's.
- **The token's reach stays as today**, decided by the person: the job's repository, and for a mega
  bug fix the product's other repositories the installation holds.
- **Mint from the job's repository's installation**, not from `workspaces.github_installation_id`: the
  App has one installation per account, GitHub names it for the repository, and the job's repository
  was checked against its workspace when it was sent. Taken by the agent; reversible.
- **The voice.** Paul (`persona:Paul - Product Manager`) objected that a runner on an old kit, or a
  repository without the App, would leave his jobs sitting or failing. The person overruled it for this
  run: there is one runner, and it is reinstalled once this ships. No send-time check is added.
  Settled `just-this-run`.

## User stories

- As a member who sends a PRD to a runner, I want its pull requests and commits to read as the Omni
  bot, so that nobody mistakes them for another person's work and any member can approve them.
- As the person whose machine hosts a runner, I want my GitHub account never to be used for jobs other
  people send, so that I am not shown as the author of work I did not do.
- As a reviewer, I want every agent-made pull request to say it is an agent's at a glance, so that I
  review it as one.

## Scope

In: `apps/galaxy/src/runners/` (the service's mint at claim and at `githubToken`, the live wiring of
the Omni App's credentials, the page's line), one migration replacing `runner_claim()`, its check in
`supabase/checks/`, and `kit/lib/runner/runner.ts`'s `asApp()`.

Out: the API key's App feature (kept, unused), the public API's send-time App check (`github_app_*`
refusals), a person's own terminal, and how a runner box is set up.

## Test seams

- `apps/galaxy/src/runners/runners.service.test.ts`, with GitHub stubbed through `GithubDeps`: a
  page-sent job is answered with an Omni App grant; a job from a key that holds its own App is answered
  with the Omni App's grant, never the key's; a mega bug fix's token lists the product's other
  repositories the installation holds; each failure (no App configured, not installed, lacking a
  permission, bot id unreadable) ends the job `failed` with its why and answers no runner; a revoked
  key's job still fails; `githubToken` mints from the Omni App.
- The migration's check in `supabase/checks/`: `runner_claim()` hands a queued job to a runner with
  `github_app = true` and none to one with `github_app = false`, with realistic rows.
- `kit/lib/runner/runner.test.ts`: a claimed job with `github: null` ends `failed`, `github app: the job
  came without its App`, and no session starts.
- `apps/galaxy/src/runners/page/model.test.ts`: a queued job only old-kit runners could take reads
  `Update the runner's kit`.

No test reaches GitHub (testing form).

## Risks

- **Publishes:** on the next deploy of the galaxy app and the migration, every job is minted as the
  Omni App. A runner on a kit older than PRD 2433 s2 stops taking jobs until it is updated. A repository
  where the Omni App is not installed, or lacks write access to contents, pull requests or issues,
  fails every job sent to it with that reason.
- **A job that edits `.github/workflows/`:** the App's installation needs the `workflows` permission to
  push such a change; without it the push is refused and the job fails. Today it works because a
  person's login holds that right. **Before this ships**, a person grants the Omni App `workflows:
  write` in its GitHub App settings and each installation accepts the new permission (a manual step,
  decided by the person; no slice does it). The feature PR's body names the step until it is done.
- **Rollback:** revert the feature PR's merge and the migration (a new migration restoring the previous
  `runner_claim()`); jobs then run as before, the box's login included.
- The Legal entries: L-AIACT-1 (content an agent makes says so): this change is what makes runner pull
  requests and commits say so. L-GDPR-2 (credentials never stored or logged in clear): the Omni App's
  private key stays on the server, and the token reaches the runner only as PRD 2433 already carries
  it, masked in every line and log.
- The locked laws:
  - BR-PRODUCT-63: a token reaching a repository outside its workspace, or outside a key's allow-list,
    would let an agent read another team's private work. The mint keeps today's repository list.
    Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
  - BR-PRODUCT-64: a key's job running after its maker left would keep working for someone outside the
    team. A key that no longer works still fails its job. Changing it needs @pierrederval or @dervalp
    to approve the pull request on GitHub.
  - BR-PRODUCT-28, BR-PRODUCT-12, BR-PRODUCT-29, BR-PRODUCT-39, N-PRODUCT-16, BR-PRODUCT-59: printed
    for these folders, not changed here; breaking any would let strangers into a workspace, change a
    given answer, leak a session, rewrite the ledger or expose the AI key. Changing one needs
    @pierrederval or @dervalp to approve the pull request on GitHub.

## Acceptance criteria

- A job sent from the Omni page to a runner opens its pull request, pushes its commits and writes its
  comments as `<slug>[bot]`, and its commits' author is the bot's noreply address.
- A job sent by an API key whose key holds its own App runs as the Omni App, not as the key's App.
- A job whose repository lacks the Omni App ends `failed`, `github app: the App is not installed on
  <repo>`, and no runner starts it.
- A deployment with no `GITHUB_APP_ID` or `GITHUB_APP_PRIVATE_KEY` ends every claimed job `failed`,
  `github app: the Omni App is not configured on this server`.
- A runner registered with `github_app = false` claims no job, and the Runners page says of a job only
  it could take `Update the runner's kit`.
- A job that reaches a runner with `github: null` ends `failed`, `github app: the job came without its
  App`, before its session starts.
- A running job's token is refreshed from the Omni App, as before.
