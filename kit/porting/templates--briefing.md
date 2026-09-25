# `kit/templates/playbook/briefing.md`

Source: `docs/agents/briefing.md` @ `vertuo-ai-domain@db67fd9da`. The kit default of the briefing
form: slots `never`, `hooks`, `next`, in the spec's order.

## Read from config instead of hard-coded

| upstream | here |
|---|---|
| `main` ("Never merge into `main`") | `{config:repo.defaultBranch}` |
| "three attempts" | `{config:limits.attempts}` |
| `pr:in-progress` | `{config:labels.inProgress}` |
| `docs/knowledge/` | `{config:paths.knowledge}` (slot `next`) |
| (decision records, named by `AGENTS.md`) | `{config:paths.adr}` (slot `next`) |

## Dropped (repository literals)

- **The opening:** "You are working in `vertuo-ai-domain`", and the three commands that carry the
  flow (`/vertuo-brainstorming`, `/clear`, `/vertuo-deliver`, `/vertuo-yolo`), with
  `docs/delivery/inbox/<prd>-<topic>/spec.md` and the `pr:phase-0` label. The loop's own skills say
  this; the briefing keeps only the rules.
- **Formatting:** "Never run `pnpm format` (it rewrites ~760 files). Fix drift with
  `pnpm exec prettier --write <files>`." Now "Never reformat files you did not change".
- **ADR 0069** (who merges sub-pull requests into the feature branch): the kit's `/omni:wave` says
  it.
- **`docs/agents/ci-triage.md`**: now "the CI page", the ci form.
- **The outbox line's names:** `high`, `/vertuo-deliver`, `/vertuo-yolo`, `ci/outbox`, `outbox:go`.
  Kept: take the most reversible option and record the decision as an outbox item; two principles
  pulling against each other stop the slice.
- **The hook paragraph:** `pnpm quality:preflight` and its steps (build, typecheck, lint, test,
  guards, dead code), `pnpm quality:preflight --full` (coverage, smoke, audit), and
  `VERTUO_PREFLIGHT_SKIP=1`. The preflight commands are the verification form's; the rule is kept
  in slot `hooks`: a hook that refuses names what to fix; never bypass it; an escape hatch is for
  emergencies, and the pull request says why.
- **"More:"** `AGENTS.md`, `docs/agents/pull-request.md`, `docs/agents/definition-of-done.md`,
  `docs/agents/implementation-workflow.md`. Now slot `next`: the rest of the playbook through
  `omni kb show <form>`, and the two registers by config.

## Changed

- "Before you decide anything the spec does not settle, read the principles and rules of the
  domains you touch in `docs/knowledge/`" reads "read the knowledge the change touches", since a
  repository may keep no domains.

## Added

- The opener, "Use this page when a session starts …": the upstream page has none (it is printed
  at session start).
- The spec's slot markers and headings.
