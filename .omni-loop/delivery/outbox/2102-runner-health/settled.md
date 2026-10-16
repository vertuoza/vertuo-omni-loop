# Settled outbox items — PRD 2102

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-health-outside-territory -->

## s1-01-health-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-health-outside-territory
prd: 2102
slice: s1
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

Storing each runner's health needed two small changes the plan did not list for this slice: the test stand-in for the runners' storage, and the line that runs the new database check on every pull request. Should they stay?

## The decision, in plain words

I made both changes: the stand-in learned to keep samples, and the new database check runs beside the other runner checks. A runner's health and samples are read as optional, so the Runners page and its examples needed no change.

## The intro, for fun

The plan drew a neat fence around this slice, and the storage stand-in lived just past it.

## The punchline, for fun

Two short steps over the fence, both of them signposted.

## The options, in plain words

A. A. Keep both edits and the optional fields, as built.
B. B. Keep the edits, and make health and samples required fields of the board's runner in s3 or s4, editing the hand-built runners then.
C. C. Drop the SQL check and its workflow step, and rely on the migration's text test alone.

## What I had to decide

Whether the test stand-in for the runners' storage (apps/galaxy/src/runners/fixtures/store.fake.ts) and the supabase workflow's check job (.github/workflows/supabase.yml) may change in s1, though neither is in its territory, and whether a runner's health and samples stay optional fields of the board's runner.

## What I did meanwhile

The fake store implements the three new repository calls (add a sample, trim a runner's samples, read the hour's samples) and gives every runner row health null; nothing else in it changed. The workflow gains one step, `A runner's health and its samples`, running supabase/checks/runner_samples.sql, as the conventions form asks of every new check. The board's Runner type carries `health` (null for a runner that never reported) and `samples` as optional fields, so the page's demo board and the send tests that build a runner by hand needed no edit.

## What it costs to change later

Low. Reverting either edit is a one-file change: without the fake's methods the service and controller tests cannot run, and without the workflow step the new check is never run. Making `health` and `samples` required is one contract edit plus the hand-built runners in page/demo.ts, send/targets.test.ts, send/send.read.test.ts and runners.client.test.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan meant the fixtures folder to be part of `apps/galaxy/src/runners/runners.` (author).
- The new SQL check could not run here, with no local database: the feature PR's supabase job runs it (author).

```

<!-- /omni-outbox-settled: s1-01-health-outside-territory -->
