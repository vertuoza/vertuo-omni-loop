---
prd: 1171
title: The harvest links each new rule to the test that proves it
blocked-by: none
spec: file
---

# The harvest links each new rule to the test that proves it

**Date:** 2026-10-07 · **PRD:** #1171 · **Follows:** PRDs 82 (the knowledge harvest), 1044 (the diff names
the risky ground) · **Touches:** `kit/lib/knowledge/classify.ts`, `kit/lib/knowledge/write.ts`,
`kit/lib/knowledge/pipeline.ts`, `kit/bin/commands/harvest.ts`, `kit/bin/github.ts`,
`apps/omni-app/src/knowledge-harvest/`, `kit/bin/commands/status.ts` · **Out of scope:** the `law-proof`
guard itself, `/omni:invade`, the plan repository's harvest.

## Problem

A knowledge entry says what must hold, and its `Enforced by:` line names the file that proves it. Three
parts of the kit already use that line:

- `/omni:invade` fills it with the test it finds for a rule, or writes `unenforced`, an honest gap;
- `omni check knowledge` refuses an `Enforced by:` path that does not exist;
- the `law-proof` rule (PRD 1044) flags any change an agent makes to a file an `Enforced by:` line names,
  so the outbox gate shows it to a person.

But after `/omni:invade`, a repository's knowledge grows through the harvest: each merged feature PR's
decisions become rules and invariants. The harvest writes `Enforced by: unenforced` on every one of them
(`kit/lib/knowledge/write.ts`), even when the same PR wrote the test that proves it. In this repository,
measured on `main` on 2026-10-07, all 60 entries of `.omni-loop/knowledge/product/` say `unenforced`. The
`law-proof` guard has nothing to protect, and nobody can see how much of the knowledge is proven.

## Solution

1. **The harvest reads what the feature PR changed.** Both callers already hold the merged feature PR:
   `omni harvest` through `kit/bin/github.ts`, the app's `knowledge-harvest` function through its own
   GitHub client. Each one lists the PR's changed files (`GET /repos/{repo}/pulls/{n}/files`, every page)
   and keeps the paths that were added, modified or renamed (a rename's new path), never a removed one. The
   list goes into `prepareHarvest` as data: the library makes no network call (N-PRODUCT-1).
2. **The model proposes the proof.** The classifier's prompt lists those paths. A reply of kind `rule` or
   `invariant` may carry `enforcedBy`: one to three of the listed paths, the files whose tests or
   constraints prove the statement. It omits the field when none does. The other kinds never carry it.
3. **Code keeps only what it can check.** When writing the entry, the harvest keeps a proposed path only
   when it is in the PR's list **and** exists in the tree the harvest reads. It writes the kept paths as
   `Enforced by: <a>, <b>`, or `Enforced by: unenforced` when none is kept, as today. A dropped path is
   reported in the harvest's output with its reason (`not changed by #<pr>`, `no longer in the tree`).
4. **A person still confirms.** The entry keeps its `Proposed: harvest <date>` line: it floors nothing until
   a person confirms it, the same as today. Confirming it confirms the link.
5. **`omni status` shows the count.** When the repository has a knowledge folder, one line under the
   delivered bar: `rules enforced  <e> of <t>`, `<t>` being every rule and invariant in the registers,
   proposed ones included, and `<e>` those whose `Enforced by:` names a path. Principles are left out: a
   principle is judged, not proven.

## Decisions

Taken in the brainstorm on 2026-10-07 with the person who asked for this PRD.

- **Only the harvest changes.** `/omni:invade` already links rules to tests, `omni check knowledge` already
  refuses a missing path, and the `law-proof` rule of PRD 1044 already guards the proving files. The PRD
  fills the one gap that leaves every delivered rule unenforced.
- **The model proposes, code verifies.** Kept: a path the feature PR changed that still exists. No check of
  the file's name: the kit runs in any stack, and `tests/Quote/ExpiryTest.php` or a migration's constraint
  proves a rule as well as a `*.test.ts` file does.
- **The link waits for a person,** through the `Proposed:` line every harvested entry already carries. No new
  approval step.
- **The count is shown, not gated.** No floor on how many rules must be enforced: a gap stays honest.
- **This repository's own `laws.source` stays out of scope.** It is `none` here, so `law-proof` never fires
  in this repository; switching it to `knowledge` is a one-line config change of its own.
- **The voice.** B-E DEv objected that a harvest guessing which test proves a rule gives links nobody can
  trust (persona:B-E DEv). Settled `accepted`: only a path the PR changed and that still exists is kept,
  and a person confirms the entry.
- **No proof video:** nothing in a browser changes.

## User stories

1. As a lead engineer, after a feature PR merges, the knowledge PR the harvest opens shows each new rule
   with the test from that PR that proves it, so I confirm the rule and its proof together.
2. As an agent building a later PRD, when my change touches a test that proves a confirmed rule, the
   outbox gate shows it to a person (PRD 1044's `law-proof`), because the harvest named that test.
3. As a product manager, `omni status` tells me how many of the repository's rules are proven by a test.
4. As a team adopting the kit, none of this needs configuration: it works in any stack, from the files the
   feature PR changed.

## Scope

In:

- Reading the feature PR's changed files in `omni harvest` and in the app's `knowledge-harvest`, and
  passing them to the pipeline.
- The classifier's prompt and schema: an optional `enforcedBy` on `rule` and `invariant`.
- The writer: keep, drop and report proposed paths; write `Enforced by:`.
- The `rules enforced` line in `omni status`.

Out:

- The `law-proof` guard, `omni check knowledge` and `/omni:invade`: unchanged.
- Back-filling the 60 entries already written here: a later harvest or a person fills them.
- The plan repository's harvest for a multi-repository PRD: its feature PR changes documents, and the tests
  live in the targets.
- Any gate or floor on the count.

## Test seams

- **The writer, pure** (`kit/lib/knowledge/write.test.ts`): a reply proposing a path that is in the PR's
  list and in the tree writes it; two kept paths are written comma-separated; a path not in the list, a path
  in the list but gone from the tree, and a removed path are each dropped with their reason; no kept path
  writes `unenforced`; a principle never gets the line.
- **The schema** (`kit/lib/knowledge/classify.test.ts`): `enforcedBy` is accepted on `rule` and
  `invariant`, refused on `adr`, `covered` and `stays-here`; more than three paths, or an empty one, is
  refused; the prompt lists the changed paths and says when to omit the field.
- **The pipeline** (`kit/lib/knowledge/pipeline.test.ts`): a harvest given a list of changed files and a
  stubbed classification writes an entry whose `Enforced by:` passes `omni check knowledge`.
- **The callers:** `omni harvest` against a stubbed `gh`, reading two pages of files and dropping a removed
  one (`kit/bin/harvest.test.ts`); the app's function against its stubbed GitHub
  (`apps/omni-app/src/knowledge-harvest/`).
- **The count** (`kit/bin/status.test.ts`, on `makeRepo()`): a knowledge folder with three rules, one
  enforced, prints `rules enforced  1 of 3`; a principle is not counted; no knowledge folder prints no line.

## Risks

A merge publishes the kit: `kit/dist/omni.mjs` and the plugin, and the app's harvest on its next deploy.
Nothing touches the database.

- **A wrong link:** the model names a changed file that does not prove the rule. Contained: the entry stays
  proposed until a person confirms it, and `law-proof` only floors a confirmed entry.
- **A large feature PR:** its file list makes the prompt longer. The list is paths only.
- **Rollback:** revert the feature PR. The harvest writes `unenforced` again, and the entries already
  written keep their paths, which `omni check knowledge` still checks.

## Acceptance criteria

1. After a feature PR that adds `kit/lib/foo.test.ts` merges, a harvested rule whose statement that test
   proves carries `Enforced by: kit/lib/foo.test.ts`.
2. A proposed path the feature PR did not change, or that no longer exists, is never written, and the
   harvest's output names it with its reason.
3. A rule with no proving file in the PR is written `Enforced by: unenforced`, as today.
4. Every harvested entry still carries its `Proposed:` line, and `omni check knowledge` passes on the
   harvest's result.
5. `omni harvest` and the app's `knowledge-harvest` write the same `Enforced by:` lines for the same PR and
   the same classification.
6. `omni status` prints `rules enforced  <e> of <t>` when a knowledge folder exists, counting rules and
   invariants only, and prints no such line without one.
