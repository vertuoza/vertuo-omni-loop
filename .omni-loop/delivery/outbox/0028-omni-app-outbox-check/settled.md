# Settled outbox items — PRD 28

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-evaluate-reads-two-snapshots -->

## s1-01-evaluate-reads-two-snapshots — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-evaluate-reads-two-snapshots
prd: 28
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Should the check read the main branch's settings and the pull request's outbox from one combined copy of the files, or from two separate copies?

## The decision, in plain words

Two separate copies: one of the main branch's settings, one of the pull request's delivery folder. A settings file inside the pull request is simply never looked at, so a pull request cannot quietly rename the override label.

## The options, in plain words

A. Two copies, the main branch's settings and the pull request's outbox, as built.
B. One combined copy holding the main branch's settings next to the pull request's outbox.
C. Two copies, but the comment is worked out at posting time rather than during the check.

## What I had to decide

The spec's unit table says evaluate takes one folder, but decision 4 says config comes from base and delivery from head, and the test seams ask that a head which renames the override label leaves the verdict unchanged. One merged folder cannot hold both a base and a head config, so that test would have nothing to prove. The spec also does not say how evaluate learns which outbox comment already exists.

## What I did meanwhile

evaluate takes `base` (a folder holding the base branch's `.omni-loop/config.yml`, or nothing) and `head` (a folder holding `paths.delivery` at the head SHA); the kit's context is rooted at `head` with the config parsed from `base`. It also takes `comments` (the PR's existing comments) and returns `comment: { id, body }` (id null = create, else rewrite) or null, computed by running the kit's `upsertOutboxPrComment` against an in-memory client. s4's `snapshot` is called twice with its list of paths; s5 fetches the PR's comments in the evaluate step and s4's `publish` posts the plan.

## What it costs to change later

A constant-level change: if one merged folder is preferred, evaluate reads the config from the same root and the renamed-label test is dropped. No stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the spec author meant one folder built from two refs, or was describing the unit loosely.
- (author) Whether publish should re-list comments at post time instead of trusting the id evaluate saw; a marker comment created between the two would be duplicated.

```

<!-- /omni-outbox-settled: s1-01-evaluate-reads-two-snapshots -->

<!-- omni-outbox-settled: s1-02-evaluate-grades-changed-files-when-given -->

## s1-02-evaluate-grades-changed-files-when-given — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-evaluate-grades-changed-files-when-given
prd: 28
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

When the check is handed the list of files a pull request changed, should it also hold the pull request for risky changes nobody explained?

## The decision, in plain words

Yes, when the list is handed in: the check then holds the pull request exactly as the kit's full gate does, and names those changes in its title. When no list is handed in, it only looks at open questions and unfinished rework.

## The options, in plain words

A. Grade the changed files whenever they are handed in, as built.
B. Never grade them: the check looks only at open questions and unfinished rework, matching the conclusion table.
C. Grade them, and widen the copy to include the knowledge folder so every rule can fire.

## What I had to decide

The spec makes changed files an input to evaluate, and the kit's gate uses them for one thing only, the unaccounted-risky-change reason. But the spec's conclusion table names only open items and unreworked drift, and the gate as /omni:yolo runs it today does not grade the range.

## What I did meanwhile

evaluate passes `changes` straight to `gateResult` when given (default null, range not graded); an unaccounted change makes the check `failure` with 'n unaccounted risky changes' in the title, overridable by the label like the others. The Inngest function (s5) chooses whether to pass the compare endpoint's files.

## What it costs to change later

One argument: s5 passes the changed files or does not. No stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) With laws.source set to knowledge, the law-proof rule reads the knowledge folder, which the snapshot does not hold today, so that one rule would never fire from the app.
- (author) Whether the spec author wanted the app's gate to match /omni:yolo's (no range) or the kit's fullest gate.

```

<!-- /omni-outbox-settled: s1-02-evaluate-grades-changed-files-when-given -->

<!-- omni-outbox-settled: s2-01-empty-product-registers -->

## s2-01-empty-product-registers — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-empty-product-registers
prd: 28
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Keeping the new decision record where the plan puts it makes the repository's knowledge check fail, because that check expects three product register files to exist alongside it. How should the check be kept green?

## The decision, in plain words

Three placeholder product register files were added, each saying it holds nothing yet, so the knowledge check passes without changing the kit or the repository's settings.

## The options, in plain words

A. A: Placeholder product registers, each saying it holds nothing yet (built).
B. B: Point the decision record folder outside the knowledge folder in this repository's settings and drop the placeholders.
C. C: Teach the knowledge check to skip grading when the laws come from nowhere and the folder holds only decision records.
D. D: Keep the decision record elsewhere, such as beside the PRD, and leave the knowledge folder absent.

## What I had to decide

Whether the knowledge folder should carry placeholder product registers, whether the decision records should live outside it, or whether the knowledge check should skip a folder holding only decision records.

## What I did meanwhile

The knowledge folder holds the decision record plus three placeholder product registers with no principles, rules or invariants; the knowledge check reports zero of each and passes.

## What it costs to change later

Deleting three small files and, if chosen, a one-line settings change or a small kit change with its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for this slice names only the decision record folder, so the three register files sit outside it.
- (author) Whether a later PRD will fill the product registers is not known.

```

<!-- /omni-outbox-settled: s2-01-empty-product-registers -->

<!-- omni-outbox-settled: s2-02-bundle-not-committed -->

## s2-02-bundle-not-committed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-bundle-not-committed
prd: 28
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

The plan says to rebuild the kit's single-file bundle and commit it, but the repository is set to never track that bundle. Should it be committed anyway?

## The decision, in plain words

The bundle was rebuilt and checked to build cleanly, but not committed, because the repository deliberately ignores it and this repository runs the kit from source.

## The options, in plain words

A. A: Rebuild to prove it builds, keep it untracked as the ignore rule says (built).
B. B: Lift the ignore rule and commit the bundle with every kit change.

## What I had to decide

Whether the built bundle should be tracked in this repository, which means lifting the ignore rule, or stay a build output produced on demand.

## What I did meanwhile

The bundle builds cleanly from the changed kit and stays untracked; this repository's own command runs the kit source directly, so it already sees the new default.

## What it costs to change later

Removing one ignore rule and committing one generated file, then rebuilding it on every kit change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether an installed repository will copy the bundle from this repository's history or from a release build is not settled.

```

<!-- /omni-outbox-settled: s2-02-bundle-not-committed -->
