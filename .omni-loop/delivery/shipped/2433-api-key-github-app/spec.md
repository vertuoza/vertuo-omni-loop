---
prd: 2433
title: An API key's job runs on GitHub as the calling app's own GitHub App, never as a person
blocked-by: none
spec: file
phase0: server
areas: [access]
---

## Problem

An app that sends a bug fix through the public API (`POST /api/v1/bug-fixes` or `/mega-bug-fixes`,
an `oma_` workspace key, PRD 2022) gets a pull request that GitHub shows as a person's work:

- **The runner writes as its machine's account.** A runner pushes branches and opens pull requests
  with the `gh` and git login of the machine it runs on, the account of whoever set it up
  (`docs/guide/runners.md:129`). The server hands it no GitHub credential: a claimed job is
  `{id, line, repo, sentBy, allowedSkills}` (`RunnerJobSchema`,
  `apps/galaxy/src/runners/runners.contract.ts:164-165`), and the job's environment carries no
  `GH_TOKEN` (`jobEnv`, `kit/bin/commands/runner.ts:158`; `kit/lib/runner/runner.ts:436`).
- **So a person appears everywhere.** The bug's issue, its comments and labels, the branch, the
  commits (author and committer are the machine's git config) and the pull request are that
  person's, who neither asked for the fix nor reviews it. GitHub notifies them and counts the work
  as theirs. When the job ends, the runner releases its claims (it swaps a label and comments on
  each pull request) with the same `gh` (`kit/lib/runner/release.ts:1-12`). A kit command the job
  runs reads `gh auth token --user <github.user>` when that setting is on (`githubEnv`,
  `kit/bin/github.ts:71-76`): a person's token again.
- **The body mentions the key's maker.** A key job's `sentBy` is `API key <name> (@<login>)`
  (`senderOf`, `apps/galaxy/src/runners/runners.service.ts:108-109`), and `senderLine` adds an `@`
  in front (`kit/lib/runner/sender.ts:6-11`). The pull request reads
  `Sent from the Omni app by @API key <name> (@<login>) on runner <runner>`: a broken line that
  pings a person.
- **Omni knows one GitHub App, its own** (`GITHUB_APP_ID`, `apps/galaxy/src/env.ts:51`), and
  nowhere keeps another app's credentials.

The app that sends the job has a GitHub App of its own, and wants every job it sends to be visibly
its own on GitHub, with no person named, assigned or asked for a review.

## Solution

A key with no GitHub App keeps today's behaviour, save its fixed sender line (§12). Everything else
below applies to a key an owner has attached a GitHub App to.

1. **A key carries at most one GitHub App.** A new table `api_key_github_apps`, one row per key,
   holds:
   - the app's id;
   - its private key (PEM), sealed by the secret box as Jev's key is (AES-256-GCM under
     `SECRETS_MASTER_KEY`, `apps/galaxy/src/jev/secret-box.ts`);
   - in the clear: the app's slug, its bot's id, who attached it and when, and when it last minted a
     token (`last_token_at`).

   No member reads the table directly. Members read a key's app slug through the keys list, owners
   also read `last_token_at`, and only the server's service role opens the sealed key. The private
   key is never shown again, to anyone.
2. **Attaching it.** An owner, on Settings › API keys, attaches an app to a live key: its App ID and
   its private key file (`.pem`). The server checks the pair against GitHub before storing anything:
   - it mints an app JWT (`appJwt`, `apps/galaxy/src/signup/github-app.ts:42`) and reads `GET /app`;
   - it reads the slug there, then the bot's id from `GET /users/<slug>[bot]`.

   A pair GitHub refuses is refused with "GitHub refused this App ID and private key." and nothing
   is stored. On a deployment with no master key, attaching is refused with "Attaching a GitHub App
   isn't available on this deployment.". **Replace** attaches another pair the same way. **Remove**
   deletes the row once asked twice, as Revoke is: **Remove**, then **Remove for good**.
   Revoking the key deletes the row too.
3. **The page.**
   - Every key row on Settings › API keys gains a **GitHub App** column: `—`, or the app's slug.
     Every member sees it.
   - An owner also sees, under the slug, `last token <date>` (or `no token yet`), and the actions
     **Attach a GitHub App** on a key with none, **Replace** and **Remove** on a key with one.
   - Attach a GitHub App and Replace open the attach form above the table, in the shape of the
     New key form: **App ID**, **Private key file** (a `.pem`), **Attach** and Cancel.
   - The key-creation form does not change.
4. **At send.** When a key with an app sends a job, the server finds the app's installation on the
   job's repository (`GET /repos/{owner}/{repo}/installation`, with the app JWT) before queuing:
   - **no installation:** 422 with code `github_app_not_installed`, naming the repository;
   - **an installation without write access** to `contents`, `pull_requests` or `issues`: 422 with
     code `github_app_permissions`, naming the permission.

   In both cases nothing is queued. For a mega-bug-fix, the repository checked is the plan
   repository: its targets are only chosen while it runs.
5. **Which runner takes it.** A runner says it can run a job as an app when it registers:
   `githubApp: true` in `POST /api/runners/register`. The server hands a job of a key with an app
   only to a runner that said so. A runner on an older kit never claims one, so it never runs one as
   its machine's account. The job waits in the queue, as a job with no free runner does today.
6. **At claim: the token.** When such a runner claims the job, the server mints an installation
   token (`POST /app/installations/{id}/access_tokens`):
   - **its repositories:** the job's repository; for a mega-bug-fix, the plan repository and every
     repository its product names that the installation holds. Each is within the key's allow-list.
   - **its permissions:** `contents`, `pull_requests` and `issues` write, `metadata` read, and
     nothing more.

   The claimed job gains:
   - `github: {token, expiresAt, login, email}`, where `login` is `<slug>[bot]` and `email` is
     `<bot id>+<slug>[bot]@users.noreply.github.com`;
   - `sentByKey`: the key's name.

   A job with no app gets `github: null`, and a person's job gets `sentByKey: null`. The server
   records the mint in `last_token_at`.
7. **On the runner: the app's identity.** For a job with `github`, the runner starts the job with:
   - `OMNI_GITHUB_APP=<login>`;
   - the app's bot as git author and committer (`GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`,
     `GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL`);
   - every git remote operation over HTTPS with the token, through a credential helper. An
     `insteadOf` set through the job's environment rewrites the `git@github.com:` and
     `ssh://git@github.com/` URLs, so the machine's SSH key is never used;
   - a `gh` first on the job's `PATH` that runs the real `gh` with `GH_TOKEN` set to the job's
     current token.

   The credential helper and that `gh` both read the token through
   `omni runner github-token`, which prints the job's current token. While `OMNI_GITHUB_APP` is
   set, the kit's own GitHub calls use that token and never read `gh auth token --user`. The
   runner's release of the job's claims, when the job ends, uses it too.
8. **Keeping the token current.** `omni runner github-token` asks the server for a fresh token when
   the current one has less than 5 minutes left:
   - **the route:** `POST /api/runners/jobs/<id>/github-token`, with the runner's own sign-in, for
     the job's runner only;
   - **when it answers:** while the job is claimed or running, and for 10 minutes after it ends, so
     the release still runs as the app. It answers `{token, expiresAt}` and records the mint.

   A refresh that fails is tried again every minute until the current token expires. Then the
   runner ends the job `failed` with the reason `github app: <why>`.
9. **The token is never written down.** The runner replaces the job's token, current or past, with
   `***` in every line, log tail and report it sends to the server.
10. **Never a person.** When the token cannot be minted at claim, the job ends `failed` with the
    reason `github app: <why>`, and no runner runs it under its machine's account. This covers an
    app removed or uninstalled, a pair GitHub now refuses, a key revoked or whose maker left the
    workspace (BR-PRODUCT-64), and a master key the server lost. A job queued while an app was
    attached keeps needing one: removing the app does not send it as a person.
11. **What GitHub shows.** Everything the job writes on GitHub is the app's bot: the bug's issue,
    its comments and labels, the branch, the commits, the pull request, its status comment, and
    the release of its claims. On top of that:
    - **no assignee:** the kit adds none today, and still adds none;
    - **no review request from the job:** while `OMNI_GITHUB_APP` is set, `/omni:pr`,
      `/omni:bug-fix` and `/omni:mega-bug-fix` request no reviewer, even one the repository's
      `pull-requests` form names. A `CODEOWNERS` file still makes GitHub request its owners: that is
      the repository's own rule, outside the job;
    - **no `@login`:** the job mentions no person in what it writes on GitHub;
    - **the commits' trailers stay the agent's own `Co-Authored-By` and the `omni sign trailer`
      line (Omni-man):** neither is a member, and no member's trailer is ever added;
    - **unchanged:** Omni's own GitHub App (its checks, the outbox check, Omni-man's comments).
12. **The sender line, for every key job.** A job with a `sentByKey` writes
    `Sent through the Omni API by API key <name> on runner <runner>`, with or without an app: no
    `@`, no login. A person's job keeps `Sent from the Omni app by @<login> on runner <runner>`.
13. **The guide.**
    - `docs/guide/api.md` gains "Run as your own GitHub App": create the app with those three
      permissions, install it on the repositories, attach it to the key, and the two new 422 codes.
    - `docs/guide/runners.md` says that a key job with an app never uses the runner's account.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| omni-loop | database | table `api_key_github_apps` (`key_id`, `workspace_id`, `app_id`, `slug`, `bot_id`, `ciphertext`, `iv`, `attached_by`, `attached_at`, `last_token_at`) | no written convention: follows `public.workspace_secrets` (`ciphertext`, `iv`, `set_by`, `set_at`) ← `supabase/migrations/20261026090000_jev_decisions.sql:26-33`, and the `api_key_` prefix of `api_key_make` ← `supabase/migrations/20261210090000_api_keys.sql` |
| omni-loop | database | functions `api_key_github_app_attach`, `api_key_github_app_remove` | no written convention: follows `api_key_make` and `api_key_revoke` ← `supabase/migrations/20261210090000_api_keys.sql` |
| omni-loop | database | migration `<version>_api_key_github_apps.sql` | conventions › A new migration takes the next free version ← `.omni-loop/knowledge/playbook/conventions.md:27` |
| omni-loop | database check | `supabase/checks/api_key_github_apps.sql` | conventions › A new database check runs in CI ← `.omni-loop/knowledge/playbook/conventions.md:41`; neighbour `supabase/checks/api_keys.sql` |
| omni-loop | public API | error codes `github_app_not_installed`, `github_app_permissions` | no written convention: follows the snake_case `ERROR_CODES` ← `apps/galaxy/src/public-api/public-api.contract.ts:149` |
| omni-loop | runner contract | claim fields `github` (`token`, `expiresAt`, `login`, `email`) and `sentByKey`; register field `githubApp` | camelCase runner fields ← `RunnerJobSchema`, `apps/galaxy/src/runners/runners.contract.ts:164-165`, and register `{name, slots, repos, version}` ← `runners.contract.ts:4` |
| omni-loop | runner route | `POST /api/runners/jobs/<id>/github-token` | no written convention: follows the runner's job routes ← `apps/galaxy/src/runners/runners.contract.ts:4-16` |
| omni-loop | settings route | `POST` and `DELETE /api/api-keys/<id>/github-app` | no written convention: follows `app/api/api-keys/route.ts` (POST make, DELETE revoke) ← `apps/galaxy/src/public-api/keys/api-keys.contract.ts` |
| omni-loop | kit env | `OMNI_GITHUB_APP` | no written convention: follows `OMNI_SENT_BY` and `OMNI_RUNNER` ← `kit/lib/runner/runner.ts:436`, read through `kit/lib/env/read.ts` (conventions › Naming, the env module) |
| omni-loop | kit command | `omni runner github-token` | no written convention: follows `omni runner sender` ← `kit/bin/commands/runner.ts:329` |
| omni-loop | module | `apps/galaxy/src/public-api/keys/github-app.ts` (attach, check, mint) | file named for its role, beside `keys/secret.ts` ← architecture › Boundaries (ADR-0095): the GitHub calls behind a dependency the tests replace |

## Decisions

Taken with the person during the brainstorm:

- **A second PRD, after PRD 2425, and independent of it.** `blocked-by: none`: neither needs the
  other. Both touch the claim and `runners.service.ts`, and whichever lands second merges the other.
  The continuations PRD 2425 queues keep the key, so they run as its app with no extra work.
- **Everything the job writes on GitHub** is the app's: issue, comments, labels, branch, commits,
  pull request and the release. The person chose this over the pull request alone, or the pull
  request and its commits.
- **A key with no app works as today.** The app is opt-in per key. The person chose this over
  refusing such a key's jobs, or falling back to Omni's own app.
- **Omni mints the app's tokens from a sealed private key attached to the key.** The person chose
  this over the app sending a token with each job (a job queued or running past an hour would fail),
  and over the app hosting its own runner.
- **The sender line names the key, never a person.** The person chose this over no line at all, and
  over naming the key's maker without an `@`.
- **Owners only** attach, replace or remove an app, as only owners revoke a key. The person chose
  this over the key's maker or any member.
- **The attach form opens above the table,** in the shape of the New key form, as the before/after
  page draws it. The person chose this over a dialog.
- **Remove is asked twice, as Revoke is** (**Remove for good**). The person chose this over one
  click.
- **No proof video:** the person said no. e2e is off here.
- **The voice's objection, accepted.** persona:B-E DEv: "You want Omni to keep another app's private
  key that can write to our repositories: one leak of Omni's database and anyone pushes as that app.
  I'd rather the key never leave the app." Settled `accepted`:
  - an owner sees on the key's row when the app last minted a token;
  - revoking the key deletes its sealed private key, so a leak shows and revoking cuts it.

  The design already kept the key on the server, sealed, with only one-hour tokens for the job's
  repositories and three permissions reaching a runner.

Taken alone while writing, each the most reversible reading of the approved design:

- **A runner says it can run as an app** (`githubApp: true` at register), and only such a runner
  claims a job of a key with an app. Otherwise a runner on an older kit would ignore `github` and
  push as its machine's account: the one thing the person ruled out.
- **A mega-bug-fix's token covers its product's repositories** that the installation holds, within
  the key's allow-list: its targets are only chosen while it runs. A target outside that
  installation fails its push, and the mega stops `blocked` under **All or nothing across targets**.
- **Git goes over HTTPS with the token, whatever the checkout's remote**, so a runner whose checkout
  was cloned over SSH never pushes with its machine's key.
- **The refresh route answers for 10 minutes after the job ends,** so the runner releases the job's
  claims as the app too.
- **The fixed sender line applies to every key job,** with or without an app: today's
  `@API key … (@login)` line is broken for all of them.
- **Attaching is on the key's row, not in the creation form,** which does not change.
- **The secret box is reused as it stands** (`apps/galaxy/src/jev/secret-box.ts`), under the same
  master key.

## User stories

- As an app that sends bug fixes, I attach my GitHub App to my key once, and every pull request my
  jobs open is my app's, so the people who review it see where it came from.
- As the person who made the key, I am never assigned, mentioned or credited on GitHub for a job
  the app sent.
- As a workspace owner, I see which app a key runs as and when it last minted a token, and I remove
  it or revoke the key from its row.
- As a reviewer, I read a pull request opened by an app, with the agent's trailer and Omni's footer,
  and no person pretending to have written it.

## Scope

In:

- the `api_key_github_apps` table, its two functions, the keys list's new fields, the migration,
  its database check and the regenerated database types;
- attaching, replacing and removing an app on Settings › API keys, and its column;
- the send-time checks and their two 422 codes, in the error shape and the OpenAPI document;
- `githubApp` at register, `github` and `sentByKey` at claim, and the refresh route;
- the runner's job environment (identity, credential helper, `gh`, `insteadOf`), the kit's GitHub
  calls and the release under `OMNI_GITHUB_APP`, and the token masked in what it sends;
- the skills' text: no reviewer and no `@login` under `OMNI_GITHUB_APP`; the sender line;
- `docs/guide/api.md` and `docs/guide/runners.md`.

Out:

- one app for a whole workspace rather than per key;
- an app for a job a person sends from the Runners page, or for a PRD job;
- showing the app on the Runners page or on `GET /api/v1/jobs/{id}`;
- stopping a `CODEOWNERS` review request, which is GitHub's;
- signed (verified) commits through the GitHub API;
- a mega target in another installation of the app.

## Test seams

Following `omni kb show testing`: tests sit beside the code and run on fixtures. No test calls
GitHub, Supabase or the network: GitHub is reached through an injected fetch.

- **`kit/lib/runner/`, on fakes:**
  - a claim with `github` gives the job `OMNI_GITHUB_APP`, the bot's author and committer, the
    credential helper, the `insteadOf` and the `gh` on `PATH`;
  - a claim with `github: null` leaves the job's environment as today;
  - `omni runner github-token` refreshes under 5 minutes on a fake clock, and retries every minute;
    a refresh that keeps failing ends the job `failed` with `github app: <why>`;
  - the token is masked in every line, log tail and report;
  - the release runs with the app's token.
- **`kit/lib/runner/sender.ts`, pure:** a job with `sentByKey` reads
  `Sent through the Omni API by API key <name> on runner <runner>`; a person's job is unchanged.
- **The kit's GitHub calls:** under `OMNI_GITHUB_APP`, `githubEnv` never runs `gh auth token`.
- **`apps/galaxy`, on the store's fake and a stubbed GitHub:**
  - attaching: a pair GitHub refuses; no master key; a member who is not an owner (403);
  - **Remove** and the key's revocation delete the row;
  - at send: both 422s, and nothing queued;
  - at claim: the token's repositories and permissions; `github` only for a key with an app and a
    runner that registered `githubApp`; `failed` with `github app: <why>` for a revoked key, a
    maker who left, an uninstalled app and a missing master key;
  - the refresh route: the job's runner only, within the 10 minutes after the end, never after.
- **`supabase/checks/api_key_github_apps.sql`,** a step of the `supabase` workflow's `check` job:
  - a member who is not an owner cannot attach or remove;
  - a member reads the slug, never the ciphertext or `last_token_at`;
  - revoking the key deletes its row.
- **The skills' text, guarded:** under `OMNI_GITHUB_APP`, `/omni:pr`, `/omni:bug-fix` and
  `/omni:mega-bug-fix` request no reviewer and add no assignee.
- **The contract:** `pnpm schemas:verify` with the new returned fields and their readers; the
  OpenAPI document lists both 422 codes.
- **Render tests:** the column for a member; an owner's actions and `last token`; both refusals in
  the attach form.
- **Mutation** on the delivery-core files the slices change (`pnpm mutation:changed`).

## Risks

**What merging publishes, and the rollback.** Merging publishes a migration on production Supabase
(the table and its two functions), a settings flow that takes a private key, two send-time
refusals, a runner route that mints tokens, a claim field, and a kit release whose runners run app
jobs. Rollback: revert the merge. Keys lose their app, jobs of such keys send as today, and a
follow-up migration drops the table, deleting every sealed key. Runners on the new kit stop
registering `githubApp` once the server no longer reads it.

- **Omni holds a third party's private key.** It is sealed under the deployment's master key,
  opened only to mint, never shown, and deleted with its key. Only one-hour tokens reach a runner,
  for the job's repositories and three permissions. An owner sees each key's last mint.
- **A token on a runner machine.** The job's session can read its token, as it reads the machine's
  own `gh` login today, with narrower reach: one hour, the job's repositories, three permissions.
  It is masked in everything the runner sends.
- **A fix that changes a workflow file fails to push:** the token has no `workflows` permission. The
  job stops `stuck`, as any push that fails.
- **Old runners.** A runner on a kit from before this PRD never claims a job of a key with an app;
  if no runner is updated, those jobs wait in the queue.
- **CODEOWNERS** still requests its owners' reviews on the app's pull request. That is the
  repository's rule, and the guide says so.

The Legal entries it touches:

- L-AIACT-1 (content an agent makes says so): a key job's pull request is the app's, and keeps the
  agent's trailer and Omni's footer, so it never passes as a person's work.
- L-GDPR-1 (only members read personal data): the job's pull request no longer names the key's
  maker on GitHub.
- L-GDPR-2 (credentials never stored or logged in clear): the private key is sealed, and the token
  is masked in every line the runner sends.

The locked laws it touches:

- BR-PRODUCT-63: an agent could read another workspace's private work. The token covers only the job's
  repositories, within the key's allow-list and the workspace. Changing it needs @pierrederval or
  @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-64: a person who left the workspace could still act through an agent. No token is minted
  for a key whose maker left, and that key's queued jobs fail. Changing it needs @pierrederval or
  @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-59: a member could copy a stored key. The app's private key is never shown to anyone,
  owners included, and the secret box is reused unchanged. Changing it needs @pierrederval or
  @dervalp to approve the pull request on GitHub.
- N-PRODUCT-15: unreviewed work reaches every user. The app only opens pull requests, and only a
  person merges. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-3 and BR-PRODUCT-5: an agent waves its own work through the gate. The skills' change
  only drops reviewer requests and `@login`s; drafts and the override label are untouched. Changing
  them needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-12, BR-PRODUCT-28, BR-PRODUCT-29, BR-PRODUCT-39 and N-PRODUCT-16 govern every
  migration. This one changes no answer, links no GitHub account to a member, opens no ask session,
  reads no session outside its workspace and writes no ledger row. Changing them needs @pierrederval
  or @dervalp to approve the pull request on GitHub.

The design changes none of these laws.

## Acceptance criteria

Acceptance scenarios are off in this repository: each criterion becomes ordinary tests.

1. An owner attaches a GitHub App (App ID and private key) to a key. Every member then reads its
   slug in the key's **GitHub App** column, and the owner reads `last token`. Nobody reads the
   private key again. A member who is not an owner can attach, replace or remove none.
2. A pair GitHub refuses is refused with "GitHub refused this App ID and private key." and nothing
   is stored. On a deployment with no master key, attaching reads "Attaching a GitHub App isn't
   available on this deployment.".
3. A bug fix sent by a key with an app, on a repository where the app is installed with the three
   permissions, is claimed only by a runner that registered `githubApp: true`. The following are all
   the app's bot `<slug>[bot]`: the bug's issue, its comments and labels, the branch, the commits'
   author and committer, the pull request and its status comment. The pull request has no assignee
   and no reviewer the job requested, and mentions no `@login`. Its commits carry only the agent's
   and Omni-man's `Co-authored-by`.
4. That pull request's body reads
   `Sent through the Omni API by API key <name> on runner <runner>`, and so does a key job's with no
   app.
5. A key with an app that sends to a repository where the app is not installed gets 422
   `github_app_not_installed`, naming the repository. One whose installation lacks a permission
   gets 422 `github_app_permissions`, naming it. In both cases nothing is queued.
6. A job whose token cannot be minted at claim ends `failed` with the reason `github app: <why>`,
   and no runner runs it under its machine's account. This holds for an app removed, an app
   uninstalled, a key revoked, and a key whose maker left.
7. A job that runs past an hour keeps writing as the app, its token refreshed before it expires. A
   refresh that keeps failing ends the job `failed` with `github app: <why>`.
8. No line, log tail or report the runner sends holds the token.
9. When the job ends, the runner releases its claims (label and comment) as the app.
10. A runner whose checkout's remote is `git@github.com:` pushes the job's branch as the app, never
    with the machine's SSH key.
11. A mega-bug-fix sent by a key with an app opens its target pull requests and its record as the
    app, on repositories of its plan repository's product that the installation holds.
12. Revoking a key, or removing its app, deletes the sealed private key. A key with no app sends and
    runs as today, and a person's job from the Runners page is unchanged.
