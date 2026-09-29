# Plan: Fast fix lists — Bug Fixes and Visual Updates read stored GitHub facts

PRD #691, spec in `spec.md` beside this plan. It is built on `feat/fast-fix-lists`, which merges into
`main` with `Closes #691`. Each slice is a sub-PR from `feat/fast-fix-lists--<slice>` into the
feature branch, with `Part of #691`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The `fix_facts` table (migration, SQL check) and its store and fake. `refreshFixFacts(workspace, fixes, deps)` reads each fix through the reader and stores it: an `UNREAD` part keeps the stored value, and a fix with a stored release is not read | `supabase/migrations/20261013090000_fix_facts` `supabase/checks/fix_facts.sql` `apps/galaxy/src/fixes/facts/` | — | 1 |
| s2 | The stages sync refreshes, per workspace, the facts of every fix dossier that has no stored release | `apps/galaxy/src/stages/sync/` | s1 | 2 |
| s3 | `/bugs` and `/visual` read `fix_facts` and make no GitHub call. They read the user through `viewer()` and each has a `loading.tsx`. A fix's own page writes the facts it read back to `fix_facts` | `apps/galaxy/src/fixes/FixListRoute` `apps/galaxy/src/fixes/list` `apps/galaxy/src/fixes/routes.test.ts` `apps/galaxy/src/dossier/page/DossierRoute` `apps/galaxy/app/bugs/` `apps/galaxy/app/visual/` | s1 | 2 |

**Shared ground:** there is none. `apps/galaxy/src/fixes/facts/` is s1's alone; s3 declares only
the list files (`FixListRoute`, `list`) and `routes.test.ts`, which covers both the lists and the
fix pages, so the write-back sits in s3 with the list rather than in a slice of its own. s2 and s3
both import s1's module and run in wave 2, after it.

## Per slice: done when

**s1 · The store**

- Migration `20261013090000_fix_facts.sql`: `fix_facts(dossier_id uuid primary key references
  dossiers on delete cascade, workspace_id uuid not null, facts jsonb not null, synced_at timestamptz
  not null)`. Row-level security: members read their workspace (`is_member`), and only the service
  role writes. `supabase/checks/fix_facts.sql` proves both, and that a member of another workspace,
  a person in no workspace and anyone signed out read nothing.
- `src/fixes/facts/store.ts` with `readFacts(workspace, ids)` and `writeFacts(rows)`, and a fake
  beside it.
- `refresh.test.ts` with a stubbed reader and the fake store:
  - a fix is read and stored;
  - an `UNREAD` part keeps the stored part;
  - a whole read that fails keeps the row;
  - a fix whose stored facts hold a release is not read.

**s2 · The sync refreshes**

- A sync test (stubbed GitHub, fake stores): per workspace, `refreshFixFacts` is called with every
  fix dossier (kind visual or bug) that has no stored release. A refresh that throws is logged and
  does not fail the sync.

**s3 · The lists read the store**

- `routes.test.ts`, with a reader that throws on any call:
  - `/bugs` and `/visual` render their rows with the stored facts;
  - a fix with no row shows `—`;
  - "Mine" falls back to `opened_by`.
- `fixListRoute` reads the user through `viewer()`, and a test greps that it never calls
  `auth.getUser`.
- `app/bugs/loading.tsx` and `app/visual/loading.tsx` exist and render the list skeleton from
  `src/skeleton/`.
- A fix page (`/bugs/<id>`, `/visual/<id>`) that read its facts live writes them to `fix_facts`. The
  write is not awaited by the render, and a failed write is only logged.
