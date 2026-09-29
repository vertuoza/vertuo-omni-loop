# Settled outbox items — PRD 563

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s4-01-target-slice-worktree -->

## s4-01-target-slice-worktree — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-target-slice-worktree
prd: 563
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When several pieces of work land in the same other repository at once, where does each one get built on this computer?

## The decision, in plain words

Each piece gets its own working copy placed right beside that repository's shared copy, and the copy is removed once its pull request is open.

## The intro, for fun

Two builders, one workbench: somebody has to hand out the stools.

## The punchline, for fun

Everyone gets a stool next to the bench, and folds it away after.

## The options, in plain words

A. a worktree per slice at <worktrees>/targets/<name>--<slice>, removed once the sub-PR is open (built)
B. a worktree per slice inside the clone's own folder
C. build in the clone itself, one slice at a time per target

## What I had to decide

Whether each slice built in a target works in its own worktree beside the target's clone, or somewhere else.

## What I did meanwhile

do-work --target builds each slice in a worktree at <worktrees>/targets/<name>--<slice>, and pr --repo's claim detaches the clone after pushing so that worktree can check the branch out.

## What it costs to change later

A different place is a changed path in two skill texts; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says only 'a worktree of that target's clone'; the path and the detach after the claim are mine (author).

```

<!-- /omni-outbox-settled: s4-01-target-slice-worktree -->

<!-- omni-outbox-settled: s4-02-target-pr-link-line -->

## s4-02-target-pr-link-line — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-target-pr-link-line
prd: 563
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When a pull request opens in another repository, how does it point back at the feature request it belongs to?

## The decision, in plain words

It names the planning repository in full before the request's number, so the link leads to the right place instead of a same-numbered page in the other repository.

## The intro, for fun

Number 563 on the wrong street is a very different house.

## The punchline, for fun

So every letter now carries the full street name too.

## The options, in plain words

A. every link line under --repo is written <plan repo slug>#<n> (built)
B. only the target feature PR names the plan repository; sub-PRs keep the bare link line

## What I had to decide

Whether the link line of a sub-PR opened in a target names the plan repository in full.

## What I did meanwhile

pr --repo writes a link line's #<n> as <plan repo slug>#<n>, as the spec already asks of the target feature PR.

## What it costs to change later

A text change in one skill paragraph.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec fixes the full form for the target feature PR only; extending it to every link line under --repo is mine (author).

```

<!-- /omni-outbox-settled: s4-02-target-pr-link-line -->

<!-- omni-outbox-settled: s2-01-moved-lost-read-at -->

## s2-01-moved-lost-read-at — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-moved-lost-read-at
prd: 563
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

When the other repository no longer has the exact version the plan was written against, what does the moved check say about it?

## The decision, in plain words

It says the repository could not be read, with the reason, rather than guessing whether anything moved.

## The intro, for fun

The bookmark is still here, but somebody tore out the page it was marking.

## The punchline, for fun

So we say we lost our place instead of pretending we finished the chapter.

## The options, in plain words

A. A. unreachable, with the reason in the detail (built)
B. B. moved, with every file under the territories counted as changed
C. C. a fourth state, lost, which ultra-yolo would record like a moved target

## What I had to decide

Whether a target whose read at commit can no longer be compared with its default branch is reported as unreachable, as moved, or as something new.

## What I did meanwhile

omni plan moved reports such a target as unreachable, its detail naming the read at commit that cannot be compared; the JSON keeps the three states the spec names.

## What it costs to change later

One branch in kit/lib/plan-repo/moved.mjs and one test; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec defines unreachable only as gh cannot read the target; a read at commit the target lost (a force-push or a rewritten history) is not covered, and folding it into unreachable is mine.

```

<!-- /omni-outbox-settled: s2-01-moved-lost-read-at -->
