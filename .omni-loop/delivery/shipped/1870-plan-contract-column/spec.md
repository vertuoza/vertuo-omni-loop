---
prd: 1870
title: A plan declares the contract each slice changes, and plan check refuses an undeclared one
blocked-by: none
spec: file
---

## Problem

A plan commits a repository to a contract before a line of code exists: a GraphQL type or field, a
REST route, a database migration. Nothing in the plan says so in a form a machine can read. The
slice table has an `id`, a `slice`, a `territory`, a `blocked by` and a `wave`; what a slice changes
for its callers sits in prose, in the "done when" bullets, where only a person reading the whole
plan finds it.

The plan repository `demo-org/nimbus-plan` needed that signal and built a gate on it: a
required GitHub check holds any phase-0 or feature pull request whose plan commits
`nimbus-backend-php` to a contract change until a member of the `backend-admin` team approves it
(its `plan-gate/` folder). The gate reads a `contract` column of the slice table. The repository's
playbook briefing told `/omni:plan` to write that column, and the planner never did: the plan
skill says the header row is "exactly" `| id | repo | slice | territory | blocked by | wave |`, and
a playbook form adds to a skill's steps but never overrides its rules. So on 2026-10-13, PRD 229's
phase-0 pull request there (`demo-org/nimbus-plan#231`) was held with "slice s1 declares
no contract", and every backend slice of every plan will be, with no way for a plan to say "this
slice changes nothing for its callers".

Paths were tried first and rejected: at plan level a territory such as `src/graphql/resolvers/`
cannot tell a schema change from a behaviour change, and nearly every backend slice touches one.

## Solution

**A declaration in the plan, asked for by the repository that receives the slice.**

1. The slice table may carry a `contract` column. Its cell says what the slice changes for its
   callers: one or more of the kinds the receiving repository names, comma-separated (`api`,
   `api, db`), or `none`. An em dash or an empty cell declares nothing. The column is read by name,
   like `landing`, so its position in the row is free.
2. A repository asks for the declaration in its own `.omni-loop/config.yml`:
   `contracts: { declare: true, kinds: [api, db] }`. `declare` is `false` by default; `kinds` is
   optional and defaults to `[api, db]`: `api` for a GraphQL schema or a REST route or payload,
   `db` for a migration or a stored shape. A repository whose callers depend on something else
   names its own (`kinds: [api, event]`, `kinds: [schema, rest, db]`), with no kit release. In an
   ordinary repository, every slice of its plans then declares. In a plan repository, every slice
   landing in a target that asks declares, with that target's kinds; the plan repository itself
   lists nothing.
3. `omni plan check` refuses, naming the slice, wherever the receiving repository asks: a cell that
   declares nothing, and a word outside that repository's `kinds`. Wherever the slice sits, it
   refuses `none` beside a kind. A declaration on a slice whose repository asks nothing is checked
   for that form only: there is no list to check its words against. So `/omni:plan`'s step 5,
   "check until green", guarantees the declaration before the plan is pushed.
4. A plan repository learns what a target asks, and with which kinds, from the target's copied
   planning config, `<paths.knowledge>/repos/<name>/flow/config.yml`, which today travels only
   with an `imported` knowledge copy. `/omni:mega-invade` now writes that copy for **every** target
   whose config carries a flow, a `landings.alone`, a `pr.openWith` or `contracts.declare`, `own`
   and `none` included, and only that folder: a target's knowledge base is still never copied
   unless imported. `omni targets` compares every target's committed planning config with its
   copy, and `--sync` redraws a stale one. `omni plan check` reads every copy present, whatever the
   target's `knowledge`.
5. `/omni:plan` writes the column when a repository asks, with that repository's kinds: in an
   ordinary repository, when `omni flow show` prints `contracts: declare <kinds>`; in a plan
   repository, for each target whose `omni flow show --repo <name>` prints it.
   `/omni:mega-brainstorm` runs that skill and changes nothing of its own.
6. Nothing else in the kit acts on the declaration. `Slice` carries it so that a downstream reader
   (the backend plan gate, the Omni app's phase-0 grading comment) can.

## Decisions

- **A declaration, not a path.** The planner judges and writes a kind or `none` after reading
  the slice; paths were rejected for their false positives (Problem). The residual risk is a `none`
  declared wrongly, which the phase-0 review exists to catch.
- **`none` is explicit.** An empty cell and "nothing to declare" must read differently, or a
  downstream gate cannot tell an oversight from a decision.
- **The repository that receives the slice asks, never the plan repository.** `contracts.declare`
  lives in the target's own config and reaches the plan repository through the copy, like its flow
  areas do. A list of repositories in the plan repository's config was considered and rejected: the
  plan repository would decide for a target it does not own.
- **The planning config of every target is copied, `own` included.** The alternative, switching a
  target such as `nimbus-backend-php` to `imported`, would put a draft of its knowledge base in the
  plan repository, which `own` exists to avoid. Copying `flow/` alone copies nothing a person wrote.
  A consequence worth naming: a target's `landings.alone` and flow areas, written in its own config,
  reach `omni plan check` of the plan repository for the first time too. It is a change of its
  own, so the release note names it (Risks).
- **The receiving repository names its kinds; `api, db` by default.** What a repository's callers
  depend on is the repository's to say: a back end has an API and a database, a worker has events
  and queues, a library has its exports. A closed vocabulary in the kit was considered and
  rejected: every new kind would wait for a kit release, and the kit would hold the words of one
  consumer. The default keeps the common case at one line: `api` groups a GraphQL schema change
  and a REST change, `db` is a migration or any stored shape change. A downstream gate reads the
  words its repository chose; `nimbus-plan`'s backend gate can keep `schema` and `rest`
  by having `nimbus-backend-php` declare `kinds: [schema, rest, db]`.
- **Words are checked only where a list exists.** A slice of a repository that asks nothing, or of
  a target with no copy, has no `kinds` to check against: its cell is checked for form alone
  (`none` beside a kind). Checking it against the default would refuse a target's own words the
  day its copy goes missing.
- **A missing copy is silent in `plan check`, loud in `omni targets`.** A target that asks in its
  committed config but has no copy in the plan repository is graded with the kit's defaults, as a
  target without a flow copy is today; `omni targets` reports it `stale`, and `--sync` repairs it.
  Refusing in `plan check` would turn every plan repository red on the day the kit updates.
- **Nothing downstream in this PRD.** A check that a built sub-PR honours its slice's declaration
  (a slice that declared `none` touching a `risk.sharedContract` path) is the natural next PRD, on
  the outbox check's risky-change rules; and `plan.product`, whose targets are read from the server,
  has no copy to carry a target's `contracts.declare` yet.

## User stories

- As the owner of a back-end repository, I write `contracts: { declare: true }` once in my own
  config, and every plan that lands a slice in my repository, from any plan repository, says what
  that slice changes for its callers.
- As the owner of a repository whose callers depend on something other than an API or a database,
  I name my own kinds (`kinds: [api, event]`) and plans declare with those, without waiting for a
  kit release.
- As a planner (`/omni:plan`, `/omni:mega-brainstorm`), I write one of the receiving repository's
  kinds or `none` beside each slice of such a repository, and `omni plan check` tells me which
  slice I left undeclared or misspelt before I push.
- As a reviewer of a phase-0 pull request, I read in the slice table which slices change a
  contract, and a gate built on that column holds the pull request for the right people without
  holding the slices that change nothing.
- As the maintainer of a plan repository, `omni targets` tells me when a target's planning config
  moved since its copy, `own` targets included, and `/omni:mega-invade --sync` redraws the copy.

## Scope

**In.**

- `kit/lib/config.ts`: a root `contracts` section, strict, `declare: boolean`, default `false`,
  and `kinds: string[]`, default `['api', 'db']`, each a lowercase word, none of them `none`, the
  list non-empty and without duplicates; anything else refused with the key's path.
- `kit/lib/types.ts`, `kit/lib/inbox/territory.ts`: `Slice.contract`, read from the `contract`
  column by name: `{ kinds: string[] }` (the cell's words, lowercased, in order, `none` kept if it
  sits beside another word, for the grader to refuse), `'none'`, and `null` for no column, an empty
  cell or an em dash. The parser checks no vocabulary: the grader does, against the receiving
  repository's `kinds`.
- `kit/lib/inbox/plan-grade.ts`: the three refusals of Solution 3, each naming its field first, as
  the other refusals do, and naming the receiving repository's kinds; the repository that asks is
  the config's own outside a plan repository, and each target's copied `contracts` inside one.
- `kit/lib/plan-repo/copy-flow.ts`: `FlowConfig` gains `contracts`, kinds included;
  `parseFlowConfig` picks it; `NO_FLOW` carries `declare: false` and the default kinds; `hasFlow`
  is true when `declare` is; `targetFlows` reads every copy present, whatever the target's
  `knowledge`.
- `kit/lib/plan-repo/targets.ts`: `readTargets` compares every target's committed planning config
  with its copy; a target that commits one and has no copy is `stale` with a detail starting
  `flow not copied`.
- `kit/bin/commands/flow.ts`: `omni flow show [--repo <name>]` prints one line,
  `contracts: declare <kinds>` (`contracts: declare api, db`) or `contracts: none`.
- `kit/bin/commands/plan.ts`: `omni plan check` prints, after the waves, one line naming every
  slice that declares a kind, with its kinds.
- `kit/plugin/skills/plan/SKILL.md`: when a repository asks, the header row (both variants) gains
  `contract` after `territory`; the cell holds that repository's kinds, as `omni flow show` prints
  them, or `none`; the rule for the default `api` and `db`; `—` on a slice of a repository that
  asks nothing. `kit/porting/plugin--plan.md` records the departure from upstream.
- `kit/plugin/skills/mega-invade/SKILL.md`: step 3's "The flow" applies to every target, and
  names `contracts.declare` among the keys that make a copy; `--sync` the same.
- `docs/guide/flow.md`: the `contracts.declare` and `contracts.kinds` keys, the default kinds and
  the refusals `plan check` prints; `docs/guide/several-repositories.md`: the planning config of
  every target is copied, `own` included, and what that brings into `plan check`.
- An ADR under `.omni-loop/knowledge/adr/`: the declaration lives in the plan and in the config of
  the repository that receives the slice, which names its own kinds, never in the plan repository;
  with the alternatives rejected (paths, a mark on the done-when heading, a list in the plan
  repository, a closed vocabulary in the kit).

**Out.**

- Any reader of the declaration beyond `Slice` and the two printed lines: no merge-time check of
  a sub-PR's diff against it, no label, no comment.
- `plan.product` targets read from the server: no copy carries their `contracts.declare` yet.
- The backend plan gate of `demo-org/nimbus-plan`: it already reads the column. Whether
  `nimbus-backend-php` keeps the gate's `schema`/`rest` through `kinds`, or the gate moves to the
  default `api`, is decided there.

## Test seams

Test-first, beside the code, as `omni kb show testing` says; `config` and `inbox` are delivery core,
so `pnpm mutation:changed` runs on them and their floors (94, 69) never go down.

- `kit/lib/config.test.ts` — `parseConfig`: `contracts.declare` is `false` and `contracts.kinds`
  `['api', 'db']` by default, both read when the file says so, and a non-boolean `declare`, an
  empty `kinds`, a duplicate, a non-string or `none` among them are refused with the key's path.
- `kit/lib/inbox/territory.test.ts` — `parsePlanSlices`: `api`, `db`, `api, db` (any spacing,
  any case), a word of any repository's own (`event`), `none`, `none` beside a kind, an empty cell
  and an em dash, a plan with no `contract` column reading `null`; the column found by name at any
  position.
- `kit/lib/inbox/plan-grade.test.ts` — `gradePlan`: an ordinary repository that asks refuses an
  undeclared slice and a word outside its kinds, accepts `none`, and accepts its own kinds when they
  are not the default; one that does not ask accepts a plan without the column and any declaration
  of the right form; `none` beside a kind is refused wherever it sits; a plan repository asks per
  target, with that target's kinds, from the copied flows handed in, and checks only the form for a
  target with no copy; every refusal names the slice and the field first.
- `kit/lib/plan-repo/copy-flow.test.ts` — `parseFlowConfig` picks `contracts`, kinds included, and
  ignores every other key; `hasFlow` is true with `declare: true` alone; `targetFlows` returns the
  copy of an `own` target and of a `none` target when one is on disk.
- `kit/lib/plan-repo/targets.test.ts` — `readTargets`, against the stubbed GitHub: an `own`
  target whose committed config differs from its copy is `stale`; one that commits a planning
  config and has no copy is `stale (flow not copied …)`; one with neither stays as today.
- `kit/bin/flow.test.ts` — `omni flow show` prints the `contracts:` line with the kinds, with and
  without `--repo`, on a fixture repository (`makeRepo()`).
- `kit/bin/plan.test.ts` — `omni plan check` prints the declared contracts after the waves, and
  its refusal lines read as the spec says.
- The skills and the guide have no test: `kit/porting/plugin--plan.md` and the two guide pages are
  reviewed in the pull requests that change them.

## Risks

What a merge of this PRD publishes (`omni kb show releasing`): **the kit** — `kit/dist/omni.mjs`,
the file the one-line install runs, and the plugin with its skills, which every kitted repository
picks up at its next `omni update`. No database migration, no arcade or GitHub App change beyond the
App reading a `Slice` with one more field. Rollback is reverting the feature pull request; the
release commit that follows it hands out the previous kit again.

- **A plan repository goes red on update.** It does not: a target with no copied planning config
  is graded with the kit's defaults, as today. What changes on update is `omni targets`, which may
  report an `own` target `stale (flow not copied)` until `--sync` runs; that is information, not a
  refusal.
- **A target's flow areas start applying in the plan repository.** `nimbus-backend-php`'s
  `landings.alone` and its `migrations` area reach `nimbus-plan`'s `plan check` once its
  copy exists; a plan that already violates them goes red at its next check. That is the rule the
  target wrote for itself finally being read; the plan repository's maintainer sees it in `omni
  targets` before syncing. It reaches every plan repository with an `own` target, not only the
  ones that use contracts, so the PRD's release note says it in its own line: what now applies,
  and that `omni targets` shows it before `--sync` brings it in.
- **A repository renames or drops a kind.** A plan written with the old word goes red at its next
  check, naming the slice and the kinds the repository now names. The repository's owner chose the
  change; the planner rewrites the cell.
- **A `none` declared wrongly.** Accepted (Decisions); the phase-0 review and, later, a merge-time
  check on the built diff (the next PRD) are the nets.
- **Existing plans with backend slices.** A plan written before this PRD has no column; it is
  graded only when a pull request changes it, and the planner then adds the column. Nothing is
  backfilled.

## Acceptance criteria

Every criterion is a condition someone can observe; `/omni:plan` turns each into a slice's "done
when". No acceptance harness in this repository: ordinary tests prove them.

1. `parseConfig` of a config with `contracts:\n  declare: true` reads `contracts.declare` as `true`
   and `contracts.kinds` as `['api', 'db']`; with `kinds: [api, event]`, as `['api', 'event']`;
   with no `contracts` key, `declare` as `false`; `declare: yes` (a string) is refused, naming
   `contracts.declare`; `kinds: []`, `kinds: [api, api]` and `kinds: [none]` are refused, naming
   `contracts.kinds`.
2. `parsePlanSlices` of a slice table with a `contract` column reads `api` as `{ kinds: ['api'] }`,
   `API , db` as `{ kinds: ['api', 'db'] }`, `event` as `{ kinds: ['event'] }`, `none` as
   `'none'`, `none, db` as `{ kinds: ['none', 'db'] }`, `—` and an empty cell as `null`; the same
   table without the column reads `null` on every slice; the column is found at any position among
   the header's names.
3. `gradePlan` of a plan whose slice `s2` declares nothing, in an ordinary repository that asks with
   the default kinds, lists the violation `s2: contract: declares nothing — api, db or none`, and
   lists no violation once `s2` declares `none`.
4. In the same repository, `gradePlan` lists `s3: contract: "graphql" is no kind of this
   repository — api, db or none` for a slice declaring `graphql`; in a repository that asks with
   `kinds: [api, event]`, `event` is accepted and `db` refused the same way. `s4: contract: "none"
   beside a kind — one or the other` is listed for `none, db` whether or not the repository asks;
   in a repository that asks nothing, `graphql` is accepted.
5. `gradePlan` of a plan repository's plan, handed the copied flows of its targets, refuses an
   undeclared slice of a target whose copy says `declare: true`, and a word outside that copy's
   kinds; accepts an undeclared slice of a target whose copy says nothing or has no copy; and
   accepts a declaration of the right form on a target that asks nothing.
6. `parseFlowConfig` of a config text with only `contracts:\n  declare: true` returns a flow whose
   `contracts.declare` is `true`, whose `contracts.kinds` is `['api', 'db']` and whose other keys
   are the defaults; with `kinds: [schema, rest, db]`, those kinds; `hasFlow` of it is `true`;
   `NO_FLOW.contracts.declare` is `false`.
7. `targetFlows` of a plan repository with a target of `knowledge: own` and a
   `repos/<name>/flow/config.yml` on disk returns that target's flow; with no file, the target is
   absent from the map.
8. `readTargets`, against a stubbed GitHub, reports an `own` target whose committed
   `.omni-loop/config.yml` carries `contracts.declare: true` and has no copy as `stale`, its detail
   starting `flow not copied`; the same target with an identical copy as `ok`; a target that commits
   no planning config and has no copy as it is reported today.
9. `omni flow show` in a repository that asks with the default kinds prints the line
   `contracts: declare api, db`; with `kinds: [api, event]`, `contracts: declare api, event`; in
   one that does not ask, `contracts: none`; `omni flow show --repo <name>` prints the target's
   copy's.
10. `omni plan check <n>` on a plan whose `s1` declares `api, db` prints a line naming `s1` and both
    kinds after the waves; on a plan whose `s1` declares nothing in a repository that asks, exits
    1 and prints the refusal of criterion 3.
11. `kit/plugin/skills/plan/SKILL.md` names the `contract` column, its two header variants, where
    the kinds come from (`omni flow show`), the default `api` and `db`, `none`, and when to write
    the column; `kit/plugin/skills/mega-invade/SKILL.md` says the planning config of every target
    is copied; `docs/guide/flow.md` documents `contracts.declare`, `contracts.kinds` and the
    refusals; `docs/guide/several-repositories.md` says the copy covers every target and that an
    `own` target's flow areas and `landings.alone` then reach `plan check`; an ADR records the
    decision and the alternatives, a closed vocabulary among them.
