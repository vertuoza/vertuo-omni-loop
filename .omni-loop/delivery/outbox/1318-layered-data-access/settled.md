# Settled outbox items — PRD 1318

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-layering-check-reading -->

## s1-01-layering-check-reading — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-layering-check-reading
prd: 1318
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The spec names one database module and says the check reads every file of the galaxy app. Which files should it read, and which modules count as reaching the database?

## The decision, in plain words

The check reads every app file except tests and test fakes, counts the old cookie builder as a database module beside the new one, treats any file named as a client as a browser file, and counts a storage bucket only when it is called.

## The intro, for fun

A rule is only as good as the files it reads.

## The punchline, for fun

The fakes pretend to be the database, so they get a pass for good acting.

## The options, in plain words

A. As built: the check skips tests and fakes, counts both the old and the new database builders, and treats every client-named file as a browser file.
B. Keep to the spec's words: read the fakes too and count only the new database module, so more fakes and fewer pages sit on the list.
C. As built, but read the fakes as well, so they sit on the list until each area moves.

## What I had to decide

Whether the layering check skips test fakes, counts supabase-server.ts as a database module, treats every *.client.ts as a browser file, and flags .storage only through .storage.from(.

## What I did meanwhile

The baseline holds 150 lines with these choices; any other reading only changes the guard's constants and regenerates the baseline.

## What it costs to change later

Changing it is a constant in scripts/layering-guard.test.ts and a regenerated layering/baseline.json: no migration, no product change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says 'every tracked TypeScript file under apps/galaxy'; leaving out *.fake.ts is my reading, since a fake stands for the database in tests and would otherwise sit on the baseline forever.
- (author) Counting supabase-server.ts as a database module is beyond the spec's one module: without it a controller could import the cookie builder and pass the client on unflagged.

```

<!-- /omni-outbox-settled: s1-01-layering-check-reading -->

<!-- omni-outbox-settled: s1-03-db-module-test-outside-territory -->

## s1-03-db-module-test-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-db-module-test-outside-territory
prd: 1318
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The new database module had no test in the plan, and the repository's dead-code and complexity gate refuses a module nothing uses or covers. Should the slice add a test beside it, outside the ground the plan gave it?

## The decision, in plain words

The slice adds one test file beside the new database module, the only file it writes outside its planned ground, so the module is covered and the gate passes without any suppression.

## The intro, for fun

A new module walked in with nobody to vouch for it.

## The punchline, for fun

So it brought its own test, one step past the fence.

## The options, in plain words

A. As built: one test file beside the new database module, reported as spillover.
B. Drop the test and leave the module unused until the next slice, which needs a suppression the rules forbid.

## What I had to decide

Whether apps/galaxy/src/data/db.test.ts may land with slice s1, outside its declared territory.

## What I did meanwhile

The test sits beside the module; the wave's territory check reports it as one breach, which is never fatal.

## What it costs to change later

Moving or deleting one test file; nothing else depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory names db.ts alone, so its test was not declared; the commit gate refuses an unused, uncovered file and the briefing forbids a suppression.

```

<!-- /omni-outbox-settled: s1-03-db-module-test-outside-territory -->
