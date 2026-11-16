---
title: What ready proves
description: The five checks a mission's feature pull request must pass before it is marked ready, the AC format of a spec, the label that starts the full checks, the settings, and the runner fallback for e2e.
---

In a mission, a feature pull request is marked ready only when **five checks** prove it. A check
that is not proven leaves the pull request a draft, and the verdict names the check that holds it.
Nothing here merges: only a person merges.

## The five checks

1. **CI is green on the latest commit.** Every check run of that commit finished `success`. A skipped
   or neutral run is left out, since a pull request skips jobs on purpose; a run that failed, was
   cancelled, timed out or needs an action is red. If only skipped or neutral runs are there, the check
   is not finished. The `omni / ready` check itself is left out.
2. **The full tests and lint ran.** The CI jobs named by `ready.full` (here `test` and `lint`, never
   `quick`, which runs only the changed files) succeeded on that commit.
3. **Every acceptance criterion has its proof.** Each `AC-n` of the spec has a passing proof on that
   commit (see the AC format below).
4. **No test was loosened.** The diff against the default branch holds no deleted test file, no
   removed test or `describe`, no `.skip`, `.todo`, `.only`, `xit` or `xdescribe`, no weaker
   assertion, no added suppression (`eslint-disable`, `@ts-ignore`, `@ts-expect-error`), no lowered
   mutation floor, no raised timeout or retry, no grown baseline, and no changed `AC-n` test whose
   spec criterion did not change. An outbox item a person answered can excuse a named path, and only
   through its `excuses:` field.
5. **The change stayed in its area.** Every file of the diff sits under a slice's territory, the
   PRD's folder, its outbox, or a generated entry's path, unless an answered outbox item names it.

Each check reads one of four states: `pass`, `fail`, `not finished` (its evidence is not there yet,
such as a run still going or a preview not up) or `not judged · <why>` (its evidence could not be
read). Only `pass` passes. The verdict is **ready** only when all five read `pass`. The Ready panel on
the PRD page shows `Ready for review · 5 of 5`, or `4 of 5` with the failing check named at the top,
and each check links to its evidence.

## Who it applies to

A setting decides, `ready.checks`:

- `off` gates no pull request. It is the kit's default.
- `mission` gates the feature pull request of a PRD that belongs to a running or paused mission. This
  repository runs with `mission`.
- `all` gates every feature pull request. A later switch, which changes no code.

Under `mission`, `/omni:review`'s pass is the one that marks a feature pull request ready. It runs
`omni ready <prd>` before `gh pr ready`, and on a red verdict leaves the pull request a draft and
ends with `changes`, the failing check named as the finding.

## The label that starts the full checks

A draft runs no full checks by itself. Before `omni ready` runs, the gated skill adds the label
`omni:ready-check` to the draft. That label starts, on the draft's latest commit, the full checks, the
e2e job and the preview. A later push to a labelled draft runs them again. Ready still comes last: a
draft is never marked ready first and then turned back.

The label is made by a person, once per repository, as the other loop labels are not. The name can be
changed with `labels.readyCheck`; left out, the kit reads `omni:ready-check`. Until the label exists,
the gate cannot start those checks, and the checks read `not finished`.

## The AC format in a spec

A spec's acceptance criteria are numbered scenarios in Gherkin, each with its kind:

````markdown file=spec.md
### AC-2 · e2e

```gherkin
Scenario: A loosened test keeps the pull request a draft
  Given a mission's pull request whose diff skips a test
  When the Reviewer passes it
  Then it stays a draft and its check names the skipped test
```
````

- `test`: proven by a vitest test titled `AC-n: …`, with its body in the same Given, When, Then order,
  that passed on the latest commit.
- `e2e`: proven by the scenario run with e2e against the pull request's preview. `/omni:validate-e2e`
  turns each scenario into one test titled `AC-n: …`, tagged `prd-<n>`, with the scenario's lines kept
  verbatim (see [Validate with e2e](/docs/validate-e2e)).

The kind is written on each criterion. `acceptance.kind` names the default a new spec takes.
`omni check inbox` refuses a spec whose `AC-` headings have a missing or repeated number, a missing
kind, a kind other than `test` or `e2e`, or a scenario without a Given, a When and a Then. A spec with
plain bullets still reads, but its PRD fails check 3 when it is gated.

## The settings

In `.omni-loop/config.yml`:

```yaml file=.omni-loop/config.yml
ready:
  checks: mission        # off, mission or all
  full: [test, lint]     # the CI jobs that run the whole suite
acceptance:
  kind: test             # the default kind a new AC takes
e2e:
  ci: true               # run the e2e scenarios in CI, on the draft's preview
  repo: null             # owner/name, when the e2e tests live in another repository
labels:
  readyCheck: omni:ready-check   # optional: the label that starts the full checks
```

`e2e.ci` is `false` by default. With it off, or with no key configured, the e2e scenarios are run by a
runner of the workspace instead (below). `e2e.repo` is unset for this repository, where the tests live
in `e2e.dir`. A product whose e2e tests live elsewhere names `<owner>/<name>` there.

## Where the proof comes from

CI writes the check run `acceptance` on the head commit. The AC results come from the test job's
report. The e2e results come from a job that waits for the pull request's Vercel preview and runs the
`e2e` scenarios there, keeping its HTML report (steps, screenshots, video) as the run's artifact. For
CI to run them here, the repository needs the secrets `OPENROUTER_API_KEY` and
`VERCEL_AUTOMATION_BYPASS_SECRET`.

## The runner fallback

When `e2e.ci` is false, or no key is configured, and the PRD has an `e2e` criterion, a new commit
queues a runner job. The runner runs the scenarios against the preview, and the App writes the
`acceptance` check run from its result. Two things make it work:

- the preview's address. With `e2e.url: github-deployment` the runner asks GitHub for the preview of
  the commit, and the Omni App is not allowed to read deployments, so that lookup fails and says why.
  A fixed `e2e.url` runs as set instead.
- a runner. With no runner online, check 3 reads `not finished · no runner has run the e2e scenarios
  yet`, and the verdict stays not ready, the pull request a draft.

## Where the verdict lives

`omni ready <prd>` runs the rule on facts it reads itself, through `gh`: the head commit's runs, the
acceptance report, the diff, the plan and the ledger at the head. The Omni App runs the same rule on
each new commit of a gated pull request and posts the check `omni / ready`, each state linking its
evidence. When the App cannot be reached, `omni ready` still decides alone: the gate never waits on the
App.

The `acceptance` check run, the `omni / ready` check and the App's saved verdicts are the App's own
status records, not a person's words. They are never read as an answer that excuses a finding.

[Next → Use cases](/docs/use-cases)
