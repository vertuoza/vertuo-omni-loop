# Plan: every feat or fix PR merged into a tracked repository's default branch pays its author

PRD #1975, spec beside this plan (`spec.md`). The feature branch `feat/merged-pr-points` merges into
`main` with `Closes #1975`; each slice is a sub-PR from `feat/merged-pr-points--<slice>` into the
feature branch, with `Part of #1975`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A feat or fix PR merged by a person into a tracked repository's default branch is one `PR_MERGED` that pays its author 30 points and 30 XP | `game/sources/github` `game/projector` `game/events` `game/economy` `game/rulebook` `game/experience` `game/README.md` `supabase/migrations/` `packages/galaxy/src/galaxy.test.ts` `apps/galaxy/src/arcade/scenes/menu.test.ts` | — | 1 |
| s2 | A sub-PR never earns points: a secured zone pays 0, retroactively, the expedition bonus 10, and the rule is written and tested | `game/rulebook` `game/economy` `game/README.md` `game/cli/xp.test.ts` `.omni-loop/knowledge/product/rules.md` | s1 | 2 |
| s3 | The galaxy's feed names a merged pull request, and the arcade's briefing, home page and cards say the merged feat/fix PR's 30 points in place of the secured zone | `packages/galaxy/src/` `apps/galaxy/src/arcade/scenes/menu` `apps/galaxy/src/home/spreads/` `.omni-loop/knowledge/design/screens/arcade-menu.md` `.omni-loop/knowledge/design/screens/home.md` | s1, s2 | 3 |

Shared ground: `game/rulebook`, `game/economy` and `game/README.md` are declared by s1 and s2
(waves 1 and 2). `packages/galaxy/src/galaxy.test.ts` and `apps/galaxy/src/arcade/scenes/menu.test.ts`
are declared by s1, which adds the `prMerged` XP weight they list, and by s3 (waves 1 and 3), which
changes what they render. s3 follows s2 because the home page's cards and their tests read the
rulebook numbers s2 changes.

## Per slice: done when

**s1** (`ui: yes`)

Its territory meets `apps/galaxy/src/` through `menu.test.ts` alone: it adds the `prMerged` weight
there and changes no screen. It appends an event type and rewrites no ledger row (N-PRODUCT-16,
whose test it does not touch).

- `buildSnapshot` lists each tracked repository's pull requests merged into its default branch, and
  keeps a `feat`/`fix` title (`feat:`, `fix(x):`, `feat!:`, any case) by a person; a
  `chore(release): v0.0.N`, a `docs:` title, a title with no type, a `[bot]` or app author and a
  missing author are dropped (unit tests on a fake `exec`, no GitHub call).
- The projector writes one `PR_MERGED` per kept pull request: id `pr:<owner>/<repo>#<n>:merged`,
  `at` its merge, its author's login in lower case, its team, `region` its repository, planet 0,
  `data: { pr, kind }`; a second projection adds nothing.
- `game/events.ts` accepts `PR_MERGED` with planet 0, and still refuses planet 0 for any other type
  but `QUESTION_ANSWERED`.
- `RULEBOOK.prMerged` is 30 and `xp.weights.prMerged` 1; `score()` credits `'pr merged'` 30 to the
  author in the merge's season; XP counts it.
- A migration, dated after the newest on `main`, adds `PR_MERGED` to `ledger_events_type_check`.
- `game/README.md` has **Merged pull requests**: what is read, what is kept, the id, the pay, the
  rollback.
- The weights' lists in `galaxy.test.ts` and `menu.test.ts` name `prMerged`.

**s2**

- `RULEBOOK.zoneSecured` is 0 and `terraformExpedition` 10.
- An `economy.test.ts` case builds a planet through merged sub-PRs and a terraform: each sub-PR
  author earns 0 for `ZONE_SECURED` and 10 at the terraform, past seasons included; a
  `ZONE_REVERTED` debits 0.
- `rules.md` gains `A sub-PR never earns points`, its `Enforced by:` naming that test, and saying
  the expedition bonus is the one credit a sub-PR's author still earns, at the terraform.
- `game/README.md`'s zone, expedition and scoring lines say the new numbers.
- `game/cli/xp.test.ts` still holds with `zoneSecured` at 0.

**s3** (`ui: yes`)

- `packages/galaxy/src/galaxy.ts`'s feed says `<login> merged #<number> into <repo>` for a
  `PR_MERGED`, and `types.ts` names the type; `galaxy.test.ts` holds it.
- The briefing's **EARN** says `MERGE A FEAT OR FIX PR +30` first, `EXPEDITION ON IT +10`, and its
  note no longer names a secured zone (`menu.tsx`, its test).
- **SHIP VALUE** says `A merged feat/fix PR scores 30.`, and the beaver's card carries
  `A merged feat/fix PR scores 30.` (`Game.tsx`, `cards.ts`, their tests); no number is written by
  hand, each is read from `RULEBOOK`.
- The draft screens `arcade-menu` and `home` say the new words.
