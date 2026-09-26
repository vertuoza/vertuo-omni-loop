---
form: briefing
form-version: 1
state: blank
points-to: null
evidence: []
invaded: null
---

<!-- Ported from vertuo-ai-domain@db67fd9da:docs/agents/briefing.md — changes in kit/porting/templates--briefing.md -->

# Briefing

Use this page when a session starts: the rules that cost the most when broken.

## Never
<!-- slot: never · required -->
- Never merge into `{config:repo.defaultBranch}`. A person does.
- Before you decide anything the spec does not settle, read the knowledge the change touches. Take
  the most reversible option and record the decision as an outbox item; two principles pulling
  against each other stop that slice.
- Never lower a coverage floor or add a suppression to turn a check green.
- Never reformat files you did not change: format only what you touched.
- A red check on your pull request is yours to fix. Read the CI page first; after
  `{config:limits.attempts}` attempts, leave a comment saying what is stuck.
- A pull request you own carries `{config:labels.inProgress}` and a status comment you keep current,
  until it is green or stuck.

## Hooks
<!-- slot: hooks · optional -->
A hook that refuses a commit or a push names what to fix: fix the cause, and never bypass the hook.
An escape hatch that skips one exists for emergencies only, and the pull request says why it was
used.

## Where to read next
<!-- slot: next · optional -->
The rest of this playbook, one form per question, through `omni kb show <form>`; the knowledge
registers in `{config:paths.knowledge}`, which say what is true about the product; and the decision
records in `{config:paths.adr}`, which say how it is built.
