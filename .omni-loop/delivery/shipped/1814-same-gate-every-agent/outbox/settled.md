# Settled outbox items — PRD 1814

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-hooks-enter-through-check-changed -->

## s1-01-hooks-enter-through-check-changed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-hooks-enter-through-check-changed
prd: 1814
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The two new git checks need a starting point the dead-code audit can see. Should they start inside the existing changed-files checker, or from a script of their own that the audit's settings list?

## The decision, in plain words

They start inside the existing changed-files checker, through a hook mode, so the audit sees them without a settings change outside this slice.

## The intro, for fun

Every gate needs a door, and this one had two places it could hang.

## The punchline, for fun

We used the door that was already in the wall.

## The options, in plain words

A. A. The checks start inside the existing changed-files checker, and the audit settings stay as they are.
B. B. The checks start from a script of their own, and the audit settings list that script.

## What I had to decide

Keep A unless you would rather the hooks have a script of their own. B moves the hook mode out of scripts/check-changed.ts into its own entry file and adds that file to the entry list of .fallowrc.jsonc, which is outside this slice's territory.

## What I did meanwhile

The hooks run `node scripts/check-changed.ts --hook pre-commit|pre-push`; the gate's code lives in scripts/check-changed-hooks.ts, imported by scripts/check-changed.ts.

## What it costs to change later

Cheap either way: one import and one argument check to move, plus one line in .fallowrc.jsonc for B.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- vitest.config.ts still includes .claude/hooks/**/*.test.{mjs,ts}, which now matches nothing; the file is outside this slice, so the glob was left (author)

```

<!-- /omni-outbox-settled: s1-01-hooks-enter-through-check-changed -->

<!-- omni-outbox-settled: s1-02-old-claude-gate-test-deleted -->

## s1-02-old-claude-gate-test-deleted — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-old-claude-gate-test-deleted
prd: 1814
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The old commit check that only Claude ran is gone, and its test went with it. Do you agree the cases that still matter are now proven by the new checks' tests?

## The decision, in plain words

The old test is deleted, as the spec asks. Its cases that still apply, a check run inside a side copy of the repository and a missing tool named, are proven again by the new checks' tests.

## The intro, for fun

A guard retired today, and its replacement already took the oath.

## The punchline, for fun

The old badge goes in the drawer, not the bin: history keeps it.

## The options, in plain words

A. A. The old test is deleted, and its still-valid cases live in the new checks' tests.
B. B. The old Claude check and its test come back beside the new git checks.

## What I had to decide

Keep A unless a case the old test covered still matters to you. The old test also proved which typed commands counted as a commit or a push, which no longer applies: git itself now decides when its own checks run.
Decided by: Jev (hardToRevert 0.48) · agent said true

## What I did meanwhile

The new tests in scripts/check-changed-hooks.test.ts cover a worktree audited from its own root, a missing fallow and a missing pnpm named with run pnpm install, a fallow runtime error refusing, and git itself refusing a commit.

## What it costs to change later

Cheap: restoring the old test means restoring the old Claude hook it tested, one revert.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The old test's command-matching cases (git -C dir commit, git log commit-message.txt) have no successor, since git runs its own hooks; none was carried over (author)

```

<!-- /omni-outbox-settled: s1-02-old-claude-gate-test-deleted -->

<!-- omni-outbox-settled: s1-03-ci-form-evidence-line-dropped -->

## s1-03-ci-form-evidence-line-dropped — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-ci-form-evidence-line-dropped
prd: 1814
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

Deleting the old Claude-only check left the CI page of the playbook pointing at a missing file, which turns the checks red. Is it fine that this slice dropped that one pointer, though the page belongs to a later slice?

## The decision, in plain words

The one pointer to the deleted file was removed from the CI page, so the repository's checks stay green. The page's wording about the old check is left for the later slice that rewrites it.

## The intro, for fun

One signpost still pointed at a house that was just knocked down.

## The punchline, for fun

We took the signpost down and left the map redraw to the cartographer.

## The options, in plain words

A. A. This slice drops the one pointer, and the later slice rewrites the page.
B. B. The pointer stays, and the checks are red until the later slice lands.

## What I had to decide

Keep A: s3 rewrites the CI form's paragraph on the old hook and can add the git hooks as evidence then. B would leave omni check all red on the feature branch until s3 merges.

## What I did meanwhile

The ci form's evidence list no longer names .claude/hooks/fallow-gate.sh; its paragraph on the Claude session's fallow audit still describes the old hook until s3.

## What it costs to change later

Cheap: one evidence line, which s3 rewrites anyway.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The ci form is s3's territory; this is the only line of it s1 touched (author)

```

<!-- /omni-outbox-settled: s1-03-ci-form-evidence-line-dropped -->
