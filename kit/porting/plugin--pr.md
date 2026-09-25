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
| "a status comment more than an hour old" | `limits.claimStaleMinutes` (spec §2.1 rule 6), plus "no newer commit on the branch" |
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
  `repo.defaultBranch`". Merging `origin/<base>` into a branch to resolve a conflict is kept.
- **`BEHIND`.** Upstream deferred to `vertuo-pr-monitor`, which PRD 7 does not port; now "a person
  decides".
- **Red outbox context.** New row: a red `ci.outboxContext` alone is the gate, not a CI failure; the
  skill runs `omni status <prd>` and stops when only person-answered items remain (item s4-03).
- **Triage.** Upstream allowed a re-run only on a failure signature listed in its CI-triage page.
  There is no such page here; now one re-run per PR is allowed when the failure is plainly not the
  branch's (runner, network, timeout, in untouched code), still counted as an attempt (item s4-04).
- **Body.** Upstream relied on its PR template. The skill now carries the shape itself (Summary,
  Verified, Risk and rollback, Reviewer focus) and follows `.github/PULL_REQUEST_TEMPLATE.md` only when
  it exists. The sub-PR body's "Scenarios" line became "Decisions" (outbox items raised); slices are
  named by plan id.
- **Sub-PR orchestrator.** `vertuo-parallel-wave` → `/omni:wave`.
- **Step 0** added (spec §2.1 rule 1).
- **Phase-0 PR** added as one line: `/omni:brainstorm` opens it; it uses `labels.phase0` and
  `prLinks.phase0` with this lifecycle.
- The `coverage` job's 25-minute example was dropped; the background-watch rule stays.

## Dropped (specific to vertuo-ai-domain)

- `gh label create` lines with their colours and the `prd` label definition.
- References: its PR authoring guide, ADR 0069, CI-triage page, Definition of Done page.
- Guidance on domain impact / business-rule sources (folded into the body's Reviewer focus) and on UI
  manual test steps.
- Translation checklist, French-first wording (ADR 0037) and "where does this string live" (ADR 0040,
  its feature-UI lib, `pnpm i18n:catalogs`, `system-*` primitives).
- `VERTUO_PREFLIGHT_SKIP` and the "Preflight skipped" summary line.
- The `/vertuo-fix-bug` **Bug** section of its template.
- The `acceptance-not-needed` label and its push-timing rule.
- The feature PR's `.feature` path shape (now `acceptance.dir`).
