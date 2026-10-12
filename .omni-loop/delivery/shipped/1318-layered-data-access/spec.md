---
prd: 1318
title: Client → controller → service → repository, starting with the bell and the ask pages
blocked-by: none
spec: file
---

## Problem

The galaxy app (`apps/galaxy`) reaches Supabase from everywhere. Nineteen browser files build their own
Supabase client with the public key and read or write tables straight from the browser; nine client
components call `.from` or `.rpc` themselves. Row-level security keeps the data safe, but:

- A tab whose sign-in expired keeps asking the database, which refuses every read: about 430
  `42501 permission denied` an hour from one forgotten tab (bug #1316, fixed for the bell only).
- Every browser is coupled to the tables' shape: a column renamed breaks open tabs, and nothing on
  the server can check, throttle, cache or log a read.
- There is no single answer to "where does this rule live?". The server half-follows a pattern
  (45 API routes, 32 `store.ts` / `source.ts` modules, no page querying directly), and nothing
  enforces it. Agents build this repository, and an import that compiles is an import they keep
  (ADR-0058).

vertuo-ai-domain already settled this for its own code (`libs/LIBRARY_STYLE_RULES.md` §5):
**Controller → Service → Repository → Database**, only `*.repository.ts` touches the database, zod
contracts at every boundary, one typed client in the UI, enforced by a script.

## Solution

The galaxy app adopts the same layering, inside its feature folders (`apps/galaxy/src/<area>/`):

| role | file | may | must not |
|---|---|---|---|
| contract | `<area>.contract.ts` | zod schemas of each request and response, and the error shape; browser-safe | import anything server-only |
| client | `<area>.client.ts` | `fetch` its area's routes, parse every response with the contract | import a controller, service, repository or `@supabase/*` |
| controller | `<area>.controller.ts` | check the session first, parse the input with the contract, call services, map results and refusals to HTTP | import a repository or `@supabase/*`; reach the database |
| service | `<area>.service.ts` | hold the rules, call one or more repositories, own a flow across them | import `@supabase/*`, HTTP types, or another area's repository |
| repository | `<area>.repository.ts` | call `.from` / `.rpc` / `.storage` on the client it is given | import another repository or a service; hold a rule |

- `app/api/**/route.ts` only re-exports a controller's handlers. A **server page** is a controller: it
  checks the session, then calls services, never a repository.
- **One module builds the database client** (`apps/galaxy/src/data/db.ts`): the signed-in person's
  client from the request's cookies, or the service-role client for the repositories ADR-0051 names.
  Only repositories import it.
- **The session is checked first, without the database:** a controller reads the claims locally
  (`getClaims`, as `viewer()` does). None → `401 {"error":"signed-out"}`, and no service runs.
- **Sign-in stays on Supabase Auth in the browser,** in one allowed module
  (`apps/galaxy/src/data/sign-in.client.ts`): signing in and out is authentication, not data.
- **Row-level security stays** as the second wall: repositories read as the signed-in person.

**The guard.** A new check, `scripts/layering-guard.test.ts`, reads every tracked TypeScript file under
`apps/galaxy` and refuses, naming the file and the rule:

1. a `.from(`, `.rpc(` or `.storage` call on a Supabase client in a file not named `*.repository.ts`;
2. a repository importing another repository or a service;
3. a service importing `@supabase/*` or the database module;
4. a controller (or a server page, or `app/api/**/route.ts`) importing a repository, `@supabase/*` or
   the database module;
5. a `'use client'` file importing a controller, a service, a repository, `@supabase/*` or the database
   module, other than the sign-in module.

Today's breaches are listed in `layering/baseline.json`, one line per file and rule. The check fails on
a breach the baseline does not list, **and on a baseline line whose breach is gone**, so the list only
shrinks. This PRD writes the rule, the check and the baseline, and moves two areas off it:

- **The waiting list (the bell),** `src/waiting`: `GET /api/waiting/questions` and
  `GET /api/waiting/documents` replace the browser's Supabase reads; the outbox and business parts
  already use routes.
- **The ask pages,** `src/ask`: `GET /api/ask/tabs`, `GET /api/ask/sessions/:id` and
  `GET /api/ask/rounds/:id` replace the pages' 2 s polls; answering, sharing and abandoning go through
  the existing `/api/ask/*` routes, whose controllers now take the cookie session as well as the
  terminal's bearer token, so the browser and the CLI share one service.

**Screenshots** (PRD 620) go through the controller: one screenshot per `POST`, at most **4 MB**, under
Vercel's 4.5 MB request cap. A migration lowers the `ask-attachments` bucket's `file_size_limit` from
5 MB to 4 MB to match. The client refuses a larger file before sending it, with the controller's own
message.

**Errors** have one shape, `{"error": <kind>}`, in the contract:

| status | kind | the client |
|---|---|---|
| 401 | `signed-out` | stops every poll of the page and shows the sign-in card; nothing is asked again until a reload |
| 403 | `not-a-member` | shows not found, as today |
| 404 | `not-found` | shows not found, as today |
| 413 | `too-large` | says the screenshot is over 4 MB |
| 422 | `invalid` | names the field (a client bug) |
| 500 | `database` | keeps the last good data, marks the part unread, logs once, as today |

Polling keeps today's pace: the bell 5 s visible / 15 s hidden, New documents 10 s, the ask pages 2 s.

## Decisions

- **The layering of vertuo-ai-domain, inside feature folders** (asked: the person pointed at
  vertuo-ai-domain). Files keep living beside their feature; the role is the file's suffix. Top-level
  layer folders and Server Actions were weighed and set aside: the first scatters every feature, the
  second gives two kinds of controller (the polls and the terminal need HTTP routes).
- **Reads and writes** both move (asked). Sign-in and sign-out stay on Supabase Auth in the browser.
- **A shrinking baseline, not a big bang** (asked; the voice's objection, accepted): fourteen browser
  areas break the rule today. They stay listed, so an old file never blocks a feature PR; only new code
  and the areas this PRD moves must follow the rule. Each later PRD moves one area and deletes its lines.
- **A separate check, not a new row in ADR-0058's guard:** the import guard has "no allowlist, no
  comment escape"; this check starts with a baseline, so it is its own test, and a new ADR records the
  rule. ADR-0058 is unchanged.
- **Screenshots through the controller, capped at 4 MB** (asked): signed upload URLs were offered and
  declined. The bucket's limit drops to 4 MB with them.
- **Same polling pace** as today: moving behind routes changes where a read goes, not how often.
- **No proof video** (asked).
- **The voice:** Paul – Product Manager objected to a refactor that ships nothing customers see and
  could block feature PRs (persona:Paul - Product Manager). Settled `accepted`: the baseline means old
  files never block a feature PR, and this PRD moves only two areas.

## User stories

- As a member with a tab left open after my sign-in expired, my tab stops asking the database: the
  bell and the ask page go quiet and show the sign-in card.
- As a member answering a question on an ask page, everything I see and do works as today, screenshots
  included, up to 4 MB each.
- As an engineer (or an agent) adding a feature to the galaxy app, I know where each piece goes, and
  the check tells me, by file and rule, when I put a database call or an import in the wrong layer.
- As a lead engineer, I can read one table and one baseline to see how far the app follows the rule.

## Scope

In:

- The five roles, their naming, and `apps/galaxy/src/data/db.ts` as the one database module.
- `scripts/layering-guard.test.ts`, its fixtures, and `layering/baseline.json` listing today's breaches.
- A new ADR recording the layering rule and its baseline.
- The waiting list (`src/waiting`): its Questions and New documents reads behind `/api/waiting/*`, a
  `waiting.client.ts`, and `WaitingProvider` with no Supabase client.
- The ask pages (`src/ask`): their reads behind `/api/ask/*` GET routes, answering, sharing and
  abandoning through controllers shared with the terminal, screenshots through the controller.
- `SignInCard`'s sign-out moves into the sign-in module.
- The migration lowering `ask-attachments` to 4 MB.
- The architecture playbook form (`omni kb show architecture`) and the galaxy README name the rule.

Out:

- The other fourteen browser areas (arcade, business, fleets, products, repositories, ideas, dossier
  page, agent questions, home, nav, …): they stay on the baseline, each for its own PRD.
- `apps/omni-app` and the kit CLI: their Supabase calls are not the galaxy app's and are untouched.
- Realtime, caching, rate limits: none today, none added.

## Test seams

Follow `omni kb show testing`: tests beside the code, the narrowest level that proves the risk.

- **The check:** `scripts/layering-guard.test.ts` proves each of its five rules on a fixture tree first
  (each breach refused, naming file and rule; each allowed shape accepted), then the baseline rules (a
  new breach fails, a stale baseline line fails), then runs on every tracked file.
- **Controllers:** with fake services; signed out → 401 `signed-out` and the service never called;
  invalid input → 422 naming the field; a refusal → 403/404; a failed repository → 500 `database`;
  bearer and cookie both accepted on the shared ask routes.
- **Services:** with fake repositories (today's `store.fake.ts`), no HTTP, no Supabase.
- **Repositories:** today's `supabase/checks/*.sql` and `pnpm schemas:verify` stay their proof.
- **Clients:** with a fake `fetch`: 401 stops the poll and reports signed-out; 500 keeps the last data;
  a screenshot over 4 MB is refused before any request.
- **Characterization first:** before moving an ask read, its current output on the fakes is pinned, so
  the move is proven to change nothing a person sees.

## Risks

- **What a merge publishes:** the galaxy app (Vercel) and one migration (the bucket limit), applied by
  the `supabase` workflow's `deploy` job. A screenshot between 4 and 5 MB, accepted today, is refused
  after it. Rolled back by reverting the PR and a migration restoring the 5 MB limit.
- **More function calls:** each poll now runs a Vercel function as well as a database read. The
  pace is unchanged, so the database sees the same reads, minus a signed-out tab's.
- **The terminal's routes change underneath:** the CLI's `/api/ask/*` calls must keep working with a
  bearer token; the controller tests cover both, and `omni ask` is run against a preview before ready.
- **A baseline that is wrong** would hide a breach: it is generated by the check itself, and reviewed
  in this PRD's PR.

## Acceptance criteria

- `scripts/layering-guard.test.ts` refuses each of the five breaches on its fixtures, naming the file
  and the rule, and accepts each allowed shape.
- The check fails when a breach is not in `layering/baseline.json`, and when a baseline line's breach
  no longer exists.
- No file under `apps/galaxy/src/waiting` or `apps/galaxy/src/ask` is on the baseline.
- No `'use client'` file under `src/waiting` or `src/ask` imports `@supabase/*`; the count of
  browser files building a Supabase client drops from 19 to 14.
- Every `.from`, `.rpc` and `.storage` call under `src/waiting` and `src/ask` sits in a
  `*.repository.ts`.
- `GET /api/waiting/questions`, `GET /api/waiting/documents`, `GET /api/ask/tabs`,
  `GET /api/ask/sessions/:id` and `GET /api/ask/rounds/:id` answer a signed-out request with
  `401 {"error":"signed-out"}` and call no service.
- A signed-out bell or ask page stops polling after its first 401 and shows the sign-in card.
- A signed-in member sees the bell and the ask pages as today: the same items, the same pace, the same
  answers and shares, screenshots up to 4 MB.
- A screenshot over 4 MB is refused in the browser before any request, and by the controller with 413
  `too-large`; the `ask-attachments` bucket's limit is 4 MB.
- The terminal (`omni ask`) still opens sessions, asks rounds and reads answers with its bearer token.
- A new ADR records the layering rule and its shrinking baseline; the architecture form points at it.
