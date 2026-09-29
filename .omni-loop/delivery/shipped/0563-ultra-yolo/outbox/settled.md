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

<!-- omni-outbox-settled: s3-01-relay-refuses-taken-id -->

## s3-01-relay-refuses-taken-id — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-relay-refuses-taken-id
prd: 563
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 3
---

## The question, in plain words

When a question written in another repository is brought home and one with the same name is already waiting there, should the new one be renamed or turned away?

## The decision, in plain words

It is turned away and left where it was, with the reason printed, so nothing already waiting is overwritten and nothing is silently renamed.

## The intro, for fun

Two questions, one name, one inbox: someone has to wait outside.

## The punchline, for fun

The newcomer waits, politely, with a note explaining why.

## The options, in plain words

A. Refuse the item and leave it in the folder with its reason, the option built.
B. Renumber it to the next free number and move it.
C. Overwrite the item already in the outbox.

## What I had to decide

What the relay does with an item whose id is already taken in the plan repository's outbox (an open file, or an id the settled ledger carries).

## What I did meanwhile

The relay refuses it: the file stays in the scratch folder, is named on stderr with the reason, and the exit is 2 while the other files still move. It never overwrites and never renumbers. Ids should not collide in practice, since item new --out already counts the outbox's spent ids.

## What it costs to change later

One branch in the relay module: renumbering instead would be a small change there plus rewriting the item's id line, and any account naming the old id.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether two slices of one wave, raising items in separate scratch folders at the same time, can ever pick the same number; they carry different slice ids, so they should not.

```

<!-- /omni-outbox-settled: s3-01-relay-refuses-taken-id -->

<!-- omni-outbox-settled: s5-01-target-pr-empty-commit -->

## s5-01-target-pr-empty-commit — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-target-pr-empty-commit
prd: 563
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 4
---

## The question, in plain words

A pull request cannot open on a branch that holds nothing new yet. How should the build open each other repository's pull request before any work has landed there?

## The decision, in plain words

It adds one empty, signed starting commit to the new branch, so the draft pull request can open at once and be followed from the start.

## The intro, for fun

GitHub will not open a pull request for a branch with nothing to show.

## The punchline, for fun

So the branch arrives with an empty box and a polite label on it.

## The options, in plain words

A. A. One empty signed commit on the new branch, then the draft pull request at once, the option built.
B. B. Open each repository's pull request only after its first piece of work has landed there.

## What I had to decide

How /omni:ultra-yolo step 2 opens a draft target feature PR when the target's freshly cut feature branch equals its default branch, which GitHub refuses as a pull request with no commits.

## What I did meanwhile

The skill cuts the feature branch, makes one empty commit (git commit --allow-empty, signed like every other), pushes it, and opens the draft target feature PR right away, as the spec's step 2 asks.

## What it costs to change later

One paragraph of the ultra-yolo skill text: opening the target PR after the first sub-PR merges instead would move that item from step 2 into /omni:ultra-wave's merge step.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec asks for the draft target PR in step 2 but does not say how to open it on a branch with no commits yet.

```

<!-- /omni-outbox-settled: s5-01-target-pr-empty-commit -->

<!-- omni-outbox-settled: s5-02-no-plan-stops -->

## s5-02-no-plan-stops — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-no-plan-stops
prd: 563
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 4
---

## The question, in plain words

When a feature that spans several repositories has no plan yet, should the build write one itself, as the one-repository build does, or stop?

## The decision, in plain words

It stops in one line and points to the brainstorm for several repositories, the step that writes such a plan and asks which repository does what.

## The intro, for fun

Building across three repositories without a map is a bold holiday plan.

## The punchline, for fun

The build asks for the map first, and says who draws it.

## The options, in plain words

A. A. Stop in one line and point to the brainstorm for several repositories, the option built.
B. B. Follow the one-repository planning step and let it write a plan that names a repository per piece.

## What I had to decide

What /omni:ultra-yolo does when the PRD has no plan.md or no plan PR, where /omni:yolo would follow /omni:plan.

## What I did meanwhile

It stops with the line 'PRD <n> has no plan: /omni:mega-brainstorm writes it'. /omni:plan slices one repository and cannot fill the plan's repo column or its Repositories table.

## What it costs to change later

One sentence of the ultra-yolo skill: planning there instead would name a planning step that fills the repo column, which no skill does today outside the mega-brainstorm.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec takes the plan from PRD 549 as given and never says what happens when it is missing.

```

<!-- /omni-outbox-settled: s5-02-no-plan-stops -->

<!-- omni-outbox-settled: s5-03-target-install-red -->

## s5-03-target-install-red — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-target-install-red
prd: 563
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 4
---

## The question, in plain words

When another repository's own checks fail only because its tools are not installed on this computer, should the build install them, or leave that repository's online checks to decide?

## The decision, in plain words

It never installs anything in another repository. It names the missing install as a step for a person and lets that repository's online checks decide.

## The intro, for fun

The checks want their toolbox, and the build promised not to touch the shed.

## The punchline, for fun

It leaves a note on the door and lets the online checks do the inspection.

## The options, in plain words

A. A. Never install in another repository; name it for a person and let the online checks decide, the option built.
B. B. Run the repository's own install once before its checks, as its configuration names it.

## What I had to decide

What finishing a target (/omni:ultra-yolo step 4) does when the target's committed preflight is red for want of an install, since the spec allows only that preflight to run in a target.

## What I did meanwhile

No install runs in a target. The red step is named as a human step, the target feature PR is still marked ready, and its CI is the check that holds or frees the plan PR.

## What it costs to change later

One sentence in the ultra-yolo skill: allowing an install would have to name which install command runs, something a target's config would then declare.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lets only a target's committed preflight run and does not say what happens when that preflight needs its dependencies installed first.

```

<!-- /omni-outbox-settled: s5-03-target-install-red -->
