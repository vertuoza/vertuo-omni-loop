# ADR-0095 — The galaxy app layers client → controller → service → repository, checked against a shrinking baseline

**Status:** accepted · **Date:** 2026-10-09 · **PRD:** #1318

## Context

The galaxy app (`apps/galaxy`) reached Supabase from everywhere: nineteen browser files built their
own client with the public key, nine client components called `.from` or `.rpc` themselves, and the
server half-followed a pattern (API routes, `store.ts` and `source.ts` modules) that nothing
enforced. A tab whose sign-in expired kept asking the database (bug #1316), every open tab was
coupled to the tables' shape, and there was no single answer to "where does this rule live?".
Agents build this repository, and an import that compiles is an import they keep (ADR-0058).

vertuo-ai-domain settled the same question for its own code in `libs/LIBRARY_STYLE_RULES.md` §5:
Controller → Service → Repository → Database, only a repository touches the database, contracts at
every boundary, one typed client in the UI, enforced by a script. PRD 1318 adopts it for the galaxy
app.

## Decision

1. **Five roles, named by the file's suffix, inside the feature folders** (`apps/galaxy/src/<area>/`):

   | role | file | may | must not |
   |---|---|---|---|
   | contract | `<area>.contract.ts` | zod schemas of each request and response, and the error shape `{"error": <kind>}`; browser-safe | import anything server-only |
   | client | `<area>.client.ts` | `fetch` its area's routes, parse every response with the contract | import a controller, service, repository or `@supabase/*` |
   | controller | `<area>.controller.ts` | check the session first, parse the input, call services, map results and refusals to HTTP | import a repository or `@supabase/*`; reach the database |
   | service | `<area>.service.ts` | hold the rules, call one or more repositories | import `@supabase/*`, HTTP types or another area's repository |
   | repository | `<area>.repository.ts` | call `.from` / `.rpc` / `.storage` on the client it is given | import another repository or a service; hold a rule |

   `app/api/**/route.ts` only re-exports a controller's handlers; a server page (`app/**/page.tsx`) is a
   controller.
2. **One database module,** `apps/galaxy/src/data/db.ts`: the signed-in person's client from the
   request's cookies (`userDb`), and the service role's client (`serviceRoleDb`) for the reads
   ADR-0051 names. Only repositories import it. Row-level security stays the second wall. Until every
   caller moves to it, `db.ts` wraps the cookie builder of `src/data/supabase-server.ts`, and the
   check counts both as database modules.
3. **The session is checked first, without the database:** a controller reads the claims locally;
   none answers `401 {"error":"signed-out"}`, and no service runs.
4. **Sign-in stays on Supabase Auth in the browser,** in one allowed module,
   `apps/galaxy/src/data/sign-in.client.ts`: signing in and out is authentication, not data.
5. **The check,** `scripts/layering-guard.test.ts`, reads every TypeScript file git tracks under
   `apps/galaxy` (tests and `*.fake.ts` excepted) and refuses, naming the file, the line and the rule:
   `database-call` (a `.from(` or `.rpc(` outside a repository, a bucket's `.storage.from(` included),
   `repository-import`, `service-import`, `controller-import` and `client-import` (a `'use client'`
   file or a `*.client.ts`, the sign-in module excepted). A type-only import counts.
6. **A shrinking baseline,** `layering/baseline.json`: today's breaches, one line per file and rule,
   written by the check itself. The check fails on a breach the baseline does not list, and on a
   baseline line whose breach is gone, so the list only shrinks: an old file never blocks a feature,
   and each later PRD that moves an area deletes its lines.

## Consequences

- ADR-0058 and its import guard are unchanged: that guard has no allowlist and no comment escape,
  and this one starts from a baseline, so it is a check of its own. vertuo-ai-domain's
  `libs/LIBRARY_STYLE_RULES.md` §5 is unchanged too: this record adopts it, it does not amend it.
- New code in the galaxy app follows the roles from the start: a database call or an import in the
  wrong layer fails the test suite, by file and rule.
- The baseline is the measure of how far the app follows the rule; PRD 1318 moves the ask pages and
  the bell off it, and each other browser area is its own later PRD.
- A file's role comes from its name, so a misnamed file escapes the role rules (not the
  `database-call` rule, which holds for every non-repository file).
- The ask actions the page and the terminal share (answer, delete, sort, share, upload) stay in
  `src/ask/api.ts`, one module that checks the caller (terminal token or page sign-in) and acts,
  and keep their plain-words `{error}` refusals, which the kit's terminal client reads. Only their
  database calls moved into repositories. Splitting them into a controller and a service is a later
  change, not a breach (PRD 1318, s3-03).
