# Settled outbox items — PRD 603

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-docs-test-outside-territory -->

## s1-01-docs-test-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-docs-test-outside-territory
prd: 603
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

Adding the new guide page also changed a second test that checks the guide's menu as the site shows it, which the plan had not listed. Is it fine that this slice updated that test too?

## The decision, in plain words

The slice updated that test so it expects the new page in the menu, between Your first PRD and Use cases, and changed nothing else in it.

## The intro, for fun

One new page, and a second test raised its hand to say it counts the pages too.

## The punchline, for fun

It now counts to nine, like its neighbour.

## The options, in plain words

A. A. keep the test change in this slice, the new page added to the lists it checks (built)
B. B. move the test change to a slice of its own, so each slice stays inside what its plan names
C. C. have that test read the page list from the guide itself, so a new page never needs it changed

## What I had to decide

Whether a slice may update a test outside its territory (apps/galaxy/src/docs/docs.test.ts) when that test only pins the guide's page list.

## What I did meanwhile

The sub-PR carries the updated docs.test.ts: the sidebar, the page params, the Next links and the code-block sweep now include several-repositories, and every test is green.

## What it costs to change later

A few lines of one test file; no stored shape, no product code.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan named apps/galaxy/src/docs/guide.test.ts as the only test to change; apps/galaxy/src/docs/docs.test.ts also lists the pages and fails without the update.

```

<!-- /omni-outbox-settled: s1-01-docs-test-outside-territory -->
