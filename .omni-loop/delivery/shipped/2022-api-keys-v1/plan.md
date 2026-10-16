# Plan: API keys v1

PRD #2022, specified in `spec.md` beside this plan. The feature branch `feat/api-keys-v1` goes into
`main` with `Closes #2022`; each slice is a sub-PR from `feat/api-keys-v1--<slice>` into the feature
branch with `Part of #2022`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | A workspace owner makes, lists and revokes an API key on Settings › API keys; the secret shows once, and `api_key_of` answers a live key's workspace and repositories | `supabase/migrations/` `supabase/checks/api_keys` `supabase/database.types.ts` `apps/galaxy/src/public-api/keys/` `apps/galaxy/src/public-api/page/` `apps/galaxy/app/api/api-keys/` `apps/galaxy/app/app/settings/api-keys/` `apps/galaxy/src/nav/section-tabs` `apps/galaxy/src/nav/SectionTabs.render.test.ts` `apps/galaxy/src/business/render.test.ts` `apps/galaxy/src/fleets/render.test.ts` `apps/galaxy/src/jev/settings/render.test.ts` `apps/galaxy/src/products/render.test.ts` `apps/galaxy/src/repositories/render.test.ts` | — | 1 | deep |
| s2 | A program lists the workspace's PRDs and bug fixes with its key, page by page with a cursor, under the key's allow-list, and every refusal answers the one error shape | `apps/galaxy/src/public-api/public-api.` `apps/galaxy/src/public-api/cursor` `apps/galaxy/src/public-api/fixtures/` `apps/galaxy/app/api/v1/prds/` `apps/galaxy/app/api/v1/bug-fixes/` | s1 | 2 | deep |
| s3 | `GET /api/v1/openapi.json` serves the OpenAPI 3.1 reference generated from the routes' zod schemas, `/docs/api` renders it with Scalar, and `docs/guide/api.md` explains keys, routes, the cursor and the errors | `apps/galaxy/src/public-api/openapi` `apps/galaxy/app/api/v1/openapi.json/` `apps/galaxy/app/docs/api/` `apps/galaxy/src/docs/` `docs/guide/` `apps/galaxy/package.json` `pnpm-lock.yaml` | s2 | 3 | build |
| s4 | A program starts a bug fix with its key, which queues `/omni:bug-fix` on the runners, then follows the job; the Runners page and the pull request name the key | `apps/galaxy/src/public-api/public-api.` `apps/galaxy/src/public-api/openapi` `apps/galaxy/app/api/v1/bug-fixes/` `apps/galaxy/app/api/v1/jobs/` `apps/galaxy/src/runners/` `docs/guide/api` | s1, s2, s3 | 4 | build |

**Shared ground.**

- `apps/galaxy/src/public-api/public-api.` (the contract, controller, service and repository): s2
  writes them; s4 adds the bug-fix and job routes to them. s4 waits on s2 (wave 4 after wave 2).
- `apps/galaxy/app/api/v1/bug-fixes/`: s2 adds `GET`; s4 adds `POST` to the same `route.ts`.
- `apps/galaxy/src/public-api/openapi`: s3 builds the registry with s2's routes; s4 registers its
  two routes in it. s4 waits on s3.
- `docs/guide/api`: s3 writes the guide; s4 adds the bug-fix and job sections.
- The migration is s1's alone: it already adds `runner_jobs.sent_by_key`, which s4 only reads and
  writes, so no later slice touches `supabase/`.
- The Settings render tests (`business`, `fleets`, `jev/settings`, `products`, `repositories`,
  `SectionTabs`) read `SETTINGS_TABS`, which s1 alone changes.

## Per slice: done when

### s1 (deep: a migration, SECURITY DEFINER functions, a secret and two locked laws)

**s1** (`ui: yes`) (`law: N-PRODUCT-17 · owner @pierrederval`) (`law: BR-PRODUCT-64 · owner @pierrederval`)

A secret sent to any browser but its maker's, once, would let anyone opening the app call the API
as the workspace. A key that outlived its maker's membership would let a person who left keep
reading and acting for the team.

- The migration is dated after the newest on `main`. It widens `agent_tokens.scope` to `api` and
  adds `repos text[]` and `runner_jobs.sent_by_key`, with the four functions `api_key_make`,
  `api_key_revoke`, `api_keys_list` and `api_key_of`, and its header names the rollback line.
- `supabase/checks/api_keys.sql` proves:
  - only an owner makes or revokes a key;
  - a member lists keys without the hash;
  - the 20-key limit;
  - unknown repositories are refused;
  - `api_key_of` answers nothing for a revoked key, a key whose maker left, or a `business` or `kit`
    token.
- The secret is `oma_` followed by 32 bytes in base64url. Only its SHA-256 and last four characters
  are stored. Unit tests cover the shape and the hash.
- `/app/settings/api-keys`, under a new **API keys** tab after Products, matches the `api-keys`
  draft screen:
  - an owner makes a key and sees the secret once with **Copy**;
  - a reload shows only `oma_…<last four>`;
  - **Revoke** removes it;
  - a member sees the table without the buttons and "Only owners make or revoke keys."
- Component tests cover the owner, member, no-key and just-made states. Controller tests on the
  make and revoke route cover owner, member, another workspace and no session.

### s2 (deep: the cursor and the cross-workspace and allow-list guarantees)

**s2** (`law: BR-PRODUCT-63 · owner @pierrederval`)

A key reading a repository outside its own workspace would let one team read another's private
work.

- `GET /api/v1/prds` and `GET /api/v1/bug-fixes` answer `{data, next_cursor}`, newest first, in the
  shapes the spec names. `limit` defaults to 50 and is capped at 100.
- Following `next_cursor` over 120 fixture rows, with rows added between pages, returns each row
  exactly once. A tampered cursor answers 422.
- Two workspaces' fixture rows: each key lists only its own. A key limited to one repository lists
  only that repository's dossiers, and no product PRD without a home repository.
- No header, a wrong prefix, an unknown, a revoked or an orphaned key each answer 401 as
  `{error: {code: "unauthorized", message}}`. A bad `limit` answers 422 naming `limit`.
- The routes follow ADR-0095's roles. `scripts/layering-guard.test.ts` and
  `scripts/import-guard.test.ts` pass with no new baseline line.

### s3

**s3** (`ui: yes`)

- `@asteasolutions/zod-to-openapi` 9 is added to `apps/galaxy`, imported only by
  `src/public-api/openapi.ts`, through zod 4's `.meta()`.
- `GET /api/v1/openapi.json` answers, with no key, an OpenAPI 3.1 document with `bearerAuth` on
  every route but itself. A test parses it and fails when an `app/api/v1/**/route.ts` is missing
  from the registry.
- `/docs/api` renders the document with Scalar inside the docs layout, every route with its
  parameters, responses and examples.
- `docs/guide/api.md` is listed in `docs/guide/meta.json`. It shows making a key, a `curl` for each
  list route, paging with the cursor, the error table, and links `/docs/api`. The docs tests pass.

### s4

**s4** (`ui: yes`) (`law: N-PRODUCT-15 · owner @pierrederval`)

A job started by a key that merged its own pull request would ship work nobody reviewed. The job
still ends in a pull request a person merges.

- `POST /api/v1/bug-fixes` `{repo, description, runner?, fleet?}` answers 202 with the queued job.
  It goes through the runners' own service and `checkLine`, with `sent_by` set to the key's maker
  and `sent_by_key` to the key.
- A repository outside the workspace or the allow-list answers 403. A description the runners
  refuse answers 422 with their reason, and nothing is queued.
- `GET /api/v1/jobs/{id}` answers a job a key of this workspace queued: status, runner, PR link,
  exit code, reason and times. Another workspace's job, or a person's job, answers 404.
- The Runners page shows `API key <name>` with `made by @<login>` as the job's sender, matching the
  `runners` draft screen. The runner's `OMNI_SENT_BY` reads
  `API key <name> (@<login>)`, so the pull request says
  `Sent from the Omni app by API key <name> (@<login>) on runner <runner>`.
- Both routes are in the OpenAPI registry, and `docs/guide/api.md` shows a `curl` for each.
