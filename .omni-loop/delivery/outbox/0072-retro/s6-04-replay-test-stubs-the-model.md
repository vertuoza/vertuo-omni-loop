---
id: s6-04-replay-test-stubs-the-model
prd: 72
slice: s6
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

A test written by the slice before this one runs the retro a second time with a model key set, only to make the retro change, and now that a key makes the retro ask the model, that test would reach the real service. Should that test change?

## The decision, in plain words

That one test now puts a stand-in for the model's service in place for its second run, answering that the key is refused. It still checks what it checked: the second retro is added on top of the first, never written over it.

## The intro, for fun

A test borrowed a key just to rattle the doorknob, and now the door really opens.

## The punchline, for fun

So it gets a cardboard door instead, one that says no politely every single time.

## The options, in plain words

A. Stub the model's service in that one test, the option built.
B. Stub it for every test of the suite, in a shared setup file.
C. Make the second run change the retro some other way, with no key set.

## What I had to decide

Whether to edit `src/retro/retro.test.mjs`, outside this slice's territory (s2 wrote it; `retro.` is slice s8's ground in wave 4). Its test "adds a commit on top of the first instead of rewriting it when the retro changed" runs with `env: { OPENROUTER_API_KEY: 'k' }`. With `narrate` built, that sends a real request to OpenRouter, which no test may do, and a network error there is retried with pauses past the test's timeout.

## What I did meanwhile

That test stubs `fetch` with `vi.stubGlobal` for its second run, answering 401 (never retried), and unstubs it after; nothing else in the file changes, and all its tests pass. `narrate.test.mjs` runs the real function with a stubbed `fetch` for the 500 and the reply cases.

## What it costs to change later

A few lines of one test. Keeping the test untouched instead needs a stub installed for every test, in a root setup file, also outside this slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether slice s8, which owns that file in wave 4, would rather keep the stub in a shared test helper.
