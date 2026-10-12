# Settled outbox items — PRD 1205

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-steps-only-act -->

## s1-01-steps-only-act — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s1
- Wave: 1
- Became: BR-PRODUCT-87, P-PRODUCT-76

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-steps-only-act
prd: 1205
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

When the loop's next step is only waiting, for a running check or a claim another session holds, should it still be listed among the steps to launch?

## The decision, in plain words

The list of steps to launch holds only steps that have work to start. A step that only waits is left out, and a step kept back only because every slot is full is not listed as held.

## The intro, for fun

Three slots, and one step that only waits for a check to finish.

## The punchline, for fun

Sending a helper to watch paint dry still costs the helper.

## The options, in plain words

A. A. Steps lists only steps that act; held only what a rule keeps back (built).
B. B. Steps also carries today's step when it waits, so with one slot it always equals step.
C. C. As A, and held also names each step left out because every slot is taken.

## What I had to decide

The spec says the first entry of steps is today's step with today's verdict, and that with one slot steps holds step alone. Today's step can be a wait (a check running, a claim held). Launching an agent for a wait does nothing but cost tokens, and a step already running must never be launched twice. So steps lists only act verdicts: today's step comes first whenever it acts and is not running, and with one slot steps equals [step] exactly when step acts. held lists only what one of the four rules keeps back; a step left out because every slot is taken is simply next.

## What I did meanwhile

followSteps offers act verdicts only; tested against every existing followPlan case with one slot.

## What it costs to change later

A constant: let a wait verdict through in candidatesOf and add a slot-full held line, in kit/lib/next/follow.ts. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the drive skills (slice s2) would rather see the wait in steps to set their wake; today step and verdict still carry it.

```

<!-- /omni-outbox-settled: s1-01-steps-only-act -->

<!-- omni-outbox-settled: s1-02-running-read -->

## s1-02-running-read — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s1
- Wave: 1
- Became: BR-PRODUCT-88, P-PRODUCT-77

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-running-read
prd: 1205
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

How does the loop tell, from GitHub alone, which step of a PRD is running right now?

## The decision, in plain words

A PRD runs the wave holding a live claim on one of its slices. Otherwise, when its feature PR carries the in-progress label with a status comment updated within the claim limit, it runs its first step not done, whatever that step is.

## The intro, for fun

The label says someone is home; it does not say which room.

## The punchline, for fun

So the loop knocks on the first door that is not finished.

## The options, in plain words

A. A. Claims name their wave; the label runs the first step not done (built).
B. B. The label always runs the finish step, as the spec words it.
C. C. As A, and a ready sub-PR in flight also counts as a claim.

## What I had to decide

The spec ties the label to the finish, yolo-fix or PR care step. But yolo keeps the label on the feature PR through every wave it builds, so a label alone does not say the finish is running. Reading it as the PRD's first step not done never launches a second agent on a PRD someone is on, and it names the finish once every wave is merged. A live claim is a draft sub-PR in flight, not stale and not stalled, as the spec says; a ready sub-PR waiting for its wave to merge it is not counted. In a plan repository the label is read on the plan PR and on every target PR.

## What I did meanwhile

readFacts reads the claims from the board and the label from the PR listing, fetching comments only for a PR that carries it.

## What it costs to change later

A constant: change runningStep in kit/lib/next/follow.ts or the claim filter in kit/bin/commands/next.ts. Nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a ready sub-PR left behind by a wave that died should hold its PRD's slot; today it does not.

```

<!-- /omni-outbox-settled: s1-02-running-read -->

<!-- omni-outbox-settled: s1-03-roadmap-held-merge -->

## s1-03-roadmap-held-merge — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s1
- Wave: 1
- Became: ADR-0088

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-roadmap-held-merge
prd: 1205
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

Under a roadmap the tick already used the name held for the PRDs the roadmap holds or parks, and the pool needs it for the steps it keeps back: how do the two share it?

## The decision, in plain words

Under a roadmap, held lists the roadmap's held or parked PRDs first, unchanged and each marked with its gate, then the steps the pool keeps back. A PRD the roadmap already holds gets no second line.

## The intro, for fun

Two lists walked into one field name.

## The punchline, for fun

The roadmap kept its seat; the pool sat right behind it.

## The options, in plain words

A. A. One held list: the roadmap's PRDs first with their gate, then the pool's steps (built).
B. B. Keep held for the roadmap only and give the pool's list another name.
C. C. Give every entry a step and a gate, the pool's gate reading collision.

## What I had to decide

The spec names held for the pool's steps, each {step, prd, why}; under --roadmap, held already meant each PRD the roadmap holds or parks ({prd, gate, why, link}), and the drive skills park every entry of it. Renaming either would break a reader. Keeping the roadmap entries first and unchanged keeps today's readers working; the pool's entries carry no gate, so a reader tells them apart by it. The drive skills (slice s2) must park only the entries that carry a gate.

## What I did meanwhile

tickJson writes held as the roadmap's entries, then the pool's for PRDs the roadmap does not hold; the plain output prints each once.

## What it costs to change later

A constant: split the pool's entries into their own field in tickJson (kit/bin/commands/next.ts). Nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Slice s2 has to read the gate field when it parks held PRDs; nothing in this slice can enforce that.

```

<!-- /omni-outbox-settled: s1-03-roadmap-held-merge -->

<!-- omni-outbox-settled: s2-01-unseen-step-holds-pool -->

## s2-01-unseen-step-holds-pool — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s2
- Wave: 2
- Became: BR-PRODUCT-89, P-PRODUCT-78

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-unseen-step-holds-pool
prd: 1205
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

When the loop has just started a step and GitHub does not show it running yet, may the loop start more steps in the same round?

## The decision, in plain words

No. While a step the loop started is not yet visible on GitHub, the loop starts nothing new, and it never starts a second step for a PRD it is already working on.

## The intro, for fun

A helper just left for work, and the board still shows the desk empty.

## The punchline, for fun

So the loop waits a minute before handing that desk to someone else.

## The options, in plain words

A. An unseen step of this session holds the pool until GitHub shows it or it returns (built).
B. Launch every entry of steps at once; only skip PRDs this session already runs.
C. Pass the session's own running steps to omni next so its collision check sees them.

## What I had to decide

omni next reads what runs from GitHub only: a live claim, or the in-progress label with a fresh status comment. A step agent launched a moment ago has neither yet (a yolo that plans first, a pr-care --once that sets no label), so the collision check cannot see its ground and the slot count misses it. Launching beside it could start two steps on one PRD or two steps on one path. So while a step agent of this session runs a step that running does not list, the tick launches nothing, and an entry of steps whose PRD already has a step agent of this session is never launched; the session never has more than limits.parallelSteps agents at once.

## What I did meanwhile

Both drive skills' step 3 Launch paragraph says so; the plugin test checks the launch wording.

## What it costs to change later

A constant: reword the Launch paragraph in kit/plugin/skills/drive/SKILL.md (mega-drive follows it). Nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How long a fresh step stays invisible on GitHub: a pr-care --once round may never show, so it holds the pool until it returns.
- (author) Whether the person would rather let steps of other PRDs start at once and accept a rare clash the merge-time territory check still catches.

```

<!-- /omni-outbox-settled: s2-01-unseen-step-holds-pool -->

<!-- omni-outbox-settled: s2-02-mega-step-worktree -->

## s2-02-mega-step-worktree — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s2
- Wave: 2
- Became: ADR-0089

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-mega-step-worktree
prd: 1205
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

When the loop builds several cross-repository PRDs at once, does each one also get its own copy of the planning repository, or only its own copies of the code repositories?

## The decision, in plain words

Each one gets both: its own working copy of the planning repository, and its own copies of the code repositories, kept in one shared place so every step of that PRD finds them again.

## The intro, for fun

Three builders, one notebook, and everyone wants to write on the same page.

## The punchline, for fun

Everyone gets a notebook; the shared shelf keeps the copies.

## The options, in plain words

A. Step agents run in a worktree too, and the per-PRD clones sit under the main checkout (built).
B. Step agents run in the loop's checkout, as the spec words it, with per-PRD clones only.
C. Step agents run in a worktree, and each keeps its clones inside that worktree.

## What I had to decide

The spec gives mega-drive a target clone per PRD and gives the worktree isolation to drive only. But the ultra skills also commit in the plan repository (the plan PR's branch, the outbox relays), so two running in the loop's checkout would fight over its HEAD just as two waves would. So mega-drive's step agents run with isolation worktree too. A worktree would then read omni config worktrees relative to itself and clone the targets afresh each step, so the clone path is taken from the plan repository's main checkout (the folder holding git rev-parse --git-common-dir), and the exclude line goes to info/exclude under that common git folder.

## What I did meanwhile

mega-drive step 3 and ultra-yolo step 2 item 1 say so; the other ultra skills, mega-pr-care, do-work --target and pr --repo read the clone at <worktrees>/targets/<name>@<prd>.

## What it costs to change later

A constant: wording in kit/plugin/skills/mega-drive/SKILL.md and kit/plugin/skills/ultra-yolo/SKILL.md. Old clones at <worktrees>/targets/<name> are left on disk, unused.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Clones made before this change at <worktrees>/targets/<name> are not moved or removed; the next run clones each PRD's afresh.

```

<!-- /omni-outbox-settled: s2-02-mega-step-worktree -->

<!-- omni-outbox-settled: s2-03-slice-worktree-per-prd -->

## s2-03-slice-worktree-per-prd — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s2
- Wave: 2
- Became: ADR-0090

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-slice-worktree-per-prd
prd: 1205
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

Two cross-repository PRDs built at once can both have a first slice in the same code repository: where does each slice's working folder go?

## The decision, in plain words

Each slice's working folder is named after its PRD as well as its slice, beside that PRD's own copy of the code repository, so two PRDs' slices never share a folder.

## The intro, for fun

Two first slices, one folder name, and a very confused filing cabinet.

## The punchline, for fun

Adding the PRD number to the label settles the argument.

## The options, in plain words

A. The slice folder carries the PRD number beside the slice id (built).
B. Keep the slice folder as it was and accept a clash when two PRDs share a slice id.
C. Put each slice folder inside the PRD's clone folder instead.

## What I had to decide

do-work --target built each slice in <worktrees>/targets/<name>--<slice>. With a clone per PRD, two PRDs running at once can both reach slice s1 in one target, and the same folder would be asked for twice. The plan does not list it, but the spec's isolation rule (no two running steps share a HEAD) needs it, so the slice worktree is now <worktrees>/targets/<name>@<prd>--<slice>.

## What I did meanwhile

do-work's Under --target section names the new folder in all three places.

## What it costs to change later

A constant: the folder name in kit/plugin/skills/do-work/SKILL.md. Nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) mega-bug-fix keeps <worktrees>/targets/<name> and its own --fix-<n> worktrees: it has no PRD and the loop never runs it, so it was left out of this slice's territory.

```

<!-- /omni-outbox-settled: s2-03-slice-worktree-per-prd -->
