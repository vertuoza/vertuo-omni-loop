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
