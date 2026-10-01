# Settled outbox items — PRD 871

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-constituents-check-in-ci -->

## s1-01-constituents-check-in-ci — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-constituents-check-in-ci
prd: 871
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

The new database check for constituents only runs on pull requests if the database workflow lists it, and that workflow sits outside this slice's area. Should the slice add it there?

## The decision, in plain words

I added one step to the database workflow so every pull request runs the constituents check, beside the business and Jev checks.

## The intro, for fun

A brand new safety check that nobody runs is just a very tidy file.

## The punchline, for fun

So it got a seat on the bus with the other checks.

## The options, in plain words

A. A. Keep the step in the database workflow, added by this slice.
B. B. Drop the step here and add it in a follow-up change.
C. C. Run the constituents check from inside the business check instead.

## What I had to decide

Keep the extra step in the database workflow, or move it to a separate change.

## What I did meanwhile

Every pull request touching the database runs the constituents check.

## What it costs to change later

Removing the step is a one-line change; nothing else depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names no owner for the database workflow file; I took it as the slice that writes the check. (author)

```

<!-- /omni-outbox-settled: s1-01-constituents-check-in-ci -->

<!-- omni-outbox-settled: s1-02-statement-shape-and-never-numbers -->

## s1-02-statement-shape-and-never-numbers — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-statement-shape-and-never-numbers
prd: 871
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

The spec does not say how long a product's Statement may be, whether it can be removed, or whether Never line numbers count per product or per workspace.

## The decision, in plain words

A Statement is one line of up to 400 characters, an owner can remove it and write a new one, and Never line numbers count per product, so each product starts at number one.

## The intro, for fun

Every product gets one sentence about who it is, like a dating profile but stricter.

## The punchline, for fun

Four hundred characters, one line, no novels.

## The options, in plain words

A. A. One line up to 400 characters, removable, Never numbers per product.
B. B. Allow several lines in the Statement, up to 1000 characters.
C. C. Count Never numbers across the whole workspace instead of per product.

## What I had to decide

Confirm the Statement length and the per product numbering, or pick other limits.

## What I did meanwhile

Owners type Statements up to 400 characters on one line, and each product numbers its own Never lines from one.

## What it costs to change later

Changing the length is one small database change; renumbering Never lines after people cite them would be costly.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Nothing in the spec or the knowledge base sets a Statement length; 400 is my pick from the proposed Statements, which run about 150 characters. (author)

```

<!-- /omni-outbox-settled: s1-02-statement-shape-and-never-numbers -->
