# Settled outbox items — PRD 1584

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s3-01-pixel-perfect-line-placement -->

## s3-01-pixel-perfect-line-placement — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-pixel-perfect-line-placement
prd: 1584
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Where should the feature pull request show which screens to look at closely, and where does that list come from?

## The decision, in plain words

The line sits right under the link to the PRD, and lists the screens the comparison page names in its pixel-perfect part, or says none.

## The intro, for fun

Every reviewer wants a map before the walk.

## The punchline, for fun

We put the map at the top, where eyes land first.

## The options, in plain words

A. A. Right after the link line, read from the screens the comparison page names (built)
B. B. Inside the reviewer focus section, further down the body
C. C. Read from the screens the merged slices touched instead of the comparison page

## What I had to decide

Keep the line at the top of the feature pull request, read from the comparison page, or move it to the reviewer focus section further down.

## What I did meanwhile

The skill writes the line right after the link line, with design on only.

## What it costs to change later

Moving it later is one sentence of skill text.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the line but not where it sits in the body nor what it is read from (author).

```

<!-- /omni-outbox-settled: s3-01-pixel-perfect-line-placement -->
