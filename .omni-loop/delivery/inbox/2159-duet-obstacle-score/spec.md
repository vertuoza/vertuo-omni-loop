---
prd: 2159
title: OMNI DUET scores each obstacle passed, 1 in a chapter and 2 in endless mode
blocked-by: none
spec: file
---

# OMNI DUET scores each obstacle passed, 1 in a chapter and 2 in endless mode

**Date:** 2026-10-17 · **PRD:** #2159
**Touches:**
- `apps/galaxy/src/arcade/duet/waves.ts` (how many of a wave's obstacles are fully below the circle at a sub-step)
- `apps/galaxy/src/arcade/duet/run.ts` (the score: per obstacle, no longer per wave)
- `apps/galaxy/src/arcade/duet/run.test.ts`, `waves.test.ts`
- `apps/galaxy/README.md` (OMNI DUET's section: what scores)

## Problem

OMNI DUET, the arcade's fourth game (PRD 1633), scores a wave only once it is passed: +10 in a
chapter, +20 in endless mode, nothing else. Waves hold three to six obstacles, so the score moves in
jumps after a wave's last obstacle and says nothing about the obstacles a player got past before a
hit. Martin asked for points counted per obstacle.

## Solution

Each obstacle a player gets past scores, as soon as it is **fully below the circle** (every block
of it entirely below the lowest point the orbs reach, the line a wave is passed at today):

- **1 point** for an obstacle in a chapter, **2 points** in endless mode (endless keeps its ×2).
- A gate is **one obstacle**, its two bars together; every other obstacle is one block.
- **Finishing a wave earns nothing more**: a wave's last obstacle scores as the others do, and the
  wave is passed on that same sub-step, as today.
- **A hit** still sets the score back to what it was when the chapter began (in endless mode, when
  the wave hit began), so the points of the obstacles already passed in that chapter (or that
  endless wave) are given back. No death ever earns a point.
- **The scores already saved** under `duet` stay as they are: no reset of the leaderboard.

Nothing else changes: the waves, the lives, the banners, the HUD's score line (it now moves within a
wave), the game over screen (the score, the waves passed, where the run got to), the score's single
send through `submitScore('duet', score)`.

## Decisions

- **1 and 2 per obstacle, not 10 and 20** (Martin, 2026-10-17, relayed by the session that started
  this one): a full run of the four chapters scores its 171 obstacles, 171 points, against 400 points for its 40 waves today. Chosen
  over 10/20 per obstacle.
- **Keep the saved scores** (Martin, same answer): a best set under the old rule stays on the
  leaderboard; old and new runs are not on the same scale, which Martin accepted. Chosen over a
  reset of DUET's scores, which would have needed a migration.
- **Counted when fully below the circle, a gate as one obstacle, a hit giving every point of the
  chapter (or endless wave) back** (proposed with the questions above; Martin did not object). This
  replaces PRD 1633's decision "Waves only score" (+10 a wave, +20 in endless mode).
- **No new event and no sound:** the game is silent (PRD 1633), and the HUD already redraws the
  score each frame it changes.
- **The voice.** B-E DEv objected (below, `voice.json`): more polish on a mini-game. Settled `none`:
  the design was approved by Martin before the voice spoke; the change is small and pure, and adds
  no dependency or table.
- **No proof video:** the proof question was not put to Martin; nothing is written, the most
  reversible choice (a later run can add `proof: video`).

## User stories

1. As a player in chapter I, I get past a half bar and my score goes up by 1 at once, before the
   wave ends.
2. As a player, I get past a gate's gap and it counts once, not once per bar.
3. As a player in endless mode, each obstacle I get past adds 2.
4. As a player, I am hit in the middle of a chapter's third wave: my score goes back to what it was
   when the chapter began, whatever I passed since.
5. As a player with a best score saved before this change, I still see it in the crew's top 5.

## Scope

In: the score rule in `duet/run.ts`, the count of obstacles passed in `duet/waves.ts`, their tests,
the README's OMNI DUET section.

Out: the waves themselves, the lives and restart rule, any screen layout, the database and its
saved scores, the other games.

## Test seams

Pure modules, vitest, beside the code (`omni kb show testing`: a domain rule is tested where it
lives).

- `duet/waves.ts`: a function giving how many of a wave's obstacles are fully below the circle at a
  sub-step; a gate counts once; the count never falls; it reaches the number of obstacles on the
  sub-step the wave is passed.
- `duet/run.ts`: the score grows by 1 (2 in endless mode) on the sub-step each obstacle passes, and
  by nothing more at the wave's end; a full clean run of the four chapters scores the number of their
  obstacles; the same run at 1/60 s and 1/120 s gives the same score.
- **No death earns a point** (`run.test.ts`, kept): for every wave of the four chapters and the first
  50 endless waves, a run hit at that wave never ends with a higher score than the same inputs
  without the hit; extended with a hit **after** an obstacle of the wave has scored, in a chapter and
  in endless mode, which gives that obstacle's points back.

## Risks

Merging publishes a new score rule on the arcade (Vercel, the galaxy app). Scores saved after it are
on a smaller scale than the ones saved before (171 for the four chapters, against 400), so a
pre-change best may stay on top of DUET's top 5 for a while: accepted (Decisions). No migration,
nothing stored changes shape. Rollback: revert the feature PR; scores saved meanwhile stay, as any
score does.

## Acceptance criteria

- Getting past an obstacle in a chapter adds 1 to the score on the sub-step it is fully below the
  circle; in endless mode it adds 2.
- A gate adds 1 (2 in endless mode), once.
- Passing a wave adds nothing beyond its obstacles' points.
- A clean run of the four chapters reaches endless mode with a score equal to the number of their
  obstacles.
- A hit in a chapter sets the score back to the chapter's starting score, and in endless mode to the
  wave's starting score, including after obstacles of that wave have scored.
- The no-death-earns-a-point test still passes for every chapter wave and the first 50 endless
  waves.
- The README's OMNI DUET section says what scores.
- The scores saved before stay: no migration, no change to `arcade_scores`.
