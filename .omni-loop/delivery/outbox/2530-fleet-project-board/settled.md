# Settled outbox items — PRD 2530

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-app-route-test-counts-the-new-function -->

## s2-01-app-route-test-counts-the-new-function — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-27
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-app-route-test-counts-the-new-function
prd: 2530
slice: s2
rank: medium
bears-on: none
raised: 2026-10-27
wave: 2
---

## The question, in plain words

Registering the new board function broke an App test that sits outside the files this piece of work was given: should it change here?

## The decision, in plain words

I updated that one test to expect the new function, and nothing else in it, so the App's full test run stays green.

## The intro, for fun

The App's guest list had fourteen names, and a fifteenth guest showed up at the door.

## The punchline, for fun

We wrote the new name on the list rather than leave the guest outside.

## The options, in plain words

A. A. Update the route test in this slice: the function id added to its list, the counts moved from 14 to 15 and 19 to 20.
B. B. Leave the route test alone and update it in a follow-up pull request, with the App's tests red until then.

## What I had to decide

Keep the test as updated (A), or move the change into its own follow-up (B).

## What I did meanwhile

The test expects fifteen functions, the fleet board's last, and twenty registered on Inngest.

## What it costs to change later

B costs one small follow-up pull request; until it lands the App's tests are red. A costs nothing more.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan registers the function in functions.ts but does not list apps/omni-app/src/outbox-check/inngest-route.test.ts, which counts the served functions; the change there is three lines and adds no behaviour.

```

<!-- /omni-outbox-settled: s2-01-app-route-test-counts-the-new-function -->
