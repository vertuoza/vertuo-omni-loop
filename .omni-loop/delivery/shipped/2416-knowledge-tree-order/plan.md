# Plan: One resolution order for the knowledge tree

PRD #2416, spec beside this plan (`spec.md`). The feature branch `feat/knowledge-tree-order` goes
into `main` through the feature PR (`Closes #2416`); each slice is a sub-PR from
`feat/knowledge-tree-order--<slice>` into the feature branch (`Part of #2416`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | One resolver reads a playbook section through the tree, bottom-up: the repository's, else the plan repository's copy, else the Omni settings' copy, else the kit default, each tagged with its level; a repository with no other level reads exactly as today | `kit/lib/knowledge-tree/` `kit/lib/playbook/resolve.` `kit/bin/kb.test.ts` | — | 1 | deep |
| s2 | `omni kb status` counts each form's sections per level | `kit/lib/playbook/status.` `kit/bin/commands/kb.ts` `kit/bin/kb.test.ts` | s1 | 2 | build |
| s3 | `omni kb show decisions` lists each record with its level, a repository's own first, then the plan repository's and the Omni settings' records it does not hold | `kit/lib/playbook/decisions.` `kit/lib/budgets/measure.` `kit/bin/kb-decisions.test.ts` | s1 | 2 | build |
| s4 | Product knowledge reads top-down: every level's register entries apply, the highest first, and a lower entry that contradicts a higher one makes `omni check knowledge` red, naming both | `kit/lib/knowledge-tree/product` `kit/lib/knowledge/check-knowledge.` `kit/bin/check-knowledge-levels.test.ts` | s1 | 2 | deep |

**Shared ground.**

- `kit/lib/knowledge-tree/`: s1 creates the module (the levels, where each level's local copy lies,
  the tech-side order) and owns all of it; s4 adds only files starting `kit/lib/knowledge-tree/product`
  and reads s1's levels without changing them. s4 waits for s1: wave 2.
- `kit/bin/kb.test.ts`, the `omni kb show` and `omni kb status` snapshot tests: s1 adds the
  `kb show` cases for the level tags, s2 the `kb status` cases; wave 1, then wave 2.
- s3 keeps its command tests in a file of its own (`kit/bin/kb-decisions.test.ts`), so it shares no
  test with s2 in wave 2. It changes `readDecisions` and the records' lines in `measure.ts`, and never
  `kit/bin/commands/kb.ts`, which s2 owns: the decisions are read through the context, as today.
- Generated files are never committed by a slice; the wave rebuilds them.

## Per slice: done when

### s1 (deep: the order every agent reads its rules by, and the "reads as today" guarantee)

- A `kit/lib/knowledge-tree/` module names the four levels in order (`repo`, `plan repo`,
  `omni settings`, `kit default`) and where the plan repository's and the Omni settings' local copies
  lie; a level whose copy is absent is skipped, never an error. Where they lie is recorded as an
  outbox item (PRD #2417 writes the Omni-settings copy; this PRD only reads it).
- `resolveForm` resolves each slot bottom-up through the levels: the repository's own section wins
  even when both other levels hold one (AC 1); a section the repository lacks shows the plan
  repository's, tagged `[plan repo]`, else the Omni settings', tagged `[omni settings]`, else the kit
  default, tagged `[kit default]` (AC 2). A higher level's `TODO(human)`-only section is no answer and
  falls through.
- Unit tests over fixture repositories with and without each level prove the winner per section and
  each tag; `kit/bin/kb.test.ts` snapshots `omni kb show <form>` with each tag.
- A repository with no plan repository copy and no Omni-settings copy prints every form byte for
  byte as before (AC 5): the existing `resolve.test.ts`, `kb.test.ts` and the context budget pass
  unchanged.

### s2

- `omni kb status` prints, per form, how many sections come from each level (`repo`, `plan repo`,
  `omni settings`, `kit default`), and `--json` carries the same counts per form.
- A repository with no other level prints the same rows as today (no column for a level it lacks),
  proven by a `kit/bin/kb.test.ts` snapshot.
- A fixture with every level present snapshots the per-level counts.

### s3

- `readDecisions` returns each record with its level: the repository's records first, then the plan
  repository's and the Omni settings' records whose number the repository does not hold (bottom-up:
  the repository's own record wins a shared number).
- `omni kb show decisions` prints each record's level beside it (AC 4); in a repository with no other
  level the lines are exactly today's (AC 5).
- `kit/bin/kb-decisions.test.ts` covers both, and the context budget measure still passes.

### s4 (deep: the product rules every level must agree on, and a new red in `omni check knowledge`)

- `kit/lib/knowledge-tree/product*` reads every level's register entries, the highest first, and
  names each entry's level.
- A repository entry that contradicts an entry of its plan repository or its Omni settings makes
  `omni check knowledge` red with one line naming both entries and their levels (AC 3); what counts
  as a contradiction is the slice's to define from the registers' own fields and record as an outbox
  item.
- An entry a lower level only adds keeps the check green; a repository with no other level grades
  exactly as today.
- `kit/bin/check-knowledge-levels.test.ts` proves the red and the green over fixture repositories.
