# Settled outbox items — PRD 2299

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-kb-index-json-lists -->

## s1-01-kb-index-json-lists — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-21
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-21
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-kb-index-json-lists
prd: 2299
slice: s1
rank: medium
bears-on: none
raised: 2026-10-21
wave: 1
---

## The question, in plain words

When the session-start knowledge block is cut to fit its size cap, should the machine-readable form list only the items the block shows, or every item the page holds?

## The decision, in plain words

The machine-readable form lists only the items the block shows, and a separate count says how many were left out of each list.

## The intro, for fun

A list that has to fit in a small box must choose what to leave out.

## The punchline, for fun

Here it leaves out the tail and says how much, so nothing disappears quietly.

## The options, in plain words

A. A. The lists are the items the block prints, cut says how many were left out (built).
B. B. The lists hold every item the page sent, cut says how many the text block left out.

## What I had to decide

The spec says --json prints { state, product, words, legal, personas, syncedAt, cut } but not whether the lists are whole or as printed. Built: the lists are the printed items, cut holds the counts left out. Changing to whole lists is a one-line change in kit/lib/product/index.ts.

## What I did meanwhile

Anything reading the machine-readable form sees the same items as the text block.

## What it costs to change later

A reader that wants every item must run omni kb glossary or omni kb legal instead.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the machine-readable lists are whole or as printed (author)

```

<!-- /omni-outbox-settled: s1-01-kb-index-json-lists -->

<!-- omni-outbox-settled: s2-01-s2-check-inbox-print-in-check-ts -->

## s2-01-s2-check-inbox-print-in-check-ts — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-21
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-21
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-s2-check-inbox-print-in-check-ts
prd: 2299
slice: s2
rank: medium
bears-on: none
raised: 2026-10-21
wave: 1
---

## The question, in plain words

The spec warnings about avoided words have to be printed by the command that runs the inbox check, a file this slice's list of files did not include. Is a one-line change there acceptable?

## The decision, in plain words

The warnings are written by the inbox check's own file and printed by the check command's file, with a three-line change there, so the check's pass or fail result is untouched.

## The intro, for fun

A warning needs a mouth to speak with.

## The punchline, for fun

We borrowed three lines of someone else's mouth.

## The options, in plain words

A. A. Print the warnings from the check command, as built
B. B. Leave the check command alone and widen the plan's territory, so a later slice prints them

## What I had to decide

Edited kit/bin/commands/check.ts (checkInbox) to print inboxAvoidWarnings after the report; its return value is unchanged.

## What I did meanwhile

Nothing waits: the lines print and the check stays as green or red as before.

## What it costs to change later

Reverting means deleting three lines in check.ts and the warnings stop printing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan's territory meant to include check.ts is not stated (author)

```

<!-- /omni-outbox-settled: s2-01-s2-check-inbox-print-in-check-ts -->
