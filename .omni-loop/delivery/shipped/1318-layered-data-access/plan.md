# Plan: client → controller → service → repository, starting with the bell and the ask pages

PRD #1318, spec in `spec.md` beside this plan. The feature branch `feat/layered-data-access` goes into
`main` with `Closes #1318`; each slice is a sub-PR from `feat/layered-data-access--<slice>` into the
feature branch, with `Part of #1318`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The rule and its check: the five roles, `scripts/layering-guard.test.ts` proving each rule on fixtures and then running on every tracked file under `apps/galaxy`, `layering/baseline.json` listing today's breaches (a new breach and a stale line both fail), the one database module `src/data/db.ts`, the sign-in module `src/data/sign-in.client.ts` taking `SignInCard`'s sign-out, the new ADR, and the architecture form and galaxy README naming the rule | `scripts/layering-guard` `scripts/fixtures/layering/` `layering/` `apps/galaxy/src/data/db.ts` `apps/galaxy/src/data/sign-in.client` `apps/galaxy/src/ask/page/SignInCard.tsx` `.omni-loop/knowledge/adr/` `.omni-loop/knowledge/playbook/architecture.md` `apps/galaxy/README.md` | — | 1 |
| s2 | The ask pages read through controllers: `ask.contract.ts`, `ask.repository.ts`, `ask.service.ts`, `ask.controller.ts` and `ask.client.ts` for the reads; `GET /api/ask/tabs`, `GET /api/ask/sessions/:id` and `GET /api/ask/rounds/:id`; `AskPage`, `AskSession` and `AskQuestion` poll through `ask.client.ts` at today's pace, stop on 401 and show the sign-in card; their baseline lines are removed | `apps/galaxy/src/ask/` `apps/galaxy/app/api/ask/tabs/` `apps/galaxy/app/api/ask/sessions/[id]/route.ts` `apps/galaxy/app/api/ask/rounds/[id]/route.ts` `layering/baseline.json` | s1 | 2 |
| s3 | Answering, sharing and abandoning go through controllers the browser and the terminal share: the existing `/api/ask/*` write routes take the cookie session or the bearer token and call `ask.service.ts`; screenshots go one per `POST`, at most 4 MB, refused in the browser and with 413 `too-large` by the controller; a migration lowers the `ask-attachments` bucket to 4 MB; `RoundForm` and `ShareButton` call `ask.client.ts`; the ask folder leaves the baseline | `apps/galaxy/src/ask/` `apps/galaxy/app/api/ask/` `supabase/migrations/` `supabase/checks/ask.sql` `layering/baseline.json` | s2 | 3 |
| s4 | The bell reads through controllers: `waiting.contract.ts`, `waiting.service.ts` (over `ask.service.ts` and a `waiting.repository.ts` for the documents), `waiting.controller.ts` and `waiting.client.ts`; `GET /api/waiting/questions` and `GET /api/waiting/documents`; `WaitingProvider` builds no Supabase client, polls at today's pace and stops on 401; the waiting folder leaves the baseline and the browser-client count reads 14 | `apps/galaxy/src/waiting/` `apps/galaxy/app/api/waiting/questions/` `apps/galaxy/app/api/waiting/documents/` `apps/galaxy/src/data/viewer.ts` `layering/baseline.json` | s2 | 4 |

**Shared ground.**

- `layering/baseline.json` is declared by s1 (which writes it) and by s2, s3 and s4 (each deletes the
  lines of what it moved). They sit in waves 1, 2, 3 and 4, so each edits it after the one before has
  merged.
- `apps/galaxy/src/ask/` is declared by s2 and s3 (waves 2 and 3), and s1 owns one file in it,
  `apps/galaxy/src/ask/page/SignInCard.tsx` (wave 1).
- `apps/galaxy/app/api/ask/` is s3's; s2 declares only its two new GET route files and the new `tabs/`
  folder inside it, in the wave before.
- Names other areas import from `src/ask` and `src/waiting` (about a hundred files: the dossier page,
  the dashboards, the nav) keep working from their old paths. A slice moves a database call into a
  repository and leaves a re-export where an out-of-scope area still imports the name, so no file
  outside the territories changes. Those areas stay on the baseline.

## Per slice: done when

**s1**

- `scripts/layering-guard.test.ts` refuses each of the five breaches on its fixtures under
  `scripts/fixtures/layering/`, naming the file and the rule, and accepts each allowed shape (a
  repository calling `.from`, a controller importing a service, a client importing a contract, the
  sign-in module calling `auth`).
- It fails on a breach `layering/baseline.json` does not list, and on a baseline line whose breach is
  gone; with today's code and the written baseline, it passes.
- `apps/galaxy/src/data/db.ts` builds the signed-in person's client from the request's cookies and the
  service-role client; `SignInCard` signs out through `sign-in.client.ts` and builds no Supabase
  client.
- A new ADR records the layering rule and its shrinking baseline, citing vertuo-ai-domain's
  `libs/LIBRARY_STYLE_RULES.md` §5 and ADR-0058 as unchanged; the architecture form's Boundaries and
  the galaxy README name the five roles and the check.
- `pnpm test`, `pnpm typecheck` and `pnpm lint` are green.

**s2**

- Characterization first: the ask pages' current reads (the tabs, a session with its rounds, a round
  with its session and shares) are pinned on the fakes, and the same results come back through the
  service after the move.
- `GET /api/ask/tabs`, `GET /api/ask/sessions/:id` and `GET /api/ask/rounds/:id` answer a signed-out
  request with `401 {"error":"signed-out"}` and call no service; another workspace's session or round
  gives 404 `not-found`; a failed read gives 500 `database`.
- `AskPage`, `AskSession` and `AskQuestion` import no `@supabase/*`, poll every 2 s through
  `ask.client.ts`, parse each response with `ask.contract.ts`, stop every poll after a 401 and show the
  sign-in card, and keep the last data on a 500.
- Every `.from`, `.rpc` and `.storage` call the ask reads make sits in `ask.repository.ts`; the check
  passes with the moved reads' baseline lines removed.

**s3**

- The answer, share, abandon, close and category routes under `/api/ask/` accept the cookie session as
  well as the terminal's bearer token, both proven by controller tests; `omni ask` still opens
  sessions, asks rounds and reads answers with its bearer token against a preview.
- A screenshot over 4 MB is refused by `ask.client.ts` before any request, and by the controller with
  413 `too-large`; one at or under 4 MB is stored and recorded with the answer, as today.
- A migration sets the `ask-attachments` bucket's `file_size_limit` to 4194304, and
  `supabase/checks/ask.sql` proves it.
- `RoundForm` and `ShareButton` call `ask.client.ts`; no `'use client'` file under `src/ask` imports
  `@supabase/*` apart from the sign-in module; no file under `src/ask` is on the baseline.

**s4**

- `GET /api/waiting/questions` and `GET /api/waiting/documents` answer a signed-out request with
  `401 {"error":"signed-out"}` and call no service; a signed-in member gets the same items the
  browser read before, proven on the fakes.
- `WaitingProvider` imports no `@supabase/*`, reads through `waiting.client.ts` every 5 s visible and
  15 s hidden (questions) and every 10 s (documents), stops both polls after a 401, and keeps the last
  items and marks the part unread on a 500.
- The server's first paint (`src/data/viewer.ts`) reads the Questions part through
  `waiting.service.ts`.
- No file under `src/waiting` is on the baseline, and the check counts 14 browser files building a
  Supabase client.
- `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm schemas:verify --local` are green.
