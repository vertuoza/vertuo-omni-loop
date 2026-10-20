# Plan: A runner job waiting on answers fixes by itself once they are in

PRD #2270, spec in `spec.md` beside this plan. The feature branch `feat/fix-when-answered` goes into
`main` with `Closes #2270`; each slice is a sub-PR from `feat/fix-when-answered--<slice>` into the
feature branch, with `Part of #2270`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | Once every asked item is answered, the touch's read queues one `/omni:yolo-fix <n>` to the runner job that waited, linked as its continuation, while the repository's switch is on | `apps/galaxy/src/runners/continue` `apps/galaxy/src/runners/runners.` `apps/galaxy/src/touched/` `supabase/migrations/` `supabase/database.types.ts` | — | 1 | deep |
| s2 | The Runners page reads Answered · fixing / fixed, Answered with Fix with answers when the switch is off, and `after answers · job <id>` on the fix | `apps/galaxy/src/runners/page/` `apps/galaxy/app/api/runners/` | s1 | 2 | build |
| s3 | Settings › Repositories shows the Fix on a runner once answered switch, on by default, and saves it per repository | `apps/galaxy/src/repositories/` `apps/galaxy/app/app/settings/repositories/` `apps/galaxy/app/api/repositories/` | s1 | 2 | build |
| s4 | The PRD page's status line reads `fixing on <runner>` while the fix is queued or running | `apps/galaxy/src/dossier/page/stage` `apps/galaxy/src/dossier/page/view.ts` `apps/galaxy/src/dossier/page/render.test.ts` `apps/galaxy/src/dossier/page/DossierRoute.tsx` | s1 | 2 | build |

**Shared ground.** None between slices of one wave. s1 owns the migration (both columns), the
runners service, repository and contract (`apps/galaxy/src/runners/runners.*`), and the touch; s2, s3
and s4 read what s1 stores and change only their own page. `kit/dist/` is untouched.

## Per slice: done when

### s1 (deep: a job queued with no person pressing a button, once and only once)

- A migration, dated after the newest on `main`, adds `runner_jobs.continues uuid null references
  runner_jobs(id)` with a unique index, and `repositories.fix_when_answered boolean not null default
  true`; `supabase/database.types.ts` updated; `runners.migration.test.ts` reads both.
- `shouldContinue` (`apps/galaxy/src/runners/continue.ts`) decides from the PRD's `outboxStand`, its
  newest runner job, the jobs queued or running, and the switch, as the spec's five conditions say;
  each condition failing alone queues nothing (`continue.test.ts`).
- The service queues `/omni:yolo-fix <n>` to the job's runner or fleet, sent by its sender, with
  `continues` set; a second continuation of the same job is refused by the unique index and queues
  nothing (`runners.service.test.ts`).
- After a touch's dossier read, the decision runs and queues at most one fix (`touched.test.ts`).

### s2 (`ui: yes`)

- A done job with outcome `answers` reads Answered · fixing while its continuation is queued or
  running and Answered · fixed once it ended, linking it; the continuation reads `after answers · job
  <8 characters>` linking the job it continues (`model.test.ts`, `render.test.ts`).
- With the switch off and every asked item answered, the job reads Answered with **Fix with answers**,
  which sends `/omni:yolo-fix <n>` to the same runner with `continues` set (the send route takes it).

### s3 (`ui: yes`)

- Each repository card shows **Fix on a runner once answered**, on by default; whoever may change the
  other switches may change it, and it saves per repository (the repositories tests).

### s4 (`ui: yes`)

- While the PRD's fix job is queued or running, the status line reads `fixing on <runner>` in place
  of `answered` (`stage.test.ts`, `render.test.ts`).
