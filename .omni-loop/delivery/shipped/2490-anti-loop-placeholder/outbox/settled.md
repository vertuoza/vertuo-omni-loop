# Settled outbox items — PRD 2490

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-mirrored-crest-ring-ramp -->

## s1-01-mirrored-crest-ring-ramp — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-mirrored-crest-ring-ramp
prd: 2490
slice: s1
rank: medium
bears-on: none
raised: 2026-10-23
wave: 1
---

## The question, in plain words

The spec says the mirrored crest has its ring in the anti-loop signal colour but gives one colour, and the crest is shaded in four tones. Which tones should the ring use?

## The decision, in plain words

The ring keeps its four-tone shading, in pink: the anti-loop signal pink is the main tone, with a lighter tint, a darker pink and a deep pink around it. The outline and the shadow keep their colours.

## The intro, for fun

The crest looks in the mirror and turns pink.

## The punchline, for fun

Four shades of pink, one of them the signal.

## The options, in plain words

A. A. Four pink tones around the signal, as built
B. B. One flat signal pink for the whole ring
C. C. Keep the yellow ring and only mirror the pixels

## What I had to decide

Ramp: #ffc2e3, #ff3ea5 (the signal), #c21a80, #7d0f55, in @omni/design's logo module. Changing it is a constant.

## What I did meanwhile

The mirrored crest uses this ramp.

## What it costs to change later

Nothing stored; a different answer changes four constants.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The three lighter and darker tones are not in the concept's table (author)

```

<!-- /omni-outbox-settled: s1-01-mirrored-crest-ring-ramp -->
