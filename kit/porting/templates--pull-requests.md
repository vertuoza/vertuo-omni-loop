# `kit/templates/playbook/pull-requests.md`

Source: `docs/agents/pull-request.md` @ `vertuo-ai-domain@db67fd9da`, with the Conventional Commit
title from `docs/agents/definition-of-done.md` › Commit Shape. The kit default of the pull-requests
form: slots `body`, `title`, `labels`, `reviewers`, in the spec's order.

## Read from config instead of hard-coded

| upstream | here |
|---|---|
| `pr:feature` | `{config:labels.feature}` |
| `pr:sub` | `{config:labels.sub}` |
| `pr:phase-0` | `{config:labels.phase0}` |
| `pr:in-progress` | `{config:labels.inProgress}` |
| `main` ("into `main`", "a human merges it") | `{config:repo.defaultBranch}` (slot `reviewers`) |

## Dropped (repository literals)

- **The skill pointer:** `vertuo-pull-request`.
- **Kinds' mechanics:** `feat/<topic>`, `feat/<topic>--<slice>`, `docs/phase-0-<topic>`,
  `Closes #<prd>`, `Part of #<prd>`, `Refs #<prd>`, ADR 0069, `vertuo-plan`, `vertuo-deliver`,
  `vertuo-yolo`, `vertuo-brainstorming`, `ci/outbox`, `outbox:go`,
  `docs/agents/implementation-workflow.md`, `pnpm quality:preflight --full`, `.pending.feature`,
  `.claude/skills/vertuo-brainstorming/phase-0-policy.mjs`, "the label with a comment more than an
  hour old". The kit's `/omni:pr` owns the kinds; the form keeps each kind's label and the status
  comment rule (slot `labels`).
- **`.github/PULL_REQUEST_TEMPLATE.md`**: now "the repository's pull request template, when it has
  one" (slot `body`).
- **"For docs-only changes … mark UI/API/database impact as none"**: those sections are that
  template's.
- **Handoff Checks' mechanics:** the preflight's `mergeable` and `base-first` steps,
  `scripts/base-first.mjs`, `git merge origin/<base>`, the link to `./ci-triage.md`. "No checks
  means a conflict" is the ci form's (`gating`).
- **The link to `./definition-of-done.md`**: the title rule is stated here instead.

## Changed

- **Domain And Business Impact**, **Validation** and **Risk And Rollback** fold into `body`.
  "Domain invariants and business rules should cite their source of truth: code, schema, ADR,
  capability doc, product rule, or test" reads "A rule or invariant cites its source of truth".
- "Reviewer focus names the parts most worth scrutinizing" (Handoff Checks) is slot `reviewers`.

## Added

- Slot `title`: "The title is a Conventional Commit …", from "Use Conventional Commits for PR
  commits".
- Slot `reviewers`: "A person merges into the default branch; an agent never does", from the
  upstream "A human merges it".
- The spec's slot markers and headings.
