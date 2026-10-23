---
form: review
form-version: 1
state: filled
points-to: null
evidence: []
invaded: null
owner: null
---

# Review

Use this page when a reviewer's comment on a pull request needs an answer: fix it, push back, or ask
a person.

<!-- The workspace's tech default for every repository that writes no review page of its own. The
`owner:` line names who approves a change to this page; null means the law owners of the settings
repository's config. -->

## Fix
<!-- slot: fix · required -->
Fix the comment, commit, and reply with the commit, when it names a bug, a security or data-loss
problem, duplicated code, a missing or weak test, a broken convention or law, or a misleading name.

## Push back
<!-- slot: push-back · required -->
Reply with a reason that names the line below it falls under, and change nothing, when it asks for:
- naming taste, or style no linter enforces;
- work outside the pull request's scope;
- a rewrite to another pattern, with no defect named;
- what the spec already settles: quote it.

## Ask
<!-- slot: ask · required -->
Leave the thread open for a person, and say why, when the comment needs a product decision,
contradicts the spec, or asks for a change that is hard to undo. A reviewer who replies again after
a fix or a push-back has the last word: the thread goes to a person, never back into the argument.
