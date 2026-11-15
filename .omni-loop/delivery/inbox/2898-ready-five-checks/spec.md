---
prd: 2898
title: A mission's pull request is ready only when five checks prove it
blocked-by: none
spec: file
phase0: server
---

## Problem

In a mission, the Reviewer's pass marks a feature PR ready (PRD 2871). Nothing proves what that
"ready" stands on. CI may still be running on the latest commit, or may have run only the tests of
the changed files. Nothing ties a spec's acceptance criteria to the tests that prove them, because
they are plain bullets. Nothing sees a test that was deleted, skipped or weakened to go green. And a
file outside every slice's territory is only reported by the wave, never refused. A reviewer has to
ask an engineer, or read the whole diff, to trust a ready PR.

Concept #2800, area `ready-five-checks`, crowned this: "PR 2817 ready for review · 5 of 5 checks:
CI green on the latest commit, full tests and lint ran, every success criterion has its proof, no
test was loosened, the change stayed in its area. Not merged: only a person merges."

## Solution

**Five checks, one rule.** A pure validator in the kit (facts in, verdict out, no network, no
model) decides whether a feature PR may be marked ready. It passes only when all five checks pass
on the PR's latest commit:

1. **CI green on the latest commit:** every check run of that commit finished `success`. A check
   that only skipped or was cancelled is not green. `omni / ready` itself is left out.
2. **The full tests and lint ran:** the CI jobs `ready.full` names (here `test` and `lint`, never
   `quick`, which runs only the changed files) succeeded on that commit.
3. **Every acceptance criterion has its proof:** each `AC-n` of the spec has a passing proof on that
   commit, as **Acceptance criteria as scenarios** says.
4. **No test was loosened:** the diff against the default branch holds none of these, unless an
   outbox item a person answered names the path:
   - a test file deleted, a test or a `describe` removed, or `.skip`, `.todo`, `.only`, `xit` or
     `xdescribe` added;
   - weaker assertions in a changed test: fewer `expect(` calls than before, an assertion removed,
     or one turned weaker (`toEqual` to `toBeDefined` or `toBeTruthy`, `toThrow(<message>)` to
     `toThrow()`, `toHaveBeenCalledWith` to `toHaveBeenCalled`), or a snapshot file rewritten;
   - a suppression or a floor: an `eslint-disable`, `@ts-ignore` or `@ts-expect-error` added, a
     mutation floor in `mutation/floor.json` lowered, a test timeout or retry raised, a baseline
     grown (`fallow/`, `layering/`);
   - a changed AC test: a test titled `AC-n: …` whose title or steps changed while the spec's
     `AC-n` did not.
5. **The change stayed in its area:** every file of the diff sits under a slice's territory in the
   plan, the PRD's folder, its outbox or a generated entry's path, unless an outbox item names the
   path and was answered by a person or adopted.

**What excuses a finding, and nothing else.** An outbox item excuses a finding of check 4 or 5
only through two recorded fields, never through its words: its `excuses:` field, a list of exact
paths the agent writes when it raises the item (`omni item new` takes them, and refuses a folder or
a pattern), and its settled entry's verdict, `agreed` (the person picked A, what was built) or, for
check 5 only, `adopted`. A `drifted` verdict, a prose answer, an item with no `excuses:` field for
that path, or one still open excuses nothing. The checks only read the ledger, as it is written:
they never read meaning into an answer and never reword one, and an answer that does not plainly say
yes leaves the finding in place, for a person to answer again.

**The App's status records.** The `acceptance` check run, the `omni / ready` check and the rows of
`public.ready_verdicts` are the App's status records, in its own name, like an agent's status
comment: BL-ASK-1 counts those as no person's answer. They are kept apart from the ledger, never
shown as a person's words, and never read as an excuse.

A check reads `pass`, `fail`, `not finished` (its evidence is not there yet: a run still going,
the preview not up; never shown green) or `not judged · <why>` (its evidence could not be read).
Only `pass` passes: `not finished` and `not judged` never do. The verdict is ready only when all five
checks read `pass`; one check `not finished` or `not judged` makes the whole verdict not ready, shown as
not finished, and the pull request stays a draft.

**Who it gates.** A setting decides: `ready.checks` is `mission` here (only the feature PR of a PRD
that belongs to a running or paused mission, as the Omni page records it), and may later read `all`
(every feature PR) or `off` (none, the kit's default). Widening it changes no code. In a mission,
only `/omni:review`'s pass marks a feature PR ready, so the gate is one line there: run
`omni ready <prd>` before `gh pr ready`, and on a red verdict leave the PR a draft and end
`changes`, the failing check named as the finding. Under `all`, the same line runs in `/omni:yolo`
and `/omni:yolo-fix` before their `gh pr ready`.

**The evidence starts on the draft.** Today the full checks (`test`, `lint`) and the Vercel
preview run only once a pull request into the default branch is ready, never on a draft, so a
draft could never pass checks 2 and 3. Before it runs `omni ready`, the gated skill adds the label
`omni:ready-check` to the draft: that label starts, on the draft's latest commit, the full checks,
the e2e job and the preview. A later push to a labelled draft runs them again. Only gated PRs pay
for it, and ready still comes last. While those runs are going, checks 1 to 3 read `not finished`.

**Two places, one verdict.** `omni ready <prd>` runs the rule on facts it reads itself, through `gh`
(the head commit's runs, the acceptance report, the diff, the plan and the ledger at the head). The
Omni App runs the same rule on every new commit of a gated PR and posts the check `omni / ready`,
each check linking its evidence, and saves the verdict for the PRD page. When the App cannot be
reached, `omni ready` still decides alone: the gate never waits on the App.

**Acceptance criteria as scenarios.** A spec's acceptance criteria may be numbered scenarios, in
Gherkin, each with its kind:

````markdown
### AC-2 · e2e

```gherkin
Scenario: A loosened test keeps the pull request a draft
  Given a mission's pull request whose diff skips a test
  When the Reviewer passes it
  Then it stays a draft and its check names the skipped test
```
````

- `test`: proven by a vitest test titled `AC-n: …`, its body in the same Given, When, Then order,
  that passed on the latest commit.
- `e2e`: proven by the scenario run with e2e against the PR's preview: `/omni:validate-e2e` turns
  it into one test titled `AC-n: …` and tagged `prd-<n>`, each Given and When an `agent.act`, each
  Then an `agent.assert`, the scenario's lines kept verbatim.
- The kind is written on each criterion; `acceptance.kind` names the default a new spec takes.

`omni check inbox` refuses a spec whose criteria use `AC-` headings with a missing number, a number
twice, a missing kind, a kind other than `test` or `e2e`, or a scenario without a Given, a When and
a Then. A spec with plain bullets still reads; its PRD simply fails check 3 when it is gated.

**Where the proof comes from.** CI writes the check run `acceptance` on the head commit: the AC
results from the test job's report, and the e2e results from a job that waits for the PR's Vercel
preview and runs the `e2e` scenarios there, its HTML report (steps, screenshots, video) kept as the
run's artifact. When e2e does not run in CI here (`e2e.ci` false, or no key configured), a runner of
the workspace runs the scenarios against the preview and the App writes the same `acceptance` check
run. With no runner either, check 3 reads `not finished` and names why: `no runner has run the e2e
scenarios yet`, and the verdict stays not ready, the pull request a draft.

**Where the e2e tests live.** `e2e.repo` names the repository that holds them: unset for this
repository (omni-loop keeps them in `e2e.dir`), or `<owner>/<name>` for a product whose e2e tests
live elsewhere; a plan repository reads its own config the same way.

**On the PRD page.** A Ready panel (the library screen `ready-checks`, a draft) shows the latest
verdict: `Ready for review · 5 of 5` or `4 of 5`, each check one tap from its evidence, each AC with
its three lines, its kind, its proof and its state, then `Ready for review, not merged. Only a person
merges.` and the action **Review PR <n>**. A failing check is named at the top. The word "merged"
never appears as a state.

## Conventions

| repo | layer | name | source |
| --- | --- | --- | --- |
| vertuo-omni-loop | cli | `omni ready <prd>`, `kit/lib/ready/` | no written convention: follows `omni hold` (`kit/bin/commands/hold.ts`), a verdict a skill reads before `gh pr ready` |
| vertuo-omni-loop | config | `ready.checks`, `ready.full`, `acceptance.kind`, `e2e.ci`, `e2e.repo` | no written convention: follows the `e2e` and `acceptance` blocks of `kit/lib/config.ts` |
| vertuo-omni-loop | ci | the check `omni / ready`, the check run `acceptance` | `omni / budgets` ← `apps/omni-app/src/budgets-check/budgets-check.ts:1` |
| vertuo-omni-loop | db | `public.ready_verdicts` | plural snake case ← `supabase/migrations/20270122093000_missions.sql:184` (`public.mission_events`) |
| vertuo-omni-loop | spec | `### AC-<n> · <kind>` with a `gherkin` block | no written convention: follows the Gherkin scenarios `/omni:brainstorm` step 4 already copies into a spec |

## Decisions

- **Missions first** (asked): `ready.checks: mission` here, `off` by default in the kit, `all`
  later with no new code.
- **Numbered criteria and a test tag** (asked), **written as Gherkin scenarios** (asked), each with
  its kind per criterion and a repository default (asked).
- **One PRD with e2e** (asked): the e2e run in CI is built here, not in a later PRD of roadmap
  #1280.
- **e2e runs in CI on the PR's preview, falling back to a runner** (asked).
- **A label starts the full CI on a gated draft** (asked): `omni:ready-check`, added before
  `omni ready`; not every mission draft on every push, and never ready first then back to draft.
- **e2e keeps OpenRouter** (asked): its model is reached through OpenRouter, as `e2e.model` says
  today, so OpenRouter is named under L-GDPR-5 with its agreement before this ships.
- **Loosening** covers all four kinds (asked): deleted or skipped tests, weaker assertions,
  suppressions and floors, changed AC tests. Only an item a person answered excuses one.
- **Outside its area fails unless accounted** (asked): an item answered by a person, or an adopted
  medium item, that names the path excuses it.
- **Approach A** (asked): one validator in the kit, also run by the App as `omni / ready`; not the
  App alone (no gate while it is unreachable) and not the kit alone (every proof from an agent's
  own machine).
- **The scenario lives in the spec, never in a second `.feature` file:** two copies would drift;
  `/omni:validate-e2e` reads the spec, as it already does.
- **The objection** (persona:Paul - Product Manager): "Five checks plus an e2e run on every mission
  PR: my small fixes now wait for a preview and an agent clicking through it before anyone can even
  look." Settled: `none` (the person approved the section without answering it). A PRD with no
  `e2e` criterion has no e2e evidence to wait for: check 3 reads its `test` criteria only, and the
  e2e job does not run for it. A PRD with one `e2e` criterion waits for its run: check 3 reads
  `not finished` until that scenario's result is there, and never `pass` before.
- **No proof video** (asked).

## User stories

1. As a reviewer, I open a ready mission PR and see five checks, each one tap from its proof, so I
   trust it without asking an engineer.
2. As a person who answers the outbox, a loosened test or a file outside the plan reaches me as a
   question, never as a green ready.
3. As a PRD's author, I write each acceptance criterion as a scenario, and its page shows which ones
   are proven on the latest commit.
4. As a workspace owner, I turn the gate on for missions only, and widen it later with one setting.

## Scope

In:

- the validator (`kit/lib/ready/`), its facts readers and `omni ready <prd> [--json]`;
- the `excuses:` field of an outbox item, written by `omni item new`;
- the settings `ready.checks`, `ready.full`, `acceptance.kind`, `e2e.ci`, `e2e.repo`, read and
  documented;
- the AC format in specs, its check in `omni check inbox`, and `/omni:brainstorm` writing it;
- the gate line in `/omni:review`'s pass (and in `/omni:yolo` and `/omni:yolo-fix`, off unless
  `ready.checks: all`);
- `/omni:validate-e2e` writing `AC-n` tests from the scenarios;
- the CI: the full checks, the e2e job and the preview on a draft labelled `omni:ready-check`, the
  test job's AC report, the `acceptance` check run;
- the runner fallback for the e2e scenarios;
- the App's `omni / ready` check and `public.ready_verdicts`;
- the PRD page's Ready panel;
- the guide's page on what ready proves.

Out: gating PRs outside missions (`ready.checks: all` is a later switch), `/omni:bug-fix` and
`/omni:visual-fix` PRs, rewriting the acceptance criteria of PRDs already written, the Operation
room linking to the panel, mobile e2e (PRD 1278).

## Test seams

- **The rule:** a pure table test of the validator, each check passing, failing, `not finished` and
  `not judged`, and each excuse (an answered item, an adopted medium item for check 5 only).
- **Loosening:** diff fixtures, one per kind and per weakening the solution lists, plus clean diffs
  that must pass (a test renamed, an assertion made stronger).
- **The AC format:** `omni check inbox` on fixture specs, each refusal named.
- **`omni ready`:** a fake `gh` returning the runs, the report, the diff, the plan and the ledger;
  no real GitHub.
- **The App check:** a fake GitHub, as `budgets-check` is tested; the verdict row on a local
  database.
- **The skills:** guard tests on `/omni:review`'s gate line and `/omni:validate-e2e`'s AC tests.
- **The database:** `supabase/checks/` proves members read `ready_verdicts` and only the service
  role writes.
- **e2e:** one real scenario of this PRD run with e2e against a local app, with its recording.
- **The page:** a render test of the Ready panel at 5 of 5 and 4 of 5; its words pass
  `omni design words`.

## Risks

Merging publishes a new check on mission PRs, full CI runs on labelled drafts, a migration (`public.ready_verdicts`), a CI job that
calls a model on a changed screen, and a stricter Reviewer pass. Roll back by setting
`ready.checks: off` (the gate and the check stop at once), then reverting the PR; the table is
dropped by a later migration once nothing reads it.

- A false `fail` holds a mission PR in draft: the verdict names the check and its evidence, and an
  outbox item answered by a person excuses a path.
- The e2e job spends model calls when a screen changes; replays spend none. Its key is a CI secret,
  never in a file or a log.
- The e2e CLI sends anonymous usage data by default: CI and the runner set
  `E2E_TELEMETRY_DISABLED=1`.

The Legal entries:

- L-AIACT-1 (an agent's content says so): the `omni / ready` check and the panel are signed as the
  App's, never a person's.
- L-GDPR-2 (credentials never in clear): the e2e model key and the preview's sign-in stay in
  secrets and environment variables, masked in every log and never in the report.
- L-GDPR-5 (each service named, with its agreement): the e2e run reaches its model through
  OpenRouter, which is not named yet. Before this ships, the entry's owner (@pierrederval) names
  OpenRouter beside Supabase, Vercel and Anthropic, with its data-processing agreement (a human
  action of this PRD). The e2e CLI's telemetry is turned off.
- L-GDPR-4 (logs capped): the e2e reports are CI artifacts, kept for the artifact retention period.

The locked laws, all kept:

- N-PRODUCT-15: only a person merges into the main branch. Ready is never merged, and the panel
  says so. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-63: an agent link reads only repositories in its own workspace. `omni ready` and the
  App read only the PR's own repository, and `e2e.repo` must be in the same workspace. Changing it
  needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-28, BR-PRODUCT-64, BR-PRODUCT-12, BR-PRODUCT-29, BR-PRODUCT-39, N-PRODUCT-16 and
  BR-PRODUCT-59 are listed for the files touched; this PRD changes none of them. Changing one needs
  @pierrederval or @dervalp to approve the pull request on GitHub.

The business laws, all kept:

- BL-GATE-1 (a check that does not decide says "not judged", with the reason, and a running one is
  shown as not finished, never as passed): each check's `not finished` and `not judged · <why>`
  states are never shown green and never pass, and one of them keeps the whole verdict not ready.
- BL-ASK-1 (a person's answer is never changed or reworded): an item excuses a finding only by
  two recorded fields, its `excuses:` paths and its verdict (`agreed`, or `adopted` for check 5);
  a person's words are never read to decide it. The checks never write to the ledger, and the App's
  check is signed as its own, never in a person's name.
- BL-APPROVALS-1 (an approval covers exactly the files read): untouched; the ready gate never
  stands in for the PRD's approval.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: Five passing checks let the Reviewer mark a mission's pull request ready
  Given a mission's feature PR whose latest commit has CI green, the full tests and lint run, every AC proven, no test loosened and every file in its area
  When the Reviewer passes it
  Then omni ready reads 5 of 5 and the pull request is marked ready
```

### AC-2 · test

```gherkin
Scenario: A loosened test keeps the pull request a draft
  Given a mission's feature PR whose diff adds .skip to a test and no answered item names it
  When the Reviewer passes it
  Then it stays a draft, the Reviewer ends changes, and the finding names the skipped test
```

### AC-3 · test

```gherkin
Scenario: Evidence still coming never passes
  Given a mission's feature PR whose test job is still running on its latest commit
  When omni ready reads it
  Then check 2 reads not finished and the verdict is not ready
```

### AC-4 · test

```gherkin
Scenario: An answered item excuses a file outside the plan
  Given a mission's feature PR that changes one file outside every territory, listed in the excuses field of an outbox item a person answered A
  When omni ready reads it
  Then check 5 passes and names the item
```

### AC-5 · test

```gherkin
Scenario: A criterion without its proof fails check 3
  Given a spec with AC-1 and AC-2 and a latest commit whose report proves only AC-1
  When omni ready reads it
  Then check 3 fails and names AC-2
```

### AC-6 · test

```gherkin
Scenario: A malformed criterion is refused
  Given a spec whose criteria hold AC-3 twice and an AC-4 with no Then
  When omni check inbox reads it
  Then it refuses the spec, naming AC-3 and AC-4
```

### AC-7 · test

```gherkin
Scenario: Outside a mission nothing changes
  Given ready.checks is mission and a feature PR whose PRD is in no mission
  When /omni:yolo marks it ready
  Then omni ready is not run and the pull request is marked ready as today
```

### AC-8 · test

```gherkin
Scenario: The App posts the same verdict
  Given a gated feature PR with a new commit
  When the App runs its check
  Then omni / ready shows the same five states omni ready prints, each with a link, and the verdict is saved for the PRD page
```

### AC-9 · e2e

```gherkin
Scenario: The PRD page shows what ready proves
  Given a member signed in on the PRD page of a mission PRD whose PR is ready
  When they open its Ready panel
  Then they see Ready for review · 5 of 5, each check with its proof link, each AC with its state, and the line Ready for review, not merged. Only a person merges.
```

### AC-10 · test

```gherkin
Scenario: e2e falls back to a runner
  Given e2e.ci is false and the PRD has an e2e criterion
  When its pull request gets a new commit
  Then a runner job runs the scenario against the preview and the App writes the acceptance check run
```

<!-- Judged again after the business-law judge fix (#2900). -->
