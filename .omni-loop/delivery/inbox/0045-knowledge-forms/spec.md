---
prd: 45
title: Knowledge forms — the playbook in .omni-loop/knowledge, filled by /omni:terraform
blocked-by: none
spec: file
---

# Knowledge forms — the playbook, and /omni:terraform

**Date:** 2026-09-25 · **PRD:** #45 · **Follows:** #3 (the kit, §6 knowledge), #7 (the `omni` plugin),
#39 (`omni init`, the one-line install) ·
**Retires:** `.omni-loop/repo.md` (PRD 3 §3), read today by `/omni:do-work` step 1.5 ·
**Modelled on:** `vertuoza/vertuo-ai-domain@db67fd9da` — `docs/knowledge/`, `docs/agents/`, `docs/adr/`

## Problem

vertuo-ai-domain writes down two kinds of knowledge. `docs/knowledge/` says what is true about the
product: principles, business rules and invariants. PRD 3 ported that half into the kit as
`.omni-loop/knowledge/`, with its parser (`kit/lib/knowledge/registers.mjs`) and its check. The other half,
`docs/agents/`, says how to work in the repository: how to test (`testing.md`), how CI works and which
reds are known (`ci-triage.md`), what must be green before a pull request (`verification.md`), what a pull
request looks like (`pull-request.md`), what a merge publishes (`releasing.md`), and the rules that cost the
most when broken (`briefing.md`). The kit has no counterpart for it.

What the kit has instead:

- `.omni-loop/repo.md`, one optional free-text file that `/omni:do-work` reads "when it exists". It
  exists in no repository, this one included.
- `paths.context`, default `[CLAUDE.md]`. This repository has no `CLAUDE.md`, so the list names a
  missing file.
- `commands.*`: one string per command.
- `paths.adr`, which can point at an ADR folder elsewhere, while `.omni-loop/knowledge/adr/` then carries
  no sign of it for a person who opens it.

So the skills run generic in every repository. `/omni:do-work` builds test-first without knowing where
tests live or what a test must never do. `/omni:pr` re-runs a red check without knowing which reds are
already known. Nothing grades any of this, and a stale "how to test" reads the same as a current one.

## Solution

**One knowledge root, two halves.** `.omni-loop/knowledge/` stays the front door. Its truth registers
(`product/`, `domains/`, `cross-domain/`, `adr/`) do not change. A second half, `playbook/`, holds one
**form** per question an agent asks while delivering. Anything that lives elsewhere in the repository gets
a pointer here, so a person or an agent always starts in the same place.

```text
.omni-loop/knowledge/            the front door: the parent of paths.playbook
  README.md                      the two halves and the override order (written by omni kb init)
  product/ domains/ cross-domain/   the truth registers, unchanged
  adr/
    README.md                    the decisions form: a pointer, or "records live here"
    NNNN-<slug>.md               records, when paths.adr is this folder
  playbook/                      paths.playbook — one form per question
    briefing.md  setup.md  architecture.md  testing.md  verification.md  ci.md  pull-requests.md
    definition-of-done.md  conventions.md  releasing.md  bug-fixing.md  glossary.md
```

### A form

A Markdown file with front matter the kit parses, an opener, and sections that are **slots**:

```markdown
---
form: testing
form-version: 1
state: filled                   # blank | filled | pointer
points-to: null                 # a repository path when state is pointer
evidence:                       # the files it was filled from: <path>@<first 7 hex of git hash-object>
  - package.json@50fa1bd
  - vitest.config.mjs@1ed9907
terraformed: 2026-09-25         # or null
---

# Testing

Use this page when adding, changing, or choosing tests.

## Commands
<!-- slot: commands · required · by: terraform · verified: 2026-09-25 -->
| What | Command |
|---|---|
| everything | `pnpm test` (runs `vitest run`) |

## Choosing the level
<!-- slot: levels · optional -->

## Test data
<!-- slot: data · optional -->
TODO(human): is there a naming rule for fixture repositories?
```

- **Front matter:** exactly `form`, `form-version`, `state`, `points-to`, `evidence`, `terraformed`, and,
  on a pointer form only, an optional `index` (the page to read first inside a pointed folder).
- **The opener:** the line under the title, "Use this page when …", as on every `docs/agents/` page.
- **A slot** is a `## <heading>` followed by its marker comment:
  `<!-- slot: <id> · required|optional[ · by: terraform|human][ · verified: YYYY-MM-DD] -->`. The kit's
  template for the form defines its slot ids, headings and order. A form may not invent a slot.
- **A section's body** is repository text; or a `See: <path>[#anchor]` line (a **section pointer**); or
  empty; or it holds `TODO(human): <question>` lines (a **hole**).

### The thirteen forms

Required slots are in bold. The front door is the parent of `paths.playbook`.

| Form | File, under the front door | Kind | Slots | Modelled on (vertuo-ai-domain) |
|---|---|---|---|---|
| briefing | `playbook/briefing.md` | core | **never**, hooks, next | `docs/agents/briefing.md` |
| setup | `playbook/setup.md` | core | **prerequisites**, **install**, run, env | `README.md` › local setup |
| architecture | `playbook/architecture.md` | core | **layout**, **boundaries**, patterns | `AGENTS.md` › Boundaries, `libs/LIBRARY_STYLE_RULES.md` |
| testing | `playbook/testing.md` | core | **commands**, **layout**, levels, **never**, data | `docs/agents/testing.md` |
| verification | `playbook/verification.md` | core | **preflight**, before-push, checks | `docs/agents/verification.md` |
| ci | `playbook/ci.md` | core | **workflows**, **gating**, known-reds, rerun | `docs/agents/ci-triage.md` |
| pull-requests | `playbook/pull-requests.md` | core | **body**, title, labels, reviewers | `docs/agents/pull-request.md` |
| decisions | `adr/README.md` | core | **where**, **format**, numbering | `docs/adr/index.md` |
| definition-of-done | `playbook/definition-of-done.md` | extended | **done**, docs, commits | `docs/agents/definition-of-done.md` |
| conventions | `playbook/conventions.md` | extended | naming, formatting, commits | the briefing, DoD › Commit shape, ADR 0058 |
| releasing | `playbook/releasing.md` | extended | **publishes**, how, rollback | `docs/agents/releasing.md` |
| bug-fixing | `playbook/bug-fixing.md` | extended | **steps**, guard | `docs/agents/bug-fixing.md` |
| glossary | `playbook/glossary.md` | extended, pointer only | **where** | `CONTEXT.md`, `docs/glossary.md` |

A **core** form is one a terraformed repository has filled or pointed; `omni check kb` warns on a blank
required slot of a core form. An **extended** form's blank slots are silent: the kit default applies.

### How a section is resolved

The skills never read a form's file. They call `omni kb show <form>`, which merges three layers per
slot, top wins, and labels where each section came from:

| The repository section is… | `omni kb show` prints… | Label |
|---|---|---|
| filled | the repository text | `[repo]`, `[repo · by human]`, `[repo · verified <date>]` |
| a `See: <path>` line | the page it names | `[→ <path>]` |
| empty | the kit default for that slot | `[kit default]` |
| holding `TODO(human)` lines | the kit default, then each open question | `[hole]` |
| in a form with `state: pointer` | the whole target: a file's text; a folder's `index`, else its Markdown file list | `[→ <path>]` |
| in a form file that is missing | the kit default for every slot | `[kit default]` |

**Kit defaults** live in the kit, in one template per form (`kit/templates/playbook/<form>.md`), and
travel inside the bundled `omni.mjs`: a terraformed repository needs no other file. A default is doctrine
every repository shares, ported from vertuo-ai-domain with every repository literal removed. It may name
a config value as `{config:<key>}` (for example `{config:commands.test}`), which `omni kb show` fills from
the repository's config. `omni kb init` never copies default text into a repository, so a kit upgrade
upgrades every section a repository left blank.

**The decisions form** is the one `/omni:do-work`'s `bearsOn: ADR-nnnn` and `/omni:yolo-fix`'s write-back
lean on. When `paths.adr` is the front door's `adr/`, the records live beside it and the form says so.
Otherwise it is a pointer (`points-to: <paths.adr>`). Either way `omni kb show decisions` reads the
folder live: every record's number and title (the file's first `#` heading), each number used by more
than one record flagged, and the next free number. Nobody keeps that list by hand.

### The commands

- **`omni kb init`** writes every missing form from its template: the front matter with `state: blank`,
  the title, the opener, every slot heading and marker, empty bodies. The decisions form is written as a
  pointer when `paths.adr` is outside the front door's `adr/`; the glossary form as a pointer when
  `paths.glossary` is set. It also writes the front door's `README.md` when it is missing, pointing at
  `paths.knowledge` when the registers live elsewhere. When the front door is `paths.knowledge` and its
  `product/` register files are missing, it writes them empty ("None yet."), because `omni check
  knowledge` grades any knowledge folder that exists and requires those three files. It never changes a
  file that exists. It prints what it wrote.
- **`omni init`** (PRD 39) lays down the forms too. After it writes or keeps the config and the bin, it
  runs the same writer as `omni kb init`, lists the files it wrote among the files it reports, and its
  closing steps gain one: fill the forms with `/omni:terraform`. Everything it writes stays under
  `.omni-loop/`, as PRD 39 requires. Because the forms now create `.omni-loop/knowledge/` in every
  installed repository, `omni init` no longer reads `laws.source: knowledge` from that folder's
  existence: it reads it from registers that hold at least one principle, rule or invariant entry.
- **`omni kb show <form> [--json]`** prints the resolved form, as above.
- **`omni kb status [--json]`** prints the map, derived every time: each form, its state, its open
  questions, its stale evidence and its source (repository, pointer or kit default).
- **`omni check kb`**, also run by `omni check all`:
  - **fails**, naming the file, on: a `points-to`, `index`, `See:` or `evidence` path that does not exist;
    a slot id the form's template does not define; a required slot whose marker is missing; a
    `form-version` newer than the kit's; front matter that does not parse or holds another key.
  - **warns**, exit `0`, on: each `TODO(human)`; a blank required slot of a core form; an `evidence`
    file whose `git hash-object` no longer starts with the recorded hex; a missing form file.

### `/omni:terraform`

A user-facing skill that fills the forms from what the repository can prove, and ends with a docs-only
pull request a person merges.

1. **Step 0:** `omni config`. When it fails, stop: the repository is not installed, and the kit's
   one-line `omni init` (PRD 39) comes first. Then `omni kb init`, for a repository installed before this
   PRD.
2. **Survey, read-only:** package scripts and lockfile, engines, test runner config and test file globs,
   workflows and their triggers, jobs and checks, the pull request template, CODEOWNERS, labels, git
   hooks, the README, `CLAUDE.md` or `AGENTS.md` when present, and every Markdown page in the tree.
   Candidate pages are found by name anywhere in the tree (a folder named `adr`, `adrs` or `decisions`;
   a page whose title answers a form's question), never by a fixed path.
3. **Point before writing.** A page that already answers a form's question makes the form a pointer
   (`state: pointer`), or a section a `See:` line when it answers only part of it.
4. **Fill from evidence.** Every filled section's files are listed under `evidence:`. Every command is run
   once, green, before it is written, and its slot carries `verified: <date>`.
5. **Leave holes.** What it cannot show becomes `TODO(human): <question>`, never a guess.
6. **Propose config** as a diff. `omni init` already detected `commands.*`: terraform runs each one and
   proposes a change only for a command that is `null` or does not run green. It also proposes
   `paths.adr`, `paths.glossary`, `paths.context` and `ci.aggregateCheck`.
7. **Open one docs-only pull request** on `branches.terraform` into `repo.defaultBranch`, through
   `/omni:pr`'s standalone kind. Its body lists every hole as a checkbox.

`/omni:terraform --refresh` redoes only the forms `omni kb status` reports stale or blank, and never
rewrites a `by: human` section.

### What each skill reads

| Skill · step | Today | With the forms (`omni kb show …`) |
|---|---|---|
| every skill · step 0 | `omni config` | + `briefing`, printed first |
| `/omni:brainstorm` · spec and acceptance | `acceptance.*` | + `testing`, `releasing` (what a merge publishes, for the Risks section) |
| `/omni:plan` · territories | the spec, `paths.context` | + `architecture` |
| `/omni:do-work` · read before building | `paths.context`, the registers, `.omni-loop/repo.md` | + `architecture`, `conventions`, `setup`; `repo.md` is no longer read |
| `/omni:do-work` · build test-first | "write the failing test" | + `testing` |
| `/omni:do-work` · ship; `/omni:pr` · open | `commands.preflight` | + `verification`, `pull-requests`, `definition-of-done` |
| `/omni:pr` · watch to green; `/omni:wave` · a red slice | re-run once, three attempts | + `ci`: which checks exist and gate, the known reds, when a re-run is allowed |
| `/omni:yolo` · start | the board | + `omni kb status`: the open questions, printed once; delivery carries on with kit defaults |
| `/omni:yolo-fix` · write-back | truth → a knowledge entry; how we build → an ADR under `paths.adr` | + the ADR follows `decisions`; a process lesson → a playbook section, `by: human`, recorded as `Became: playbook/<form>#<slot>` |

## Decisions

Decided 2026-09-25 by the PRD author, approving the brainstorm page and its six recommendations.

1. **One front door.** The playbook sits under `.omni-loop/knowledge/`, beside the registers, through a
   new `paths.playbook` key (default `.omni-loop/knowledge/playbook`). Its parent is the front door, which
   holds `README.md` and `adr/README.md`.
2. **Overrides are per slot, top wins:** pointer, then repository section, then kit default.
3. **Kit defaults stay in the kit,** bundled into `omni.mjs`, never copied into a repository.
4. **Pointers, not copies,** at two levels: a whole form (`state: pointer`) and a section (`See:`).
5. **Derived, never kept by hand:** the ADR list, the next free number and the form map are read live.
   There is no generated map file.
6. **Evidence or nothing.** A filled section names its files; a command is written only after it ran
   green. A wrong claim is worse than an honest hole (the `Enforced by: unenforced` rule).
7. **A hole never blocks delivery.** `omni check kb` warns; `/omni:yolo` prints the holes once and carries
   on with the kit defaults.
8. **Pages read by the one plugin,** not a generated skill per repository: per-repository skill copies are
   the drift PRD 3 was written to end.
9. **Terraform ends with a pull request** a person merges, on a new `branches.terraform` key (default
   `docs/omni-terraform`). No bot writes to `main`, and terraform never rewrites a `by: human` section.
10. **A process lesson from a settled outbox answer** lands in a playbook section, `by: human`, and the
    settled entry records `Became: playbook/<form>#<slot>`, which `omni check outbox` resolves like any
    other `Became:` id.
11. **`adr/README.md` states no law.** Decision coverage already means to skip a folder's `README.md`; its
    pattern is corrected to do so.
12. **Orientation pages are later.** A form points at them when they exist.

Added on 2026-09-25, after PRD 39 (`omni init`) merged, without asking the PRD author. Each is a medium
outbox item, adopted: the feature pull request's outbox comment lists it under "Adopted unless you
object", where a person can object. Decision 13 is `s4-01-init-lays-down-the-forms`, decision 14 is
`s4-02-laws-source-from-register-entries`.

13. **The one-line install lays down the forms.** `omni init` runs the forms writer after the config and
    the bin, and its closing steps name `/omni:terraform`. Installing and filling are then two steps: one
    command, one skill.
14. **An installed repository's knowledge folder no longer means it has laws.** `omni init` reads
    `laws.source: knowledge` from registers that hold at least one entry, not from the folder existing,
    which every install now creates.

## User stories

- As an **agent running `/omni:do-work`** in any terraformed repository, I read how this repository tests
  before I write the first test.
- As **`/omni:pr` watching CI**, I know which reds are known and what rules my branch out before I re-run
  anything.
- As a **team adopting the loop**, I run `/omni:terraform` and get one pull request that fills what the
  repository can prove and asks me only what it cannot.
- As a **repository that already documents all this**, such as vertuo-ai-domain, I get pointers, not
  copies, so each page keeps one source.
- As a **person opening `.omni-loop/knowledge/`**, I find where the ADRs are, even when they live
  elsewhere.
- As a **kit maintainer**, I improve a kit default once, and every repository that left that section blank
  gets it on upgrade.

## Scope

**In:** `paths.playbook` and `branches.terraform` in the config schema; the form parser and resolver
(`kit/lib/playbook/`); the thirteen kit templates and the front door README template (`kit/templates/`),
bundled; `omni kb init | show | status` and `omni check kb` inside `check all`; `omni init` laying down
the forms, naming `/omni:terraform` in its closing steps, and reading `laws.source` from the registers'
entries; the `/omni:terraform` skill; the seven existing skills reading their forms, and
`.omni-loop/repo.md` retired; `Became:` resolving a playbook section; the decision-coverage README fix; this
repository installed with `omni init` and terraformed, with a session-start hook printing its briefing.

**Out:** `omni init`'s other duties, and `doctor`, `upgrade`, `remove` (PRD 3 §10); a session-start hook
in any other repository, because `omni init` writes nothing outside `.omni-loop/` (PRD 39, decision 7) and
the skills' step 0 prints the briefing instead; orientation pages; `/omni:fix-bug`; generated
per-repository skills; terraforming vertuo-ai-domain or any other repository (each is its own
`/omni:terraform` run once this ships).

**Human steps** (never taken by the work):

1. Run `omni init` once in this repository, from a checkout (`node kit/dist/omni.mjs init`), before
   `/omni:yolo 45`. It keeps the config and the shim and creates the loop labels this repository still
   lacks (PRD 39, acceptance criterion 12, not run yet), so the sub-PRs get their labels. s7 runs it again
   and expects to create nothing.
2. Answer the open questions this repository's own terraform leaves (s7), listed on the feature pull
   request.

## Test seams

All in the root vitest suite (`pnpm test`):

- **The parser and resolver:** fixture forms for each row of the resolution table; a template-order
  test; `{config:<key>}` filled from a fixture config.
- **The templates:** each parses with the parser and declares exactly the slots in the forms table;
  `kit/test/no-literals.test.mjs` scans `kit/templates/`.
- **The bundle:** the committed `kit/dist/omni.mjs`, which `kit/test/dist.test.mjs` (PRD 39) keeps equal
  to a fresh build, copied alone into a fixture repository to run `kb show`. Every change to bundled code
  lands with its rebuilt bundle.
- **The commands:** through `main()` on fixture repositories (`kit/test/fixture.mjs`), with a fake `exec`
  where git is involved; `check all` in `kit/test/profiles.test.mjs` for the three profiles.
- **`omni init`:** PRD 39's fixture repositories in `kit/bin/init.test.mjs`, now also asserting the forms,
  the closing step and `laws.source`.
- **The outbox:** `check-outbox` and `decision-coverage` tests for a playbook `Became:` and an ADR folder
  README.
- **The skills:** `kit/test/plugin.test.mjs` (frontmatter, every `omni <command>` named exists).

## Risks

- **Forms go stale.** Evidence hashes turn a changed source into a warning; they never fail a build.
- **Terraform guesses.** Every claim carries its evidence, every command ran green, and a hole is written
  where proof is missing; the reviewer of the terraform pull request sees all three.
- **Too much text in a skill's context.** A step reads only the forms the wiring table names, and a form
  holds only what differs from the kit default.
- **`check all` turns a repository red.** Only a broken pointer, an unknown slot or bad front matter fails;
  a repository with no forms gets warnings.
- **Kit defaults drift from vertuo-ai-domain.** Each template carries a provenance line pinned to
  `db67fd9da`, and its porting record lists what changed.
- **The committed bundle is shared ground.** Every slice that changes bundled code rebuilds and commits
  `kit/dist/omni.mjs`, so no two such slices can share a wave; the plan orders them.
- **`omni init` changes behaviour PRD 39 shipped:** it writes more files, and reads `laws.source`
  differently. Both stay under `.omni-loop/`, a second run still changes nothing, and PRD 39's own
  acceptance tests keep passing, amended only where `laws.source` is asserted on a knowledge folder.

## Acceptance criteria

1. `omni kb init` in a fixture repository with no forms writes the twelve playbook forms, `adr/README.md`
   and the front door `README.md`: each form's state is `blank`, except decisions (a pointer when
   `paths.adr` is outside the front door's `adr/`) and glossary (a pointer when `paths.glossary` is set).
   In a repository with no knowledge folder it also writes the three empty `product/` register files, and
   `omni check knowledge` stays green. A second run writes nothing, and no existing file is ever changed.
2. `omni kb show testing`, on a fixture whose `commands` is filled, `levels` empty, `never` a `See:` line to
   an existing file and `data` a hole, prints the sections in template order labelled `[repo]`,
   `[kit default]`, `[→ <path>]` and `[hole]`; a kit default naming `{config:commands.test}` prints the
   fixture's command.
3. A form with `state: pointer` shows its target. `omni kb show decisions` on a fixture folder where two
   records share a number lists every record with its title, flags the shared number and prints the next
   free number.
4. `omni check kb` fails, naming the file, on each failure its section lists, and exits `0` with a warning
   line for each warning it lists.
5. `omni check all` runs the `kb` guard and stays green on a repository with no forms.
6. The bundled `kit/dist/omni.mjs`, alone in a fixture repository, prints the kit defaults.
7. `kit/test/no-literals.test.mjs` scans `kit/templates/` and passes.
8. `/omni:terraform` is in the plugin, names only commands the CLI has, and states each of its seven
   steps, its `--refresh` rule and the `by: human` rule.
9. Each of the seven existing skills calls `omni kb show` for the forms the wiring table gives it, at that
   step; `/omni:yolo` prints the open questions once; `/omni:do-work` no longer reads `.omni-loop/repo.md`.
10. A settled entry's `Became: playbook/<form>#<slot>` passes `omni check outbox` when that slot exists and
    is not blank, and fails it otherwise; a change to `adr/README.md` is not counted as law text.
11. `omni init` in a fixture repository with no `.omni-loop/` writes the config, the bin and the forms of
    criterion 1; `laws.source` is `none`; `git status --porcelain` lists only paths under `.omni-loop/`;
    the closing steps name `/omni:terraform`; a second run writes nothing. `omni init --force` in a
    repository whose knowledge folder holds only forms and empty registers keeps `laws.source: none`, and
    one whose registers hold an entry gets `knowledge`.
12. This repository is installed and terraformed: `omni init` run here keeps the config and the shim,
    creates no label a person already created, and writes the forms; `omni check kb` reports no errors;
    the forms match the "two repositories" column of the before/after page, or the sub-PR says why they
    differ; every open question is a checkbox on the feature pull request; `paths.context` names no
    missing file; a session start prints the briefing.
