# Settled outbox items — PRD 1066

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-server-only-exemptions -->

## s1-01-server-only-exemptions — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-04
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-04
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-server-only-exemptions
prd: 1066
slice: s1
rank: medium
bears-on: none
raised: 2026-10-04
wave: 1
---

## The question, in plain words

Which server files of the arcade may go without the server-only label: should a file that only borrows a type from the server settings, or one used only while the site is being built, still carry it?

## The decision, in plain words

Only files that run server code need the label. Files that borrow a type and nothing else, the guide's diagram reader used while the guide is compiled, and the build's own configuration go without it, because the label would break the build for them.

## The intro, for fun

A label that says server only is great, until the builder itself trips over it.

## The punchline, for fun

So the label goes on what runs on the server, and the scaffolding stays bare.

## The options, in plain words

A. A. Only files that run server code carry the label; type borrowers and build-time files go without it (what was built).
B. B. Count borrowed types too, after moving those shared types somewhere the browser may safely read.
C. C. Exempt nothing, and move the guide diagram reader out of the arcade code the browser can reach.

## What I had to decide

Whether the coming import guard (s3) counts a type-only import of the server environment, and whether build-time modules are exempt from the server-only rule.

## What I did meanwhile

Twenty-nine arcade files carry the marker. Left without it: src/ask/classify.ts, src/business/suggest.ts, src/business/draft/extract.ts, src/releases/page/source.ts and src/releases/sync-run.ts (their src/env.ts import is type-only, and classify.ts and suggest.ts are reached from 'use client' files, so the marker would fail next build); src/docs/diagrams.ts (source.config.ts loads it while fumadocs-mdx compiles the guide under plain Node, where the marker throws); next.config.ts and artifact/build.ts (build configuration and a bundling script, like apps/galaxy/scripts/). s3's guard should count only value imports for this rule and exempt those build-time files.

## What it costs to change later

Changing it later is a few lines in the guard and, at most, moving the OpenRouter env types out of src/env.ts so client-reachable files no longer name it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says a type-only import counts for the rule table, and does not say whether it counts for the server-only marker rule (author).

```

<!-- /omni-outbox-settled: s1-01-server-only-exemptions -->

<!-- omni-outbox-settled: s1-02-server-only-outside-next -->

## s1-02-server-only-outside-next — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-04
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-04
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-server-only-outside-next
prd: 1066
slice: s1
rank: medium
bears-on: none
raised: 2026-10-04
wave: 1
---

## The question, in plain words

Outside the website itself, in the tests and in the release script, the server-only label refuses to load. Should each test and script switch it off where it needs to, or should the test runner switch it off once for everyone?

## The decision, in plain words

Each test that loads a labelled file switches the label off itself, as the existing ones already did, and the release and screenshot scripts load a small helper that reads the label the way the server does.

## The intro, for fun

Forty-nine tests learned the same one-line trick at once.

## The punchline, for fun

One line each is cheap; one line for everyone would be cheaper, if it may live outside the arcade.

## The options, in plain words

A. A. Each test switches the label off itself, and the two scripts load a helper that reads it as the server does (what was built).
B. B. Switch the label off once in the shared test settings and the shared script commands, and drop the per-test lines and the helper.

## What I had to decide

Keep the per-test mock and the scripts' resolve hook, or turn the marker off once in the shared test configuration and the root script commands.

## What I did meanwhile

49 arcade test files add vi.mock('server-only', () => ({})), the pattern src/home/home.test.ts already used. apps/galaxy/scripts/releases-sync.ts and scripts/shots.ts import apps/galaxy/scripts/server-only.ts (a node:module registerHooks resolve hook adding the react-server condition for 'server-only') and then import the server modules dynamically. The alternative, an alias of 'server-only' to its empty module in the root vitest.config.ts and --conditions=react-server on the root package.json scripts, sits outside this slice's territory.

## What it costs to change later

Moving to one shared alias later deletes the 49 mock lines and the hook: no stored data, no behaviour.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s3, which owns the root scripts and config, would rather carry one shared alias was not asked (author).

```

<!-- /omni-outbox-settled: s1-02-server-only-outside-next -->

<!-- omni-outbox-settled: s3-01-game-reads-the-database-types -->

## s3-01-game-reads-the-database-types — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-04
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-04
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-game-reads-the-database-types
prd: 1066
slice: s3
rank: medium
bears-on: none
raised: 2026-10-04
wave: 2
---

## The question, in plain words

The game writes its scores with the help of the database's own description of its tables, yet the agreed layering rules let it borrow only two small pieces of the delivery tool. Should the game also be allowed to borrow that description?

## The decision, in plain words

Yes: the game may read the database's description of its tables, the way both apps already do. Nothing else about the game's limits changes.

## The intro, for fun

The game was told to pack light, then turned up carrying the map of its own house.

## The punchline, for fun

So the map stays in the bag: it is the one thing the game cannot do without.

## The options, in plain words

A. The game may import the generated database types, as both apps may (what was built).
B. Keep the table as written: the game's adapter declares the few row shapes it writes by hand and drops the generated types.
C. Move the game's Supabase adapter out of the game into a zone that may read the types, and hand it to the game as a port.

## What I had to decide

Whether the game zone may import the generated supabase types (supabase/database.types.ts). The spec's rule table lets the game import only kit/lib/ids and kit/lib/env, while game/sources/supabase.ts, the game's REST adapter for its ledger, types its rows from the generated types (a type-only import). The guard found it on the whole tree.

## What I did meanwhile

The guard's table gives the game a third allowance, the supabase types, beside kit/lib/ids and kit/lib/env, with a comment naming this item; the ADR and the architecture form's table show it. The apps already had the same allowance in the spec's table.

## What it costs to change later

One line in the guard's table, its fixtures' messages, a row of the ADR and of the architecture form. Option B would also retype the game's adapter by hand.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's table and its decisions never mention the game's Supabase adapter, so whether leaving the supabase types out of the game's row was meant is unknown.

```

<!-- /omni-outbox-settled: s3-01-game-reads-the-database-types -->

<!-- omni-outbox-settled: s3-02-two-tests-change-homes -->

## s3-02-two-tests-change-homes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-04
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-04
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-two-tests-change-homes
prd: 1066
slice: s3
rank: medium
bears-on: none
raised: 2026-10-04
wave: 2
---

## The question, in plain words

Two existing checks broke the layering rules: the design library's check reached into the game, and a check of the whole test suite sat inside the delivery tool. Where should each live now?

## The decision, in plain words

The check that the design has a colour for every kind of game wound moved to the website, which may read both. The check of the test suite's time limits moved to the repository's own scripts, beside the other repository-wide checks.

## The intro, for fun

Two tests were caught standing in the wrong rooms, so they were kindly shown the door.

## The punchline, for fun

Same tests, same answers, just better addresses.

## The options, in plain words

A. Move both checks to a layer that may read what they compare (what was built).
B. Leave both tests where they were and widen the test allowance so the design's tests may read the game and the kit's tests may read the root config.

## What I had to decide

How to fix two leftovers the guard found: packages/design/src/sprites.test.ts imported game/events.ts (the design never imports the game, tests included), and kit/test/test-timeouts.test.ts imported the root vitest.config.ts.

## What I did meanwhile

The equality of the design's WOUND_TINT keys and the game's WOUND_KINDS moved to a new apps/galaxy/src/arcade/wound-tints.test.ts; the sprite test now loops over the design's own tints. The time-limit test moved to scripts/test-timeouts.test.ts, as the architecture form asks of a check about the repository as a whole; its one-line mention in vitest.config.ts's comment, a root file outside this slice's territory, was updated with it.

## What it costs to change later

Moving two test files back, if a reviewer prefers a row allowance instead.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a reviewer would rather allow the design's tests to read the game than move the check was not asked.

```

<!-- /omni-outbox-settled: s3-02-two-tests-change-homes -->

<!-- omni-outbox-settled: s3-03-rows-the-table-leaves-unsaid -->

## s3-03-rows-the-table-leaves-unsaid — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-04
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-04
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-rows-the-table-leaves-unsaid
prd: 1066
slice: s3
rank: medium
bears-on: none
raised: 2026-10-04
wave: 2
---

## The question, in plain words

The agreed layering rules say what each main part of the code may borrow, but stay silent on the delivery tool's own test helpers and on the repository's configuration files. What may those borrow?

## The decision, in plain words

The delivery tool's test helpers may borrow the tool itself and its command line, and the configuration files may borrow anything, like the repository's own scripts. Every package must also list any sibling package it borrows by name.

## The intro, for fun

Every room in the house got a rule, except the broom cupboard and the fuse box.

## The punchline, for fun

So the broom cupboard may hold brooms, and the fuse box may touch every wire.

## The options, in plain words

A. Give the unlisted parts the rules above, and ask every package to list what it borrows (what was built).
B. Check only the parts the rules list, and ask only the design library to list what it borrows, leaving the rest unchecked.
C. Narrow the config files' row to what they import today, so a config file cannot reach an app.

## What I had to decide

What the guard does where the spec's rule table has no row, and how far its declared-dependency check reaches. The table names kit/test and the supabase types as zones but gives them no row, and names no zone for eslint.config.ts, vitest.config.ts and .claude/hooks/. It asks only packages/design to declare the kit.

## What I did meanwhile

kit/test may import kit/lib and kit/bin (it is the kit's own test fixtures); the supabase types and the root manifest import nothing; the repository's config files and Claude Code's hooks may import anything, like scripts. Any import by package name (vertuo-omni-plan/..., @omni/*) from another workspace package must be declared in the importing package's manifest, for every package, not only packages/design: it holds on the whole tree today.

## What it costs to change later

A few lines of the guard's table and its fixtures, and the matching rows of the ADR and of the architecture form.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether its table was meant to be complete, nor whether the declared-dependency rule was meant for packages/design only.

```

<!-- /omni-outbox-settled: s3-03-rows-the-table-leaves-unsaid -->
