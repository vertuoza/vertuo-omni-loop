# Settled outbox items — PRD 1072

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-mutation-timeout -->

## s1-01-mutation-timeout — adopted

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
id: s1-01-mutation-timeout
prd: 1072
slice: s1
rank: medium
bears-on: none
raised: 2026-10-04
wave: 1
---

## The question, in plain words

How long may a changed copy of the code run its tests before we call it stuck and count it as caught?

## The decision, in plain words

Five seconds beyond the time its tests normally take. A stuck copy counts as caught, so a longer wait makes the run slower but the score a little more honest.

## The intro, for fun

Some changes to the code do not fail the tests, they just make them wait forever.

## The punchline, for fun

We gave them five polite seconds before calling it a win.

## The options, in plain words

A. Five seconds beyond the tests' measured time, Stryker's default, the option built.
B. Ten seconds, for fewer slow healthy runs counted as caught, at the price of a longer run.
C. Sixty seconds, for the most honest timeouts at the price of a much longer run.

## What I had to decide

How long a mutant may run beyond its tests' measured time before Stryker counts it as timed out, which counts as detected in the score.

## What I did meanwhile

timeoutMS is 5 000 in stryker.config.ts (10 000 at first; the person asked for a faster run after the first full run crawled): one constant, no migration.

## What it costs to change later

One constant. A higher value makes each run longer (the first try with 60 s spent most of the ids.ts proof waiting on 23 timed-out mutants); a lower one can count a slow but healthy run as caught.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether 5 s is enough on CI's runner, where the tests' time varies differently than on a laptop; the nightly in s3 will show it

```

<!-- /omni-outbox-settled: s1-01-mutation-timeout -->

<!-- omni-outbox-settled: s1-02-mutation-test-set -->

## s1-02-mutation-test-set — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-05
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-05
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
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

```

<!-- /omni-outbox-settled: s1-02-mutation-test-set -->
