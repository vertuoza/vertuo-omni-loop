# Plan: A new rule's id is never taken twice

PRD #3015, its spec beside this plan (`spec.md`). The feature branch `feat/rule-ids-never-collide`
goes into `main` through one draft feature PR (Closes #3015); each slice is a sub-PR from its slice
branch into the feature branch (Part of #3015).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `omni kb next-id <prefix>` prints the next free id past the tree, the base and every open pull request into the default branch, through the pure `nextFreeId` | `kit/lib/knowledge/next-id` `kit/bin/commands/kb.ts` `kit/bin/kb-next-id` `kit/lib/help/entries.ts` | — | 1 | build |
| s2 | the knowledge harvest numbers past every open pull request into the default branch, not only knowledge branches | `apps/omni-app/src/knowledge-harvest/github` | — | 1 | build |
| s3 | `omni check knowledge` refuses an id new on this branch that the base holds with other words, naming the next free id; with no base it says ids were not compared; `omni check all` passes its base | `kit/lib/knowledge/id-clash` `kit/bin/commands/check.ts` `kit/bin/check-knowledge-ids` `kit/lib/help/entries.ts` | s1 | 2 | deep |
| s4 | `/omni:yolo-fix` takes a new entry's id from `omni kb next-id` | `kit/plugin/skills/yolo-fix/SKILL.md` | s1 | 2 | light |

Shared ground: `kit/lib/help/entries.ts` is declared by s1 (the `next-id` usage) and s3 (the
`--base` of `omni check knowledge`); s3 waits on s1, so they sit in waves 1 and 2. No other prefix is
shared. `kit/dist/` and `apps/omni-app/api/` are generated: no slice lists them, and the wave rebuilds
them once after merging.

## Per slice: done when

### s1

- `nextFreeId('BR-PIPELINE', sets)` returns one past the highest number across every set, and
  ignores ids of other prefixes; a prefix `idParts()` cannot split is refused.
- `omni kb next-id BR-PIPELINE` prints `BR-PIPELINE-48` when the base holds 46 and an open pull
  request into the default branch adds 47 (AC-1), read through a fake `exec` answering `git` and
  `gh`; `--json` prints `{ id, past }`, naming where the highest number came from.
- With `gh` failing, it prints `BR-PIPELINE-47`, exits 0, and stderr says the open pull requests were
  not read (AC-2); with no base either, it says so on the same line and numbers past the tree.
- `omni help kb` lists the verb.

### s2 (`ui: yes`)

- `takenElsewhere()` returns the ids of every open pull request into the default branch, a feature
  branch's included, and still leaves out the run's own branch, against the fake Octokit its tests
  use.
- A harvest whose other open pull request (a feature branch) adds BR-PIPELINE-47 writes its new
  pipeline rule as BR-PIPELINE-48 (AC-5).

### s3 (deep: compares the base as it is now against the merge base, a subtle range)

- `omni check knowledge --base origin/main` on a repository whose `origin/main` holds BR-PIPELINE-47
  with other words than the branch's new BR-PIPELINE-47 is red, naming the base's statement and
  BR-PIPELINE-48 as the id to renumber to (AC-3).
- An entry the branch rewords in place (there at the merge base) keeps its id and stays green (AC-4);
  the same id with the same statement on both sides is green.
- With no readable base, it prints `ids not compared — no <base>` and grades the rest as before
  (AC-6); `omni check all` passes its base.

### s4 (light: one sentence of a skill)

- `/omni:yolo-fix`'s **Write back what was just settled** says a new rule, invariant or principle
  takes the id `omni kb next-id <prefix>` prints, never one read off the branch; an amended entry
  keeps its id.
