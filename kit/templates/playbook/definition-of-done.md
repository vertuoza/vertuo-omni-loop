---
form: definition-of-done
form-version: 1
state: blank
points-to: null
evidence: []
invaded: null
---

<!-- Ported from vertuo-ai-domain@db67fd9da:docs/agents/definition-of-done.md — changes in kit/porting/templates--definition-of-done.md -->

# Definition of done

Use this page when handing off work or opening a pull request.

## Done means
<!-- slot: done · required -->
- The changed behaviour is tested, or otherwise verified with the narrowest useful evidence.
- The nearest relevant docs are updated when behaviour, workflow, setup, or architecture intent
  changes.
- The pull request body explains impact, validation, risk, rollback, and reviewer focus.
- `{config:commands.preflightFull}` is green; the body names any step it skipped, and why.
- The hand-off names the checks that ran and any intentionally skipped.
- The pull request is green and mergeable, or carries `{config:labels.needsFix}` and a comment
  saying what is stuck after `{config:limits.attempts}` attempts.
- A feature pull request's outbox is settled, or waved through with `{config:labels.outboxGo}`,
  before it is treated as done.
- `{config:labels.inProgress}` is off the pull request, and its status comment says where it ended.

## Documentation updates
<!-- slot: docs · optional -->
- A decision record, when the work changes a durable architectural decision, a dependency
  direction, a persistence model, a boundary, or a trade-off future agents must understand.
- The knowledge registers, when the work settles something true about the product.
- The glossary, when the work introduces, renames, or sharpens domain language.
- This playbook, when the lesson is about how future agents should work.
- The setup page, when commands, ports, environment variables, or bootstrap steps change.

## Commits
<!-- slot: commits · optional -->
Each commit is one coherent change, in the Conventional Commit shape. Prefer a few meaningful
commits over one mixed commit that hides unrelated work.
