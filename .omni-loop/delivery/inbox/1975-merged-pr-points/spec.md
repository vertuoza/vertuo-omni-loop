---
prd: 1975
title: Every feat or fix PR merged into a tracked repository's default branch pays its author; sub-PRs never earn points
blocked-by: none
spec: file
phase0: server
---

## Problem

A player's points do not follow the work they ship into main. Kevin reported 590 points after many
pull requests on backend-php, vertuo-soft and vertuo-build (#1948). Today, in `game/economy.ts`:

- a **sub-PR** pays its author `RULEBOOK.zoneSecured` (10) when it secures a slice's zone, and the
  terraform pays each sub-PR author `terraformExpedition` (50). Sub-PRs merge into feature branches,
  never into main, and must never earn points;
- a **feature PR** of a PRD pays only who merged it (`featureMerged`, 30) and each approver
  (`featureReviewed`, 10). Its **author** earns nothing, and only the first landing's feature PR of a
  PRD shipped in landings is read;
- an ordinary pull request into main that belongs to no PRD, most of the work on the product
  repositories, earns nothing.

The fix attempted in #1949 made the game read every landing's sub-PRs, which paid more sub-PRs; it
was closed for breaking the rule.

## Solution

1. **The read.** `game:project` (`game/sources/github.ts`) lists, for each tracked repository, the
   pull requests merged into its default branch (`gh pr list --base <default> --state merged`), with
   their number, title, author and merge time. It keeps one when:
   - its title opens with the type `feat` or `fix`, as Conventional Commits writes it, in any case:
     `feat: …`, `fix(scope): …`, `feat!: …`, `fix(scope)!: …`. Any other type (`chore`, `docs`,
     `refactor`, `test`, …) and a title with no type is not kept; `chore(release): v0.0.N` never is;
   - its author is a person: an author whose login ends `[bot]`, is a GitHub app, or is missing (a
     deleted account) is not kept.

   A sub-PR merges into a feature branch, never into the default branch, so it is never read.
2. **The event.** Each kept pull request is one ledger event, `PR_MERGED`, appended by the
   projector: id `pr:<owner>/<repo>#<number>:merged`, `at` its merge time, `contributor` its author's
   login in lower case (BR-PRODUCT-79), `team` from the roster, `region` its repository, and
   `data: { pr: <number>, kind: 'feat' | 'fix' }`. It belongs to no planet (`planet` 0, as an answered
   question does): it opens no wound, joins no crew, and no planet's loss claws it back. Its id names
   the pull request, so a merge pays once, however many polls see it, and a merge before the
   workspace's `game_since` is never written, as for every event.
3. **The pay.** `game/rulebook.ts` gains `prMerged: 30` and the XP weight `prMerged: 1`;
   `score()` credits `PR_MERGED` to its author, `'pr merged'`, in the season of the merge, with no
   multiplier. `FEATURE_MERGED` and `FEATURE_REVIEWED` are unchanged: the author of a merged feature
   PR earns `prMerged`, who merged it `featureMerged`, each approver `featureReviewed`. These are three
   different people's credits for one pull request, never one person paid twice for the same role.
4. **Sub-PRs earn nothing.** `zoneSecured` becomes `0`, and `ZONE_REVERTED` therefore debits 0.
   `ZONE_SECURED` is still written: the zones' state, the planet's readiness and the crew still read
   it. `score()` and `game:xp` recompute from the whole ledger, so every sub-PR point ever paid
   disappears at the next poll, this season's and XP alike. No ledger row is rewritten (N-PRODUCT-16).
5. **The expedition bonus** becomes `terraformExpedition: 10`, paid as today to each crew member when
   the planet terraforms. The closer bonus and the owner fleet's terraform credit are unchanged.
6. **The rule.** A product rule, `A sub-PR never earns points`, joins
   `.omni-loop/knowledge/product/rules.md`, enforced by a test of `score()` that a ledger holding a
   merged sub-PR's events credits its author no point but the expedition bonus. Locking it as a law
   is for its owner: the 20 law slots (`laws.max`) are full.
7. **The ledger's types.** A migration adds `PR_MERGED` to `ledger_events_type_check`; the galaxy's
   feed (`packages/galaxy/src/galaxy.ts`) says `<login> merged #<number> into <repo>`, and the event
   types listed in `game/events.ts`, `packages/galaxy/src/types.ts` and the arcade's menu name it.
8. **The docs.** `game/README.md` gains **Merged pull requests**, and its zone, expedition and
   scoring lines say the new numbers.

## Decisions

- **feat and fix pay, nothing else.** The person chose `feat + fix` over `feat only` and over every
  pull request. The type is read from the title, the way this repository and the kit's PRs are titled.
- **30 points per pull request,** the same as `featureMerged`. Chosen by the person.
- **Retroactive.** Setting `zoneSecured` to 0 removes every sub-PR point already earned, season and
  XP, at the next poll. Chosen by the person over "from now on".
- **The expedition bonus stays, at 10.** Chosen by the person: a sub-PR author still earns 10 when
  the planet terraforms. This is the one credit the crew of sub-PR authors keeps; the rule's test
  names it as the exception.
- **Past merges pay.** Merges since `game_since` are written on the first poll after this lands, as
  `FEATURE_MERGED` was (most reversible: setting `prMerged` to 0 removes them all).
- **No double pay.** A merged feature PR's author earns `prMerged`; who merged it and its approvers
  earn as today. The same login holding two roles is paid for each role it held, as today.
- **Tracking stays a setting.** backend-php, vertuo-soft and vertuo-build pay only once they are
  tracked in Settings › Repositories: nothing in this PRD tracks a repository.
- **The voice.** The Lead Engineer objected that 30 points per pull request rewards splitting one
  change into several pull requests into main. The person accepted the risk, the design unchanged:
  reviewers judge a pull request's size as today. Settled: `none`.
- **The law.** The rule is written and tested now; locking it needs a free law slot or a larger
  `laws.max`, which is for its owner to decide.

## User stories

- As a developer who merges `feat` and `fix` pull requests into a product repository with no PRD, I
  earn 30 points for each, so my score shows the work I ship.
- As the author of a PRD's feature PR, whichever landing it belongs to, I earn 30 points when it
  merges.
- As a team, we know a sub-PR earns nothing, so splitting a PRD into slices never inflates a score.
- As a player, I read in the galaxy's feed who merged which pull request into which repository.

## Scope

In: the read, the event, the pay, the sub-PR rule and its test, the expedition number, the migration,
the galaxy's feed line, the README.

Out: tracking repositories (a setting); a cap on paid pull requests per day; paying other types
(`refactor`, `perf`, …); changing `FEATURE_MERGED` or `FEATURE_REVIEWED`; the dashboard's
`public.contributions` (it never feeds the ledger); locking the rule as a law.

## Test seams

- `game/sources/github.test.ts`: `buildSnapshot` with a fake `exec` lists merged pull requests per
  tracked repository and keeps only `feat`/`fix` titles by a person (a `chore(release)`, a `docs:`, a
  title with no type and a `[bot]` author are dropped). No test calls GitHub.
- `game/projector.test.ts`: one `PR_MERGED` per kept pull request, its id, its lower-case contributor,
  its team and no planet; a second projection of the same snapshot adds nothing.
- `game/economy.test.ts`: `PR_MERGED` pays 30 to its author in the merge's season; a ledger of a
  planet built through sub-PRs credits each sub-PR author 0 for `ZONE_SECURED` and 10 at the
  terraform; a `ZONE_REVERTED` debits 0.
- `game/rulebook.test.ts`, `game/experience.test.ts`: the new numbers and the XP weight.
- `game/events.test.ts`: a `PR_MERGED` with planet 0 parses; any other type with planet 0 still
  does not.
- `supabase/`: the migration's check accepts `PR_MERGED` (the repository's migration checks).

## Risks

- **Every player's score and XP drop** by the sub-PR points they earned, at the first poll after the
  merge, and rise by 30 per past `feat`/`fix` merge into a tracked default branch. That is what was
  chosen; say it in the release notes. Rollback: put `zoneSecured` back to 10, `terraformExpedition`
  to 50 and `prMerged` to 0; the next `game:score` and `game:xp` restore every number, the events
  staying and paying what the rulebook says.
- **The poll's budget.** One more `gh pr list` per tracked repository per poll (`--limit 1000`,
  merged since `game_since`). A repository that cannot be read reads as none, and the rest still land.
- **The migration** changes `ledger_events_type_check`; it is dated after the newest migration on
  `main`.
- **Splitting for points,** the Lead Engineer's objection: accepted, watched in review.
- N-PRODUCT-16: the game's ledger is only ever added to, never rewritten. If broken: scores and
  history could change after the fact, and players could no longer trust what they earned. This PRD
  only appends `PR_MERGED` and changes rulebook numbers; changing the law needs @pierrederval to
  approve the pull request on GitHub.
- The other locked laws: none touched.

## Acceptance criteria

- A `feat(...)` or `fix(...)` pull request merged into a tracked repository's default branch by a
  person, after `game_since`, credits its author 30 points in the season of its merge, and 30 XP.
- A pull request merged into a feature branch (a sub-PR) never produces a `PR_MERGED`.
- A `chore(release): v0.0.N`, a `docs:` pull request, a title with no type and a bot's pull request
  credit no one.
- After the first poll, `ZONE_SECURED` credits 0 points and 0 XP, past seasons included, and a
  `ZONE_REVERTED` debits 0.
- A planet's terraform pays each crew member 10; the owner fleet and closers are paid as before.
- Polling twice writes each `PR_MERGED` once.
- A rule `A sub-PR never earns points` is in `rules.md`, its `Enforced by:` naming the test that
  proves it.
- The galaxy's feed shows `<login> merged #<number> into <repo>` for a `PR_MERGED`.
