# Settled outbox items — PRD 1369

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-unreadable-base-reads-unknown -->

## s2-01-unreadable-base-reads-unknown — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-unreadable-base-reads-unknown
prd: 1369
slice: s2
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

When the check cannot read the branch it compares against, should it say it does not know, or stop with an error?

## The decision, in plain words

It says it does not know whether a screen changed, names the branch it could not read, and carries on, so the agent judges from the change itself.

## The intro, for fun

The check went looking for the branch to compare against and found an empty shelf.

## The punchline, for fun

So it shrugged politely instead of slamming the door.

## The options, in plain words

A. A. Print ui: unknown with the base it could not read, exit 0 (built)
B. B. Stop with a usage error, exit 2, as omni generated does
C. C. Fetch the base first, then fall back to A

## What I had to decide

Whether a missing comparison branch is an unknown answer or a usage error.

## What I did meanwhile

omni design touched prints ui: unknown and a line naming the base it could not read, and exits 0; a wrong number of arguments still exits 2.

## What it costs to change later

A constant: switching to an error is a one-line change in kit/bin/commands/design.ts and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the command always exits 0 and lists the four answers, but does not say what a base git cannot read prints (author).

```

<!-- /omni-outbox-settled: s2-01-unreadable-base-reads-unknown -->

<!-- omni-outbox-settled: s2-02-design-paths-glob-syntax -->

## s2-02-design-paths-glob-syntax — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-design-paths-glob-syntax
prd: 1369
slice: s2
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

Which pattern syntax should the list of screen locations accept?

## The decision, in plain words

It accepts the usual star, double star, question mark and either-or braces; a plain folder name means everything under it; square brackets are taken as written, so folders named with brackets match as they are.

## The intro, for fun

Every tool has its own dialect of wildcards, and each thinks its own has no accent.

## The punchline, for fun

This one speaks the common phrases and leaves the slang at the door.

## The options, in plain words

A. A. The common subset, brackets literal, a bare name as a folder (built)
B. B. Full glob syntax, with character classes and negation
C. C. Regular expressions, as the landings section uses

## What I had to decide

Whether design.paths needs character classes or negation, or the common subset is enough.

## What I did meanwhile

kit/lib/design/glob.ts matches *, **, ?, {a,b}; a pattern ending in / or with no wildcard is a folder prefix; [ and ] are literal.

## What it costs to change later

A constant: a wider syntax is an added branch in kit/lib/design/glob.ts; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says design.paths is a list of globs without naming the dialect (author).

```

<!-- /omni-outbox-settled: s2-02-design-paths-glob-syntax -->
