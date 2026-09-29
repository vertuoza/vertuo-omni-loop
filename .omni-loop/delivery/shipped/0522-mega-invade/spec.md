---
prd: 522
title: mega-invade — a plan repository that knows its target repositories
blocked-by: none
spec: file
---

# mega-invade: a plan repository that knows its target repositories

**Date:** 2026-09-29 · **PRD:** #522 · **Series:** multi-repository mode, part 1 of 3 (then
mega-brainstorm, then ultra-yolo) · **Touches:** the kit's config (`kit/lib/config.mjs`), a new verb
`omni targets`, `omni check kb` / `omni kb status` for imported knowledge, and a new skill
`kit/plugin/skills/mega-invade/`. No migration, and no change to the galaxy app, the GitHub App or
the game.

## Problem

At Vertuoza one feature usually lands in several repositories: the screen in `vertuo-apps`, the
business logic in `vertuo-backend-php`, the switch in `vertuo-soft`. The loop only knows one
repository. Its config holds a single `repo.slug`, every `gh` and `git` step acts on the checkout it
runs in, and a plan's slices have no repository. A PM cannot brainstorm one feature and get pull
requests in the back-end and the front-end from it.

The multi-repository mode keeps **one plan in one place**: a **plan repository** that holds no
product code, carries the PRD issue, its folder and its one phase-0 PR, while the code's pull
requests open in the **target repositories**. Vertuoza's plan repository is
`vertuoza/vertuo-automation-plan`, which already holds a routing guide
(`docs/git-repositories/README.md`) saying which repository does what.

Before a plan can name repositories, the plan repository must know them: which repositories are its
targets, what each one's role is, and whether each one has the loop and a knowledge base the
planner can read. Nothing records that today. This PRD adds it; the planning across repositories
(mega-brainstorm) and the delivery across them (ultra-yolo) are the next two PRDs.

## Solution

**1. The plan section of the config.** `.omni-loop/config.yml` gains an optional `plan` section.
A repository whose config has it is a **plan repository**; a config without it parses and behaves
exactly as today.

```yaml
plan:
  guide: docs/git-repositories/README.md
  targets:
    - repo: vertuoza/vertuo-backend-php
      role: back-end
      knowledge: imported
      readAt: 3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4
    - repo: vertuoza/vertuo-apps
      role: front-end
      knowledge: own
    - repo: vertuoza/vertuo-soft
      role: legacy
      knowledge: none
```

- `guide`: the repository path of the page that says, in prose, which repository does what. It is
  pointed at, never copied. `null` when the plan repository has none.
- `targets`: at least one entry. Each has:
  - `repo`: `owner/name`, unique in the list;
  - `role`: one short kebab-case word (`back-end`, `front-end`, `legacy`, `planning`…), free to
    choose, which later PRDs print beside the repository;
  - `knowledge`: `own` (the target has the loop and its own knowledge base, read where it lives),
    `imported` (the target has none, and a copy drafted from its code lives in the plan
    repository), or `none` (neither: the planner reads only the guide for it);
  - `readAt`: the full 40-character commit of the target's default branch the imported copy was
    read at. Required when `knowledge` is `imported`, refused otherwise.
- `omni config` refuses a malformed `plan` section and names the field first: a `repo` not in
  `owner/name` form, a duplicate `repo`, an empty `targets`, a `knowledge` outside the three words,
  a missing or extra `readAt`, a `role` that is not one kebab-case word.

**2. Imported knowledge.** The copy of a target's knowledge base lives in the plan repository at
`<paths.knowledge>/repos/<name>/`, where `<name>` is the target's repository name (the part after
the `/`). Its layout is a knowledge folder's own: `playbook/` with the forms, `product/`, `domains/`
and `cross-domain/` with the registers, and a `README.md` that says whose copy it is, the commit it
was read at, and that it is a draft to be replaced the day the target installs its own.

- The plan repository's own registers never read it: `readKnowledge` keeps reading only
  `product/`, `domains/` and `cross-domain/` directly under `paths.knowledge`, so an id in a copy
  (`BR-QUOTE-1` of the back-end) never binds the plan repository.
- Every **evidence** entry of a form in a copy names a path **in the target**, at its git blob hash
  at `readAt`, in today's `<path>@<hex>` shape. `omni check kb` checks a copy's forms and registers
  exactly as it checks the plan repository's own, except that it never looks for an evidence path
  on the plan repository's disk.
- `omni kb status --json` gains `targets: [{ repo, folder, forms, registers }]`, one entry per
  imported target, each shaped like today's top-level `forms` and `registers`.

**3. `omni targets`.** A new read-only verb. In a repository with no `plan` section it prints
`not a plan repository` and exits `1`. Otherwise it reads each target through `gh api` only (no
clone) and prints one row per target, in config order:

```text
repo                          role        knowledge  loop          state
vertuoza/vertuo-backend-php   back-end    imported   not installed stale (12 commits, 4 evidence files changed)
vertuoza/vertuo-apps          front-end   own        v0.0.40       ok
vertuoza/vertuo-soft          legacy      none       not installed ok
vertuoza/vertuo-typo          front-end   own        —             unreachable
```

- `loop`: the kit version its default branch's `.omni-loop/config.yml` was installed at
  (`omni update`'s own reading), `installed` when the version cannot be read, `not installed`
  when the file is absent.
- `state`, worst first:
  - `unreachable`: `gh` cannot read the repository (no access, a typo);
  - `drifted`: the config says `own` but the target no longer has the loop or a filled form, or it
    says `imported` or `none` and the target now has both;
  - `stale`, for `imported` only: the target's default branch moved past `readAt` **and** at least
    one evidence file of the copy changed between them (read with `gh api .../compare`); a head
    that moved without touching evidence stays `ok`;
  - `ok`.
- `--json` prints the same rows as `[{ repo, role, knowledge, loop, state, detail }]`. It exits
  `0` when every row is `ok`, `1` otherwise, so later PRDs and CI can gate on it.
- "Has a filled form" is: at least one file under the target's `paths.playbook` whose front matter
  says `state: filled`, read from its config (the default layout when the key is unset).

**4. `/omni:mega-invade`.** A new skill in the plugin, run in a plan-repository checkout that has
the loop installed. It writes **only in the plan repository**, never in a target, and ends in one
docs-only pull request on `branches.megaInvade` (default `docs/omni-mega-invade`) that a person
merges. In order:

0. **Step 0.** `omni config` prints (else: stop, one line, `omni init` first). Cut the branch from
   the default branch, or continue the open pull request of an earlier run, as `/omni:invade` does.
1. **Survey.** Read the guide when `plan.guide` is set or a page is found; its `## <name>` headings
   are the candidate repositories, prefixed with the plan repository's owner. Add every target the
   config already lists. For each candidate, run the same readings `omni targets` runs.
2. **One map, one answer.** Show every candidate in one table (installed? kit version? filled
   forms?) and take every answer in one message: for each, **target or not**, its **role**, and,
   for a target without its own knowledge base, **import one or not**. A target with the loop and
   a filled form is `own` without asking: its knowledge is never copied.
3. **Import.** For each target answered "import": a shallow, read-only clone of its default branch
   in the scratch folder, outside the plan repository. Run `/omni:invade`'s four read-only facets on
   it, and write what they find into `<paths.knowledge>/repos/<name>/` by invade's own rules: every
   register entry proposed, an index entry pointing at each rule a page already states, a
   `TODO(human)` where proof is missing. **Nothing runs in the clone**: no install, no test, no
   script. A playbook command the evidence suggests is written with a `TODO(human)` asking a person
   to confirm it runs. `readAt` is the clone's head.
4. **Config.** Write `plan.guide` and `plan.targets` as their own commit, so a person can drop the
   config change alone. `omni config` must still print.
5. **One docs-only pull request.** Its diff names only files under `paths.knowledge` and the config
   file. Its body carries the readiness table and, for each gap, the one step a person takes, in the
   target: `npx omni-loop init`, then `/omni:invade` there, to give it its own knowledge base.

**5. `/omni:mega-invade --sync`.** The same skill, keeping the imported copies current. It touches
only `imported` targets, never an `own` one.

- For each `stale` target: a fresh shallow clone, and only the forms and register entries whose
  evidence changed are redrawn, as `/omni:invade --refresh` does. A section or entry a person wrote
  or confirmed is never rewritten; a conflict with it becomes a `TODO(human)`. `readAt` moves to
  the new head.
- For each `drifted` target that now has its own loop and knowledge base: it proposes switching
  it to `own` and deleting its copy, in their own commit.
- A repository newly listed in the guide shows on the map as a candidate.
- It opens or continues the same one pull request. With nothing stale, drifted or new, it opens
  nothing and says so.

## Decisions

- **The plan repository is `vertuoza/vertuo-automation-plan`,** reused: the loop's footprint sits
  beside its `psd/`, `product-health/` and `plan-delivery/`. The kit itself names no repository:
  whichever repository runs mega-invade becomes a plan repository.
- **One plan in one place** (for the series): one mega phase-0 in the plan repository and no
  phase-0 in any target. This PRD only records the targets; it fixes the shape later PRDs build on.
- **Machine list in the config, prose in the guide.** The config holds the repository, a one-word
  role and the knowledge state; the "which repository does what" prose stays in the guide, pointed
  at, never copied.
- **A target with its own knowledge base is read in place,** never copied and never synced: the
  config says `own`.
- **A target without one may have a copy imported into the plan repository,** accepted as a
  trade-off: a copy can drift, so it is stamped with `readAt`, `omni targets` reports it `stale`,
  and `--sync` refreshes it. Only a person's "import" answer creates one.
- **Nothing runs in a target's clone.** mega-invade reads, it never executes code from another
  repository on the person's computer; unverified commands stay `TODO(human)`.
- **mega-invade never writes in a target repository:** a gap is reported with the step a person
  takes there.
- **`omni targets` reports and never refreshes:** a stale copy is refreshed only by `--sync`, in a
  pull request a person merges.

## User stories

- As the owner of the plan repository, I run `/omni:mega-invade` once and get one pull request that
  lists our back-end and front-end repositories with their roles, so the loop knows where code lives.
- As the same owner, I see at a glance which target has the loop and a knowledge base, and the one
  command to run in each one that has not.
- As the same owner, for a repository nobody has invaded yet, I say "import" and get a draft of its
  knowledge base in the plan repository, without touching that repository.
- As the same owner, when the back-end moved on, `omni targets` tells me its copy is stale and
  `/omni:mega-invade --sync` refreshes only what changed.
- As a later mega-brainstorm, I read `omni targets --json` to know every target, its role and where
  its knowledge lives.

## Scope

In:

- `kit/lib/config.mjs`: the `plan` section and its refusals; `branches.megaInvade`
  (default `docs/omni-mega-invade`).
- `kit/lib/plan-repo/` (new): the targets reader (`gh api` readings: installed, version, filled
  forms, compare for staleness) and the row states; `kit/bin/commands/targets.mjs` (new) and its
  entry in `COMMAND_TABLE`.
- `kit/lib/playbook/` and `kit/lib/knowledge/`: reading a copy under `repos/<name>/` with the
  existing parsers, `omni check kb` over copies (evidence not looked up on disk), `kb status`'s
  `targets`.
- `kit/plugin/skills/mega-invade/SKILL.md` (new), with `--sync`; its row in `/omni:help`.
- The kit's docs of the config (where `repo`, `branches` and `paths` are documented today).

Out:

- mega-brainstorm (a plan whose slices carry a repository, one mega phase-0): the next PRD.
- ultra-yolo (feature branches and pull requests in each target, one gate on the plan-repository
  PRD): the PRD after.
- Writing anything in a target repository, or installing the loop there.
- The Omni app: its workspace's `plan_repo` and sectors are not read or written.
- Running a target's commands anywhere.

## Test seams

Every test runs on fixtures; none calls GitHub or Supabase (`omni kb show testing` › Never). A
command is tested through `main()` on a fixture repository (`makeRepo()` in `kit/test/fixture.mjs`),
with `gh` faked the way `kit/bin/commands/dossier.test.mjs` and the board tests fake it.

- **Config (unit, `kit/lib/config.test.mjs`):** a config without `plan` parses unchanged; a valid
  `plan` parses; each refusal of point 1 is named, field first.
- **Targets reader (unit):** from faked `gh api` answers, each state: `ok` own, `ok` none, `ok`
  imported with a moved head that touched no evidence, `stale` imported, `drifted` both ways,
  `unreachable`; the worst-first order; `loop` read as a version, `installed`, `not installed`.
- **`omni targets` (command):** the table, `--json`, exit `0` all ok, exit `1` otherwise, and
  `not a plan repository` exit `1` without a `plan` section.
- **Imported knowledge (command):** `omni check kb` passes on a well-formed copy, fails on a
  malformed one the same way it fails on the repository's own, and never fails on an evidence path
  missing from the plan repository's disk; the plan repository's registers never include an entry
  of a copy; `kb status --json` lists `targets`.
- **Skill guards:** the kit's existing skill checks (signing, the footer guard of ADR-0042) cover the
  new skill.

## Risks

- **What a merge publishes** (`omni kb show releasing`): the kit. The root package's bin and the
  plugin marketplace hand out the new verb and the new skill on the next release (`v0.0.N`).
  Rollback: revert the merge; the next release hands out the kit without them. A plan repository
  that already merged a `plan` section would then be refused by the older config reader, so its
  owner reverts that config commit too (it is its own commit on purpose).
- **Copies drift.** An imported copy can say something the target no longer does. `readAt`,
  `stale` and `--sync` bound it; a later PRD's planner must say when it reads a stale copy.
- **Rate limits.** `omni targets` makes a few `gh api` calls per target; with six targets that
  stays well under GitHub's limits. It makes no call per evidence file beyond one compare.
- **A copy's ids clash with the plan repository's.** They cannot bind it: the plan repository's
  reader never enters `repos/`.

## Acceptance criteria

- A config with no `plan` section parses and every existing command behaves as today.
- `omni config` refuses each malformed `plan` section of point 1 and names the field.
- `omni targets` prints one row per target in config order with its role, knowledge, loop and
  state; `--json` gives the same rows; it exits `0` only when every row is `ok`.
- An imported target whose default branch moved and changed an evidence file reads `stale`; one
  whose head moved without touching evidence reads `ok`.
- An `own` target whose loop was removed, and a `none` target that installed the loop and filled a
  form, read `drifted`.
- A repository `gh` cannot read reads `unreachable` and is never dropped from the table.
- `omni check kb` checks the forms and registers under `repos/<name>/` and does not look for their
  evidence on the plan repository's disk; the plan repository's own registers contain no entry
  from a copy.
- `/omni:mega-invade` in a plan repository opens one docs-only pull request whose diff holds only
  files under `paths.knowledge` and the config file, the config change in its own commit, and a
  body with the readiness table and one next step per gap. It writes nothing in any target.
- Only a target answered "import" gets a `repos/<name>/` copy, with `readAt` set; a target with its
  own loop and a filled form is `own` and never copied.
- `/omni:mega-invade --sync` redraws only what changed in stale copies, never rewrites a section a
  person wrote, moves `readAt`, proposes `own` for a target that installed its own knowledge base,
  and opens nothing when there is nothing to do.
