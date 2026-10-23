# Plan: An API key's job runs on GitHub as the calling app's own GitHub App, never as a person

PRD #2433, its spec beside this plan (`spec.md`). The feature branch `feat/api-key-github-app`
merges into `main` with `Closes #2433`; each slice is a sub-PR from
`feat/api-key-github-app--<slice>` into the feature branch, with `Part of #2433`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The database keeps a key's GitHub App: the table `api_key_github_apps`, attach and remove for owners only, the slug for every member and `last_token_at` for owners, revocation deleting it, `runners.github_app` set at register, `runner_claim` handing a job of a key with an app only to such a runner, and the service-role reads that open a job's app and record its mint | `supabase/migrations/` `supabase/checks/` `supabase/database.types.ts` `.github/workflows/supabase.yml` | — | 1 | deep |
| s2 | The runner runs a claimed job as its app: it registers `githubApp: true`, reads the claim's `github` and `sentByKey`, starts the job with the app's identity (`OMNI_GITHUB_APP`, the bot as author and committer, the credential helper, the `insteadOf`, the `gh` on `PATH`) read through `omni runner github-token`, masks the token in all it sends, never reads `gh auth token` under the app, and writes the sender line that names the key | `kit/lib/runner/` `kit/bin/commands/runner.` `kit/bin/github.` `kit/lib/env/` `kit/README.md` | — | 1 | deep |
| s3 | The runner keeps the app's token current and ends with it: `omni runner github-token` refreshes it 5 minutes before it expires, retries every minute, ends the job `failed` with `github app: <why>` when it runs out, and the release of the job's claims runs as the app | `kit/lib/runner/` `kit/bin/commands/runner.` | s2 | 2 | build |
| s4 | An owner attaches, replaces and removes a key's GitHub App: the server checks the pair with GitHub, seals the private key and stores the slug and bot id; `keys/github-app.ts` also finds an installation and mints its token for given repositories and permissions | `apps/galaxy/src/public-api/keys/` `apps/galaxy/app/api/api-keys/` | s1 | 2 | deep |
| s5 | Settings › API keys shows each key's GitHub App to every member, and to an owner its last token and the Attach, Replace and Remove actions, with the attach form and its two refusals | `apps/galaxy/src/public-api/page/` | s4 | 3 | build |
| s6 | A key with an app is refused at send, nothing queued: `github_app_not_installed` when its app is not installed on the repository, `github_app_permissions` when the installation lacks a permission, both in the error shape and the OpenAPI document | `apps/galaxy/src/public-api/public-api.` `apps/galaxy/src/public-api/openapi.` `apps/galaxy/src/public-api/fixtures/` | s4 | 3 | build |
| s7 | At claim the server mints the job's token (its repositories, three permissions), hands `github` and `sentByKey` to a runner that registered `githubApp`, ends the job `failed` with `github app: <why>` when it cannot, and answers the refresh route for the job's runner until 10 minutes after the end | `apps/galaxy/src/runners/runners.` `apps/galaxy/src/runners/fixtures/` `apps/galaxy/app/api/runners/` | s1, s2, s4 | 3 | deep |
| s8 | Under `OMNI_GITHUB_APP`, `/omni:pr`, `/omni:bug-fix` and `/omni:mega-bug-fix` request no reviewer, add no assignee and mention no `@login` | `kit/plugin/skills/pr/` `kit/plugin/skills/bug-fix/` `kit/plugin/skills/mega-bug-fix/` `kit/test/github-app-skills` | — | 1 | light |
| s9 | The guide says how to run as your own GitHub App and that such a job never uses the runner's account | `docs/guide/api.md` `docs/guide/runners.md` | s3, s5, s6, s7, s8 | 4 | light |

**Shared ground.**
- `kit/lib/runner/` and `kit/bin/commands/runner.` are declared by s2 and s3, in waves 1 and 2:
  s3 builds the refresh and the release on the identity s2 settles.
- The claim's shape is named twice. The kit's `kit/lib/runner/api.ts` (s2) reads it and galaxy's
  `runners.contract.ts` (s7) writes it. s7 waits for s2, so it writes the shape s2 settled.
- The public API's folder `apps/galaxy/src/public-api/` is split by narrow prefixes, so its slices
  never meet:
  - `keys/` is s4's: the settings routes, the sealing and the module that mints;
  - `page/` is s5's;
  - `public-api.`, `openapi.` and `fixtures/` are s6's.
- s6 and s7 only import `keys/github-app.ts`, which s4 settled a wave before them.
- `supabase/database.types.ts` is s1's alone; the galaxy slices read it.
- s1 adds new functions rather than widening `api_keys_list` or `runner_claim`'s returned columns,
  so no reader outside its territory must change in its pull request (conventions › A new returned
  column lands with its readers).
- `kit/dist/` and `apps/omni-app/api/` are generated: no slice lists them, and the wave rebuilds
  them once.

**Laws.** No slice carries a `law:` mark: none changes a locked law's text or its enforcing test.
`omni kb laws` lists locked laws in two slices' territories, and both slices only keep them true:
- s1: BR-PRODUCT-28, BR-PRODUCT-63, BR-PRODUCT-64, BR-PRODUCT-12, BR-PRODUCT-29, BR-PRODUCT-39,
  BR-PRODUCT-59 and N-PRODUCT-16. Its new functions read only the caller's workspace, and its app
  stops minting when the key's maker leaves. Its owner-only reads follow BR-PRODUCT-59. Its
  migration rewrites no ledger row and no answer.
- s8: BR-PRODUCT-3, BR-PRODUCT-5 and N-PRODUCT-15. Its paragraph adds no override label, keeps the
  feature PR a draft while a question is open, and merges nothing.

## Per slice: done when

### s1 (deep: the one migration every slice reads, a sealed secret and the claim's selection)

- A migration `<version>_api_key_github_apps.sql`, dated after the newest on `main`
  (`node scripts/migration-order.ts`; conventions › A new migration takes the next free version).
  Its header names its rollback. It does the following:
  - **creates `public.api_key_github_apps`:** `key_id` (primary key, references `agent_tokens`, a key
    of scope `api` only), `workspace_id`, `app_id`, `slug`, `bot_id`, `ciphertext`, `iv`,
    `attached_by`, `attached_at`, `last_token_at`. Row-level security is on, and no policy lets a
    member select it;
  - **adds `api_key_github_app_attach(p_key, p_app_id, p_slug, p_bot_id, p_ciphertext, p_iv)`:** it
    inserts or replaces the row. It is for an owner of the key's workspace only, on a live key
    (42501 otherwise, the message naming why);
  - **adds `api_key_github_app_remove(p_key)`:** it deletes the row, for an owner only;
  - **adds `api_key_github_apps_list(p_workspace)`:** each live key's id and slug for any member,
    with `last_token_at` only when the caller is an owner. It never returns `ciphertext` or `iv`;
  - **changes `api_key_revoke`:** it also deletes the key's row;
  - **adds `runners.github_app boolean not null default false`**, written at register;
  - **changes `runner_claim(p_runner)`:** it never hands a job whose `sent_by_key` has a row in
    `api_key_github_apps` to a runner whose `github_app` is false. Its returned columns do not
    change;
  - **adds `api_key_github_app_of_job(p_job)` and `api_key_github_app_minted(p_key)`, service role
    only:** the first gives the job's key's app with its sealed key and whether the key still works
    (not revoked, maker still a member); the second sets `last_token_at`.
- `supabase/checks/api_key_github_apps.sql`, a new named step of the `supabase` workflow's `check`
  job (conventions › A new database check runs in CI), proves:
  - a member who is not an owner can neither attach nor remove;
  - a member reads the slug and never the ciphertext, the iv or `last_token_at`;
  - an owner reads `last_token_at`;
  - revoking the key deletes its row;
  - `runner_claim` gives a key-with-app job to a `github_app` runner and never to another;
  - a member of another workspace reads none of it.
- `supabase/database.types.ts` is regenerated (`node scripts/supabase-types.ts`).

### s2 (deep: the identity every write on GitHub takes, and a token on a machine)

- `POST /api/runners/register` sends `githubApp: true`. The kit's claim schema
  (`kit/lib/runner/api.ts`) reads `github: {token, expiresAt, login, email} | null` and
  `sentByKey: string | null`; a payload without them reads as `null`.
- A job with `github` starts with all of these, and a job with `github: null` starts with today's
  environment, byte for byte:
  - `OMNI_GITHUB_APP=<login>`;
  - `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME` and `GIT_COMMITTER_EMAIL` set to the
    bot;
  - a git credential helper and `url.<https>.insteadOf` for `git@github.com:` and
    `ssh://git@github.com/`, set through `GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_<n>` and
    `GIT_CONFIG_VALUE_<n>`;
  - a directory first on `PATH` holding a `gh` that runs the real `gh` with `GH_TOKEN` from
    `omni runner github-token`.
- `omni runner github-token` prints the job's current token, and no one else's: only inside a job
  of this runner.
- The job's token, current or past, reads `***` in every line, log tail and report the runner sends.
- Under `OMNI_GITHUB_APP`, `githubEnv` (`kit/bin/github.ts`) never runs `gh auth token`; it uses
  the job's token.
- `senderLine`: a job with `sentByKey` reads
  `Sent through the Omni API by API key <name> on runner <runner>`. A person's job reads as today.
  `OMNI_SENT_BY_KEY` carries the key's name.
- Every new variable joins its group in `kit/lib/env/read.ts`, and the README's
  `omni:env-variables` list follows (conventions › Naming).
- Tests on fakes cover each of these; `pnpm kit:build` rebuilds the bundle to test, which the slice
  does not commit.

### s3

- `omni runner github-token` asks `POST /api/runners/jobs/<id>/github-token` for a fresh token when
  the current one has less than 5 minutes left, on a fake clock in tests.
- A refused or failed refresh is tried again every minute. When the current token expires with no
  fresh one, the runner ends the job `failed` with the reason `github app: <why>`.
- The release of a job's claims (`kit/lib/runner/release.ts`) runs its `gh` calls with the job's
  token when the job had `github`, and with the machine's `gh` otherwise.

### s4 (`ui: yes`, deep: a third party's private key, sealed, and the module that mints)

- `apps/galaxy/src/public-api/keys/github-app.ts`, behind an injected fetch:
  - **checking a pair:** `appJwt` with the pair, `GET /app` for the slug, then
    `GET /users/<slug>[bot]` for the bot's id;
  - **finding an installation:** `GET /repos/{owner}/{repo}/installation`, which answers its
    permissions;
  - **minting:** `POST /app/installations/{id}/access_tokens` with the given repositories and
    exactly `contents`, `pull_requests` and `issues` write and `metadata` read.
- `POST /api/api-keys/<id>/github-app` takes `{appId, privateKey}` from an owner's session:
  - it checks the pair, seals the key with the secret box (`apps/galaxy/src/jev/secret-box.ts`,
    unchanged) and calls `api_key_github_app_attach`;
  - it answers the key's `{slug}`.
- `DELETE /api/api-keys/<id>/github-app` removes the app.
- The refusals:
  - a pair GitHub refuses: "GitHub refused this App ID and private key.", nothing stored;
  - no master key: "Attaching a GitHub App isn't available on this deployment.";
  - a member who is not an owner: 403;
  - a revoked key: 404.
- The keys list the page reads gains each key's `githubApp: {slug, lastTokenAt} | null`, read through
  `api_key_github_apps_list`; `lastTokenAt` is present for an owner only.
- No answer, log line or error ever carries the private key or a token.

### s5 (`ui: yes`)

- The keys table gains a **GitHub App** column: `—`, or the slug. Every member sees it.
- An owner sees, under the slug, `last token <date>` or `no token yet`, and the actions
  **Attach a GitHub App** on a key with none, **Replace** and **Remove** on a key with one.
- The attach form, opened above the table like the New key form, takes an App ID and a `.pem` file, and shows both refusals of s4 word for word.
- The key-creation form is unchanged.
- Render tests cover all three: the member's view, the owner's view, and the form's refusals.
- Remove is asked twice, as Revoke is: **Remove**, then **Remove for good**.

### s6 (`ui: yes`)

- `POST /api/v1/bug-fixes` from a key with an app checks the installation on the job's repository
  before queuing; `/mega-bug-fixes` checks it on the plan repository:
  - no installation: 422 `github_app_not_installed`, naming the repository;
  - an installation without write access to `contents`, `pull_requests` or `issues`: 422
    `github_app_permissions`, naming the permission.
- In both cases nothing is queued. A key with no app queues as today.
- `ERROR_CODES` and the OpenAPI document list both codes; `pnpm schemas:verify` stays green.

### s7 (`ui: yes`, deep: the claim, the mint and never a person)

- `POST /api/runners/register` stores `githubApp` in `runners.github_app`; a runner that sends none
  stores false.
- On a claim of a job whose key has an app, the server opens the sealed key and finds the
  installation. It then mints a token, records the mint, and answers the job with
  `github: {token, expiresAt, login: '<slug>[bot]', email: '<bot id>+<slug>[bot]@users.noreply.github.com'}`.
  The token's repositories are:
  - the job's repository;
  - for a mega-bug-fix, the plan repository and every repository its product names that the
    installation holds, each within the key's allow-list.
- Every claimed job carries `sentByKey`: the key's name, or `null`.
- A mint that fails, or a key that no longer works, ends the job `failed` with the reason
  `github app: <why>`. The job is never answered without `github`.
- `POST /api/runners/jobs/<id>/github-token` answers `{token, expiresAt}`:
  - only to the job's runner;
  - only while the job is claimed or running, or within 10 minutes after it ends;
  - 409 after that, 403 for another runner.
- Tests on the store's fake and a stubbed GitHub cover each case.

### s8 (light: the skills' words and their guard)

- `/omni:pr`, `/omni:bug-fix` and `/omni:mega-bug-fix` say: while `OMNI_GITHUB_APP` is set, request
  no reviewer (even one the `pull-requests` form names), add no assignee, and mention no `@login`
  in anything written on GitHub.
- A test under `kit/test/github-app-skills` fails when one of the three skills loses that
  paragraph.

### s9 (light: the guide only)

- `docs/guide/api.md` gains "Run as your own GitHub App": create the app with `contents`,
  `pull_requests` and `issues` write, install it, attach it to the key, and the two 422 codes. It
  also says a `CODEOWNERS` file still requests its owners.
- `docs/guide/runners.md` says a key job with an app never uses the runner's account, and that a
  runner on an older kit never takes one.
