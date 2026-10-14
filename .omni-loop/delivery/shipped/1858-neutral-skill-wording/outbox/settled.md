# Settled outbox items — PRD 1858

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-02-briefing-slot-outside-territory -->

## s1-02-briefing-slot-outside-territory — adopted

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
id: s1-02-briefing-slot-outside-territory
prd: 1858
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The new section of the agents' rules only prints once the kit's list of sections names it, and that list sat outside this slice's agreed files. Is it fine that the slice added one name to it?

## The decision, in plain words

The slice added the new section's name to the kit's list of briefing sections, and to the test that spells that list out, and changed nothing else there.

## The intro, for fun

A new section of the rules turned up, but the guest list was in another room.

## The punchline, for fun

The slice wrote one name on the list and left the rest of the room alone.

## The options, in plain words

A. A. Keep the added name in the forms table and its test, as built.
B. B. Undo it here and plan a slice whose files include the forms table.

## What I had to decide

Answer A to keep the one added name; B to move the change into its own slice.

## What I did meanwhile

The section prints as a kit default in every repository whose own briefing lacks it.

## What it costs to change later

Two one-line changes outside the planned files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan's territory for s1 named the template but not the forms table that every template must match, so the plan missed this file

```

<!-- /omni-outbox-settled: s1-02-briefing-slot-outside-territory -->

<!-- omni-outbox-settled: s1-01-briefing-session-budget-raise -->

## s1-01-briefing-session-budget-raise — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-13T18:26:44Z
- Channel: feature pull request #1861
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1861#issuecomment-6152356585
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-10-13
- Slice: s1
- Wave: 1
- Stays here: a one-off raise of this repository's context ceilings, recorded in `.omni-loop/budgets/context.json` itself; no lasting rule beyond the budget file.

### The answer, as it was given

```text
A. A. Keep the raised limits: briefing 4096 bytes, session 10240 bytes, as the spec agreed.
```

### The item, as it was raised

```text
---
id: s1-01-briefing-session-budget-raise
prd: 1858
slice: s1
rank: high
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The spec raised the size limits of the rules every agent reads first, but the size check only turns green on a person's answer. Do you confirm the raise?

## The decision, in plain words

The two limits are raised as the spec says, and this question carries your yes to the size check, which only reads answered questions.

## The intro, for fun

The spec already said yes, but the size check only listens to answered questions.

## The punchline, for fun

One quick answer and the check stops holding its breath.

## The options, in plain words

A. A. Keep the raised limits: briefing 4096 bytes, session 10240 bytes, as the spec agreed.
B. B. Keep the old limits and trim the new section, or the agents guide, until both fit again.

## What I had to decide

Answer A to confirm the raise the spec agreed at the design. Budget raise: `briefing` to 4096 bytes. Budget raise: `session` to 10240 bytes.

## What I did meanwhile

The context check stays red on the feature pull request until this is answered; nothing else waits on it.

## What it costs to change later

Each agent session reads about 1 KB more before its first step.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec says no outbox item is raised for this raise, but the check matches only settled items, so the raise could not turn green without one

```

<!-- /omni-outbox-settled: s1-01-briefing-session-budget-raise -->

<!-- omni-outbox-settled: s2-01-law-proof-test-reworded -->

## s2-01-law-proof-test-reworded — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-13T18:26:44Z
- Channel: feature pull request #1861
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1861#issuecomment-6152356585
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: N-PRODUCT-15
- Raised: 2026-10-13
- Slice: s2
- Wave: 2
- Stays here: the test's assertions follow the reworded skills; every law's meaning is unchanged, so no register entry changes.

### The answer, as it was given

```text
A. Keep the edited test: it reads the neutral wording with the Claude way in brackets, and every rule's check stays as it was.
```

### The item, as it was raised

```text
---
id: s2-01-law-proof-test-reworded
prd: 1858
slice: s2
rank: high
bears-on: N-PRODUCT-15
raised: 2026-10-13
wave: 2
---

## The question, in plain words

The test that proves several locked rules, among them that only a person merges into the main branch, was edited where it read the skills' old Claude-only wording. Do you approve that edit?

## The decision, in plain words

Only the lines that read the old wording changed; each rule's own check is exactly as it was, and the full test run is green.

## The intro, for fun

Words moved around a guard, and the guard asks a person to look before it stands down.

## The punchline, for fun

Same lock, new label on the door.

## The options, in plain words

A. Keep the edited test: it reads the neutral wording with the Claude way in brackets, and every rule's check stays as it was.
B. Undo the test edits and keep the old Claude-only wording in the skills.

## What I had to decide

Approve the change to the rules' test on the feature PR (the lock line names who must). Decided by: Jev (hardToRevert 0.76) · agent said true

## What I did meanwhile

The feature PR stays red on the rules' check until the person named by the lock approves it.

## What it costs to change later

Option B means putting the Claude-only wording back in every skill, which undoes the PRD.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The edit was checked by the full test run and by the snapshot of every skill's commands and guards; no one has read each changed line against the rules yet (author)

```

<!-- /omni-outbox-settled: s2-01-law-proof-test-reworded -->
