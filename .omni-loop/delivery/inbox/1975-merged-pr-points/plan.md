# Plan: a pull request merged into a tracked repository's default branch pays its author and its reviewers by its kind

PRD #1975, spec beside this plan (`spec.md`). The feature branch `feat/merged-pr-points` merges into
`main` with `Closes #1975`; each slice is a sub-PR from `feat/merged-pr-points--<slice>` into the
feature branch, with `Part of #1975`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A pull request merged into a tracked repository's default branch is sorted by kind (`feat`, `docs`, none) and writes one `PR_MERGED` for its author and one `PR_REVIEWED` per reviewer, paying 30 and 10 (`feat`) or 10 and 5 (`docs`) | `game/sources/github` `game/projector` `game/events` `game/economy` `game/rulebook` `game/experience` `game/README.md` `supabase/migrations/` `packages/galaxy/src/galaxy.test.ts` `apps/galaxy/src/arcade/scenes/menu.test.ts` | — | 1 |
| s2 | A sub-PR never earns points and the old merge pay ends: a secured zone, `featureMerged` and `featureReviewed` pay 0, retroactively, the expedition bonus 10, and the rule is written and tested | `game/rulebook` `game/economy` `game/README.md` `game/cli/xp.test.ts` `.omni-loop/knowledge/product/rules.md` | s1 | 2 |
| s3 | The galaxy's feed names who merged and who reviewed a pull request, and the arcade's briefing, home page and cards say the new pay in place of the secured zone | `packages/galaxy/src/` `apps/galaxy/src/arcade/scenes/menu` `apps/galaxy/src/home/spreads/` `.omni-loop/knowledge/design/screens/arcade-menu.md` `.omni-loop/knowledge/design/screens/home.md` | s1, s2 | 3 |

Shared ground: `game/rulebook`, `game/economy` and `game/README.md` are declared by s1 and s2
(waves 1 and 2). `packages/galaxy/src/galaxy.test.ts` and `apps/galaxy/src/arcade/scenes/menu.test.ts`
are declared by s1, which adds the `prMerged` XP weight they list, and by s3 (waves 1 and 3), which
changes what they render. s3 follows s2 because the home page's cards and their tests read the
rulebook numbers s2 changes.

## Per slice: done when

**s1** (`ui: yes`)

Its territory meets `apps/galaxy/src/` through `menu.test.ts` alone: it adds the XP weights there
and changes no screen. It appends event types and rewrites no ledger row (N-PRODUCT-16, whose test
it does not touch).

- `buildSnapshot` lists each tracked repository's pull requests merged into its default branch, with
  their kind and reviewers: a bot or missing author and `omni:phase-0` are none; `omni:retro` and
  `omni:knowledge` are `docs`; `omni:feature`, `omni:bug`, or a `feat`/`fix` title (`feat:`,
  `fix(x):`, `feat!:`, any case) are `feat`; anything else (`chore(release)`, `docs:`, no type) is
  none. Reviewers are the approvers and the merger, each once, never the author, never a bot (unit
  tests on a fake `exec`, no GitHub call).
- The projector writes, per `feat` or `docs` pull request, one `PR_MERGED`
  (`pr:<owner>/<repo>#<n>:merged`) and one `PR_REVIEWED` per reviewer
  (`pr:<owner>/<repo>#<n>:reviewed:<login>`): `at` its merge, the login in lower case, its team,
  `region` its repository, planet 0, `data: { pr, kind }`; a second projection adds nothing.
- `game/events.ts` accepts both with planet 0, and still refuses planet 0 for any other type but
  `QUESTION_ANSWERED`.
- `RULEBOOK.prMerged` is `{ feat: 30, docs: 10 }`, `prReviewed` `{ feat: 10, docs: 5 }`, with XP
  weights 1; `score()` credits `'pr merged'` and `'pr reviewed'` by kind in the merge's season; XP
  counts them.
- A migration, dated after the newest on `main`, adds both types to `ledger_events_type_check`.
- `game/README.md` has **Merged pull requests**: what is read, the kinds, the table, the ids, the
  rollback.
- The weights' lists in `galaxy.test.ts` and `menu.test.ts` name `prMerged` and `prReviewed`.

**s2**

- `RULEBOOK.zoneSecured`, `featureMerged` and `featureReviewed` are 0, and `terraformExpedition` 10.
- An `economy.test.ts` case: `FEATURE_MERGED` and `FEATURE_REVIEWED` pay 0, past seasons included.
- An `economy.test.ts` case builds a planet through merged sub-PRs and a terraform: each sub-PR
  author earns 0 for `ZONE_SECURED` and 10 at the terraform, past seasons included; a
  `ZONE_REVERTED` debits 0.
- `rules.md` gains `A sub-PR never earns points`, its `Enforced by:` naming that test, and saying
  the expedition bonus is the one credit a sub-PR's author still earns, at the terraform.
- `game/README.md`'s zone, expedition, merged-feature-PR and scoring lines say the new numbers.
- `game/cli/xp.test.ts` still holds with `zoneSecured` at 0.

**s3** (`ui: yes`)

- `packages/galaxy/src/galaxy.ts`'s feed says `<login> merged #<number> into <repo>` for a
  `PR_MERGED` and `<login> reviewed #<number> in <repo>` for a `PR_REVIEWED`, and `types.ts` names
  both; `galaxy.test.ts` holds them.
- The briefing's **EARN** says `SHIP A FEAT OR FIX +30` and `REVIEW OR MERGE ONE +10` first,
  `EXPEDITION ON IT +10`, and its note says `RETRO OR KNOWLEDGE +10 · ITS REVIEW +5` and no longer
  names a secured zone (`menu.tsx`, its test).
- **SHIP VALUE** says `A merged feat/fix PR scores 30.`, and the beaver's card carries
  `A merged feat/fix PR scores 30.` (`Game.tsx`, `cards.ts`, their tests); no number is written by
  hand, each is read from `RULEBOOK`.
- The draft screens `arcade-menu` and `home` say the new words.
