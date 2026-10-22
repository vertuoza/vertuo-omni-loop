---
prd: 2022
title: API keys v1 — a workspace key, a versioned REST API and its OpenAPI reference
blocked-by: none
spec: file
phase0: server
---

# API keys v1 — a workspace key, a versioned REST API and its OpenAPI reference

**Date:** 2026-10-15 · **PRD:** #2022 · **After:** PRD 855 (agent tokens), PRD 1628 (kit tokens: "a
scope, not a second table"), PRD 1830 (runners and their jobs), ADR-0095 (the galaxy's layering) ·
**Touches:** `supabase/migrations/` (one migration), `supabase/checks/`, `apps/galaxy/src/public-api/`
(new), `apps/galaxy/app/api/v1/` (new), `apps/galaxy/src/runners/` (a job sent by a key),
`apps/galaxy/app/app/settings/api-keys/` (new page), `apps/galaxy/src/nav/section-tabs.ts`,
`apps/galaxy/app/docs/api/` (new), `docs/guide/api.md` (new), `apps/galaxy/package.json`.
**Out of scope:** creating or editing a PRD through the API, rate limiting, key expiry, editing a
key after it is made, webhooks, an SDK, and any change to the kit.

## Problem

Other Vertuoza teams want to plug their own tools into Omni Loop. Their first tool wants three
things: the list of the workspace's PRDs, the list of its bug fixes, and a way to start a bug fix.

Nothing lets a program outside the loop do any of that. Every route of the Omni app answers only a
signed-in person (a Supabase session, from the browser or `omni signin`) or the kit's own token. The
agent link tokens (`omb_…`, PRD 855) read only the business, over MCP. There is no API key, no
public route, no versioning, no pagination a caller can rely on, and no document that says what a
route takes and returns.

## Solution

### Words

| word | meaning |
|---|---|
| API key | a secret `oma_…` string a workspace owner makes on Settings › API keys; it acts for the workspace, optionally only on a list of repositories |
| allow-list | the repositories a key may read and act on; empty means every repository of the workspace |
| cursor | an opaque string a list returns as `next_cursor`; passing it back returns the next page |
| the reference | the OpenAPI 3.1 document `GET /api/v1/openapi.json` and the page `/docs/api` that renders it |

### The key

- An API key is a row of `public.agent_tokens` with a new scope, `api`, beside `business` and `kit`
  (PRD 1628's precedent: a scope, not a second table). The migration widens the scope check and adds
  one column, `repos text[] not null default '{}'` (`owner/name`, used only by the `api` scope).
- The secret is `oma_` followed by 32 random bytes in base64url, made on the server. Only its
  SHA-256 hash and its last four characters are stored. It is shown once, to the owner who made it,
  in the answer to the request that made it, and never again.
- Four SECURITY DEFINER functions, as the agent and kit tokens already have:
  - `api_key_make(p_workspace, p_name, p_repos)`: workspace owners only. The name is 1–40
    characters and unique among the workspace's live keys. Each repository must be one the
    workspace tracks. At most 20 live API keys per workspace. Answers the new row's id; the route
    makes the secret and passes the hash.
  - `api_key_revoke(p_workspace, p_key)`: workspace owners only. Sets `revoked_at` and `revoked_by`.
  - `api_keys_list(p_workspace)`: any member. Answers name, last four, repositories, made by, made
    at, last used, revoked at. Never the hash.
  - `api_key_of(p_hash)`: the routes only (service role). Answers `{key_id, workspace_id, repos,
    made_by, name}` for a live key whose maker is still a member of its workspace, or nothing.
    Writes `last_used_at` at most once a minute.
- A key stops working when it is revoked, or when the person who made it leaves the workspace,
  exactly as an agent link does (BR-PRODUCT-64).

### The routes

Under `apps/galaxy/app/api/v1/`, in ADR-0095's roles, in one new area `apps/galaxy/src/public-api/`
(`public-api.contract.ts`, `public-api.controller.ts`, `public-api.service.ts`,
`public-api.repository.ts`). Every route reads `Authorization: Bearer oma_…`, hashes it and calls
`api_key_of`. Reads and writes then go through the service role, always filtered by the key's
workspace and, when its allow-list is not empty, by its repositories.

| route | does |
|---|---|
| `GET /api/v1/prds?limit=&cursor=` | the workspace's PRDs (`dossiers.kind = 'prd'`), newest first |
| `GET /api/v1/bug-fixes?limit=&cursor=` | the workspace's bug fixes (`dossiers.kind = 'bug'`), newest first |
| `POST /api/v1/bug-fixes` | body `{repo, description, runner?, fleet?}`: queues the runner job `/omni:bug-fix '<description>'` on `repo`; answers `202` with the job |
| `GET /api/v1/jobs/{id}` | a job this workspace's keys queued: status, runner, PR link, exit code, reason, times |
| `GET /api/v1/openapi.json` | the reference, without a key |

**A PRD** answers `{id, ref, number, title, repo, product, stage, created_at, links: {page, issue}}`:

- `ref` is `"<number>"` for a repository PRD, or `"<product key>-<seq>"` for a product PRD;
- `product` is `{key, name}` or `null`;
- `stage` is its latest `prd_stages` stage, or `null`;
- `issue` is `null` when the PRD has no GitHub issue.

**A bug fix** answers `{id, number, title, repo, created_at, links: {page, issue}}`. Its state
(asked, in review, merged) lives on GitHub, and v1 does not return it (Decisions).

**A list** answers `{data: [...], next_cursor: string | null}`. `limit` is 1–100, default 50. The
cursor is the base64url of the last row's `(created_at, id)`, read back as a keyset
`(created_at, id) < (…)` on `dossiers_workspace_idx`. A page never repeats or skips a row while rows
are added. A cursor that does not decode answers 422.

**Starting a bug fix:**

- `repo` must be a repository of the workspace and on the key's allow-list (when it has one). The
  description is 1–200 characters, and the line `/omni:bug-fix '<description>'` must pass the
  runners' own `checkLine` (`runners.contract.ts`), so a description the runners refuse is refused
  here too, with the same reason.
- `runner` (a runner's name) or `fleet` (a fleet's key) picks the target, as an owner may pick it on
  Send to terminal; neither means any runner of the workspace.
- The job is queued through the runners' own service, so every rule PRD 1830 set still holds. Its
  `sent_by` is the key's maker, and its new column `sent_by_key` (nullable, a reference to
  `agent_tokens`) is the key. The Runners page and the pull request the job opens name the key:
  `Sent from the Omni app by API key <name> (@<maker's login>) on runner <runner>`.

**Errors** answer one shape, `{error: {code, message}}`:

| status | code | when |
|---|---|---|
| 401 | `unauthorized` | no key, an unknown key, a revoked key, or a key whose maker left |
| 403 | `forbidden` | a repository outside the workspace or outside the key's allow-list |
| 404 | `not_found` | a job that does not exist or that no key of this workspace queued |
| 422 | `invalid_request` | a query or body the contract refuses, a bad cursor, a line the runners refuse; the message names the field |
| 500 | `internal` | anything else; the message never carries a stack or a database error |

### The reference

- Each route's request and response are zod 4 schemas in `public-api.contract.ts`, described with
  zod 4's `.meta({ description, example })`. The route validates with them.
- `apps/galaxy/src/public-api/openapi.ts` registers every route with
  `@asteasolutions/zod-to-openapi` (v9, zod 4) and builds the OpenAPI 3.1 document with the
  `bearerAuth` security scheme. It is the only file that imports the library.
- `GET /api/v1/openapi.json` serves that document. `/docs/api` renders it with Scalar's API
  reference viewer, inside the docs site's own layout.
- `docs/guide/api.md` is the guide: making a key, a `curl` for each route, paging with the cursor,
  the errors, and a link to `/docs/api`. It is listed in `docs/guide/meta.json`.

### The page: Settings › API keys

- A new tab, **API keys**, after Products in `SETTINGS_TABS`, opening
  `/app/settings/api-keys`.
- A table of the workspace's live keys: name, `oma_…<last four>`, repositories ("All repositories"
  or one chip each), made by, made, last used ("never" until the first call), and **Revoke** for
  owners.
- **New key**, for owners: a name and the repositories (All, or a pick list of the workspace's
  repositories). Once made, the secret shows once with **Copy**, a `curl` example and a link to
  `/docs/api`, and the line "You will not see this key again."
- A member sees the table without the buttons, and the line "Only owners make or revoke keys."
- With no key yet, the table says "No key yet." and an owner sees **New key**. The page links the
  reference as "API reference".
- On the Runners page, a job a key sent shows "API key <name>" where a person's name would be.

## Decisions

- **Workspace-wide keys** (the person's answer). A key acts for the whole workspace, not for one
  product or one person. Rejected: one product per key, and personal access tokens.
- **Only workspace owners make and revoke keys** (the person's answer). Members see the list.
- **Starting a bug fix queues a runner job** (the person's answer), through PRD 1830's service and
  line check. Rejected: opening a GitHub issue only, and reads only in v1.
- **The reference is generated with `@asteasolutions/zod-to-openapi`** (the person's answer, after
  the pros and cons). It is maintained (v9.1.0, July 2026, a release every one or two months), it
  supports zod 4, and its only dependency is `openapi3-ts`. It saves the path, parameter, `$ref` and
  security-scheme code we would otherwise write. It stays in one file, `openapi.ts`, through zod 4's
  native `.meta()`, so nothing patches `z`. Rejected: zod 4's `z.toJSONSchema` with our own
  assembly, and a hand-written `openapi.yaml` (two sources of truth).
- **Scalar at `/docs/api`** (the person's answer). Rejected: Swagger UI.
- **The voice's objection, accepted.** Lead Engineer objected that one workspace-wide key able to
  start agent work on any repository blurs who started a 3am pull request. It is met two ways:
  - every job a key queues records and names the key (`sent_by_key`, the sender line);
  - a key may be limited to an allow-list of repositories (the person's answer).
- **A key dies with its maker's membership** (taken without asking, the most reversible option,
  following BR-PRODUCT-64). An integration whose owner leaves needs a new key from another owner.
- **A key with an allow-list sees only dossiers whose home repository is on it.** A product PRD with
  no home repository is shown only to keys with an empty allow-list (taken without asking).
- **A key targets runners as an owner does** (taken without asking): only owners make keys, so a
  key may send to any runner or fleet of the workspace.
- **Cut from v1** (taken without asking, to keep one plan small): rate limiting and 429, key expiry,
  editing a key's allow-list (revoke and make another), a bug fix's GitHub state in the list, and
  creating a PRD.

## User stories

1. As a workspace owner, I make an API key named "QA dashboard" limited to `demo-org/backend-php`,
   copy it once, and give it to the team that builds the tool.
2. As that team's developer, I open `/docs/api`, read each route with its examples, and page through
   the bug fixes with the cursor in a `curl`.
3. As that tool, I start a bug fix on `demo-org/backend-php` with one POST, then poll its job until
   it is done and read the pull request's link.
4. As a lead engineer, I see on the Runners page, and in the pull request, that "API key QA
   dashboard" sent the job, and which owner made the key.
5. As a workspace owner, I revoke a leaked key, and its next call answers 401.

## Scope

In:

- the migration (the `api` scope, `repos`, `runner_jobs.sent_by_key`, the four functions) and its
  database check;
- the `public-api` area and its five routes;
- the reference (`openapi.ts`, `openapi.json`, `/docs/api`, `docs/guide/api.md`);
- the Settings › API keys page and its tab;
- the key named on the Runners page and in the job's sender line.

Out: everything named under **Out of scope**, and any change to `/api/runners/*`, the agent link or
kit tokens beyond the shared scope check.

## Test seams

Every test runs on fixtures. None calls GitHub or Supabase (testing playbook).

| risk | test |
|---|---|
| a key reads only its own workspace | service tests on realistic rows: two workspaces, a key of each, each list answering only its own dossiers |
| the allow-list holds | service and controller tests: a key limited to one repository sees only that repository's PRDs and bug fixes, sees no product PRD without a home repository, and gets 403 starting a bug fix elsewhere |
| a dead key is refused | controller tests: no header, a wrong prefix, an unknown hash, a revoked key, a key whose maker left: each 401 with the error shape |
| the cursor | unit tests: encode and decode round trip, a tampered or foreign cursor is 422; a repository test paging 120 rows by 50 with rows added between pages, never repeating or skipping one |
| the contracts | unit tests with valid and invalid queries and bodies: `limit` 0, 101 and `abc`; a 201-character description; shell characters in the description |
| starting a bug fix | service tests through a fake runners port: the line built, the target passed, `sent_by` and `sent_by_key` set, a line the runners refuse is 422 with their reason |
| the job route | controller tests: a job of this workspace's key, another workspace's job is 404, a person's job is 404 |
| the reference | a test that every `app/api/v1/**/route.ts` is registered in `openapi.ts`, and that the document parses as OpenAPI 3.1 with `bearerAuth` on every route but `openapi.json` |
| the keys' rules in the database | `supabase/checks/api_keys.sql`: only an owner makes or revokes; a member lists without the hash; the 20-key limit; `api_key_of` refuses a revoked key and a key whose maker left; the hash is unique; a `business` or `kit` token is never answered by `api_key_of` |
| the page | component tests: an owner's and a member's view, no key yet, the secret shown once after making, Revoke |
| layering | `scripts/layering-guard.test.ts` and `scripts/import-guard.test.ts`, with no new baseline line |

By hand, once, on a preview: make a key, run each route's `curl` from `docs/guide/api.md`, start a
bug fix on a test repository with a runner online, and revoke the key.

## Risks

- **What merging publishes:**
  - the migration, on the next deploy of the database;
  - the routes, the reference and the Settings page, on the galaxy's next production deploy.

  Until an owner makes a key, nothing answers anyone but `openapi.json` and `/docs/api`.
- **A leaked key reads the workspace's PRD and bug titles and starts agent work.** It is only ever
  stored hashed, shown once, limited by its allow-list, named on every job it sends, and revoked in
  one click. Every job still ends in a pull request a person merges (N-PRODUCT-15).
- **A new dependency on the request path:** `@asteasolutions/zod-to-openapi` and `openapi3-ts`, used
  only to build the reference, never to validate a call.
- **Rollback:** revert the feature pull request. The routes, the page and the reference go, and
  every key stops working with the routes. The migration's rollback line revokes every `api` key:
  `update public.agent_tokens set revoked_at = now() where scope = 'api';`. The new column and
  functions can stay, unused, until a follow-up migration drops them.

**The locked laws it touches.** `omni kb laws` printed all 20 locked laws for these paths; the
design touches these:

- N-PRODUCT-17: a key's secret reaching any browser other than its maker's, once, would let anyone
  opening the app call the API as the workspace. Changing it needs @pierrederval to approve the pull
  request on GitHub.
- BR-PRODUCT-63: a key reading a repository outside its own workspace would let one team read
  another's private work. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-64: a key that kept working after its maker left would let a person who left keep
  reading and acting for the team. Changing it needs @pierrederval to approve the pull request on
  GitHub.
- N-PRODUCT-15: a job started by a key merging its own pull request would ship work nobody reviewed.
  Changing it needs @pierrederval to approve the pull request on GitHub.

The other 16 are not touched: no gate, label, answer, ask hook, install, ledger or session code
changes.

## Acceptance criteria

1. A workspace owner makes a key on `/app/settings/api-keys` and sees its secret once. Reloading the
   page shows it only as `oma_…<last four>`. A member sees the list with no **New key** and no
   **Revoke**.
2. `GET /api/v1/prds` with that key answers the workspace's PRDs, newest first, at most 50, with
   `next_cursor`. Following `next_cursor` until it is `null` returns every PRD exactly once.
3. `GET /api/v1/bug-fixes` does the same for the workspace's bug fixes.
4. A key limited to one repository never lists a PRD or a bug fix of another repository, and gets
   403 starting a bug fix on another repository.
5. `POST /api/v1/bug-fixes` with a repository and a description answers 202 with a job id. The job
   appears on the Runners page as sent by "API key <name>", and `GET /api/v1/jobs/{id}` follows it
   to `done` with the pull request's link.
6. A description the runners refuse (shell characters, over 200 characters) answers 422 naming the
   field, and nothing is queued.
7. A call with no key, a wrong key, a revoked key, or the key of an owner who left the workspace
   answers 401 with `{error: {code: "unauthorized", message}}`.
8. `GET /api/v1/openapi.json`, with no key, answers an OpenAPI 3.1 document listing every `/api/v1`
   route, and `/docs/api` renders it, each route with its parameters, responses and examples.
9. `docs/guide/api.md` shows in the docs site's menu, and each `curl` in it works against the
   preview with a real key.
