---
form: verification
form-version: 1
state: blank
points-to: null
evidence: []
terraformed: null
---

<!-- Ported from vertuo-ai-domain@db67fd9da:docs/agents/verification.md — changes in kit/porting/templates--verification.md -->

# Verification

Use this page when handing off changes: what must be green before a pull request, and before a push.

## The preflight
<!-- slot: preflight · required -->
`{config:commands.preflight}` is the preflight: it is green before a pull request is opened. It
runs the half of the gate a laptop can run, stops at the first failure, and says what to fix. What
only CI can run, it names and leaves to CI.

## Before every push
<!-- slot: before-push · optional -->
Run `{config:commands.preflightFull}` before every push to an open pull request. A sub-pull request
runs no CI, so this is its only grade.

A commit hook runs only the checks that need no build: a hook that costs minutes buys the habit of
skipping it, and then it protects nothing. So a green commit is not a green branch; run the rest
yourself when you delete an export or change a signature. Never skip a hook.

## Checks
<!-- slot: checks · optional -->
- Run the narrowest relevant check while iterating. Broaden it when changing a shared contract,
  layering, runtime behaviour, or documentation links.
- Every CI job has a local command that runs the same check, so a red job is reproduced locally
  under its own name.
- A ratchet (a check graded against a recorded baseline: coverage floors, a suppression budget, a
  formatting baseline) may only hold or improve. Never relax one to turn a check green; raising a
  budget is its own reviewed change, and a gate never rewrites its own thresholds.
- The hand-off names the checks that ran, and each check skipped with a concrete reason.
