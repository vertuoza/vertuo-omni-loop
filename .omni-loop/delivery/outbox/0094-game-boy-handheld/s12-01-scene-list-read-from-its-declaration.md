---
id: s12-01-scene-list-read-from-its-declaration
prd: 94
slice: s12
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

The check that every screen has an upright layout needs the full list of screens, but the game keeps that list only as a rule for the code, not as a list a check can read while it runs. Where should the check get the list from?

## The decision, in plain words

The check reads the list straight from where the game declares its screens, and makes sure it matches the screens the game actually draws. A new screen without an upright layout now fails the tests, with nothing else to update.

## The intro, for fun

Counting the screens is easy, until you find nobody wrote the list down anywhere a check can read it.

## The punchline, for fun

So the check reads the game's own table of contents, then flips through the pages to be sure.

## The options, in plain words

A. Read the list from where the game declares its screens, and check it against the screens the game draws. This is what was built.
B. Add a list of screens to the game's code, build the rule from it, and have the check use it: a small change outside this slice's ground.
C. Keep a copied list in the check that the code checker refuses when it misses a screen, so a missing upright layout fails the code checker rather than the tests.

## What I had to decide

`SceneName` in `apps/galaxy/src/arcade/scenes/common.ts` is a type-only union: nothing lists the scenes at run time, and the only other full list is the `case` labels of `drawFrame` in `scenes/index.ts`. The slice's territory is `grid.test.ts` and the README, so adding a runtime list (a `SCENE_NAMES` const the type derives from) is outside it. The completeness test must not use a hand-copied list that could drift, and the spec's risks ask that a missing tall layout fail `pnpm test`, not only the typecheck.

## What I did meanwhile

`grid.test.ts` reads the `SceneName` union with TypeScript's own parser (`ts.createSourceFile`, from the `typescript` devDependency the typecheck already uses), fails loudly if the type stops being a union of string literals, and checks that the names equal the dispatcher's `case` labels. The completeness test then holds that every name is in `TALL_SCENES` and gets `TALL` from `gridFor('handheld', …)`. Shown red twice, locally and reverted: dropping `fleets` from its group's list, and adding a `shop` scene to the type. The hand-copied `SCENES` array that `grid.test.ts` had is gone.

## What it costs to change later

One test helper. Moving to a runtime list later means exporting a `SCENE_NAMES` const from `scenes/common.ts`, deriving `SceneName` from it, and importing it in `grid.test.ts` in place of the helper: no stored shape, no data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a test that reads source text is welcome here: the playbook's testing form says nothing either way, though two tests already read repository files (the game workflow and the migrations).
- (author) Whether the team would rather have a runtime list of scenes in the arcade's code, which this slice could not add outside its territory.
