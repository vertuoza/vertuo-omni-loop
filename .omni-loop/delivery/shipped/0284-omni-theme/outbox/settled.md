# Settled outbox items — PRD 284

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-theme-colour-test-beside-the-theme -->

## s2-01-theme-colour-test-beside-the-theme — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s2
- Wave: 2
- Stays here: A local choice about where one small test lives, removable by deleting one file; nothing in it is a lasting rule, invariant or build decision.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-theme-colour-test-beside-the-theme
prd: 284
slice: s2
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

The colour of the browser's bar on the app's pages had no automatic check, and the slice's list of files it may touch named no test. Should a small check for it be added anyway?

## The decision, in plain words

One new, small test file checks that every app page paints the browser's bar in the Omni colour and keeps its light and dark setting; deleting that one file undoes it.

## The intro, for fun

The browser's bar changed colour, and nobody was watching it.

## The punchline, for fun

Now a small test keeps an eye on it, from a seat just outside the slice's fence.

## The options, in plain words

A. Keep the new test file beside the theme module (built).
B. Drop the test, and rely on the type check, the build and the manual pass.
C. Move the checks into the existing theme stylesheet test, which is slice s1's file.

## What I had to decide

Whether slice s2 may add apps/galaxy/src/ask/theme-color.test.ts, outside its territory (the five layouts and the two READMEs), to prove its done-when line on viewport.themeColor test-first.

## What I did meanwhile

Added apps/galaxy/src/ask/theme-color.test.ts: it imports the five layouts (app, ask, knowledge, prd, releases), with server-only mocked as other page tests do, and checks viewport.themeColor is TOKENS.omni.ground and viewport.colorScheme is 'light dark'. It failed on the old media-query pair and passes on the new single value. No file of s1's was touched.

## What it costs to change later

Deleting one test file; nothing else depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives s2 no test path, and tests must sit under apps/*/src/ to run, while the layouts sit under apps/galaxy/app/: whether the planner meant s2 to go without an automated check or simply left the test out was not settled.

```

<!-- /omni-outbox-settled: s2-01-theme-colour-test-beside-the-theme -->
