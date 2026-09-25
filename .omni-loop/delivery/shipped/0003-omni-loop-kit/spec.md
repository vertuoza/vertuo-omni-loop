---
prd: 3
title: Omni Loop kit — terraform any repository with the delivery loop
blocked-by: none
spec: file
---

# Omni Loop — the terraform kit

**Date:** 2026-09-24
**Status:** design, awaiting review
**Scope:** turning the delivery loop that `vertuo-ai-domain` runs by hand (brainstorm → inbox → yolo →
outbox → yolo-fix → shipped) into a kit that installs into any repository, reads everything specific to
that repository from one removable `.omni-loop/` folder, and ships its skills once, as a Claude Code
plugin. Not the game (`docs/superpowers/specs/2026-09-24-omni-plan-game-design.md`), which only reads
what this kit produces.

## 1. Why

The loop has been ported twice by hand into `vertuo-workflow` (2026-09-11, 2026-09-23). Each port is a
fork: its `.claude/skills/PORTED.md` lists, skill by skill, every literal that had to change — ADR
numbers, register paths, labels, check names, the preflight command, the acceptance layout, the repo
slug. One day after the second port, upstream (`vertuo-ai-domain` `origin/main`, `c4a21012`) had
already moved on: options A–D, adopted medium items, reply intake on the pull request, Slack, and the
`docs/knowledge/` registers. A copy per repository cannot keep up.

The kit fixes that by construction: **one source of behaviour, one config file per repository, zero
repository literals in the kit.**

## 2. Principles

1. **Removable.** Everything the loop owns in a repository sits in `.omni-loop/`. The only files outside
   it are listed in `.omni-loop/manifest.json`, and `omni-loop remove` deletes exactly those. Removing
   the loop leaves product code untouched.
2. **No literal of any repository in the kit.** A path, label, command, check name, ADR number or slug
   is read from `.omni-loop/config.yml`. A skill that needs a value the config does not hold says so and
   stops; it never falls back to another repository's habit.
3. **Behaviour comes from `vertuo-ai-domain` `origin/main`; seams come from `vertuo-workflow`.** The
   port's injection style (`invariantAdrs(root)` passed in, labels never auto-created, board matched by
   base branch, statuses read by name) is the template for configurability.
4. **Independent of upstream PRD #1229.** The kit borrows its good ideas (one folder per PRD, the folder
   is the status, the feature PR carries the ship move) but neither implements nor tracks it.
5. **No bot writes to `main`.** A human merge is the only thing that ships.
6. **State is derived or is a folder, never a field.** No `status`, `priority` or `value` in any
   front matter. A planner never invents a business-value number.
7. **The game stays a projection** of what this kit writes, and the kit never mentions the game.

## 3. The footprint in a terraformed repository

```text
.omni-loop/
  config.yml                 everything specific to this repository (§4)
  repo.md                    prose the do-work step obeys: architecture rules, conventions
  manifest.json              kit version + every file written outside .omni-loop/
  bin/omni.mjs               the kit's library and CLI, bundled, Node only, pinned version
  delivery/
    README.md
    inbox/<prd>-<topic>/     approved, not shipped
      spec.md  plan.md  before-after.html
    outbox/<prd>-<topic>/    a PRD being built: open items, settled.md, accounts/
    shipped/<prd>-<topic>/   merged: spec.md plan.md before-after.html outbox/
    archive/                 history no PRD issue can be matched to
  knowledge/
    README.md                where truth lives (§6)
    product/{principles,rules,invariants}.md
    domains/<domain>/{README,principles,rules,invariants}.md
    cross-domain/<a>--<b>.md
    adr/NNNN-<slug>.md       unless config points at an existing ADR folder
.github/workflows/omni-outbox.yml   (manifest-listed)
.claude/settings.json               two keys merged in: marketplace + enabled plugin (manifest-listed)
```

`<prd>` is the PRD issue number, zero-padded to four digits; `<topic>` is kebab-case and is also the
feature branch's name (`feat/<topic>`). One naming rule joins folder, branch and outbox.

Every path above is a default. A repository that already has `docs/adr/` or `docs/knowledge/` points
the config at them and the kit writes nothing there on install (and `remove` leaves them alone).

## 4. `config.yml`

Written by `omni-loop init` (§10), checked by `omni-loop doctor`. Sketch — the schema lives in
`kit/lib/config.mjs` and is the only definition:

```yaml
kit: 1                               # config schema version
repo:
  slug: vertuoza/vertuo-workflow-domain   # default: read from the origin remote
  remote: origin
  defaultBranch: main
github:
  user: null                         # gh auth --user, when several accounts are logged in
branches:
  feature: feat/{topic}
  fix: fix/{topic}
  phase0: docs/phase-0-{topic}
  slice: feat/{topic}--{slice}
  rework: fix-{item}
worktrees: .claude/worktrees
paths:
  delivery: .omni-loop/delivery
  knowledge: .omni-loop/knowledge
  adr: .omni-loop/knowledge/adr      # e.g. docs/adr in a repo that has one
  glossary: null                     # e.g. docs/glossary.md
  context: [CLAUDE.md]               # read before planning and building
labels:                              # names only; see autoCreate
  prd: prd
  phase0: pr:phase-0
  feature: pr:feature
  sub: pr:sub
  inProgress: pr:in-progress
  needsFix: pr:needs-fix
  outboxGo: outbox:go
  autoCreate: false                  # true: skills create missing labels; false: report a human step
prLinks:
  feature: "Closes #{prd}"
  sub: "Part of #{prd}"
  phase0: "Refs #{prd}"
board:
  matchBy: base                      # base | label
ci:
  outboxContext: ci/outbox
  aggregateCheck: all-green          # null when there is none
  branchProtection: false            # false: statuses are read by name, never via --required
  runner: ubuntu-latest
commands:
  preflight: pnpm quality:preflight
  preflightFull: pnpm quality:preflight --full
  checks: [pnpm check]               # optional extra guards, run before a PR
  test: pnpm test
acceptance:
  enabled: true
  dir: apps/e2e/features
  pendingSuffix: .pending.feature    # null: plain .feature
  run: null                          # command that runs the scenarios twice
laws:
  source: knowledge                  # knowledge | claudeMdInvariants | none
  claudeMdHeading: "## Invariants"   # used by claudeMdInvariants
risk:                                # decision-coverage rules specific to this repository
  storedShape: []                    # regex sources: a persisted schema changed (e.g. '^libs/[^/]+/src/server/migrations\.ts$')
  sharedContract: []                 # path prefixes other repositories read (e.g. 'libs/system-api-contract/')
notify:
  slack: { channelVar: OMNI_SLACK_CHANNEL, tokenSecret: SLACK_BOT_TOKEN }   # or null
limits:
  stallDays: 5
  attempts: 3
  claimStaleMinutes: 60
  beforeAfterMaxBytes: 512000
markers:
  prefix: omni-outbox                # <!-- omni-outbox -->, <!-- omni-outbox-settled: id -->
```

## 5. Delivery: the lifecycle and its states

**The folder is the status.**

| State | Where | Derived from |
|---|---|---|
| approved, unplanned / planned / in flight / stalled | `inbox/<prd>-<topic>/` | branches and PR bodies (`Closes #`, `Part of #`), as `inbox-status.mjs` does today |
| being answered | `outbox/<prd>-<topic>/` holds open items | the files |
| shipped | `shipped/<prd>-<topic>/` on `main` | the human merge of the feature PR |
| archive | `archive/` | nothing matched |

1. **`/omni-brainstorm`** — an idea, classified spike / bounded / architectural (the upstream
   brainstorming steps are written into the skill; no `superpowers:` dependency). It writes
   `inbox/<prd>-<topic>/{spec.md,before-after.html}` and, when there is behaviour, the pending
   acceptance files; opens the PRD issue (a pointer to the file); runs the plan step; opens the
   docs-only phase-0 PR into `main`. **Stops:** a human merges phase-0.
2. **Plan** (internal) — writes `plan.md` beside `spec.md`: waves of slices with territory and blockers,
   a collision matrix (`sameWaveCollisions` must be empty). Opens the draft feature PR
   `feat/<topic>` → `main` with `Closes #<prd>`.
3. **`/omni-yolo <prd>`** — rebuilds the board from GitHub, runs every wave, asks nothing. Each slice:
   **claims first** (a draft sub-PR opened before building, per the game spec §3.2 — justified without
   the game: two concurrent runs no longer build the same slice), builds test-first, records every
   decision it took as an outbox item, and is squash-merged into the feature branch after the full
   preflight. Ends with the feature PR ready and `ci/outbox` red when items are open — the expected end
   state. Never labels `outbox:go`, never merges `main`.
4. **A person answers** on the PR (§8).
5. **`/omni-yolo-fix <prd>`** — reads the replies, settles them (a settle sub-PR), reworks every
   drifted item as a slice (one sub-PR each), and, once nothing is open or unreworked, runs the **ship
   step**.
6. **The ship step** (`omni ship <prd>`, on the feature branch): move `inbox/<prd>-<topic>/` to
   `shipped/<prd>-<topic>/`, move the outbox folder into it as `outbox/`, rewrite links to either,
   commit. The human merge ships it. `/omni-yolo` runs the same step itself when it ends with nothing
   open.

## 6. Knowledge: where truth lives

The split `vertuo-ai-domain` settled in #1081, made portable:

| Layer | Id | Who decides | Proven by a test? |
|---|---|---|---|
| Principle — what the product should be | `P-<CODE>-<n>` | a person | no, judged |
| Business rule — what may or may not happen | `BR-<CODE>-<n>` | a person, via a PRD | yes |
| Invariant — what must always hold in the code | `N-<CODE>-<n>` | engineering | yes, or honestly `unenforced` |
| Cross-domain rule or invariant | `X-<A>-<B>-<n>` | — | yes |
| ADR — how we build | `ADR-NNNN` | engineering | — |

A rule names the one principle it `Serves:`; a principle nothing serves is a *wish* (a warning, never a
failure). Ids are never renamed or reused. "A decision about how we build is a decision record; a
decision about what the product should do is a principle." The entry format, the id grammar and the
checks are `vertuo-ai-domain`'s `registers.mjs` / `check-registers.mjs` / `knowledge.mjs`, ported with
the paths from config.

**Laws** — what raises an outbox item's rank floor to `high` and what stops a slice outright — come
from `laws.source`:

- `knowledge`: any `P-`/`BR-`/`N-`/`X-` id resolved in the registers.
- `claudeMdInvariants`: the ADRs cited under `laws.claudeMdHeading` in `CLAUDE.md` (vertuo-workflow
  today).
- `none`: no floor; `bears-on` may still cite an ADR.

A fresh install seeds `knowledge/` with the README and empty `product/` files, and the layout grows
domains as PRDs name them.

**Write-back, checked.** A settled answer that states something true about the product becomes a new
or amended entry in the same commit, and its settled entry carries `- Became: <id>`. The kit's check
resolves every `Became:` id (today nothing does, and 3 of 104 answers upstream were ever written back).
Which answers *should* become entries stays a judgment, not a check.

## 7. The outbox

Kept as upstream `origin/main` has it:

- **Item** `outbox/<prd>-<topic>/<slice>-<nn>-<slug>.md`: front matter `id, prd, slice, rank, bears-on,
  raised, wave`; sections in order — the question / the decision / the options (A = what was built,
  B–D) or what a person must do, in plain words (no paths, code or ids, two sentences at most); then
  what I had to decide, what I did meanwhile, what it costs to change later, what I could not know.
- **Ranks** `human-action` > `high` > `medium`; `bears-on` a law floors at `high`.
- **Medium items are adopted** straight into `settled.md` (`Verdict: adopted`, approved by nobody); an
  objection later appends `drifted`.
- **`settled.md`** is append-only; verdicts `agreed | drifted | adopted`; the latest entry for an id
  wins; only `Closed:` and `Became:` lines are ever amended.
- **Accounts** `accounts/<slice>.md`: every risky change (a knowledge or ADR edit, among others) is
  accounted for by an item or by the spec.

**Two changes to the gate:**

1. **Drift keeps it red.** `ci/outbox` is red while an item is open **or** a `drifted` entry's `Closed:`
   line does not yet say reworked. Today a drifted answer turns the gate green while the build is still
   wrong.
2. **`Became:` must resolve** (§6).

## 8. Talking to people

| Channel | Who reads it | Written by |
|---|---|---|
| `ci/outbox` commit status on the feature PR | reviewer, merger | `omni-outbox.yml` |
| The outbox comment on the feature PR, rewritten in place (marker) | the people answering | `omni-outbox.yml` |
| The outbox comment on the PRD issue, rewritten in place | the PM | `omni-outbox.yml`, and each yolo wave |
| A Slack note on news only (created, new item, newly adopted) | the owning team | `omni-outbox.yml`, when `notify.slack` is set |
| The yolo / yolo-fix end-of-run report | whoever ran it | the skill |

**How a person answers:** on the feature PR, in the reply grammar upstream settled in #1080/#1166:
`1: ok`, `2: B because …`, `approve all`, `go with recommendation`, or a `Verdict:` line. The label
`outbox:go` waves the gate through. A person never edits an outbox file. An undetermined answer gets a
"round N" comment asking again; it is never guessed.

Comment authorship is `github-actions[bot]` (the workflow token), so the comment notifies the people it
names; every posting step is `continue-on-error` — a GitHub or Slack hiccup never turns the gate red.
All comment writers share one marker-based upsert helper (upstream's `--edit-last` in the PR skill is
the unsafe case this replaces).

## 9. The skills (one plugin)

The plugin lives in this repository (`kit/plugin/`), published through a marketplace file here. A
target enables it in `.claude/settings.json`.

| Skill | User-facing | Upstream origin |
|---|---|---|
| `omni-brainstorm` | yes | `vertuo-brainstorming` (+ superpowers steps inlined) |
| `omni-yolo` | yes | `vertuo-yolo` ≡ deliver with the ask-nothing policy |
| `omni-yolo-fix` | yes | `vertuo-yolo-fix` (origin/main: replies, settle PR, post-merge path) |
| `omni-plan` | internal | `vertuo-plan` |
| `omni-wave` | internal | `vertuo-parallel-wave` (+ claim first) |
| `omni-do-work` | internal | `vertuo-do-work`; repository rules come from `.omni-loop/repo.md` |
| `omni-pr` | internal | `vertuo-pull-request`, reduced to the three PR kinds and their lifecycle |

Not carried over: `vertuo-deliver` (yolo with asking; later, as a policy flag), `vertuo-planner`
(later), `vertuo-bbq`, `vertuo-pr-monitor` (repo-specific, the one skill that merges `main`),
`vertuo-testing` / `vertuo-fix-bug` / `vertuo-react-*`.

Every skill starts with the same step: read `.omni-loop/config.yml` through `omni config` (which also
checks the bundled bin's version against the plugin's and says which to upgrade); stop if the repository
is not terraformed. Policy stays tested code, not prose (upstream's decision 9): `outbox-policy`,
`rework`, `phase-0-policy` live in `kit/lib/`.

**Open:** plugin skills are namespaced (`/omni-loop:omni-yolo`). Whether bare `/omni-yolo` resolves
without a conflict is to be verified in phase 3; if not, the plugin is named `omni` and the skills
`yolo`, `yolo-fix`, `brainstorm` → `/omni:yolo`.

## 10. Terraforming: `omni-loop`

```text
npx github:vertuoza/vertuo-omni-plan init     # in the target repository
omni-loop doctor                              # config valid, bin version, labels, workflow, settings
omni-loop upgrade                             # new bin + workflow template, config migrated
omni-loop remove                              # delete every manifest file, unmerge settings keys, rm .omni-loop/
```

`init` reads the repository before asking anything: remote and default branch, package manager and its
scripts (a `quality:preflight`?), CI workflows and required checks, an existing `docs/adr/` or
`docs/knowledge/`, a `CLAUDE.md` `## Invariants` section, a glossary, the labels that exist. It proposes
a config, asks only what it could not read, writes the footprint, and prints the human steps it may not
take itself: create labels, add the Slack secret, add `ci/outbox` to branch protection.

`init` on a terraformed repository is `doctor`. `remove` refuses when `delivery/inbox/` or
`delivery/outbox/` hold anything, unless `--force`: removing the loop mid-delivery loses open questions.

## 11. This repository's layout

```text
kit/
  lib/            config, delivery, inbox, inbox-status, collisions/territory, outbox, outbox-status,
                  outbox-settle, outbox-replies, outbox-comment, outbox-account, knowledge/registers,
                  ship, policies — pure, config injected, one *.test.mjs each, fixture repos
  bin/            omni.mjs entry (config, status, settle, replies, comment, ship, check, prd)
  ci/             omni-outbox.yml template + its shape test
  cli/            omni-loop.mjs (init, doctor, upgrade, remove)
  plugin/         .claude-plugin/plugin.json, skills/omni-*/SKILL.md
  templates/      delivery/ and knowledge/ READMEs, repo.md skeleton
.claude-plugin/marketplace.json
```

`zod` and `yaml` are bundled into `bin/omni.mjs` (esbuild, a dev dependency), so a target repository
needs Node and `gh`, never an install. CI in the target runs `node .omni-loop/bin/omni.mjs`.

## 12. The game

`game/` stops assuming `docs/inbox/` and `docs/outbox/<prd>/`: its GitHub source reads each
repository's `.omni-loop/config.yml` for the delivery path, and its states map one to one onto §5.
Nothing else changes: the game still only reads.

## 13. Phases

| # | What | Done when |
|---|---|---|
| 0 | This spec, reviewed | approved |
| 1 | `kit/lib` + `kit/bin`: ported from ai-domain `origin/main`, config injected; delivery + ship module | fixture tests green for three profiles: ai-domain-like (knowledge), workflow-like (CLAUDE.md invariants), bare (none) |
| 2 | `kit/ci/omni-outbox.yml`: status, both comments, Slack, drift stays red | shape test; a run on a scratch GitHub repo |
| 3 | The plugin and its seven skills | on a scratch repo: brainstorm → phase-0 → yolo → red gate → reply → yolo-fix → green → shipped |
| 4 | `omni-loop init / doctor / upgrade / remove` | `init` then `remove` leaves `git status` clean; `doctor` catches each broken install in a fixture list |
| 5 | Pilot: terraform `vertuo-workflow`, retiring its hand port; the game reads it | one real PRD shipped through `/omni-yolo` |
| 6 | Later | the sweep (a closed PRD still in inbox, an open one in shipped), reply intake on `issue_comment` without an agent, `/omni-deliver` (asking policy), the planner, other repositories |

## 14. Out of scope

- Migrating an existing repository's `docs/inbox`, `docs/outbox`, `docs/superpowers` history into
  `.omni-loop/delivery/` — the pilot starts empty and a migration is its own piece of work.
- Changing `vertuo-ai-domain`.
- The game's visual layer.

## 15. Dogfooding

This repository is terraformed by hand, before the kit exists, so its own delivery sits where the kit
will put everyone's: `.omni-loop/config.yml` holds this repository's config, and this PRD's spec, plan
and before/after page live in `.omni-loop/delivery/shipped/0003-omni-loop-kit/`. Its slices are sub-PRs
into `feat/omni-loop-kit`; a decision an agent takes while building is an outbox item in
`.omni-loop/delivery/shipped/0003-omni-loop-kit/outbox/`. Once phase 1 lands, `node kit/bin/omni.mjs check all`
must pass on this repository itself. The game's documents under `docs/superpowers/` predate the layout
and stay where they are until a PRD moves them.
