# Settled outbox items — PRD 1274

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-confirmed-steps-ledger -->

## s2-01-confirmed-steps-ledger — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-confirmed-steps-ledger
prd: 1274
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

Where should the tool remember that a person already confirmed a changed recording, so the next check does not flag it again?

## The decision, in plain words

A small list kept beside the recordings, committed together with the confirmed recording. The check skips a step on that list until its actions change again.

## The intro, for fun

A recording was waved through once; it should not be stopped at the door twice.

## The punchline, for fun

A tiny list of approved steps keeps the same one from queuing up again.

## The options, in plain words

A. A. A short approved-steps list committed beside the recordings, with held files kept outside every commit.
B. B. Compare against the last committed recording instead of the merge-base, with no list.
C. C. Keep the list in the outbox folder of the PRD.

## What I had to decide

Confirm that the approved-steps list lives beside the recordings and that held recordings wait outside every commit.

## What I did meanwhile

Built as described: held recordings wait outside every commit, and the approved-steps list sits beside the recordings.

## What it costs to change later

Moving the list or the hold folder later is a constant and a rename, with no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether QA wants the confirmation recorded somewhere visible in the pull request (author)

```

<!-- /omni-outbox-settled: s2-01-confirmed-steps-ledger -->
