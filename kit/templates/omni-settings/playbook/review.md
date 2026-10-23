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
Fix the comment, commit, and reply on its thread with the commit, when it names a defect:
- a bug, a security problem, or a way to lose or leak data;
- a missing or weak test: one that would stay green if the change were wrong;
- duplicated code the change adds;
- a broken convention, boundary or law the repository has written down;
- a name the reviewer shows is misleading;
- a case the spec asks for that the change does not handle.

Each fix stays inside the pull request's scope. The checks the verification page names run before
the fix is pushed, and the reply says what proves it.

## Push back
<!-- slot: push-back · required -->
Change nothing, and reply with a reason that names the line below it falls under, when the comment
asks for:
- naming taste, or style no linter or written convention enforces;
- "while you're here" work outside the pull request's scope: offer it as an issue of its own;
- a rewrite to the reviewer's preferred pattern, with no defect named;
- what the spec or a recorded decision already settles: quote the line that settles it.

A push-back is short and specific, and is made once.

## Ask
<!-- slot: ask · required -->
Leave the thread open for a person, and say in one line why, when the comment needs a product
decision, contradicts the spec, a recorded decision or a law, or asks for a change that is hard to
undo (a stored shape, a public contract, a published name). A reviewer who replies again after a
fix or a push-back has the last word: the thread goes to a person, never back into the argument.
