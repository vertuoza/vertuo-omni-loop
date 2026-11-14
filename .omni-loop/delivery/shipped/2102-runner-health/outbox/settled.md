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
- Stays here: A one-off territory exception and a local typing choice; the new SQL check running in the supabase workflow is already ADR-0028's convention.

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

<!-- omni-outbox-settled: s2-01-mac-memory-pauses -->

## s2-01-mac-memory-pauses — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s2
- Wave: 2
- Became: ADR-0117

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-mac-memory-pauses
prd: 2102
slice: s2
rank: medium
bears-on: none
raised: 2026-10-16
wave: 2
---

## The question, in plain words

On a Mac, the memory figure counts the memory the system keeps for its own cache as used, so a Mac runner often reads near 90 % used while it is fine, and would pause at the default limit. Should a Mac read its memory another way, or keep the reading the spec gives?

## The decision, in plain words

I kept the reading the spec gives and the default limit of 85 %. A Mac runner that pauses for no reason can be started with a higher memory limit, or with the memory limit switched off, and the page shows why it paused.

## The intro, for fun

A Mac hoards spare memory in its cache and then swears it has none left.

## The punchline, for fun

The runner believes it and takes a nap.

## The options, in plain words

A. Keep the spec's reading and the 85 % default on every platform; a Mac owner raises the memory limit, or sets it to 100 to switch it off.
B. On a Mac, read memory used without the cache (the active and wired memory only), in a follow-up change to the sampler.
C. On a Mac, leave the memory limit off by default, and pause there on disk and load only.

## What I had to decide

Whether a Mac runner reads its memory used as the spec says (all memory minus the free memory) and pauses at the same default limit, or reads it in a way that leaves the cache out.

## What I did meanwhile

pressure() and the pause use the sample s1 built, unchanged: on Linux, memory used is the total minus MemAvailable; elsewhere, the total minus os.freemem(). On the laptop this slice was built on (macOS, 32 GB), that reads 89 % used, so `omni runner` with no flag would pause at once. The kit README says that `--max-memory 100` switches the memory limit off. The command tests and the loop tests sample a fixed machine, never the real one, so they pass on any laptop.

## What it costs to change later

Low. Reading a Mac's memory without its cache is one function in the sampler (parsing `vm_stat`), plus its tests; changing the Mac's default limit is one constant. Nothing is stored differently.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names `total − os.freemem()` for every platform but Linux, and its user stories name Linux runners (nimbus-agents); whether anyone runs a runner on a Mac today is not written anywhere.

```

<!-- /omni-outbox-settled: s2-01-mac-memory-pauses -->
