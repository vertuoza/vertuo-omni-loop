---
form: definition-of-done
form-version: 1
state: filled
points-to: null
evidence: []
invaded: null
owner: null
---

# Definition of done

Use this page when handing off work or opening a pull request.

<!-- The workspace's tech default for every repository that writes no definition of done of its own.
The `owner:` line names who approves a change to this page; null means the law owners of the
settings repository's config. -->

## Done means
<!-- slot: done · required -->
- The change does what its spec or issue asks, and nothing it did not ask.
- The changed behaviour is proven by a test that failed before the change, or, where no test can
  reach it, by the narrowest evidence that was actually run.
- The repository's full preflight (`omni config commands.preflightFull` names it, else
  `commands.preflight`) is green on the last commit pushed; the pull request names any step it
  skipped, and why.
- The hand-off names every check that ran, and every check skipped with its reason. Nothing is
  reported as proven that was not run.
- Every decision taken without asking a person is written down for a person to answer.
- The pull request body says what changed, how it was verified, its risk, how to roll it back, and
  where a reviewer should look closest.
- The pull request is green and mergeable, or a comment on it says exactly what is stuck.
- No key, token, password or personal data is in a commit, a fixture, a log or the body.

## Documentation updates
<!-- slot: docs · optional -->
- A decision record, when the work changes a durable architectural decision, a dependency
  direction, a persistence model, a boundary, or a trade-off future agents must understand.
- The knowledge registers, when the work settles something true about the product.
- The glossary, when the work introduces, renames, or sharpens domain language.
- The playbook, when the lesson is about how future agents should work.
- The setup page, when commands, ports, environment variables, or bootstrap steps change.

## Commits
<!-- slot: commits · optional -->
Each commit is one coherent change, in the Conventional Commit shape, with no unrelated formatting.
Prefer a few meaningful commits over one mixed commit that hides unrelated work.
