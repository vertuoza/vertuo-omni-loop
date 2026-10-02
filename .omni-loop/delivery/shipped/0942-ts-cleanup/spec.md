---
prd: 942
title: TypeScript cleanup — clear the escape hatches, then ratchet them down
blocked-by: none
spec: file
---

# TypeScript cleanup — clear the escape hatches, then ratchet them down

**Date:** 2026-10-02 · **PRD:** #942 · **Follows:** PRD 725 (strict TypeScript across the kit, game
and omni-app) · **Touches:** `kit/test/typescript-guard.test.ts`, a new ceilings file beside it, a
new `kit/lib/narrow.ts`, the three files holding bridge casts, and source files across `kit/`,
`apps/omni-app/`, `apps/galaxy/` and `packages/` where a cast is removed or given its reason.
**Out of scope:** lint, stricter compiler flags, branded ids, Effect, any behaviour change.

## Problem

PRD 725 made the repository strict TypeScript and left its escape hatches counted but not cleared.
On `main` today (measured 2026-10-02, with the guard's own parser):

| What | Count |
|---|---|
| Casts and `any` in source carrying a `// ts-allow: <reason>` comment | 362 (galaxy 235, kit 82, omni-app 37, packages 8) |
| …of them `as unknown as` | 33 |
| Casts in source carrying **no** reason, unread because the guard exempts their folders | 190, in 11 arcade folders (`ARCADE_UNMARKED`: business 60, ask 33, jev 32, dashboard 19, working 10, engineering 8, profile 7, proof 7, repositories 7, business-api 4, signup 3) |
| Bridge casts that still say a module is untyped, though it is typed now | 7, in 3 files |

A cast tells the compiler to stop checking. The bridges now hide real signatures: `pipeline.ts`
casts `settleAtMerge`, `planShip`, `movedPath`, `findOutboxViolations` and `askModel` to shapes
written "until s8" and "until s11";
`canon/live.ts` and `retro/narrate.ts` cast `askModel` because "openrouter still opens with
@ts-nocheck", which it no longer does. Many marked casts repeat the same few reasons ("includes()
only compares the value", "split always yields a first part", "the group always matches", "a
YYYY-MM-DD date splits into three numbers"): each is a fact a small type guard could prove instead
of assert. And nothing stops the count from growing: the guard demands a reason, not fewer casts.

## Solution

1. **The bridges go.** The 7 bridge casts are deleted and their callers use the typed functions
   directly. A signature that does not fit has its types corrected, never its behaviour.
2. **Shared narrowing helpers.** `kit/lib/narrow.ts` holds the few type guards and parsers the
   recurring reasons call for (for example `isOneOf(values, x)`, a regex group that throws when
   absent, a date's three parts). It is pure, has no dependency, and is tested beside itself. Every
   side imports it: the kit, the App, the arcade and the packages already import from the kit.
3. **The exempt list empties.** In each `ARCADE_UNMARKED` folder, every unmarked cast is removed
   (through a helper, a type guard, or a Zod parse where the value comes from outside) or kept with a
   reason. A folder leaves the list once it is done; the list and its exemption code are deleted
   when the last one leaves.
4. **`as unknown as` gets the hardest look.** Each is removed, or kept with a reason saying why
   nothing narrower holds. None remains in `kit/` or `apps/omni-app/`.
5. **The ratchet.** A committed file beside the guard, `kit/test/typescript-ceilings.json`, holds
   one ceiling per area: `kit`, `game`, `scripts`, `packages`, `apps/omni-app`, `apps/galaxy`. The
   guard counts the `// ts-allow:` lines in source per area and fails on any difference:
   - above the ceiling: `apps/galaxy: 141 casts, ceiling 140 — remove one, or raise the ceiling in
     kit/test/typescript-ceilings.json and say why in the pull request`;
   - below it: `apps/galaxy: 138 casts, ceiling 140 — lower the ceiling to 138 in
     kit/test/typescript-ceilings.json`.
   The ceilings start at the counts the cleanup leaves. Raising one is a line a reviewer sees in the
   diff.

## Decisions

Taken in the brainstorm on 2026-10-02 with the person who asked for this PRD.

- **Scope: clear it, then ratchet.** Not the minimum (bridges and a ratchet on today's counts,
  which would lock in 190 unmarked casts), and not zero casts (a cast on a DOM event's target or in a
  test fake is honest, and chasing the last ones costs more than it proves).
- **The ratchet holds a committed ceiling per area, and fails both ways.** Dropping below the
  ceiling fails too, so the ceiling never goes stale and casts cannot creep back up to an old
  number. Per file was rejected: every refactor that moves a cast would edit the list.
- **One helper module, in the kit.** The arcade and the App already import from the kit; one module
  keeps one proof per pattern.
- **A cast stays when its reason is true and nothing narrower holds.** The goal is that every cast
  left can be trusted, not that none is left.
- **No proof video:** nothing visible changes.
- **The voice.** Paul - Product Manager objected at the design: the cleanup ships nothing his team can
  use while their features wait. The person approved the design as it was: settled `none`.

## User stories

1. As an agent editing the kit, when I call `planShip` I get its real signature, not a shape someone
   wrote before it was typed.
2. As an agent adding a cast, the guard tells me the area's ceiling went up, so I either find the
   type guard or say in the pull request why the cast is needed.
3. As an agent removing casts, the guard tells me the number to write as the new ceiling.
4. As a reviewer, a raised ceiling is one line in the diff I can question.
5. As an agent reading arcade code, every cast I meet carries a reason I can check.

## Scope

In:

- Deleting the 7 bridge casts (five in `kit/lib/knowledge/pipeline.ts`, one each in
  `apps/omni-app/src/canon/live.ts` and `apps/omni-app/src/retro/narrate.ts`), and calling the typed
  functions.
- `kit/lib/narrow.ts` and its tests.
- Every cast in the 11 `ARCADE_UNMARKED` folders removed or given its reason; the list deleted.
- Each `as unknown as` removed or given a reason that says why nothing narrower holds; none left in
  `kit/` or `apps/omni-app/`.
- Marked casts elsewhere that a helper, a type guard or a schema removes.
- `kit/test/typescript-ceilings.json` and the guard's per-area count, with its two failure messages.

Out:

- Lint (typescript-eslint or any other), stricter compiler flags (`exactOptionalPropertyTypes` and
  the rest), branded ids, Effect: each its own PRD.
- Any behaviour change. A bug a removed cast reveals is recorded as an outbox item and fixed in its
  own pull request, unless the fix is needed for the types to hold and changes no output.
- Casts in tests, and in files under a `test/` folder: the guard does not read them today, and this
  PRD does not change that.
- `supabase/database.types.ts`: generated.

## Test seams

The suite proves behaviour did not change; the compiler proves the types; the guard proves the
count. Tests sit beside the code (`omni kb show testing`), on fixtures only.

- **`kit/lib/narrow.ts`:** a unit test per helper, with an input it accepts and one it refuses.
- **The guard's ceilings:** fixtures in `kit/test/typescript-guard.test.ts` for each rule: an area
  above its ceiling fails with the first message, one below fails with the second, one equal passes,
  an area missing from the ceilings file fails naming it, and a ceilings file that does not read
  fails naming the field.
- **The whole repository:** the guard runs on every file git tracks, as it does today, now with the
  ceilings.
- **Every slice:** `pnpm typecheck`, `pnpm test` with at least as many tests as before, `fallow
  audit` passing, and `omni check all` green.

## Risks

`omni kb show releasing`: a merge to `main` publishes the kit's bundle and the plugin, and deploys
the arcade and the App.

- **A removed cast changes a runtime value.** A type guard that is stricter than the cast it
  replaces could reject a value the cast let through. Each helper is written to accept exactly what
  the cast asserted, and the suite pins behaviour. Rollback: revert the feature PR's merge.
- **The bundle.** `kit/lib/narrow.ts` enters `kit/dist/omni.mjs` where the kit imports it;
  `kit/test/dist` pins the bundle to a fresh build. Rollback: revert, and the release workflow
  republishes.
- **Parallel slices and the ceilings file.** Every slice that removes casts changes a count. Only
  the last slice writes the ceilings file, so parallel slices never collide on it.

No migration ships.

## Acceptance criteria

1. No `ts-allow` comment in source says a module is untyped, or names a slice it waits for.
2. `ARCADE_UNMARKED` and its exemption are gone from the guard: every cast and `any` in source, in
   every folder, carries a `// ts-allow: <reason>` comment.
3. No `as unknown as` remains in `kit/` or `apps/omni-app/` source.
4. `kit/lib/narrow.ts` exists, every export is used, and each has a test that accepts and one that
   refuses.
5. `kit/test/typescript-ceilings.json` holds one ceiling per area, equal to that area's count on the
   feature branch.
6. The guard fails when an area's count rises above its ceiling, and when it falls below, each with
   the message the Solution gives, and passes when they are equal; fixtures prove each case.
7. The total of the ceilings is lower than 552, the total measured on 2026-10-02 (362 marked and 190
   unmarked).
8. `pnpm typecheck`, `pnpm test` (at least as many tests as before), `fallow audit` and `omni check
   all` are green on the feature branch.
