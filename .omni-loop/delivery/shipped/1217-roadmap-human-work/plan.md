# Plan: a roadmap lists all its human work, by kind

PRD #1217, spec beside this plan (`spec.md`). The feature branch `feat/roadmap-human-work` merges into
`main` with `Closes #1217`; each slice is a sub-PR from `feat/roadmap-human-work--<slice>` into the
feature branch with `Part of #1217`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `omni roadmap push` sends `humanWork`: each person question, human-action and high outbox item, park line and needs-clarification comment as an entry with its key, repository, text, act, link and rule kind; `/omni:plan` marks its needs-clarification comment | `kit/lib/roadmap/human-work` `kit/lib/roadmap/push` `kit/bin/commands/roadmap` `kit/plugin/skills/plan/` `kit/plugin/skills/ultra-yolo/` | — | 1 |
| s2 | The app stores a push's `humanWork` in `roadmap_human_work` with its rule kind: a new key kept once, a missing key done, a returning key reopened, a push without the field closing nothing | `supabase/migrations/20261113090000_roadmap_human_work` `supabase/checks/roadmaps.sql` `apps/galaxy/src/roadmap/api` `apps/galaxy/src/roadmap/store` `apps/galaxy/src/roadmap/migration.test.ts` `apps/galaxy/app/api/roadmaps/` | — | 1 |
| s3 | Jev's `hitl-category` decision classifies each new key, Off / Shadow / On, keeping the rule kind on Off, on an error or on an answer outside the four | `apps/galaxy/src/jev/decisions/hitl-category` `apps/galaxy/src/jev/decisions/index.ts` `supabase/migrations/20261113100000_hitl_category` `supabase/checks/jev.sql` `apps/galaxy/src/roadmap/api` `apps/galaxy/src/roadmap/classify-jev` | s2 | 2 |
| s4 | The roadmap page shows the Human work item (counts per kind, open entries grouped by kind with their act, done entries folded, the empty line) and each list card the open counts per kind; the guide says so | `apps/galaxy/src/roadmap/page/` `docs/guide/roadmaps.md` | s2 | 2 |

**Shared ground.** `apps/galaxy/src/roadmap/api` is declared by s2 (it takes and stores the field)
and by s3 (it asks the classifier for each new key): s3 is in wave 2, after s2, so they never merge in
the same wave. `kit/dist/` is generated and rebuilt by the wave, never listed.

## Per slice: done when

**s1**
- `human-work.ts`'s tests turn fixture inputs of each source into entries with the spec's keys,
  texts, acts and links; a settled source gives no entry.
- Every rule-kind rule is tested: a question is business, secret/token/scope/permission is dev-ops
  before deploy/production/migration/console is delivery-ops, anything else development.
- `push.test.ts`'s body carries `humanWork`, read through the `gh` and `git` functions handed in, for
  a single repository and a plan repository.
- `/omni:plan` (and `/omni:ultra-yolo`'s plan step) post the needs-clarification comment starting
  with `<!-- omni-needs-clarification -->`.

**s2**
- `supabase/checks/roadmaps.sql`: a push stores each new key with its rule kind and `kind_by = 'rule'`;
  a key missing from the next push is done with its `done_at`; a key that comes back is open again;
  a push without `humanWork` changes nothing stored; a non-member reads no row.
- The route and `api.test.ts` accept a body with or without `humanWork` and refuse a malformed entry.
- `migration.test.ts` names the new table, its columns and `roadmap_push` as its one writer.

**s3**
- `hitl-category.test.ts`: the state it reads (source, text, act, repository, PRD title); an answer
  among the four kept, any other dropped.
- `api.test.ts`: On stores Jev's kind with `kind_by = 'jev'`; Shadow and Off keep the rule kind; a Jev
  error keeps the rule kind and the push succeeds; a key already stored is never classified again.
- The decision shows on the Jev settings page, Off by default.

**s4**
- `render.test.ts`: the Human work item shows a chip per kind with its open count, open entries
  grouped by kind with PRD, repository, text, act and link, done entries folded with when they were
  settled, and `No human work recorded yet.` with none.
- The list card shows the open count of each kind that has one, and nothing for a kind with none.
- `docs/guide/roadmaps.md` describes the Human work item, the four kinds and the classifier.
