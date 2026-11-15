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
a person; and when you review one, for what to look for.

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

## Look for
<!-- slot: look-for · optional -->
What a reviewer looks for in a pull request, in order of harm. A repository's own section adds items
to these six and never removes one: `omni review look-for` prints the six, then each item it adds.

1. **Correctness:** the diff does what the spec says; edge cases, error paths, concurrency, data
   loss.
2. **Security and data:** a secret, personal data, an authorisation check, injection, row-level
   security on a new table.
3. **Tests that prove it:** every acceptance criterion has a test that would fail if the code broke;
   no test loosened, skipped or deleted to go green; no suppression added; no floor lowered.
4. **Scope:** a file outside the plan's territories, or work the spec does not ask for.
5. **Laws and conventions:** what a law, a rule or a playbook line says, cited by its id or its form
   and section.
6. **Design and complexity:** duplicated code, needless generality, a misleading name; only as a
   defect, never as taste.
