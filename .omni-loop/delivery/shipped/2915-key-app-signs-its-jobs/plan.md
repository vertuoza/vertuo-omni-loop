# Plan: a job an API key sends runs as the key's own GitHub App, when the key holds one

PRD #2915, spec in `spec.md` beside this plan. The feature branch `feat/key-app-signs-its-jobs` goes
into `main` with `Closes #2915`; each slice is a sub-PR from `feat/key-app-signs-its-jobs--<slice>`
into the feature branch, with `Part of #2915`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | At claim and at `githubToken`, a job whose key holds a GitHub App, or held one when it was queued, gets a token minted from that App and its bot; a key's App that cannot mint fails the job, `github app: <why>`; every other job keeps the Omni App | `apps/galaxy/src/runners/runners.service` `apps/galaxy/src/runners/runners.github` `apps/galaxy/src/runners/runners.live.ts` `apps/galaxy/src/runners/runners.grants.test.ts` `apps/galaxy/src/runners/runners.controller.test.ts` `apps/galaxy/src/runners/runners.ultra.test.ts` `apps/galaxy/src/runners/fixtures/` | — | 1 | deep |
| s2 | A mega bug fix sent by a key that holds an App is checked at send on every repository its token would reach, and refused 422 naming the first one the App cannot work on | `apps/galaxy/src/public-api/public-api.service` `apps/galaxy/src/public-api/public-api.repository` `apps/galaxy/src/public-api/public-api.installation` `apps/galaxy/src/public-api/public-api.live.ts` `apps/galaxy/src/public-api/public-api.controller.test.ts` `apps/galaxy/src/public-api/openapi` `apps/galaxy/src/public-api/fixtures/` `apps/galaxy/src/runners/fixtures/` | s1 | 2 | build |
| s3 | The user guide says a key's App signs its jobs, that a mega bug fix's send checks every repository of its product, and what each `github app:` failure means | `docs/guide/api.md` `docs/guide/runners.md` | — | 1 | light |

**Shared ground.** `apps/galaxy/src/runners/fixtures/` is declared by s1 (the store fake holds a key with
its App, `acme-bugs`, and its sealed key; the GitHub fake mints on that App's installation) and s2 (its
send tests reuse those keys). s2 sits in wave 2, after s1, so it builds on s1's fakes. No generated path
is touched: neither `kit/dist/` nor `apps/omni-app/api/` is built from these files.

## Per slice: done when

### s1 (deep: a credential path and BR-ACCESS-1's reach) (`ui: yes`)

- A job of a key that holds an App is answered with `github` holding a token minted on that App's
  installation, `login` `acme-bugs[bot]` and `email` `<bot id>+acme-bugs[bot]@users.noreply.github.com`,
  the bot read from the stored row with no call to GitHub. The Omni App's credentials are never used for
  it.
- A job sent from the page, and a job of a key that holds no App and held none when it was queued, are
  answered with the Omni App's grant, as today.
- A job queued while its key held an App (`needs_app`), the App removed since, ends `failed`,
  `github app: the key's App was removed`, and no runner is answered.
- Each other failure ends the job `failed`, `github app: <why>`, and no runner is answered: no
  `SECRETS_MASTER_KEY` or a malformed one (`this Omni server has no key to open the App's private key`),
  a sealed key that cannot be opened (`the App's private key could not be opened`), the App not
  installed on the job's repository, its installation lacking a permission, GitHub refusing. A job of a
  revoked key, or of a key whose maker left, still fails with the stopped key's why first. No path falls
  back to the Omni App or to a person.
- A spanning skill of a key's App gets a token for the job's repository and the product's repositories
  in the key's allow-list that the App's installation holds, and no other (BR-ACCESS-1, BR-PRODUCT-63).
  `runners.github-repositories.test.ts` stays green without a change to what it asserts.
- The repositories a spanning job's token reaches, from its repository, its product reads and the key's
  allow-list, are computed by one exported pure function, which s2 calls at send.
- Each mint of a key's App calls `api_key_github_app_minted()`; a mint whose record fails still answers
  the job.
- `githubToken` for a claimed or running job of a key's App answers a fresh token of the key's App, for
  the same repositories.
- The opened private key is never logged, stored or sent to a runner. No test reaches GitHub or
  Supabase, and a test private key is built at runtime, never written whole.

### s2 (`ui: yes`)

- `public-api.service.test.ts`: a mega bug fix sent by a key whose App is not installed on one
  repository of its product within the key's allow-list is refused 422 `github_app_not_installed`, the
  message naming that repository, and nothing is queued.
- One whose App lacks write access to contents, pull requests or issues on such a repository is refused
  422 `github_app_permissions`, the message naming the permission and the repository, and nothing is
  queued.
- The repositories checked are those s1's function gives for the plan repository: a product repository
  outside the key's allow-list is never checked.
- A key that holds no App is not checked, and a bug fix is still checked on its own repository only, as
  today.
- `openapi.ts`'s 422 description says a mega bug fix is checked on every repository of its product the
  key may reach; `openapi.test.ts` is green.
- When the slice adds a Supabase read with a `*.boundary.ts`, `pnpm schemas:verify --local` passes on it.

### s3 (light: docs only)

- `docs/guide/api.md` › Run as your own GitHub App says a key's App signs its jobs (the comments,
  labels, branch, commits, pull request and status comment, and the release of claims), no longer says
  the App is unused, says a mega bug fix's send checks every repository of its product within the
  allow-list, and lists the `github app:` failures with what an owner does about each.
- `docs/guide/runners.md` says a job runs as the Omni App, or as its key's App when the key holds one.
- Every name, route and error code the pages cite exists in the code as written.
