---
id: s5-04-e2e-settings-read-the-environment
prd: 2898
slice: s5
rank: high
bears-on: ADR-0057
raised: 2026-11-15
wave: 2
---

## The question, in plain words

The end-to-end tests need three settings from the machine they run on, and the repository reads such settings in one shared place only. How should the test settings get them?

## The decision, in plain words

They take them from the one shared reader of the machine's settings, by name, without adding a new group of settings to it. The secret is sent only to the address under test.

## The intro, for fun

Three notes on the fridge, and one rule about who may read the fridge.

## The punchline, for fun

The tests asked the one who holds the key to the kitchen.

## The options, in plain words

A. Read the three settings by name from the shared reader: what was built.
B. Add a named group for the end-to-end settings to the shared reader, and read them through it.
C. Give the end-to-end tests a reader of their own, listed beside the others in the guard that checks them.

## What I had to decide

`e2e/e2e.config.ts` needs `APP_URL`, the variable `e2e.bypassEnv` names, and `e2e.model`. The environment guard (`scripts/env-guard.test.ts`, ADR-0057) refuses `process.env` outside the env modules, and a new module for the e2e runtime would be a new entry in that guard, a file the access area's locked N-PRODUCT-17 governs. A new group in `kit/lib/env/read.ts` is outside the territory. The e2e framework itself reads no `APP_URL`: its docs say a config reads it.

Decided by: Jev (hardToRevert 0.56) · agent said false

## What I did meanwhile

`e2e/e2e.config.ts` takes `processEnv()` from `kit/lib/env/read.ts` and reads `APP_URL` and the bypass variable from it; the model comes from `.omni-loop/config.yml` through `loadConfig`. No guard changed.

## What it costs to change later

Three lines in `e2e/e2e.config.ts`; a group in `kit/lib/env/read.ts` instead is one `envGroup` and its listing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the decision record on reading the environment means a program's configuration file may read a variable by name from the shared reader
