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
