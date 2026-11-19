# Settled outbox items — PRD 3088

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-02-push-sends-kind -->

## s2-02-push-sends-kind — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: BR-PRODUCT-138
- Raised: 2026-11-19
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-push-sends-kind
prd: 3088
slice: s2
rank: medium
bears-on: BR-PRODUCT-138
raised: 2026-11-19
wave: 1
---

## The question, in plain words

The database now files a bug team mission when the pushed brief says it is one, but the page's code that sends a brief today passes only its fleet, goal, measures, scope and mandate. No slice of the plan owns that code, so who makes it send the kind?

## The decision, in plain words

The database reads the kind from the brief, and reads an ordinary mission when the brief names none, so every push today works as before. A bug team brief stays refused for its empty scope until the page's code passes the kind on.

## The intro, for fun

The database learned a new word, but the messenger still leaves it out.

## The punchline, for fun

Until someone adds one field to the message, the bug team cannot be filed.

## The options, in plain words

A. A. The database reads the brief's kind, an ordinary mission when none; the page's push is left for a small extra slice (built).
B. B. The same, and the slice that wires the bug team's run also passes the kind in the page's push.

## What I had to decide

Add the kind to what the page's mission push sends, in a small extra slice of this PRD (A), or let the slice that wires the bug team's run take that one file on (B).

## What I did meanwhile

A push of a bug team brief is refused, naming its scope; every other mission push is unchanged.

## What it costs to change later

One field added to the brief the page sends, and its test; nothing in the database changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The brief's schema gains the kind in slice s1; whether the page's push then passes it depends on that file, which no territory of the plan holds.
- (author) A push never changes a mission's kind: the database refuses it naming the kind, which BR-PRODUCT-138's list of what a push updates leaves out.

```

<!-- /omni-outbox-settled: s2-02-push-sends-kind -->

<!-- omni-outbox-settled: s2-03-bug-fix-and-release-shape -->

## s2-03-bug-fix-and-release-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-19
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-bug-fix-and-release-shape
prd: 3088
slice: s2
rank: medium
bears-on: none
raised: 2026-11-19
wave: 1
---

## The question, in plain words

The spec names a bug's fix pull request and the release that holds it, but not how each is stored, nor whether a bug may read fixed without its release.

## The decision, in plain words

A bug keeps its fix pull request as a number on the Omni Loop repository and its release as a plain version number with no leading v. A bug reads fixed only once its release is known.

## The intro, for fun

A version has many spellings, and only one of them is easy to compare.

## The punchline, for fun

So the database keeps the plain one and asks for it before saying fixed.

## The options, in plain words

A. A. A pull request number and a plain version, fixed needing its version (built).
B. B. The pull request's whole link, as a mission's repairs keep it.

## What I had to decide

Keep a number and a plain version, fixed needing its version (A), or keep the pull request's whole link as a mission's repairs do (B).

## What I did meanwhile

The App writes the pull request's number and the version without its v; the room adds the v back when it shows it.

## What it costs to change later

Changing the shape later is one migration and the App's two writers; no bug has a fix yet.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A mission's repairs keep their fix as a whole link; the bug reports keep their issue as a number on their repository, which this follows.

```

<!-- /omni-outbox-settled: s2-03-bug-fix-and-release-shape -->
