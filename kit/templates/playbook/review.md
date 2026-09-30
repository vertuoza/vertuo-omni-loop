---
form: review
form-version: 1
state: blank
points-to: null
evidence: []
invaded: null
---

# Review

Use this page when a reviewer's comment on a pull request needs an answer: fix it, push back, or ask
a person.

## Fix
<!-- slot: fix · required -->
Fix the comment, commit, and reply with the commit, when it names:
- a bug, a security problem, data loss;
- duplicated code;
- a missing or weak test;
- a broken repository convention or law;
- a name the reviewer shows is misleading.

## Push back
<!-- slot: push-back · required -->
Reply with a reason that names the line below it falls under, and change nothing, when it asks for:
- naming taste;
- style no linter enforces;
- "while you’re here" changes outside the pull request's scope;
- a rewrite to the reviewer's preferred pattern with no defect named;
- an answer to a question the spec already answers.

## Ask
<!-- slot: ask · required -->
Leave the thread open for a person, and say why, when the comment needs a product decision, or
contradicts the spec. A reviewer who replies again after a fix or a push-back has the last word:
the thread goes to a person, never back into the argument.
