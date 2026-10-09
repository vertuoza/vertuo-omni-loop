---
id: s2-01-law-demoted-needs-the-base
prd: 1342
slice: s2
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

The new check that spots a law losing its test needs to see the knowledge base as it was before the change. Who hands it that earlier copy?

## The decision, in plain words

The check is built and works when it is given the earlier copy, but the commands that run the gate today do not hand it over yet. The pull request check on the server can pass it in the later slice that already reworks that check; the terminal commands wait for a follow-up.

## The intro, for fun

A law quietly losing its test is only visible if you remember what the law used to say.

## The punchline, for fun

The detective is hired; someone still has to give it yesterday's photo.

## The options, in plain words

A. A. The check takes the earlier copy when it is given one; the server check and the terminal commands learn to give it later, in the work that owns them
B. B. Teach the server check and the two terminal commands to give it now, in this slice
C. C. Add the server check's part to the later slice's to-do list, and the terminal commands to a new slice of this PRD

## What I had to decide

`law-demoted` compares register entries at the base with the head, so `riskyChanges` needs the base knowledge folder. Its callers, `kit/bin/commands/check.ts` (`omni check coverage`), `kit/bin/commands/status.ts` (`omni status --base`) and `apps/omni-app/src/evaluate/evaluate.ts`, sit outside s2's territory. Wire them now outside the territory, or expose an optional `base` (a `KnowledgeSource`) on `riskyChanges`, `unaccountedChanges` and `gateResult` and leave wiring to the slices that own those files?

## What I did meanwhile

Added an optional `base?: KnowledgeSource | null` to `riskyChanges`, `unaccountedChanges` and `gateResult`; omitted, `law-demoted` never fires and every caller behaves as before. Tests cover it through `gateResult` with `memorySource`. No caller outside the territory changed.

## What it costs to change later

A constant-sized change: each caller passes `diskSource(<base checkout>)` (the app already has the base checked out) or a git-backed source built from `git show <base>:<file>` in the CLI. No stored shape moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether s7, which owns `apps/omni-app/src/evaluate/`, will pass `base` to `gateResult`: its plan row does not say so.
- (author) No slice of this PRD owns `kit/bin/commands/check.ts` or `kit/bin/commands/status.ts`, so `omni check coverage` and `omni status --base` will not grade `law-demoted` until someone wires them.
