# Settled outbox items — PRD 2746

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-help-count-test -->

## s1-01-help-count-test — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s1
- Wave: 1
- Stays here: A one-number bump any new command needs; a local choice with nothing lasting about the product to keep.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-help-count-test
prd: 2746
slice: s1
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

Adding the new hold command makes a test that counts every command fail, and that test sits outside this slice's files. Should the slice update the count?

## The decision, in plain words

The slice raised the command count in that test from 67 to 68, and changed nothing else there.

## The intro, for fun

Every new command has to be counted before it counts.

## The punchline, for fun

The tally now reads 68.

## The options, in plain words

A. A. Raise the count to 68 in this slice (built).
B. B. Leave the test as it was and let the wave raise it after merging.

## What I had to decide

A one-number change in kit/lib/help/entries.test.ts, which every new command needs. A different answer undoes it by reverting one constant.

## What I did meanwhile

The count in the test is 68 and the full test run is green.

## What it costs to change later

Another slice that adds a command and edits the same line will conflict on one number.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the wave would rather raise the count itself after merging (author).

```

<!-- /omni-outbox-settled: s1-01-help-count-test -->

<!-- omni-outbox-settled: s3-01-hold-command-outside-territory -->

## s3-01-hold-command-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s3
- Wave: 2
- Stays here: A one-off territory call for this PRD's slices; it settles no lasting product behaviour or build choice, and is cheap to undo.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-hold-command-outside-territory
prd: 2746
slice: s3
rank: medium
bears-on: none
raised: 2026-11-13
wave: 2
---

## The question, in plain words

The plan gave this step the hold's logic but not the command that runs it, its help text, or a test that counts the hook points. Was it right to change those three files too?

## The decision, in plain words

I made the smallest change in each: the command now asks for the provider's settings and passes them on, its help text says what a probe is, and the count of hook points went from 12 to 13. All the new logic stays where the plan put it.

## The intro, for fun

The plan drew a fence, and the gate was on the other side of it.

## The punchline, for fun

So I stepped over it, touched three things, and wrote it down.

## The options, in plain words

A. A. Keep the three small changes: the command, its help and the count follow the new probe.
B. B. Revert them and add the three paths to s3's territory in the plan, then redo the same change.

## What I had to decide

Whether a slice may make the small wiring change its own feature needs in a file the plan gave to an earlier slice of the same PRD.

## What I did meanwhile

The three files carry the change; slice s1, which owned them, is already merged into the feature branch, so no other slice of the wave touches them.

## What it costs to change later

Undoing it means moving the provider read back out of the command and dropping two help sentences: a few lines, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- kit/bin/commands/hold.ts, kit/lib/help/entries.ts and kit/lib/flow/resolve.test.ts were not in s3's territory (author)

```

<!-- /omni-outbox-settled: s3-01-hold-command-outside-territory -->

<!-- omni-outbox-settled: s3-02-mega-pr-care-reads-hold -->

## s3-02-mega-pr-care-reads-hold — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s3
- Wave: 2
- Became: ADR-0138

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-mega-pr-care-reads-hold
prd: 2746
slice: s3
rank: medium
bears-on: none
raised: 2026-11-13
wave: 2
---

## The question, in plain words

The spec asks the multi-repository review watcher to check the hold before marking a pull request ready, but that watcher is never allowed to mark anything ready. What should it do with the hold?

## The decision, in plain words

The watcher reads the hold every round and writes what each held pull request waits for on its status comment, and still never marks anything ready. The skills that do mark ready check the hold again first.

## The intro, for fun

Asking the night guard to open the doors he has no key for.

## The punchline, for fun

He now tells you which door is still locked, and why.

## The options, in plain words

A. A. The watcher reads and reports the hold each round and never marks ready.
B. B. The watcher also marks a pull request ready once its hold is clear, lifting its guardrail for that case.

## What I had to decide

Whether the watcher keeps its rule of never marking ready, or gains the right to mark a pull request ready once its provider is served.

## What I did meanwhile

Held pull requests stay drafts and show their waiting line; the drive loop and the build skills mark them ready once the hold clears.

## What it costs to change later

Letting the watcher mark ready later is a few lines in one skill and the guardrail it lifts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's line for this skill says before gh pr ready; this skill names no gh pr ready at all, and a plugin test holds it to that (author)

```

<!-- /omni-outbox-settled: s3-02-mega-pr-care-reads-hold -->

<!-- omni-outbox-settled: s3-03-held-target-holds-plan-pr -->

## s3-03-held-target-holds-plan-pr — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s3
- Wave: 2
- Became: BR-GATE-1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-held-target-holds-plan-pr
prd: 2746
slice: s3
rank: medium
bears-on: none
raised: 2026-11-13
wave: 2
---

## The question, in plain words

When a feature spans several repositories and one of its pull requests waits for another to be merged and served, should the main planning pull request also stay a draft until then?

## The decision, in plain words

Yes: the waiting pull request stays a draft, the build goes on with the others, and the planning pull request waits until the waiting one is ready or merged, as it already does for a chain of pull requests merged in order.

## The intro, for fun

One train waits at the platform for the other to arrive.

## The punchline, for fun

The station master keeps the whole timetable on hold until it does.

## The options, in plain words

A. A. The planning pull request waits until every held pull request is ready or merged.
B. B. The planning pull request is marked ready anyway, with the held ones named in its body.

## What I had to decide

Whether a held pull request in one repository keeps the planning pull request a draft, or the planning pull request is marked ready around it.

## What I did meanwhile

The planning pull request stays a draft while any of its pull requests is held; the drive loop reads the hold again each tick.

## What it costs to change later

Marking the planning pull request ready around a held one later is one paragraph of the build skill.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the consumer stays a draft but says nothing of the planning pull request (author)

```

<!-- /omni-outbox-settled: s3-03-held-target-holds-plan-pr -->

<!-- omni-outbox-settled: s3-04-probe-fail-raises-high-item -->

## s3-04-probe-fail-raises-high-item — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s3
- Wave: 2
- Became: BR-PRODUCT-131

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-04-probe-fail-raises-high-item
prd: 2746
slice: s3
rank: medium
bears-on: none
raised: 2026-11-13
wave: 2
---

## The question, in plain words

When a provider's own check says its change will never be served as it is, should that be treated like a provider closed without merging, and ask a person?

## The decision, in plain words

Yes: a check that answers fail keeps the waiting pull request a draft and raises the same important question a closed provider does, naming both pull requests.

## The intro, for fun

The kitchen says the dish you are waiting for is off the menu.

## The punchline, for fun

The waiter asks you, rather than bringing something else.

## The options, in plain words

A. A. A probe's fail raises the same important question as a closed provider.
B. B. A probe's fail only keeps the pull request waiting, read again later like a wait.

## What I had to decide

Whether a provider check's fail asks a person, as a closed provider does, or only keeps the pull request waiting and asks again later.

## What I did meanwhile

A failing check raises one important question naming both pull requests, and the waiting pull request stays a draft.

## What it costs to change later

Turning it into a plain wait later is one sentence of the pull request skill.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec raises the question on a provider closed without merging; it names a probe's fail verdict without saying what follows it (author)

```

<!-- /omni-outbox-settled: s3-04-probe-fail-raises-high-item -->
