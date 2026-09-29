# ADR-0053 — A plan declares the tests its slices will all edit as shared ground

**Status:** accepted · **Date:** 2026-09-28 · **PRD:** #487 · **Decided:** @pierrederval, closing retro PRs #406, #446 and #467 and choosing the fix after #514, 2026-09-28

## Context

Retro after retro found the same thing: one slice edited a test outside its territory, often a shared
test such as a page's headers test or a component's render test, and the same few lines were
rewritten by several slices. It came up in PRD 384 (#406), PRD 400 (#446), PRD 438 (#467) and PRD 499
(#514). Each of those retros was closed with the same answer: the pattern is known, and it is fixed
once in `/omni:plan`. A retro that finds it again teaches nothing new.

## Decision

`/omni:plan` treats a test that checks what several slices change as shared ground, just like a
registry that several slices each add a line to. Before it writes territories, it looks up the
existing tests that read the files each slice will change. A test that two slices' changes will both
touch is declared in each of those slices' territories and named in the plan's shared-ground note,
so `omni plan check` puts those slices in different waves.

## Consequences

- A slice that edits a shared test is no longer a territory breach, and two slices never race on it
  in one wave.
- A retro finding "a slice edited a test outside its territory", or "one test's lines were rewritten
  across slices", repeats this known pattern. The retro's judge counts it as known, not as a new
  lesson.
- Plans may get an extra wave when two slices share a test.

## Source

The closing comments of #406, #446 and #467, and retro #514 (PRD 499, F1 and F2).
