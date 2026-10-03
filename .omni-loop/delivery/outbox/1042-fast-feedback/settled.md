# Settled outbox items — PRD 1042

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-untracked-files-not-linted -->

## s1-01-untracked-files-not-linted — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-untracked-files-not-linted
prd: 1042
slice: s1
rank: medium
bears-on: none
raised: 2026-10-03
wave: 1
---

## The question, in plain words

When an agent has created a brand new file but not yet told git about it, should the quick check lint that file too?

## The decision, in plain words

The quick check runs the new file's tests but lints it only once git knows about it, and says so on screen. The full lint before a pull request is ready still covers every file.

## The intro, for fun

A new file walks in without a badge, and the linter only checks badges.

## The punchline, for fun

It still gets tested at the door, and linted once it signs the guest book.

## The options, in plain words

A. A. Lint only the files git tracks; print the new ones it skipped (built).
B. B. Teach the lint script to also lint untracked files it is handed by name, and hand them over.
C. C. Run the linter directly on the changed files, bypassing the lint script.

## What I had to decide

Whether the quick check should also lint new files git does not know about yet, which needs the repository's lint script to accept them.

## What I did meanwhile

New files are tested by the quick check, linted after they are added to git, and always linted by the full lint before ready.

## What it costs to change later

Switching later is a small change to the lint script and to the quick check's plan: no data, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The repository's lint script lints only the files git tracks, and given no file at all it lints far more than asked; changing it was outside this slice's ground. (author)

```

<!-- /omni-outbox-settled: s1-01-untracked-files-not-linted -->
