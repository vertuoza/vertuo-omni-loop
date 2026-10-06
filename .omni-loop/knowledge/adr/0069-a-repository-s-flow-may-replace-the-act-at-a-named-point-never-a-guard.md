# ADR-0069 — A repository's flow may replace the act at a point the catalog allows, never a guard

**Status:** accepted · **Date:** 2026-10-06 · **PRD:** #1089 · **Supersedes:** part of ADR-0025, for the `flow` section only

## Context

ADR-0025 settled how a repository's playbook form ranks against the skill that reads it: the form adds
steps and detail, and never overrides the skill's rules. That held while forms were the only way a
repository could shape the loop, and a form is prose nothing checks.

PRD 1089 gives a repository a `flow` section in `.omni-loop/config.yml`: rules the CLI grades, areas
of the code with rules of their own, and **hooks**, Markdown files an agent follows at a named point
of a skill (`do-work.test`, `pr.open`, `wave.merge`…). A team with its own test runner, its own way of
opening a pull request or its own merge method needs more than adding to the kit's step: it needs to
**swap** that step for its own. Read literally, ADR-0025 forbids that. Read loosely, it would let a
hook swap anything, the guards included: the signature, the base check that keeps the loop out of the
default branch, the territory check, `omni plan check`.

## Decision

A hook may replace the **act** at a point the catalog allows, and never a **guard**.

- **Extend is the default.** At every point, a skill follows each `before` hook, then the kit's step,
  then each `after` hook. This is ADR-0025 unchanged: a hook adds to the skill.
- **Replace is the exception, named point by point.** The catalog, `kit/lib/flow/points.ts`, is the
  one list of the points where a `replace` hook may take the kit's step: `do-work.test`, `pr.open` and
  `wave.merge`. Each names what the replacement must still produce: the verdict line, the pull
  request's URL, the merged pull request's number. `omni check config` refuses a `replace` anywhere
  else, naming the key.
- **The guards run whatever the hooks say:** signing, labels, the PR links, the base check (never into
  the default branch), the territory check, `omni plan check`, the slice's preflight before it ships,
  and the merge gate (`omni flow check merge`), which a `wave.merge` hook may replace in its act but
  never skip. A hook is followed under the session's own permissions, as a form is.
- **Fail closed.** A hook's output ends with `omni-hook <point>: pass` or `… fail <why>`, read by
  `omni flow verdict`. A missing verdict, a missing hook file or a broken `flow` stops the point;
  nothing is skipped silently.
- **No code from the repository runs in the loop.** Rules are data and hooks are Markdown; executable
  hooks were declined for security.

## What it supersedes in ADR-0025

Its **Decision**, for the `flow` section only: a `replace` hook at a catalog point takes the place of
the kit's act there. ADR-0025 stays true for every playbook form, and for every `before` and `after`
hook: they add, and never loosen what a skill forbids.

## Consequences

- Adding a replaceable point is a change to the catalog and its conformance test
  (`kit/test/flow-points.test.ts`), reviewed as such, never a repository's own choice.
- A team that wants a step the catalog does not allow to be replaced extends it, or asks for the
  point.
- `pr.openWith` (PRD 1086) is read as the default area's `pr.open` replace hook, marked
  `alias: claude`; it opens feature, landing and standalone pull requests, never sub-PRs, so the claim
  and its guards stay the kit's.
- The guide page `docs/guide/flow.md` walks through it.
