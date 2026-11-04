# Settled outbox items — PRD 2632

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-law-only-domain-folder -->

## s1-01-law-only-domain-folder — adopted

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
id: s1-01-law-only-domain-folder
prd: 2632
slice: s1
rank: medium
bears-on: none
raised: 2026-11-04
wave: 1
---

## The question, in plain words

When a domain's folder holds only its business laws, should the knowledge check still ask it for the other files every domain folder carries?

## The decision, in plain words

No: a domain folder that holds its business laws and nothing else is accepted as it is, so a product can write its laws without filling in the rest of that domain's knowledge first.

## The intro, for fun

A folder with one good file in it walks up to the inspector.

## The punchline, for fun

The inspector reads the one file and lets it through.

## The options, in plain words

A. A. A domain folder holding only its business laws asks for nothing else, as built
B. B. Every domain folder, business laws or not, carries its README and its three register files
C. C. Accept a folder holding only business laws only in a repository that keeps no locked laws of its own

## What I had to decide

Keep A, or choose B and every domain folder holding business laws must also carry its README and the three register files before the check is green.

## What I did meanwhile

A folder holding only business-laws.md passes the layout check; a folder holding any other file is still asked for its README and the three register files, as before.

## What it costs to change later

One condition in the layout check to remove; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The product/ folder is still asked for its three register files whenever the knowledge folder exists, business laws or not; a plan repository with laws.source none and no product registers stays red until it adds them (author).
- Whether Vertuoza's plan repository already carries the product register files was not checked from here (author).

```

<!-- /omni-outbox-settled: s1-01-law-only-domain-folder -->
