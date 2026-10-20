# Plan: A red outbox waits on your answers, then fixes with them

PRD #2223, spec in `spec.md` beside this plan. The feature branch `feat/outbox-waiting` goes into
`main` with `Closes #2223`; each slice is a sub-PR from `feat/outbox-waiting--<slice>` into the
feature branch, with `Part of #2223`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | A yolo job that ends on its hand-off's last line reads Waiting on answers, Held or Ready on the Runners page, with a PRD page link | `kit/lib/runner/` `apps/galaxy/src/runners/` `supabase/migrations/` `supabase/database.types.ts` | — | 1 | build |
| s2 | The PRD page's head says the feature PR is a draft and how many asked questions are answered, and offers Fix with answers once every one has a counted reply | `apps/galaxy/src/dossier/page/stage` `apps/galaxy/src/dossier/page/StageHeader` `apps/galaxy/src/dossier/page/render.test.ts` `apps/galaxy/src/dossier/page/demo` `apps/galaxy/src/dossier/page/dossier.css` `apps/galaxy/src/dossier/github/replies` `apps/galaxy/src/dossier/github/summary.ts` | — | 1 | build |

**Shared ground.** None: s1 owns the runner, its report, the job's column and the Runners page; s2
owns the PRD page's head and the replies it reads. `kit/dist/` is rebuilt by the wave, never listed.
s1's test that pins the yolo hand-off's three last lines reads `kit/plugin/skills/yolo/SKILL.md`
and changes nothing in it.

## Per slice: done when

### s1 (`ui: yes`)

- `runOutcome(log, prd)` in `kit/lib/runner/log.ts` reads the last non-empty line of the run's final
  message: `/omni:yolo-fix <prd>` → `answers`, `/omni:yolo <prd>` → `held`, `/omni:pr-care <prd>` →
  `ready`, anything else (another PRD's number, no final message) → `null`; tested on each, with
  trailing blank lines.
- `ended()` sends `outcome` on exit 0 for a `/omni:yolo` or `/omni:yolo-fix` line only; a failed,
  cancelled or timed-out job sends none (`runner.test.ts`).
- A test pins the three lines against the yolo skill's hand-off text, so a change there fails here.
- `JobUpdateSchema` takes `outcome: 'answers' | 'held' | 'ready' | null`; an unknown value is refused
  (`runners.contract.test.ts`).
- A new migration, dated after the newest on `main`, adds `runner_jobs.outcome text null` with its
  check; `supabase/database.types.ts` regenerated; `runners.migration.test.ts` reads the column.
- The service stores and reads it back (`runners.service.test.ts`, `runners.repository.test.ts`).
- The Runners page: `statusWords` reads Waiting on answers, Held or Ready for a done job with an
  outcome, in `--ask-plasma` (answers, held) or `--ask-green` (ready); such a job shows a **PRD page**
  link to `/prd/at/<owner>/<repo>/<n>` beside its PR link; a done job without one reads Done
  (`model.test.ts`, `render.test.ts`).

### s2 (`ui: yes`)

- `outboxStand(summary)` in `stage.ts` returns `{ asked, answered, answers }` for the open items
  ranked `high` or `human-action`, counting an item answered only when its reply is counted and not
  held as undetermined; `null` when the outbox or the replies were not read. `replies.ts` says which
  replies are held so it can tell (`replies.test.ts`).
- At `building` and `outbox`, with asked items open: the caption keeps `3/3 slices` and adds
  `1 of 2 answered`; the button is Answer the outbox until every asked item is answered, then a copy
  button **Fix with answers** for `/omni:yolo-fix <n>`, with Send to terminal, the caption
  `answered`, and `Fixes with 1: A · 4: B` under it linking the Outbox tab (`stage.test.ts`).
- With only medium items open, or the outbox or replies unread, the button and caption are today's.
- The feature PR's link reads `feature #<n> · draft` while the PR is a draft.
- `render.test.ts` renders the head in the three cases: waiting, answered, unread.
