---
form: releasing
form-version: 1
state: blank
points-to: null
evidence: []
terraformed: null
---

<!-- Ported from vertuo-ai-domain@db67fd9da:docs/agents/releasing.md — changes in kit/porting/templates--releasing.md -->

# Releasing

Use this page when you need to know what a merge publishes.

## What a merge publishes
<!-- slot: publishes · required -->
You do not cut a release: merging does. Every merge is either a shipping change, something a
deployed service or a published package actually contains, or one that ships nothing, such as docs,
specs, or tooling. Know which one yours is before it merges.

## How a release happens
<!-- slot: how · optional -->
- The rules that decide what ships and what the next version is live in code, with tests beside
  them, never only in workflow configuration.
- A release commits nothing back to `{config:repo.defaultBranch}`: the version lives on its tag.
- Asking for more than a patch is a label on the pull request before it merges; a label added after
  the merge does nothing.
- A running service can say which release it is. One that answers a development version was not
  built by the pipeline.

## Rollback
<!-- slot: rollback · optional -->
When something is on fire, run the publishing workflow by hand for the release you mean; never
publish from a workstation. A release that went out with the wrong number stands, and the next
shipping change corrects it: never retag by hand.
