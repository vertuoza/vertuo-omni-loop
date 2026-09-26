# `kit/templates/playbook/definition-of-done.md`

Source: `docs/agents/definition-of-done.md` @ `vertuo-ai-domain@db67fd9da`. The kit default of the
definition-of-done form: slots `done`, `docs`, `commits`, in the spec's order.

## Read from config instead of hard-coded

| upstream | here |
|---|---|
| `pnpm quality:preflight --full` | `{config:commands.preflightFull}` |
| `pr:needs-fix` | `{config:labels.needsFix}` |
| "Stuck after 3 attempts" | `{config:limits.attempts}` |
| `outbox:go` | `{config:labels.outboxGo}` |
| `pr:in-progress` | `{config:labels.inProgress}` |

## Dropped (repository literals)

- **The skill pointers:** `vertuo-deliver`, `vertuo-yolo`, `vertuo-do-work`, `vertuo-testing`,
  `vertuo-pull-request`.
- **Done Means' repository rules:** structured logging metadata and correlation ids (the testing
  form's `never` keeps the log rule); "Shared contracts remain Zod-first" (the architecture form's
  `patterns`); "Layering still matches `libs/LIBRARY_STYLE_RULES.md`, especially the forbidden
  `ai → domain` edge" (the architecture form's `boundaries`); `.github/PULL_REQUEST_TEMPLATE.md`
  (now "the pull request body explains …"); ADR 0069; `ci/outbox`; `/vertuo-deliver`,
  `/vertuo-yolo` and `docs/agents/implementation-workflow.md`, "The Outbox".
- **Documentation Updates:** "Update capability docs when inputs, outputs, prompt behavior, eval
  flow, status, or known gaps change" (this repository's capability docs); "provider rule" in the
  ADR line; "README or setup docs" now "the setup page"; "agent docs" now "this playbook".

## Changed

- "A PR into `main` is green and mergeable, or carries `pr:needs-fix` and the 'Stuck after 3
  attempts' comment … A sub-PR is merged into its feature branch, or carries the same label and
  comment" is one line: the pull request is green and mergeable, or carries the needs-fix label and
  a comment saying what is stuck.
- **Commit Shape** is split: the type list is the conventions form's (`commits`); this form keeps
  "one coherent change each; a few meaningful commits over one mixed commit" (slot `commits`).

## Added

- "The knowledge registers, when the work settles something true about the product": the kit's
  write-back rule, which upstream states in `AGENTS.md` (slot `docs`).
- The opener "Use this page when handing off work …" (upstream: "before").
- The spec's slot markers and headings.
