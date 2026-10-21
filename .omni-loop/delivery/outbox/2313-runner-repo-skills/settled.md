# Settled outbox items — PRD 2313

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-s1-claim-and-test-fakes -->

## s1-01-s1-claim-and-test-fakes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-21
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-21
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-s1-claim-and-test-fakes
prd: 2313
slice: s1
rank: medium
bears-on: none
raised: 2026-10-21
wave: 1
---

## The question, in plain words

The first part of this work had to touch two test helpers it was not assigned, and it also made the runner's job carry the allowed skills, which the plan gave to the second part. Is that split fine?

## The decision, in plain words

The job a runner picks up now carries the repository's allowed skills, read when it is picked up, and the shared test helpers know about them. The second part keeps the runner's own check and its tests.

## The intro, for fun

Two parts of the plan shared one doorway, and the first one through had to hold the door.

## The punchline, for fun

The second part walks straight in: the door is open, the hinges are tested.

## The options, in plain words

A. A. Keep it: the first part adds the allowed skills to the job, reads them when a runner picks the job up, and updates the two test files; the second part adds the runner's own check.
B. B. Move the reading of the allowed skills to the second part, and let the job's field stay optional until then.
C. C. Widen the plan's assigned files for the first part to cover the two test files, and keep the rest as built.

## What I had to decide

Keep it as built (A), or ask the second part to own the job's allowed skills and move that piece there (B).

## What I did meanwhile

The job a runner picks up lists the repository's allowed skills; a runner from before this change ignores them and refuses every repository skill, as today.

## What it costs to change later

Low either way: the change is a few lines in the service and two test files, undone by a revert of this part.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gave the job's shape to the first part but the job's sending to the second part, and only the first part may change the shape: adding a required field to the shape forced the sending code to fill it here.
- (author) The test helper that stands in for the database and one test of the web routes sit outside this part's assigned files; both changes are one added field each.

```

<!-- /omni-outbox-settled: s1-01-s1-claim-and-test-fakes -->
