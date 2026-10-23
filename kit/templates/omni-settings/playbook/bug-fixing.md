---
form: bug-fixing
form-version: 1
state: filled
points-to: null
evidence: []
invaded: null
owner: null
---

# Bug fixing

Use this page when a reported bug becomes a pull request.

<!-- The workspace's tech default for every repository that writes no bug-fixing page of its own. The
`owner:` line names who approves a change to this page; null means the law owners of the settings
repository's config. -->

## Steps
<!-- slot: steps · required -->
1. **Read and classify.** A bug is something a user, a browser, or an API caller can observe. A
   flaky harness, a CI timeout, or a slow job is tooling: say so on the report and follow the CI page
   instead.
2. **Triage.** Name the domain that owns the behaviour, the risk, and whether it is a regression.
   `critical`: data loss, security, money, or a whole surface down for every user. `high`: a main
   flow broken with no workaround. `medium`: a flow broken with a workaround, or a secondary flow
   broken. `low`: cosmetic, or a minor inconvenience. A regression is a claim with evidence: the
   culprit change, a green run followed by a red one, or the report saying when it last worked.
   Without evidence it is a new bug.
3. **Words first.** Every term the reproduction needs is in the glossary. A term that cannot be
   defined without inventing product behaviour is a question for a person.
4. **Prove red.** Write the test or scenario that reproduces the bug, in the domain's own words, and
   run it before any fix: it must fail. If it passes, it misses the bug, the bug is gone, or this
   level cannot see it: run `commands.smoke` with the case added. No smoke to run: stop, keep the
   reproduction.
5. **Fix.** Test-first, the smallest fix. Never edit the reproduction to make it pass.
6. **Guard.** See below.
7. **Open the pull request**, closing the report, and say what proved red and what proved green.

Nothing is reported as proven that was not run.

## Guard
<!-- slot: guard · optional -->
Ask which cheap check would have caught this before it shipped. When one is guard-sized (a check
script, a lint rule, a unit test), add it, with its own test; for a bug proven red by
`commands.smoke`, that case, run by CI. Otherwise the pull request says `Guard: none — <reason>`.
A regression test that lets small mutations of the fixed lines pass is not guarding the fix.
