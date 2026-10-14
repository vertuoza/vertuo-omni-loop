# Settled outbox items — PRD 1915

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-home-screen-draft-words -->

## s1-01-home-screen-draft-words — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-home-screen-draft-words
prd: 1915
slice: s1
rank: medium
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

The spec asks for the home page's design draft to carry the new words, but no part of the plan was given that draft to edit. Who updates it?

## The decision, in plain words

The home page itself was changed, and its design draft was left as it was, so it can be updated once, together with the PRD page's draft, when the feature is finished.

## The intro, for fun

The home page learned new words before its own sketch did.

## The punchline, for fun

For a moment, the drawing is the one telling old stories.

## The options, in plain words

A. A. Leave the drafts to one commit on the feature branch after the wave merges, covering home and the PRD page together (built).
B. B. Update the home draft and its mockup inside this slice, widening its ground to the screen library.
C. C. Leave the drafts as they are; the next design pass redraws them.

## What I had to decide

Whether the home and PRD page drafts get their new words in a follow-up commit on the feature branch, or inside this slice.

## What I did meanwhile

The built home page shows the new row and fine print; the draft in the screen library still shows the old fine print and no row.

## What it costs to change later

A few lines of text in two draft files and one mockup; nothing runs on them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives no slice the screen library folder, so the slice could not edit the draft inside its own ground (author).

```

<!-- /omni-outbox-settled: s1-01-home-screen-draft-words -->

<!-- omni-outbox-settled: s3-01-release-demo-history -->

## s3-01-release-demo-history — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-release-demo-history
prd: 1915
slice: s3
rank: medium
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

The release notes sample shown in the demo copies, word for word, the notes the first release actually published, and four of them say Claude. Should the sample keep the published words, or should both be reworded to speak of the agent?

## The decision, in plain words

The sample keeps the published notes as they were written, since they record what shipped and the real release page shows those same words from the database. The page's own introduction to the first release now speaks of the plugin for Claude Code and skills for any coding agent.

## The intro, for fun

History was written in September, and it named names.

## The punchline, for fun

Rewriting the past is a power best left to people.

## The options, in plain words

A. Keep the published notes and the sample word for word; only the page's own words speak of the agent.
B. Reword the four published first-release notes and the sample to speak of the agent.

## What I had to decide

Keep A unless the published first-release notes themselves should be reworded; then B rewords those notes and the sample together.

## What I did meanwhile

The demo's first-release notes still say Claude in four places, exactly as the live release page does.

## What it costs to change later

Switching to B later is a text edit of four published notes and the sample, with no data change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The slice's ground does not hold the published notes, so B could not be built here (author)
- The guard of the next slice will need the sample listed among its allowed files under A (author)

```

<!-- /omni-outbox-settled: s3-01-release-demo-history -->
