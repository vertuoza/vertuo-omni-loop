# Plan: Fast PRD list and PRD page

PRD #2401, spec in `spec.md` beside this plan. The feature branch `feat/fast-prd-pages` merges into
`main` with `Closes #2401`; each slice is a sub-PR from `feat/fast-prd-pages--<slice>` into the
feature branch, with `Part of #2401`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | Both routes send `Server-Timing` naming each read, and `scripts/perf-prd.ts` measures median and p95; the before table is taken | `scripts/perf-prd*` `apps/galaxy/src/dossier/page/timing*` `apps/galaxy/app/prd/page.tsx` `apps/galaxy/src/dossier/page/DossierRoute.tsx` `apps/galaxy/src/dossier/page/source.ts` `apps/galaxy/src/dossier/page/source.test.ts` | — | 1 | build |
| s2 | Rows, filters, Clear and the PRD's tabs are `next/link`, prefetched, and a click shows the PRD's skeleton at once | `apps/galaxy/src/dossier/page/DossierHistory.tsx` `apps/galaxy/src/dossier/page/DossierPage.tsx` `apps/galaxy/src/dossier/page/history-render.test.ts` `apps/galaxy/src/dossier/page/render.test.ts` `apps/galaxy/app/prd/[id]/loading.tsx` | s1 | 2 | build |
| s3 | `dossier_list` filters by kind in SQL, `dossier_repos` serves the repository chips and the live pulse, and the slice count is read without the plan's body | `supabase/migrations/` `supabase/checks/dossier_` `apps/galaxy/src/dossier/store` `apps/galaxy/src/dossier/page/source.ts` `apps/galaxy/src/dossier/page/source.test.ts` `apps/galaxy/src/dossier/page/live` `apps/galaxy/src/data/dossiers` `apps/galaxy/app/prd/page.tsx` | s1 | 2 | deep |
| s4 | No waterfall: the list's reads start together, the PRD's shell streams without approval, send and runners, and the runners are read in one query | `apps/galaxy/src/dossier/page/DossierRoute.tsx` `apps/galaxy/src/dossier/page/source.ts` `apps/galaxy/src/dossier/page/source.test.ts` `apps/galaxy/src/runners/runners.repository` `apps/galaxy/app/prd/page.tsx` | s3 | 3 | build |

Shared ground: `apps/galaxy/app/prd/page.tsx`, `apps/galaxy/src/dossier/page/source.ts` and its test
are declared by s1, s3 and s4, and `DossierRoute.tsx` by s1 and s4; the waves 1, 2 and 3 keep them
apart. s2 shares nothing with s3, so both run in wave 2.

## Per slice: done when

### s1

- `/prd` and `/prd/<id>` responses carry `Server-Timing` with one entry per read (`viewer`,
  `dossier_list`, `scope`, `counts`, `dossier`, `approval`, …); a test proves the names.
- `scripts/perf-prd.ts <base> <id>` runs 20 requests per route and prints median and p95 time to
  first byte and to end; it refuses to run without `OMNI_PERF_COOKIE` and never prints the cookie; a
  test covers the maths and the refusal.
- The before table, measured against production, is in the sub-PR's body.

### s2 (`ui: yes`)

- Rows, filters, Clear and the PRD's tabs render as `next/link`; render tests prove it.
- `app/prd/[id]/loading.tsx` shows the skeleton on a client navigation.
- The list and the page look exactly as before.

### s3 (deep: a migration on the busiest read, under RLS)

- `dossier_list(p_kind => 'prd')` returns only PRDs, and every kind without it; a check in
  `supabase/checks/` proves it under RLS, and `dossier_list_volume.sql` still passes.
- `dossier_repos(p_dossier)` returns the same repositories `dossier_list(p_dossier)` did and nothing
  of another workspace; a check proves it.
- The list passes `'prd'`; the chips and the live pulse call `dossier_repos`.
- The slice count comes from the plan version's stored count, falling back to the body only for
  older versions; a test proves both paths.
- The migration is dated after the newest on `main`.

### s4

- On the list, the product scope and login ids start beside `dossier_list`.
- A PRD's shell renders while approval, send and runners are pending (each in `Suspense` with a
  skeleton); a test proves it.
- The fixing runners are read in one query; a repository test proves it.
- The answerable rounds start beside the five reads.
- The after table from `scripts/perf-prd.ts` shows each median at least 50% below the before one.
