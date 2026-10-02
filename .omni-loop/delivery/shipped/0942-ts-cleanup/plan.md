# Plan: TypeScript cleanup — clear the escape hatches, then ratchet them down

PRD #942, specified in `spec.md` beside this plan. The feature branch `feat/ts-cleanup` merges into
`main` through the feature PR (`Closes #942`); each slice is a sub-PR from `feat/ts-cleanup--<slice>`
into the feature branch (`Part of #942`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The shared narrowing helpers, and the bridges go: `kit/lib/narrow.ts` holds a type guard or parser for each reason that recurs across the repository, and the 7 bridge casts are deleted, their callers using the typed functions | `kit/lib/narrow` `kit/lib/knowledge/pipeline.ts` `apps/omni-app/src/canon/live.ts` `apps/omni-app/src/retro/narrate.ts` | — | 1 |
| s2 | The kit, the game, the scripts and the packages cleared: casts a helper, a type guard or a schema removes are gone, every `as unknown as` is gone from `kit/`, and every cast left has a true reason | `kit/bin/` `kit/lib/` `kit/release/` `kit/build.ts` `game/` `scripts/` `packages/` | s1 | 2 |
| s3 | The App cleared: the same, and no `as unknown as` left in `apps/omni-app/` | `apps/omni-app/` | s1 | 2 |
| s4 | Arcade I, the business screens: every cast in the two exempt folders removed or given its reason, and the marked ones a helper removes gone | `apps/galaxy/src/business/` `apps/galaxy/src/business-api/` | s1 | 2 |
| s5 | Arcade II, ask mode and sign-up: the same for the exempt folders `ask`, `signup`, `proxy`, `working` | `apps/galaxy/src/ask/` `apps/galaxy/src/signup/` `apps/galaxy/src/proxy/` `apps/galaxy/proxy.ts` `apps/galaxy/src/working/` | s1 | 2 |
| s6 | Arcade III, Jev and the engineering pages: the same for the exempt folders `jev`, `proof`, `engineering`, `repositories` | `apps/galaxy/src/jev/` `apps/galaxy/src/proof/` `apps/galaxy/src/engineering/` `apps/galaxy/src/repositories/` | s1 | 2 |
| s7 | Arcade IV, the dashboard and the people pages: the same for the exempt folders `dashboard`, `profile`, and the marked casts of `home`, `nav`, `people`, `design`, `fleets`, `knowledge` | `apps/galaxy/src/dashboard/` `apps/galaxy/src/profile/` `apps/galaxy/src/home/` `apps/galaxy/src/nav/` `apps/galaxy/src/people/` `apps/galaxy/src/design/` `apps/galaxy/src/fleets/` `apps/galaxy/src/knowledge/` | s1 | 2 |
| s8 | Arcade V, dossiers and data: the marked casts a helper, a type guard or a schema removes, gone | `apps/galaxy/src/dossier/` `apps/galaxy/src/data/` | s1 | 2 |
| s9 | Arcade VI, the arcade game and the docs: the same | `apps/galaxy/src/arcade/` `apps/galaxy/src/docs/` `apps/galaxy/src/play-dock/` | s1 | 2 |
| s10 | Arcade VII, everything else in the arcade: the same, for the folders no other slice names | `apps/galaxy/app/` `apps/galaxy/scripts/` `apps/galaxy/artifact/` `apps/galaxy/src/agent-connect/` `apps/galaxy/src/constituents/` `apps/galaxy/src/fixes/` `apps/galaxy/src/outbox/` `apps/galaxy/src/outbox-waiting/` `apps/galaxy/src/releases/` `apps/galaxy/src/skeleton/` `apps/galaxy/src/stages/` `apps/galaxy/src/switch/` `apps/galaxy/src/timings/` `apps/galaxy/src/waiting/` | s1 | 2 |
| s11 | The ratchet: `ARCADE_UNMARKED` and its exemption deleted, `kit/test/typescript-ceilings.json` written with each area's count, and the guard failing above and below a ceiling, each with its message | `kit/test/typescript-guard.test.ts` `kit/test/typescript-ceilings` | s2, s3, s4, s5, s6, s7, s8, s9, s10 | 3 |

**Shared ground.** `kit/lib/` is declared by s1 (`kit/lib/narrow`, `kit/lib/knowledge/pipeline.ts`)
and by s2; `apps/omni-app/` by s1 (`canon/live.ts`, `retro/narrate.ts`) and by s3. Both pairs are
kept apart by the waves: s1 is wave 1, s2 and s3 wave 2. The wave-2 slices never edit
`kit/lib/narrow.ts`: s1 writes every helper the recurring reasons call for. A wave-2 slice that
finds another pattern writes its helper inside its own territory and says so in its sub-PR. The
guard (`kit/test/typescript-guard.test.ts`) is read by every slice but written only by s11. The
arcade slices check their folders by running the guard locally with their folders struck from
`ARCADE_UNMARKED`, without committing that change, so no two slices edit the list. The ceilings
file is written once, by s11, from the counts the wave-2 slices leave.

## Per slice: done when

**s1**

- `kit/lib/narrow.ts` exists, pure and with no dependency, with one export per recurring reason
  (`includes()` on a narrower union, a regex group that must match, a split's first part, a
  YYYY-MM-DD date's three numbers, and any other reason repeated three times or more across the
  repository's `ts-allow` comments). Each export has a test with an input it accepts and one it
  refuses.
- No `ts-allow` comment in the repository says a module is untyped or names a slice it waits for:
  the 5 casts in `kit/lib/knowledge/pipeline.ts`, and the one each in
  `apps/omni-app/src/canon/live.ts` and `apps/omni-app/src/retro/narrate.ts`, are deleted, and the
  callers use the typed functions.
- `pnpm typecheck`, `pnpm test` (at least as many tests as before), `fallow audit` and
  `omni check all` are green.

**s2 to s10** (each in its own territory)

- Every cast and `any` in the territory's source either is gone, replaced by a `kit/lib/narrow.ts`
  helper, a type guard or a schema parse at the boundary, or carries a `// ts-allow:` reason that is
  true and says why nothing narrower holds.
- s2 and s3: no `as unknown as` in `kit/` (s2) or `apps/omni-app/` (s3) source.
- s4 to s7: with the slice's folders struck from `ARCADE_UNMARKED` locally, the guard reports
  nothing in them. The list itself is not edited.
- The sub-PR's body gives the territory's count of `ts-allow` lines before and after.
- No behaviour change: `pnpm test` with at least as many tests as before, and `pnpm typecheck`,
  `fallow audit` and `omni check all`, all green. A bug a removed cast reveals is an outbox item, not
  a fix in the slice.

**s11**

- `ARCADE_UNMARKED`, and the code that reads it, are gone from the guard; the guard on the whole
  repository reports nothing.
- `kit/test/typescript-ceilings.json` holds one ceiling for each of `kit`, `game`, `scripts`,
  `packages`, `apps/omni-app` and `apps/galaxy`, each equal to that area's count of `ts-allow` lines
  in source, and their total is lower than 552.
- Fixtures in the guard prove: an area above its ceiling fails with `<area>: <n> casts, ceiling <m> —
  remove one, or raise the ceiling in kit/test/typescript-ceilings.json and say why in the pull
  request`; one below fails with `<area>: <n> casts, ceiling <m> — lower the ceiling to <n> in
  kit/test/typescript-ceilings.json`; one equal passes; an area missing from the file fails naming
  it; a file that does not read fails naming the field.
- `pnpm typecheck`, `pnpm test`, `fallow audit` and `omni check all` are green.
