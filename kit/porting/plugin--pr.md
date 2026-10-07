# `kit/plugin/skills/pr/SKILL.md` (`/omni:pr`)

Source: `vertuo-ai-domain@c4a210122:.claude/skills/vertuo-pull-request/SKILL.md`. The skill keeps
upstream's shape: three kinds, merging rules, body, status comment, lifecycle loop, stuck path,
sub-PR lifecycle.

## Read from config instead of hard-coded

| Upstream literal | Now |
|---|---|
| `main` (base, merge guard) | `repo.defaultBranch` |
| `feat/<topic>` | `branches.feature`; slice branches `branches.slice` |
| `pr:feature` / `pr:sub` / `pr:in-progress` / `pr:needs-fix` | `labels.feature` / `labels.sub` / `labels.inProgress` / `labels.needsFix` |
| `Closes #<prd>` / `Part of #<prd>` | `prLinks.feature` / `prLinks.sub` (`{prd}` filled) |
| `pnpm quality:preflight --full` | `commands.preflightFull`, or `commands.preflight` when null |
| `gh pr checks <n> --required`, the `all-green` check | `ci.branchProtection` true → `--required`; otherwise the checks named `ci.aggregateCheck` and `ci.outboxContext` (item s4-02 for a null aggregate) |
| "three attempts" | `limits.attempts` |
| "a status comment more than an hour old" | the `claimed-stale` state of `omni board <prd>`, which `/omni:wave` reads (see "Staleness" below) |
| `## Acceptance` with `<path>.feature` | only when `acceptance.enabled`; scenario files under `acceptance.dir` |

## Changed

- **Labels.** Upstream created any missing label ("never a blocker") with fixed colours. Now a label
  is created only when `labels.autoCreate` is true (no colour given); otherwise the PR opens without
  it and "create label" is reported as a human step, in the status comment and the reply (spec §2.1
  rule 5). Added: never add `labels.outboxGo`.
- **Status comment.** Upstream edited it with `gh pr comment <n> --edit-last`, which PRD 3's final
  review found unsafe (it rewrites whichever comment was last). Now the comment carries the marker
  `<!-- <markers.prefix>-status -->`, is found by that marker through `gh api` and PATCHed in place,
  or posted when absent (item s4-01). The comment gains a `human steps` line.
- **Merge guard.** "Never merge into `main`" is now "never merge a PR whose base is
  `repo.defaultBranch`". Merging `<repo.remote>/<base>` into a branch to resolve a conflict is kept.
- **`BEHIND`.** Upstream deferred to `vertuo-pr-monitor`, which PRD 7 does not port; now "a person
  decides".
- **Red outbox context.** New row: a red `ci.outboxContext` alone is the gate, not a CI failure; the
  skill runs `omni status <prd>` and stops when only person-answered items remain (item s4-03).
- **Who posts the outbox context.** One line after "Which checks count": the `ci.outboxContext` check
  is posted by the omni-loop GitHub App, never by a workflow, and is absent when the app is not
  installed (PRD 28, ADR-0001). Upstream's `ci/outbox` came from a per-repository workflow.
- **Triage.** Upstream allowed a re-run only on a failure signature listed in its CI-triage page.
  There was no such page here, so one re-run per PR was allowed when the failure was plainly not the
  branch's (runner, network, timeout, in untouched code), still counted as an attempt (item s4-04).
  PRD 45 brings the page back as the `ci` form (item s6-01): a failure matching a known red it lists,
  where the branch changes nothing that red names, is not the branch's, and a re-run happens only
  when its **When to re-run** section allows it, one per PR, counted as an attempt. The
  runner/network/timeout allowance is gone; the form's kit default allows a re-run for a listed
  known red only, as upstream did.
- **The playbook forms** (PRD 45, the spec's wiring table), each read through `omni kb show`.
  Step 0 prints the `briefing` before any other step (acceptance criterion 9), and says how to read
  a form: a blank section is the kit default, a `[hole]` never stops the skill (decision 7), and a
  form adds to its steps without overriding its rules (item s6-02). The lifecycle reads
  `verification`, `pull-requests` and `definition-of-done` before opening or picking up a PR; they
  add to the preflight, **Labels** and **The body**. The check loop of a feature or standalone PR
  reads `ci` once. Claim mode reads none: it stops before anything is built.
- **Body.** Upstream relied on its PR template. The skill now carries the shape itself (Summary,
  Verified, Risk and rollback, Reviewer focus) and follows `.github/PULL_REQUEST_TEMPLATE.md` only when
  it exists. The sub-PR body's "Scenarios" line became "Decisions" (outbox items raised); slices are
  named by plan id.
- **Sub-PRs leave the check loop first.** Upstream says "No CI runs on a sub-PR". Here the lifecycle
  sends a sub-PR to its own section before the check table. Its checks are never read, so "no checks
  reported" is never taken for a conflict. The preflight runs on the machine, with retries counted
  toward `limits.attempts` and the same stuck path, and the skill checks for a conflict with the
  feature branch. Once both are fine, this skill runs `gh pr ready` for the sub-PR: that step is owned
  here and not by `/omni:do-work`.
- **Feature PR never marked ready.** Upstream's "Done" row ran `gh pr ready` for every kind. Now a
  feature PR stays in draft: `/omni:yolo` marks it ready after `omni ship` (spec §2.1 rule 7).
  Only a standalone PR is marked ready here.
- **Claim mode** (new, spec §2.1 rule 6). It cuts the slice branch from the feature branch, makes one
  empty claim commit with the trailer, pushes, opens the draft sub-PR (`<slice>: <title>`, body led by
  `prLinks.sub`), posts the status comment with state `claimed`, and stops. `/omni:do-work` (run
  alone) and `/omni:wave` use it.
- **Staleness.** Upstream's "older than an hour and no check running" rule is not restated here. The
  `claimed-stale` state of `omni board <prd>` decides, and `/omni:wave` reads it.
- **Remote and slug.** `origin` becomes `repo.remote`. The comment API path uses `repo.slug`, and
  falls back to gh's `{owner}/{repo}` when the slug is null.
- **Sub-PR orchestrator.** `vertuo-parallel-wave` → `/omni:wave`.
- **Step 0** added (spec §2.1 rule 1).
- **Phase-0 PR** added as one line: `/omni:brainstorm` opens it; it uses `labels.phase0` and
  `prLinks.phase0` with this lifecycle.
- The `coverage` job's 25-minute example was dropped; the background-watch rule stays.

## Dropped (specific to vertuo-ai-domain)

- `gh label create` lines with their colours and the `prd` label definition.
- References: its PR authoring guide, ADR 0069, CI-triage page, Definition of Done page. The three
  pages came back in PRD 45 as the repository's `pull-requests`, `ci` and `definition-of-done`
  forms (above).
- Guidance on domain impact / business-rule sources (folded into the body's Reviewer focus) and on UI
  manual test steps.
- Translation checklist, French-first wording (ADR 0037) and "where does this string live" (ADR 0040,
  its feature-UI lib, `pnpm i18n:catalogs`, `system-*` primitives).
- `VERTUO_PREFLIGHT_SKIP` and the "Preflight skipped" summary line.
- The `/vertuo-fix-bug` **Bug** section of its template.
- The `acceptance-not-needed` label and its push-timing rule.
- The feature PR's `.feature` path shape (now `acceptance.dir`).

## PRD #99, slice s2 — the skill signs the loop's work

Not a re-port: upstream's skill signs nothing. A kit-local change to the prose, which the bundle
does not carry. PRD #99 makes OmniMan (the `signature` config section, slice s1) a co-author of every
commit the loop makes and the signer of every pull request and issue it opens.

- **Signing,** a `## Signing` section before **Labels**, since this skill owns every body: every
  commit the skill makes ends with the session's co-author trailer, then the line `omni sign
  trailer` prints, as the message's last line with no blank line between them, so both stay in the
  trailer block. Every pull request or issue it opens ends its body with the line `omni sign footer`
  prints, as a paragraph of its own just above the session's own attribution lines, and a body it
  rewrites keeps that line. Comments are never signed. A command that prints nothing (`signature:
  null`) means signing is off: the skill adds nothing and runs unchanged. No skill spells the
  signer's name or address.
- **The body:** every body, of every kind, ends with the footer line, after the repository's
  template when it has one. The feature shape names it after Reviewer focus, the sub-PR shape shows
  it as its last line, and the standalone shape puts it after `Closes #<issue>`.
- **Claim:** the claim commit carries the trailer line. `gh pr create` gains `--body-file <file>`:
  the step already asked for a body starting with `prLinks.sub`, and now for one ending with the
  footer, which a command with no body flag cannot carry.
- **Unsigned:** the status comment and the stuck comment, named in the section.

### Tests

`kit/test/plugin.test.mjs` gained one rule, run on the live skills and on fixtures built to break
it: a SKILL.md that asks for the co-author trailer names `omni sign trailer`, and one that opens a
pull request or an issue (`gh pr create`, `gh issue create`, or "open(s) the/a … PR, pull request
or issue" in prose), or rewrites its body (`gh pr edit … --body-file`), names `omni sign footer`.
A skill that only comments is held to nothing. The existing rule that every `omni` command a
SKILL.md names exists now covers `sign`.

### Gate (this update)

`pnpm vitest run kit/test/plugin.test.mjs kit/test/no-literals.test.mjs` and `pnpm test`, green.

## Issue 1167 — ready after a push waits for the push's run

Not a re-port: a kit-local bug fix. A `gh pr ready` seconds after a push started a draft
`synchronize` run and the `ready_for_review` run together; with a branch-wide concurrency group that
cancels in progress, the ready run was cancelled and the PR showed green with no check run at all.
The kit's own `checks` workflow now gives a draft run its own group; repositories whose workflows
the kit does not own are covered by **Merging and ready**'s new rule: wait for the pushed commit's
run before `gh pr ready`, then rerun a cancelled `ready_for_review` run, and never count a check
that only skipped or was cancelled as green. `/omni:yolo` §5 item 4, `/omni:yolo-fix`'s ship and
`/omni:ultra-yolo`'s target ready point to it.

## Issue 1178 — a sub-PR's review threads

Not a re-port: a kit-local bug fix. **A sub-PR's lifecycle** step 3 now says the orchestrator
judges the sub-PR's review threads, when a reviewer left any, before it merges it (`/omni:wave`
step 4, item 5). Its checks are still never read; only its threads are.
