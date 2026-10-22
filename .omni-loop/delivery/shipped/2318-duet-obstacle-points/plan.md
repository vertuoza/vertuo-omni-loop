# Plan: OMNI DUET scores each obstacle passed, 1 in a chapter and 2 in endless mode

PRD #2318, its spec beside this plan (`spec.md`). The feature branch `feat/duet-obstacle-points`
merges into `main` with `Closes #2318`; each slice is a sub-PR from `feat/duet-obstacle-points--<slice>`
into the feature branch, with `Part of #2318`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Each obstacle scores once it is fully below the circle, 1 in a chapter and 2 in endless mode, a gate once; finishing a wave adds nothing more; a hit gives back every point since the chapter (endless: the wave) began; the README says so | `apps/galaxy/src/arcade/duet/run.` `apps/galaxy/src/arcade/duet/waves.` `apps/galaxy/README.md` | — | 1 |
| s2 | DUET's board starts over: one migration moves every `arcade_scores` row of the board `duet` to the retired board `duet-waves`, nothing deleted, nothing else touched | `supabase/migrations/` | — | 1 |

Shared ground: none. s1 and s2 share no path, so they run in the same wave. `duet/waves.test.ts`
and `duet/run.test.ts` are inside s1's territory (the `run.` and `waves.` prefixes).

## Per slice: done when

- **s1**
  - `duet/waves.ts` tells how many of a wave's obstacles are fully below the circle at a sub-step: a
    gate counts once, the count never falls, and it reaches the number of obstacles on the sub-step
    the wave is passed (tested).
  - In a chapter the score grows by 1 on the sub-step each obstacle passes, in endless mode by 2,
    and by nothing more when the wave is passed (tested in `run.test.ts`).
  - A clean run of the four chapters reaches endless mode with a score equal to their 171 obstacles.
  - A hit after an obstacle of the wave has scored sets the score back to the chapter's starting
    score (endless: the wave's), in a chapter and in endless mode (tested).
  - The no-death-earns-a-point test still runs for every chapter wave and the first 50 endless waves,
    and passes.
  - The same run at 1/60 s and 1/120 s gives the same score.
  - The README's OMNI DUET section says each obstacle passed scores 1, 2 in endless mode.
  - `pnpm test`, `pnpm lint` and `pnpm typecheck` are green.
- **s2**
  - A migration under `supabase/migrations/`, dated after the newest on the feature branch, sets
    `game = 'duet-waves'` on every `arcade_scores` row whose `game` is `duet`, and does nothing else:
    no `delete`, no other game, no other table, `submit_score()` and the table's shape unchanged.
  - Its header comment says why (PRD 2318, Martin's reset) and how to undo it (the spec's Risks).
  - `supabase/database.types.ts` is unchanged.
  - `pnpm test`, `pnpm lint` and `pnpm typecheck` are green.
