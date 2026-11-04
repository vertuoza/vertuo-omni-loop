# Settled outbox items — PRD 2648

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-pr-ref-optional-key -->

## s1-01-pr-ref-optional-key — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-04
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-04
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-pr-ref-optional-key
prd: 2648
slice: s1
rank: medium
bears-on: none
raised: 2026-11-04
wave: 1
---

## The question, in plain words

The new pull request reference setting could be stored as an empty value by default, or left absent when a repository does not set it. Which one do we want?

## The decision, in plain words

It is left absent when not set, and everything reads a missing setting as off. This avoids touching two other files that build the pull request settings by hand, which are outside this slice.

## The intro, for fun

A setting nobody asked for is easier to ignore when it is not even there.

## The punchline, for fun

Absent it stays, until a repository asks for it.

## The options, in plain words

A. A. Optional key, read as off when missing (as built)
B. B. Explicit empty default, and update the two files that build the settings by hand

## What I had to decide

Either keep the key optional, or give it an empty default and update the two files that build the pull request settings by hand in a later slice.

## What I did meanwhile

A repository without the setting sees no change; a missing key reads as off.

## What it costs to change later

Switching to an explicit empty default later is a one-line change plus two small edits.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a later slice may edit the two settings-building files (author)

```

<!-- /omni-outbox-settled: s1-01-pr-ref-optional-key -->
