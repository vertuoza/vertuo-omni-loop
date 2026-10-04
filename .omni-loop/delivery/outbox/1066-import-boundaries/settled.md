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
