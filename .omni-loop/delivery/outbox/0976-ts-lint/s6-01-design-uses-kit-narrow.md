---
id: s6-01-design-uses-kit-narrow
prd: 976
slice: s6
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

The drawing library behind the arcade's sprites and logo had to stop assuming a colour or a shape is always there. Should it borrow the toolkit's existing checks for that, or carry its own copy?

## The decision, in plain words

The drawing library now uses the toolkit's own checks, so a missing colour or shape stops with a clear message naming it, the same way everywhere else.

## The intro, for fun

The paint box asked to borrow the toolkit's ruler.

## The punchline, for fun

It said yes, and now both measure the same way.

## The options, in plain words

A. The drawing library borrows the toolkit's two checks directly.
B. The drawing library names the toolkit as a dependency first, then borrows the checks by name, as the galaxy map does.
C. The drawing library keeps its own copy of the two checks and never depends on the toolkit.

## What I had to decide

packages/design imported nothing from the kit before; clearing its `!` assertions in source needed `defined` and `at`, which the spec places in kit/lib/narrow.ts, while packages/design declares no dependency on the root package.

## What I did meanwhile

packages/design/src (draw, forge, sprites, heroes, logo, personas, fonts) imports `at` and `defined` from `../../../kit/lib/narrow.ts` by relative path, the way scripts/ already imports kit/lib. The arcade already compiles that file (it imports it as `vertuo-omni-plan/kit/lib/narrow.ts`); its typecheck, the tests and `pnpm lint` are green.

## What it costs to change later

A constant: seven import lines, which can point at a copy of the two helpers inside packages/design instead, or at the root package by name once packages/design declares it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The architecture playbook names no rule on what packages/ may depend on; I read the spec's `defined` and `at` in kit/lib/narrow.ts as binding on every source folder.
