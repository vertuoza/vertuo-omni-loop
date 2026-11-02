# Plan: every runner job runs as the Omni GitHub App, never as a person

PRD #2573, spec in `spec.md` beside this plan. The feature branch `feat/runner-jobs-as-omni-app` goes
into `main` with `Closes #2573`; each slice is a sub-PR from `feat/runner-jobs-as-omni-app--<slice>`
into the feature branch, with `Part of #2573`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | At claim and at `githubToken`, the server mints the Omni App's token for every job, a key's own App no longer read, and a job it cannot mint for ends failed | `apps/galaxy/src/runners/runners.service` `apps/galaxy/src/runners/runners.github` `apps/galaxy/src/runners/runners.live.ts` `apps/galaxy/src/runners/runners.grants.test.ts` `apps/galaxy/src/runners/runners.controller.test.ts` `apps/galaxy/src/runners/fixtures/` | — | 1 | deep |
| s2 | A runner registered without `github_app` claims no job, and the Runners page says `Update the runner's kit` of a job only such runners could take | `supabase/migrations/` `supabase/checks/runners.sql` `supabase/checks/api_key_github_apps.sql` `apps/galaxy/src/runners/runners.repository.test.ts` `apps/galaxy/src/runners/fixtures/` `apps/galaxy/src/runners/page/model` | — | 2 | build |
| s3 | A job that reaches a runner without `github` ends failed, `github app: the job came without its App`, before its session starts | `kit/lib/runner/runner.ts` `kit/lib/runner/runner.test.ts` `kit/lib/runner/runner-github.test.ts` `kit/lib/runner/fixtures/` | — | 1 | build |
| s4 | The user guide says every runner job signs as the Omni App, and what a runner owner does when a job fails `github app:` | `docs/guide/runners.md` `docs/guide/api.md` `docs/guide/troubleshooting.md` | — | 1 | light |

**Shared ground.** `apps/galaxy/src/runners/fixtures/` is declared by s1 (the GitHub fake gains the
Omni App's installation, bot id and mint) and s2 (the store fake's `runner_claim()` mirror drops the
key-App rule for `github_app`). s2 sits in wave 2 so it merges onto s1's fakes. `kit/dist/` is
generated: s3 rebuilds it only to test, and the wave rebuilds it once after merging.

## Per slice: done when

### s1 (deep: a credential path and BR-PRODUCT-63's repository list) (`ui: yes`)

- `runners.service.test.ts`: a job sent from the page (no key) is answered with `github` holding a token
  minted on the Omni App's installation for the job's repository, `login` `<slug>[bot]` and `email`
  `<bot id>+<slug>[bot]@users.noreply.github.com`.
- A job from a key that holds its own App is answered with the Omni App's grant; the key's sealed App
  is never opened.
- A mega bug fix's token lists the job's repository and the product's other repositories the
  installation holds, never one outside the key's allow-list.
- No `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` on the deployment: the claimed job ends `failed`,
  `github app: the Omni App is not configured on this server`; not installed: `github app: the App is
  not installed on <repo>`; a missing permission and an unreadable bot id each end it failed with
  their why. In each case no runner is answered.
- A key that no longer works (revoked, maker left) still ends its job failed, as before.
- `githubToken` mints from the Omni App for any claimed or running job of the caller's runner, and
  for 10 minutes after it ends.
- The bot id is read once per service instance, by the App's slug, through the injected fetch: no
  test reaches GitHub.

### s2 (`ui: yes`)

- A new migration, dated after the newest on `main`, replaces `runner_claim()` so that a runner with
  `github_app = false` claims nothing, and one with `github_app = true` claims as before (queue order,
  target, repos and slots unchanged).
- `supabase/checks/runners.sql` proves both, with realistic rows; `api_key_github_apps.sql` no longer
  asserts the key-App claim rule.
- The store fake's claim mirrors the migration.
- `page/model.test.ts`: a queued job whose only able runners registered `github_app = false` reads
  **Cannot run** with `Update the runner's kit`; with one able runner registered `github_app = true`
  it reads Queued.

### s3

- `runner.test.ts`: a claimed job with `github: null` ends `failed`, reason `github app: the job came
  without its App`, no session is started, and no line or log holds a token.
- A job with `github` starts as before (`runner-github.test.ts` stays green).
- Every existing runner test that claims a job gives it a `github` grant.

### s4 (light: docs only)

- `docs/guide/runners.md` says every job a runner runs signs as the Omni App's bot, never as the
  machine's `gh` login, and that a runner on an older kit takes no job until updated.
- `docs/guide/api.md` says an API key's own GitHub App no longer decides a job's identity.
- `docs/guide/troubleshooting.md` lists each `github app:` reason and its fix (install the App on the
  repository, accept its permissions, update the runner's kit).
