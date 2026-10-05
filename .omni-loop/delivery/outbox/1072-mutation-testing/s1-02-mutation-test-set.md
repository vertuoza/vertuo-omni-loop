---
id: s1-02-mutation-test-set
prd: 1072
slice: s1
rank: medium
bears-on: none
raised: 2026-10-05
wave: 1
---

## The question, in plain words

When a changed copy of the core is tested, which tests should try to catch it: the kit library's own, or every test in the repository?

## The decision, in plain words

The kit library's own tests only. They run in half a minute; the whole repository's take three, and its command tests start git and node, which kept stalling and timing out the run.

## The intro, for fun

The first full run was on course to take about ten hours.

## The punchline, for fun

Now the library's own tests catch the changes, and they finish before the coffee does.

## The options, in plain words

A. The kit library's own tests (`kit/lib/**/*.test.ts`), the option built.
B. Every test in the repository, as the spec first said, those under `kit/bin` and `scripts/` included: a full run takes about ten hours on a laptop, and many changes count as caught only because a busy machine was slow.
C. The library's tests plus a chosen few command tests, which needs a list to keep up to date.

## What I had to decide

The spec's design said a mutant runs the tests that reach it, "those under `kit/bin` and `scripts/` included". With them, a change to code that runs when its module loads (a zod schema, most of the core) reran the full 3-minute suite, and the first full run passed 3,700 of 6,081 mutants in 2 h 36 min before the person stopped it. A mutant that only a command test catches now counts as survived.

## What I did meanwhile

`stryker.config.vitest.ts` runs the repository's vitest settings on `kit/lib/**/*.test.ts` only; `stryker.config.ts` points the runner at it. On `kit/lib/ids.ts` the run went from over 5 minutes to 135 s.

## What it costs to change later

One line: the `include` of `stryker.config.vitest.ts`. Adding the command tests back makes every run several times longer, and the floors would have to be measured again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) how many mutants only a command test would catch; a later PRD can measure it on one module
