---
form: verification
form-version: 1
state: filled
points-to: null
evidence: []
invaded: null
owner: null
---

# Verification

Use this page when handing off changes: what must be green before a pull request, and before a push.

<!-- The workspace's tech default for every repository that writes no verification page of its own.
The `owner:` line names who approves a change to this page; null means the law owners of the
settings repository's config. -->

## The preflight
<!-- slot: preflight · required -->
The preflight is the command `omni config commands.preflight` prints, read from the config, never
typed from memory. It is green before a pull request is opened. It runs the half of the gate a
laptop can run, stops at the first failure, and says what to fix; what only CI can run, it names and
leaves to CI.

## Before every push
<!-- slot: before-push · optional -->
Run the full preflight (`omni config commands.preflightFull`, else `commands.preflight`) before
every push to an open pull request. A pull request no CI runs on, such as a sub-pull request into a
feature branch, has this as its only grade.

A commit hook runs only the checks that need no build, so a green commit is not a green branch: run
the rest yourself when you delete an export or change a signature. Never skip a hook.

## Checks
<!-- slot: checks · optional -->
- Run the narrowest relevant check while iterating. Broaden it when changing a shared contract,
  layering, runtime behaviour, or documentation links.
- A red CI job is reproduced locally, under its own name, before it is fixed.
- A ratchet (a check graded against a recorded baseline: coverage or mutation floors, a suppression
  budget, a formatting baseline) only holds or improves. Never lower a floor, skip a test or add a
  suppression to turn a check green; raising a budget is its own reviewed change.
- A check that only skipped or was cancelled is never green.
- The hand-off names the checks that ran, and each check skipped with a concrete reason.
