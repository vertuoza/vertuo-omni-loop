---
prd: 1717
title: Secret scanning and push protection, switched on and kept on
blocked-by: none
spec: file
phase0: server
---

# Secret scanning and push protection, switched on and kept on

**Date:** 2026-10-12 · **PRD:** #1717 · **Touches:** the test files that hold fake secrets,
`scripts/`, `.github/workflows/`, the briefing, the repository's settings · **Kind:** Bounded, no
product code

## Problem

`vertuoza/vertuo-omni-loop` is a **public** repository, and GitHub's secret scanning and push
protection are both **off** on it (read on 2026-10-12 from `gh api repos/vertuoza/vertuo-omni-loop`,
`security_and_analysis`: `secret_scanning`, `secret_scanning_push_protection`,
`secret_scanning_non_provider_patterns` and `secret_scanning_validity_checks` all `disabled`). The
organisation's defaults for new repositories are off too. Every push is public the moment it lands,
and about 70 pull requests merge here a day, most of them written by agents: a real token committed
by mistake would be readable by anyone before a person noticed, and nothing here would notice.

Both features are free on a public repository, and the person who brainstormed this is an admin of
it, so switching them on needs no one else. Two things make "switch them on" more than one click:

- **Fake secrets in the tests.** The masking tests and a few fixtures hold strings shaped like real
  credentials, written out whole: `ghp_…`, `ghs_…`, `github_pat_…`, `sk-ant-api03-…`,
  AWS's documented example key id, a PEM private key block (for example
  `apps/galaxy/src/jev/mask.test.ts`, `apps/omni-app/src/retro/narrate.test.ts`,
  `kit/lib/openrouter.test.ts`, `apps/omni-app/src/env.test.ts`). Once push protection is on, an
  agent that adds or moves one could have its push refused, and the briefing's Hooks rule forbids
  bypassing: the agent would stop.
- **Nothing keeps them on.** A setting switched off later, by a person or by an org-wide change,
  would go unseen, as the nightly mutation run's eight red nights went unseen.

## Solution

Five pieces, built in this order, so the settings are switched on only once nothing can be blocked
by them.

1. **Fake secrets built at runtime.** In every tracked file, a string shaped like a credential is
   assembled when the code runs (`'ghp_' + 'a'.repeat(36)`, a PEM header joined from its parts),
   never written out whole. The masking tests keep exactly the shapes they test today: each test
   still receives the same string value, so what they prove is unchanged.
2. **A guard: `scripts/secret-shapes-guard.test.ts`.** It reads every file `git ls-files` lists
   (minus the lockfile and the built bundles `kit/dist/` and `apps/omni-app/api/`, which are
   rebuilt from the sources the guard does read) and fails, naming the file, the line and the
   shape, when one holds a literal of a credential shape: GitHub tokens (`ghp_`, `gho_`, `ghu_`,
   `ghs_`, `ghr_`, `github_pat_`), Anthropic keys (`sk-ant-`), AWS access key ids (`AKIA` + 16),
   Supabase secret keys (`sb_secret_`), Slack tokens (`xox[abpr]-`), Stripe-style webhook secrets
   (`whsec_`) and PEM private key blocks. A prefix alone (a regular expression in `mask.ts`, a doc
   naming `ghp_`) is not a literal: the shape needs its body. It sits beside the repository's other
   guards (`env-guard`, `import-guard`, `layering-guard`).
3. **The settings script: `scripts/security-settings.ts`.**
   - `node scripts/security-settings.ts` reads, through `gh api`, the repository's
     `security_and_analysis` and its open secret scanning alerts. It prints one line per setting
     and per open alert, and exits 0 only when secret scanning and push protection are both
     `enabled` and no alert is open. Otherwise it exits 1, and each line names its fix: the
     `--apply` command for a setting, the alert's link for an alert.
   - `node scripts/security-settings.ts --apply` switches secret scanning and push protection on
     (one `PATCH` of `security_and_analysis`), then reads back as above. It needs an admin's `gh`.
   - The repository is `repo.slug` from `.omni-loop/config.yml`, unless `--repo <owner/name>` names
     another.
4. **A daily workflow: `.github/workflows/security.yml`.** Once a day, and on `workflow_dispatch`,
   it runs the script in read mode with `GH_TOKEN` set to the repository secret
   `SECURITY_READ_TOKEN`: a fine-grained token on this repository only, with **Administration:
   read** and **Secret scanning alerts: read**, nothing else (the workflow's own `GITHUB_TOKEN`
   cannot read either). It is off until that secret is set, as `business-recheck` is off until
   `GALAXY_URL` is. On red it opens one issue labelled `omni:security`, titled
   `Security settings: <what is wrong>`, whose body is the script's output, or, when that issue is
   already open, comments the new output on it; on green it closes the open one with a comment. It
   checks out the repository read-only and pushes nothing. Its header comment names the token's
   scopes and where to create it, as `game.yml` does.
5. **Switch on and triage, then one line in the briefing.**
   - Once 1 to 4 are merged into the feature branch, the last slice runs
     `node scripts/security-settings.ts --apply` with an admin's `gh`. GitHub
     then scans the whole history. Every alert it raises is triaged: a real credential is rotated
     at its provider first, then closed as `revoked`; a fake one is closed as `used_in_tests`. The
     list of alerts and how each was closed goes in the feature PR's report.
   - The briefing (`.omni-loop/knowledge/playbook/briefing.md`, `Never [repo]`) gains one line:
     *Never bypass push protection. A blocked push names a secret: rotate it if it is real, build
     it at runtime if it is a fixture.*

## Decisions

- **Scope: on, kept on, fixtures safe** (the person's answer to the scope question). Not chosen:
  switching the organisation's default for new public repositories (needs an org owner; a PRD of
  its own if wanted), and the paid non-provider patterns and validity checks.
- **Watched by a daily scheduled workflow, not a PR gate** (the person's answer). A missing or
  expired token turns one daily run red; it never blocks a merge.
- **A red run opens one issue.** The voice objected at the design (persona:B-E DEv): *"I don't want
  another scheduled run that goes red and that everyone learns to ignore, like the nightly mutation
  run that has been red for eight days. If this one goes red, it must say exactly what to run."*
  Settled `accepted`: every red line names its fix command or its alert's link, and a red run opens
  (or updates) one `omni:security` issue that the next green run closes.
- **Fixtures first, settings last.** Push protection is switched on only once the guard and the
  rebuilt fixtures are merged into the feature branch. Push protection reads only the commits a push
  adds, so the fakes still on `main` until the feature PR merges never refuse a push; a branch of
  someone else's that adds a new literal fake meanwhile would be refused, and the briefing line says
  what to do.
- **Built at runtime, not allow-listed.** GitHub can be told to skip paths
  (`.github/secret_scanning.yml`), but a skipped path also hides a real secret pasted into a test.
  Assembling the fake keeps every path scanned.
- **Built bundles are not read by the guard.** `kit/dist/omni.mjs` and `apps/omni-app/api/*.mjs`
  are built from sources the guard reads; a literal in them can only come from a source it already
  refused. The lockfile holds integrity hashes, not credentials.
- **Proof video: no.** Nothing in this PRD shows in a browser.

## User stories

- As anyone pushing to this repository, a person or an agent, a real credential in my push is
  refused before it becomes public.
- As an agent writing a masking test, the guard tells me, in my own run, to build the fake token at
  runtime, so push protection never stops me later.
- As the repository's admin, I learn within a day, from one issue that says what to run, when a
  setting has been switched off or a secret alert is open.

## Scope

In: the five pieces above, the triage of the alerts GitHub raises when scanning is switched on, and
the label `omni:security`, created by the admin with the token (`labels.autoCreate` is false here),
as the workflow's header says.

Out: the organisation's defaults; other Vertuoza repositories; the paid features (non-provider
patterns, validity checks, custom patterns); rotating any credential not raised by an alert; any
change to product code.

## Test seams

The repository's testing form holds: a test never calls GitHub.

- **The guard** is a test itself: it fails on today's `main` (the literal fakes are there), and
  passes once piece 1 lands. Its own cases run the matcher on planted lines: each shape with its
  body is caught; a bare prefix, a regular expression and a shape assembled with `+` are not.
- **The settings script** runs through `main()` against a fake `gh` (a stub on `PATH`, as the game
  scripts' tests do): both settings on and no alert → exit 0; a setting `disabled` → exit 1 and the
  `--apply` line; an open alert → exit 1 and its link; secret scanning disabled (the alerts call
  answers 404) → exit 1 naming the setting, not a crash; `--apply` sends exactly one `PATCH` with
  both settings `enabled`, then reads back.
- **The workflow** gets `scripts/security-workflow.test.ts`, which reads the YAML as
  `scripts/checks-workflow.test.ts` and `apps/galaxy/src/business/recheck/workflow.test.ts` do: the
  daily schedule and `workflow_dispatch`, the job's `if` on the secret being set, `GH_TOKEN` from
  `SECURITY_READ_TOKEN`, `issues: write` and nothing else written. Its behaviour is proven by its
  first `workflow_dispatch` run once the secret is set.
- **The masking tests** keep passing unchanged in what they assert: the strings they receive are
  equal to today's.

## Risks

- **What merging publishes:** a new workflow, two scripts, test changes and a briefing line. No
  deploy of the arcade or the GitHub App (no input of either changes), no migration.
- **What switching on publishes:** GitHub raises alerts for the whole history. On a public
  repository an alert's secret is already public; triage rotates real ones first.
- **A push refused for a real reason:** the briefing line says what to do; nobody bypasses.
- **The token expires:** the daily run goes red and the issue says the read failed with its HTTP
  status; a new token in the same secret fixes it.
- **Rollback:** revert the PR. The settings are switched off, if ever needed, with
  `gh api -X PATCH repos/vertuoza/vertuo-omni-loop -f security_and_analysis[secret_scanning][status]=disabled`
  (and the same for push protection); the daily run then reports it.

## Acceptance criteria

1. No tracked file outside `pnpm-lock.yaml`, `kit/dist/` and `apps/omni-app/api/` holds a literal
   credential shape; `scripts/secret-shapes-guard.test.ts` passes on the feature branch and fails
   when one such literal is planted.
2. Every masking and fixture test that held a literal fake passes, asserting the same values as
   before.
3. `node scripts/security-settings.ts` exits 0 with both settings on and no open alert, and exits 1
   with a line naming the fix for each setting off and each alert open; its tests cover each case
   against a fake `gh`.
4. `node scripts/security-settings.ts --apply` switches both settings on with one `PATCH` and reads
   them back.
5. `.github/workflows/security.yml` runs daily and on dispatch, does nothing while
   `SECURITY_READ_TOKEN` is unset, opens or updates one `omni:security` issue on red and closes it on
   green.
6. On `vertuoza/vertuo-omni-loop`, `security_and_analysis` reads `secret_scanning: enabled` and
   `secret_scanning_push_protection: enabled`, and every alert GitHub raised is closed, each with
   its resolution listed in the feature PR.
7. The briefing's `Never [repo]` section holds the push protection line, and
   `omni kb show briefing` prints it.
