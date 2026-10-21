---
prd: 1975
title: A pull request merged into a tracked repository's default branch pays its author and its reviewers by its kind; sub-PRs never earn points
blocked-by: none
spec: file
phase0: server
---

## Problem

A player's points do not follow the work they ship into main. Kevin reported 590 points after many
pull requests on backend-php, nimbus-soft and nimbus-build (#1948). Today, in `game/economy.ts`:

- a **sub-PR** pays its author `RULEBOOK.zoneSecured` (10) when it secures a slice's zone, and the
  terraform pays each sub-PR author `terraformExpedition` (50). Sub-PRs merge into feature branches,
  never into main, and must never earn points;
- a **feature PR** of a PRD pays only who merged it (`featureMerged`, 30) and each approver
  (`featureReviewed`, 10). Its **author** earns nothing, and only the first landing's feature PR of a
  PRD shipped in landings is read;
- an ordinary pull request into main that belongs to no PRD, most of the work on the product
  repositories, earns nothing; a retro or knowledge pull request earns nothing either.

The fix attempted in #1949 made the game read every landing's sub-PRs, which paid more sub-PRs; it
was closed for breaking the rule.

## Solution

1. **The read.** `game:project` (`game/sources/github.ts`) lists, for each tracked repository, the
   pull requests merged into its default branch (`gh pr list --base <default> --state merged`), with
   their number, title, labels, author, `mergedBy`, `latestReviews` and merge time. A sub-PR merges
   into a feature branch, never into the default branch, so it is never read.
2. **The kind.** Each merged pull request takes the first kind that matches, in this order:

   | the pull request | kind | its author | each reviewer |
   | --- | --- | --- | --- |
   | its author a bot (`[bot]`, an app) or missing | none | 0 | 0 |
   | labelled `omni:phase-0` | none | 0 | 0 |
   | labelled `omni:retro` or `omni:knowledge` | `docs` | 10 | 5 |
   | labelled `omni:feature` or `omni:bug`, or its title's type is `feat` or `fix` | `feat` | 30 | 10 |
   | anything else (`chore(release): v0.0.N`, `docs:`, `refactor:`, no type, …) | none | 0 | 0 |

   The title's type is read as Conventional Commits writes it, in any case: `feat: …`,
   `fix(scope): …`, `feat!: …`, `fix(scope)!: …`. A pull request of kind `none` writes no event.
3. **Who reviews.** A pull request's **reviewers** are its approvers (a reviewer whose latest review
   approves it, `latestReviews`) and its merger (`mergedBy`), each login once: a person who both
   approved and merged it is one reviewer, paid once. Its author is never its own reviewer, and a bot
   never is.
4. **The events.** The projector appends, per pull request of kind `feat` or `docs`:
   - one `PR_MERGED` for its author: id `pr:<owner>/<repo>#<number>:merged`;
   - one `PR_REVIEWED` per reviewer: id `pr:<owner>/<repo>#<number>:reviewed:<login>`;

   each `at` its merge, `contributor` the login in lower case (BR-PRODUCT-79), `team` from the
   roster, `region` its repository, `data: { pr: <number>, kind: 'feat' | 'docs' }`. Both belong to
   no planet (`planet` 0, as an answered question does): they open no wound, join no crew, and no
   planet's loss claws them back. Their ids name the pull request and the person, so a merge pays
   once, however many polls see it, and a merge before the workspace's `game_since` is never written,
   as for every event.
5. **The pay.** `game/rulebook.ts` gains `prMerged: { feat: 30, docs: 10 }` and
   `prReviewed: { feat: 10, docs: 5 }`, and the XP weights `prMerged: 1` and `prReviewed: 1`.
   `score()` credits `'pr merged'` and `'pr reviewed'` by the event's `kind`, in the season of the
   merge, with no multiplier.
6. **The old merge pay ends.** `featureMerged` and `featureReviewed` become `0`: `PR_REVIEWED` pays
   who merged a feature PR and who approved it. `FEATURE_MERGED` and `FEATURE_REVIEWED` are still
   written, and pay nothing.
7. **Sub-PRs earn nothing.** `zoneSecured` becomes `0`, and `ZONE_REVERTED` therefore debits 0.
   `ZONE_SECURED` is still written: the zones' state, the planet's readiness and the crew still read
   it.
8. **The expedition bonus** becomes `terraformExpedition: 10`, paid as today to each crew member when
   the planet terraforms. The closer bonus and the owner fleet's terraform credit are unchanged.
9. **Retroactive.** `score()` and `game:xp` recompute from the whole ledger, so at the first poll
   after the merge every sub-PR point and every `featureMerged`/`featureReviewed` point disappears,
   this season's and XP alike, and every merge since `game_since` pays by the table above. No ledger
   row is rewritten (N-PRODUCT-16).
10. **Multi-repository PRDs.** Each target of a plan repository's PRD has its own feature branch
    and its own feature PR (`Part of <plan>#<n>`) into its default branch: it is read and paid as in
    any repository, once per repository, when that repository is tracked.
11. **The rule.** A product rule, `A sub-PR never earns points`, joins
    `.omni-loop/knowledge/product/rules.md`, enforced by a test of `score()` that a ledger holding a
    merged sub-PR's events credits its author no point but the expedition bonus. Locking it as a law
    is for its owner: the 20 law slots (`laws.max`) are full.
12. **The ledger's types.** A migration adds `PR_MERGED` and `PR_REVIEWED` to
    `ledger_events_type_check`; the galaxy's feed (`packages/galaxy/src/galaxy.ts`) says
    `<login> merged #<number> into <repo>` and `<login> reviewed #<number> in <repo>`, and the event
    types listed in `game/events.ts`, `packages/galaxy/src/types.ts` and the arcade name them.
13. **The arcade's words.** Every place the arcade tells a player how points are earned says the new
    rules, reading the numbers from `RULEBOOK` as today:
    - the menu's briefing, **EARN** (`apps/galaxy/src/arcade/scenes/menu.tsx`, screen
      `arcade-menu`): `SECURE A ZONE +10` becomes `SHIP A FEAT OR FIX +30` and
      `REVIEW OR MERGE ONE +10`; the note drops `ZONE SECURED AT NIGHT ×1.5 ·`, which no longer pays
      anything, and says `RETRO OR KNOWLEDGE +10 · ITS REVIEW +5`; `EXPEDITION ON IT` shows `+10`;
    - the home page's **SHIP VALUE** (`apps/galaxy/src/home/spreads/Game.tsx`, screen `home`): `A
      secured zone scores 10.` becomes `A merged feat/fix PR scores 30.`;
    - the home page's cards (`apps/galaxy/src/home/spreads/cards.ts`): the beaver's card carries
      `A merged feat/fix PR scores 30.` in place of the secured zone's.
14. **The docs.** `game/README.md` gains **Merged pull requests** (the read, the kinds, the table,
    the ids, the rollback), and its zone, expedition, merged-feature-PR and scoring lines say the new
    numbers.

## Decisions

- **Rework of the first design.** The person asked, after the first version of this spec, that a
  feat PR also pay its reviewers and merger 10, that retro and knowledge pull requests pay 10 and 5,
  and that a phase-0 PR pay nothing. The person chose to rework this PRD rather than open a second
  one.
- **feat and fix pay alike,** 30 to the author, 10 to each reviewer. Chosen by the person.
- **The merger is a reviewer,** paid 10 (it was 30 through `featureMerged`), once even when they also
  approved. Chosen by the person.
- **Retro and knowledge** are read by their labels, `omni:retro` and `omni:knowledge`, which the
  loop sets on them; a hand-written `docs:` pull request without those labels pays nothing. Taken
  without asking, the most reversible.
- **A feature or bug PR by its label too** (`omni:feature`, `omni:bug`), whatever its title's type,
  so a target's feature PR titled otherwise still pays. Taken without asking.
- **Retroactive.** Every sub-PR point and every old merge point is removed at the next poll, and past
  merges since `game_since` pay by the new table. Chosen by the person.
- **The expedition bonus stays, at 10.** Chosen by the person: the one credit a sub-PR's author
  still earns, which the rule's test names as the exception.
- **Multi-repository.** Each target already has its own feature branch and feature PR into its
  default branch: it pays by the same table, per repository. Tracking a repository stays a setting:
  backend-php, nimbus-soft and nimbus-build pay only once tracked in Settings › Repositories.
- **The arcade's words** (taken without asking, the most reversible): the secured zone's line, card
  and sentence are replaced by the merged pull request's, and the night-shift note loses its zone
  part. The screens `arcade-menu` and `home` are drafts in the screen library, not locked.
- **The voice, first design.** The Lead Engineer objected that 30 points per pull request rewards
  splitting one change into several pull requests. The person accepted the risk. Settled: `none`.
- **The voice, rework.** The Lead Engineer objected that approving pays the same 10 as merging, so
  approvals could be clicked for points. The person accepted the risk: reviews are judged as today.
  Settled: `none`.
- **The law.** The rule is written and tested now; locking it needs a free law slot or a larger
  `laws.max`, which is for its owner to decide.

## User stories

- As a developer who merges `feat` and `fix` pull requests into a product repository with no PRD, I
  earn 30 points for each, and whoever reviewed or merged it earns 10.
- As the author of a PRD's feature PR, whichever landing or target repository it belongs to, I earn
  30 points when it merges.
- As the person who writes a PRD's retro or knowledge pull request, I earn 10, and its reviewers 5.
- As a team, we know a sub-PR and a phase-0 PR earn nothing.
- As a player, I read in the galaxy's feed who merged and who reviewed which pull request.

## Scope

In: the read, the kinds, the two events, the pay, the end of the old merge pay, the sub-PR rule and
its test, the expedition number, the migration, the galaxy's feed lines, the arcade's words
(briefing, home page, cards), the README.

Out: tracking repositories (a setting); a cap on paid pull requests; paying a review only with a
comment; other kinds (`refactor`, `perf`, `chore`, plain `docs`); the dashboard's
`public.contributions` (it never feeds the ledger); locking the rule as a law.

## Test seams

- `game/sources/github.test.ts`: `buildSnapshot` with a fake `exec` lists merged pull requests per
  tracked repository with their kind and reviewers: a `feat`/`fix` title, an `omni:feature` and an
  `omni:bug` label are `feat`; `omni:retro` and `omni:knowledge` are `docs`; `omni:phase-0`, a
  `chore(release)`, a `docs:` title, a title with no type and a `[bot]` author are none. A person who
  approved and merged is one reviewer; the author is never one. No test calls GitHub.
- `game/projector.test.ts`: one `PR_MERGED` and one `PR_REVIEWED` per reviewer, their ids, their
  lower-case contributors, their teams and no planet; a second projection adds nothing.
- `game/economy.test.ts`: `PR_MERGED` pays 30 (`feat`) and 10 (`docs`), `PR_REVIEWED` 10 and 5;
  `FEATURE_MERGED` and `FEATURE_REVIEWED` pay 0; a planet built through sub-PRs credits each sub-PR
  author 0 for `ZONE_SECURED` and 10 at the terraform; a `ZONE_REVERTED` debits 0.
- `game/rulebook.test.ts`, `game/experience.test.ts`: the new numbers and XP weights.
- `game/events.test.ts`: `PR_MERGED` and `PR_REVIEWED` with planet 0 parse; any other type with
  planet 0 but `QUESTION_ANSWERED` still does not.
- `supabase/`: the migration's check accepts both types (the repository's migration checks).

## Risks

- **Every player's score and XP change** at the first poll after the merge: sub-PR points and the
  old merge points are removed, and every merge since `game_since` pays by the table. That is what
  was chosen; say it in the release notes. Rollback: put `zoneSecured` back to 10,
  `terraformExpedition` to 50, `featureMerged` to 30, `featureReviewed` to 10, and `prMerged` and
  `prReviewed` to 0; the next `game:score` and `game:xp` restore every number, the events staying and
  paying what the rulebook says.
- **The poll's budget.** One more `gh pr list` per tracked repository per poll (`--limit 1000`,
  merged since `game_since`). A repository that cannot be read reads as none, and the rest still land.
- **The migration** changes `ledger_events_type_check`; it is dated after the newest migration on
  `main`.
- **Splitting and rubber-stamping for points,** the Lead Engineer's objections: accepted, watched in
  review.
- N-PRODUCT-16: the game's ledger is only ever added to, never rewritten. If broken: scores and
  history could change after the fact, and players could no longer trust what they earned. This PRD
  only appends `PR_MERGED` and `PR_REVIEWED` and changes rulebook numbers; changing the law needs
  @pierrederval to approve the pull request on GitHub.
- The other locked laws: none touched.

## Acceptance criteria

- A `feat` or `fix` pull request (by title, or labelled `omni:feature` or `omni:bug`) merged by a
  person into a tracked repository's default branch, after `game_since`, credits its author 30
  points and each of its reviewers 10, in the season of its merge, and as much XP.
- A pull request labelled `omni:retro` or `omni:knowledge` credits its author 10 and each reviewer 5.
- A person who approved and merged one pull request is credited once as its reviewer; its author is
  never credited as its reviewer.
- A phase-0 pull request, a `chore(release): v0.0.N`, a plain `docs:` pull request, a title with no
  type and a bot's pull request credit no one.
- A pull request merged into a feature branch (a sub-PR) is never read.
- Each target's feature PR of a multi-repository PRD pays by the same table, once per tracked
  repository.
- After the first poll, `ZONE_SECURED`, `FEATURE_MERGED` and `FEATURE_REVIEWED` credit 0 points and
  0 XP, past seasons included, and a `ZONE_REVERTED` debits 0.
- A planet's terraform pays each crew member 10; the owner fleet and closers are paid as before.
- Polling twice writes each `PR_MERGED` and `PR_REVIEWED` once.
- A rule `A sub-PR never earns points` is in `rules.md`, its `Enforced by:` naming the test that
  proves it.
- The galaxy's feed shows `<login> merged #<number> into <repo>` and
  `<login> reviewed #<number> in <repo>`.
- The arcade's briefing, the home page's SHIP VALUE and the beaver's card name the merged feat/fix
  pull request and its points, and no longer name a secured zone.
