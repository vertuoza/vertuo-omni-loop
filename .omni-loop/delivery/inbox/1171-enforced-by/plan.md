# Plan: the harvest links each new rule to the test that proves it

PRD #1171, specified in `spec.md` beside this plan. The feature branch `feat/enforced-by` merges into
`main` through the feature PR (`Closes #1171`); each slice is a sub-PR from `feat/enforced-by--<slice>`
into the feature branch (`Part of #1171`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `omni harvest` reads the feature PR's changed files, the classifier proposes `enforcedBy` on a rule or an invariant, and the writer keeps only a changed path that still exists, writing `Enforced by:` and reporting each dropped path with its reason | `kit/lib/knowledge/classify` `kit/lib/knowledge/write` `kit/lib/knowledge/pipeline` `kit/bin/commands/harvest.ts` `kit/bin/harvest.test.ts` `kit/bin/github` `kit/dist/omni.mjs` | — | 1 |
| s2 | the app's `knowledge-harvest` function reads the merged PR's changed files through its GitHub client and passes them to the pipeline, so it writes the same `Enforced by:` lines as `omni harvest` | `apps/omni-app/src/knowledge-harvest/` | s1 | 2 |
| s3 | `omni status` prints `rules enforced  <e> of <t>` when a knowledge folder exists, counting rules and invariants only | `kit/lib/status/` `kit/bin/commands/status.ts` `kit/bin/status.test.ts` `kit/dist/omni.mjs` | — | 2 |

**Shared ground.** `kit/dist/omni.mjs` is the committed bundle of the kit's source (`pnpm kit:build`,
checked by `kit/test/dist.test.ts`): s1 and s3 both change the kit's source, so both rebuild and commit
it. s3 moves to wave 2 so it rebuilds on top of s1's bundle. s2 changes only the app, which imports
`kit/lib` from source, so it never touches the bundle.

## Per slice: done when

**s1**

- `classificationSchema` accepts `enforcedBy`, one to three non-empty paths, on `rule` and `invariant`,
  and refuses it on `adr`, `covered` and `stays-here` (`kit/lib/knowledge/classify.test.ts`).
- The prompt lists the feature PR's changed paths and says to omit `enforcedBy` when none proves the
  statement.
- `prepareHarvest` takes the changed files as data; `kit/lib` makes no network call.
- The writer writes a kept path (two comma-separated when two are kept), drops a path the PR did not
  change, a removed path and a path gone from the tree, each with its reason, and writes
  `Enforced by: unenforced` when none is kept; a principle never gets the line
  (`kit/lib/knowledge/write.test.ts`).
- A harvest given changed files and a stubbed classification writes an entry that passes
  `omni check knowledge`, its `Proposed:` line kept (`kit/lib/knowledge/pipeline.test.ts`).
- `omni harvest` against a stubbed `gh` reads two pages of the PR's files, drops a removed one, and its
  output names each entry's `Enforced by:` and each dropped path (`kit/bin/harvest.test.ts`).
- `kit/dist/omni.mjs` is rebuilt and `kit/test/dist.test.ts` passes.

**s2**

- The function reads every page of the merged PR's files through its GitHub client, keeps added,
  modified and renamed paths, and passes them to the pipeline.
- Against its stubbed GitHub, the same PR and the same classification give the same `Enforced by:`
  lines as `omni harvest` (`apps/omni-app/src/knowledge-harvest/knowledge-harvest.test.ts`).

**s3**

- On `makeRepo()`, a knowledge folder with three rules, one with an `Enforced by:` path, prints
  `rules enforced  1 of 3`; proposed entries count; a principle does not (`kit/bin/status.test.ts`).
- Without a knowledge folder, `omni status` prints no such line.
- `kit/dist/omni.mjs` is rebuilt and `kit/test/dist.test.ts` passes.
