# Settled outbox items — PRD 2175

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-dead-claim-defaults-outside-config -->

## s1-01-dead-claim-defaults-outside-config — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-19
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-dead-claim-defaults-outside-config
prd: 2175
slice: s1
rank: medium
bears-on: none
raised: 2026-10-19
wave: 1
---

## The question, in plain words

Where should the defaults of the two new settings live, the released label's name and the 240-minute quiet time, when a repository does not set them?

## The decision, in plain words

The kit applies them itself when a setting is left out, so every repository's settings read exactly as before; the catch is that asking the kit to print either setting answers that it is not set until a repository sets it.

## The intro, for fun

Two new settings walked in, and every seat at the table already had a name card.

## The punchline, for fun

So they wait by the door, and the kit tells them apart by heart.

## The options, in plain words

A. The kit applies both defaults itself when a setting is left out, as it already does for the hook size limit.
B. Every repository's settings carry both defaults, the new label is created at setup with the others, and the tests that pin those lists are updated.

## What I had to decide

Keep the defaults in the kit's code (A), or write them into every repository's parsed settings (B) and update the tests that pin the full lists of labels and limits.

## What I did meanwhile

A config that leaves `labels.released` or `limits.claimDeadMinutes` out reads `omni:released` and 240 minutes on the board, the Engineering board and `omni board`, through `releasedLabel()` and `deadClaimRules()`. `omni config labels.released` and `omni config limits.claimDeadMinutes` exit 2 until a repository sets them, so s2 and s3 read the label through `releasedLabel()` in code, or name the default in the skill text.

## What it costs to change later

B is two schema defaults in `kit/lib/config.ts`, plus `kit/lib/init/labels.ts` (a style for the label, which `omni init` would then create) and the tests that pin the label and limit lists: `kit/lib/config.test.ts`, `kit/lib/schema/config.test.ts`, `kit/lib/init/labels.test.ts`, `kit/bin/init.test.ts`, `kit/bin/update.test.ts`. None is in this slice's territory.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s3's wave skill text must read the released label through `omni config`: the plan does not say how it reads it (author).

```

<!-- /omni-outbox-settled: s1-01-dead-claim-defaults-outside-config -->

<!-- omni-outbox-settled: s1-02-engineering-board-quiet-claims-need-update-time -->

## s1-02-engineering-board-quiet-claims-need-update-time — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-19
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-engineering-board-quiet-claims-need-update-time
prd: 2175
slice: s1
rank: medium
bears-on: none
raised: 2026-10-19
wave: 1
---

## The question, in plain words

The Engineering board's Loop health panel cannot see when a pull request was last updated, so should it count quiet claims now, or wait until that time is stored?

## The decision, in plain words

The panel counts a released claim as stale at once, and a quiet claim only when the pull request's update time is known, which the stored rows do not carry yet; so until then it shows released claims and cold ones, never quiet ones.

## The intro, for fun

The panel can read the label, but nobody told it what time it is upstairs.

## The punchline, for fun

It will not guess, so quiet claims wait for their clock.

## The options, in plain words

A. Count released claims now and quiet ones only when an update time is known; store none here.
B. A follow-up stores each pull request's last update time, so the panel counts quiet claims too.

## What I had to decide

Keep the panel as built (A), or store the update time in a later change so quiet claims show too (B).

## What I did meanwhile

The panel uses the kit's own rule, so it never shows a claim `omni board` would read as in flight; it may miss a quiet claim the board already reads as stale.

## What it costs to change later

B is a nullable column on `pull_requests`, the collector writing it, and the loader reading it: a migration, outside this slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the collector in the GitHub App can read the update time on the same call it already makes (author).

```

<!-- /omni-outbox-settled: s1-02-engineering-board-quiet-claims-need-update-time -->
