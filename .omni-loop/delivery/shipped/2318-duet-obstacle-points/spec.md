---
prd: 2318
title: OMNI DUET scores each obstacle passed, 1 in a chapter and 2 in endless mode
blocked-by: none
spec: file
---

# OMNI DUET scores each obstacle passed, 1 in a chapter and 2 in endless mode

**Date:** 2026-10-17 · **PRD:** #2318 (it replaces PRD 2159, whose issue and pull requests are hidden while the account that opened them is suspended)
**Touches:**
- `apps/galaxy/src/arcade/duet/waves.ts` (how many of a wave's obstacles are fully below the circle at a sub-step)
- `apps/galaxy/src/arcade/duet/run.ts` (the score: per obstacle, no longer per wave)
- `apps/galaxy/src/arcade/duet/run.test.ts`, `waves.test.ts`
- `apps/galaxy/README.md` (OMNI DUET's section: what scores)
- `supabase/migrations/<timestamp>_arcade_duet_obstacle_scores.sql` (DUET's board starts over: the saved
  scores move to the retired board `duet-waves`)

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
- **DUET's board starts over:** the scores saved under `duet` before this change move to a retired
  board, `duet-waves`, which no cabinet reads, so the crew's top 5 and every player's best start
  empty under the new rule. Nothing is deleted.

Nothing else changes: the waves, the lives, the banners, the HUD's score line (it now moves within a
wave), the game over screen (the score, the waves passed, where the run got to), the score's single
send through `submitScore('duet', score)`, `submit_score()` and the shape of `arcade_scores`.

## Decisions

- **1 and 2 per obstacle, not 10 and 20** (Martin, 2026-10-17, relayed by the session that started
  this one): a full run of the four chapters scores its 171 obstacles, 171 points, against 400 points for its 40 waves today. Chosen
  over 10/20 per obstacle.
- **Reset the saved scores** (Martin, 2026-10-17, "Remettre à zéro", relayed; it replaces his first
  answer, keep them): old and new runs are not on one scale (400 against 171 for the four chapters),
  so DUET's board starts over.
- **The reset moves the rows, it does not delete them:** one migration renames the board of every
  `arcade_scores` row whose `game` is `duet` to `duet-waves`, in every workspace, and touches nothing
  else (no other game, no other table, not the game's ledger, N-PRODUCT-16). The room draws only the
  boards `GAMES` lists (PRD 1633's Risks), so `duet-waves` is never shown, and the key matches
  `^[a-z0-9-]{1,32}$`. Chosen over a `delete` (as PRD 1923 emptied COMET RING's board), which a revert
  cannot undo, and over a new board key in the app, which would change `submit_score()`'s unlock
  mapping and the room's reading of boards. `submit_score()`, the table's shape and
  `supabase/database.types.ts` do not change.
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
5. As a player, once this ships, DUET's top 5 is empty and my first run under the new rule is my
   best; the bests I set before are kept aside, not shown.

## Scope

In: the score rule in `duet/run.ts`, the count of obstacles passed in `duet/waves.ts`, their tests,
the README's OMNI DUET section, and the migration that moves DUET's saved scores to `duet-waves`.

Out: the waves themselves, the lives and restart rule, any screen layout, `submit_score()` and the
table's shape, the other games' boards.

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

Merging publishes a new score rule on the arcade (Vercel, the galaxy app) and **writes to production
`arcade_scores`**: the migration moves every saved DUET score, in every workspace, from the board
`duet` to `duet-waves`, so every player's DUET best and the crew's top 5 start empty. Nothing is
deleted and the shape of nothing stored changes. The migration and the app may deploy minutes
apart: a run sent in between under the old rule lands on the new board, a 10-a-wave score among
1-an-obstacle ones, which the reviewer may clear by hand if it happens.

Rollback, in two steps: revert the feature PR (the app scores per wave again), then put the old
board back with a new migration, which keeps each player's better best when they also played under
the new rule:

```sql
insert into public.arcade_scores (workspace_id, user_id, game, best, at)
select workspace_id, user_id, 'duet', best, at from public.arcade_scores where game = 'duet-waves'
on conflict on constraint arcade_scores_pkey do update
  set best = greatest(arcade_scores.best, excluded.best),
      at = case when excluded.best > arcade_scores.best then excluded.at else arcade_scores.at end;
delete from public.arcade_scores where game = 'duet-waves';
```

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
- After the migration, no `arcade_scores` row has the board `duet`, and every row that had it before
  is there under `duet-waves`, its workspace, player, best and date unchanged; no other row changes.
- The migration is the newest on `main` when the feature PR is marked ready (re-dated with
  `node scripts/migration-order.ts` when it is not).
