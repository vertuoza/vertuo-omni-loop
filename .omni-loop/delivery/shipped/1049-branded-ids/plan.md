# Plan: Branded IDs

PRD #1049, specified in `spec.md` beside this plan. Built on the feature branch `feat/branded-ids` into
`main` (the feature PR says `Closes #1049`), from sub-PRs on `feat/branded-ids--<slice>` into the feature
branch (each says `Part of #1049`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `kit/lib/ids.ts` exports `IssueNumber`, `PrdNumber`, `PrNumber`, `CommentId`, `SliceId` and `OutboxItemId`, each a zod brand with its schema and `parse…` function, with value and type tests; nothing uses them yet | `kit/lib/ids` | — | 1 |
| s2 | The GitHub App takes brands: its zod schemas for GitHub payloads and stored rows brand their ID fields, and every ID-named parameter and field in `apps/omni-app` takes its brand | `apps/omni-app/` | s1 | 2 |
| s3 | The arcade takes brands: its row schemas, route params (parsed at the route) and every ID-named parameter and field in `apps/galaxy` | `apps/galaxy/` | s1 | 2 |
| s4 | The game, the shared packages and the scripts take brands: every ID-named parameter, field and schema in `game/`, `packages/` and `scripts/` | `game/` `packages/` `scripts/` | s3 | 3 |
| s5 | The kit takes brands: its entry parsers (argv, the PRD folder name, the plan table, outbox front matter, GitHub schemas) return them, every ID-named parameter and field takes them, the loose `PrdNumber` alias (a number or a string) is gone, the folder regex exists once, and the bundle is rebuilt | `kit/` `.omni-loop/bin/` `apps/` `game/` `packages/` `scripts/` | s2, s3, s4 | 4 |
| s6 | `scripts/id-types-guard.test.ts` refuses an ID-named parameter, property, variable or zod field declared bare on every source file, with fixture tests; a decision record and the `conventions` form tell agents the rule | `scripts/` `.omni-loop/knowledge/adr/` `.omni-loop/knowledge/playbook/conventions.md` `kit/` `apps/` `game/` `packages/` | s5 | 5 |

**Shared ground.** The order is the dependency order, callers first: the arcade (s3) calls the shared
packages and the game (s4), and everything calls the kit (s5). A branded value fits where a bare one is
expected, so each slice compiles alone. `apps/`, `game/`, `packages/` and `scripts/` are also s5's,
because tightening the kit's signatures may leave call sites to fix there, and s6's, because the guard may find a leftover anywhere; s5 and s6 are waves 4 and 5,
alone. `kit/lib/ids` is s1's and inside s5's `kit/`: waves 1 and 4. 

## Per slice: done when

**s1**

- `kit/lib/ids.ts` exports the six brands, a schema for each, and `parseIssue`, `parsePrd`, `parsePr`,
  `parseCommentId`, `parseSliceId` and `parseOutboxItemId`; a refusal throws the repository's parse error
  naming the value.
- `kit/lib/ids.test.ts` proves each parser accepts its valid forms and refuses 0, negatives, non-integers,
  `"12a"`, `s`, `S1` and an item id with no slug, and that the numeric parsers accept every digit string
  `positiveInt` (`kit/bin/args.ts`) accepts.
- Type tests (`expectTypeOf`, `// @ts-expect-error`): a `PrNumber` does not fit a `PrdNumber`; a
  `PrdNumber` fits an `IssueNumber`, not the reverse; a plain `number` or `string` fits none.
- No cast in `ids.ts`; `pnpm typecheck` and `pnpm typecheck:tsc` pass.

**s2, s3, s4** (each in its own territory)

- Every parameter, property, variable and zod field named `prd`, `prdNumber`, `pr`, `prNumber`, `issue`,
  `issueNumber`, `commentId`, `slice`, `sliceId`, `itemId` or `outboxItemId` takes its brand, as s6's
  guard will require; GitHub payload fields named `number` are branded by what they hold.
- Where an ID enters (a payload, a stored row, a route, a file), it is parsed there. Where a callee not yet
  migrated returns a bare value, the caller parses it, and the sub-PR lists those spots for s5 to remove.
- The sub-PR lists every call site the brands changed for a reason other than a rename.
- s3: `pnpm schemas:verify --local` parses real rows with the branded schemas.
- Tests change only where they build values (through the `parse…` functions); the full suite, both
  typechecks, lint on the changed files and the fallow audit pass (`pnpm check:changed`, then the full
  `pnpm test` and `pnpm lint` once).

**s5**

- `kit/bin/args.ts` reads each kind with its own reader; the PRD folder regex lives once, in
  `kit/lib/layout.ts`, returning a `PrdNumber`, and `kit/lib/ask/context.ts` and `heartbeat.ts` call it;
  `parsePlanSlices` gives `SliceId`s; outbox front matter gives an `OutboxItemId`.
- `PrdNumber = number | string` no longer exists; every ID-named parameter and field in `kit/` takes its
  brand; the issue-comment calls take `IssueNumber | PrNumber`; `dossier push` for a fix takes
  `PrdNumber | IssueNumber`, with the reason beside it.
- The temporary parses s2 to s4 listed are removed where the kit now returns brands.
- The kit bundle is rebuilt (`kit/dist/`, `.omni-loop/bin/`), its dist test passes, and the CLI prints
  the same output on the fixture repositories (the existing command tests pass unchanged but for how
  they build values).

**s6**

- `scripts/id-types-guard.test.ts` walks every source file (tests and generated files exempt, as the
  no-`as` guard does) and fails on an ID-named parameter, property, variable or zod field declared as a
  bare `number`, `string` or `number | string`, naming the file, line and name; no allowlist, no comment
  escape.
- Its fixture tests flag `prd: number`, `slice: string` and `pr: z.number()`, and pass their branded forms
  and a field named `number`.
- It passes on the whole tree; any leftover it finds is fixed in code.
- A decision record under `.omni-loop/knowledge/adr/` and `omni kb show conventions` say: an ID is parsed
  into its brand where it enters, and never declared bare.
- `pnpm typecheck`, `pnpm typecheck:tsc`, `pnpm test`, `pnpm lint` (0 findings), the fallow audit and
  `omni check all` pass.
