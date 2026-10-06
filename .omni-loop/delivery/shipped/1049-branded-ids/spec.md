---
prd: 1049
title: Branded IDs
blocked-by: none
spec: file
---

# Branded IDs

**Date:** 2026-10-03 · **PRD:** #1049 · **Follows:** PRDs 1023 (the last compiler flags), 1030 (no escape
hatches) and 1042 (a feedback loop in seconds) · **Touches:** a new `kit/lib/ids.ts`, the ID-typed
parameters, fields and zod schemas of `kit/`, `apps/omni-app`, `apps/galaxy`, `game/`, `packages/` and
`scripts/`, and a new guard test · **Out of scope:** branch names, the environment variables (their own
PRD next), any behaviour.

## Problem

AI agents build this repository, and they pass identifiers around all day: PRD numbers, pull request
numbers, issue numbers, comment ids, slice ids, outbox item ids. Every one of them is a bare `number` or
`string` today. Measured on `main` on 2026-10-03:

- About 230 parameters named `prd`, about 120 named `number`, and dozens of `pr`, `prNumber`, `issue`,
  `slice` and `commentId`, all bare, across the kit, the GitHub App, the arcade and the game; about 155
  zod schema fields hold IDs the same way.
- The one alias, `PrdNumber` in `kit/lib/layout.ts`, is `number | string`: looser than `number`, not
  stricter.
- Nothing checks a slice id's shape (`s1`) or an outbox item id's (`s1-01-…`) when it is read; the folder
  name regex exists three times, two of them weaker.

So a pull request number passed where a PRD number belongs compiles and runs, and fails somewhere far
away, on the wrong issue or the wrong folder. Some sharing is real and right: a PRD number is its issue's
number, and GitHub's issue-comment API takes pull request numbers (four calls pass one as `issue`). Today
nothing tells the deliberate cases from a mistake.

## Solution

1. **`kit/lib/ids.ts`**, importable by every package as `kit/lib/narrow.ts` already is, holds one zod
   brand per kind, its schema (for use inside other schemas) and a `parse…` function for a plain value:

   | brand | schema | accepts |
   |---|---|---|
   | `IssueNumber` | `z.number().int().positive().brand<'IssueNumber'>()` | a positive integer |
   | `PrdNumber` | `IssueNumber`'s schema `.brand<'PrdNumber'>()` | a positive integer; also an `IssueNumber` |
   | `PrNumber` | its own brand | a positive integer |
   | `CommentId` | its own brand | a positive integer |
   | `SliceId` | `z.string().regex(/^s\d+$/)` | `s1`, `s12` |
   | `OutboxItemId` | `z.string().regex(/^s\d+-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/)` | `s1-01-untracked-files-not-linted` |

   A `PrdNumber` fits where an `IssueNumber` is expected; nothing else fits anywhere but its own kind.
   The numeric `parse…` functions also take the digit strings `positiveInt` in `kit/bin/args.ts` accepts
   today. A brand is made only by parsing: no cast, so the no-`as` guard stays as it is.
2. **Parse where IDs enter.** `kit/bin/args.ts` gets one argument reader per kind; the PRD folder regex in
   `kit/lib/layout.ts` returns a `PrdNumber`, and the two weaker copies in `kit/lib/ask/` call it; the
   plan table gives `SliceId`s; outbox front matter gives an `OutboxItemId`; the zod schemas for GitHub
   payloads and Supabase rows brand their ID fields; the arcade parses a route's PRD number at the route.
3. **Every ID-named parameter and field takes its brand** in `kit/`, `apps/omni-app`, `apps/galaxy`,
   `game/`, `packages/` and `scripts/`. The loose `PrdNumber = number | string` is replaced. The
   issue-comment calls take `IssueNumber | PrNumber`, so the four that pass a pull request say so; a fix's
   dossier, keyed by its issue (`kit/bin/commands/dossier.ts`), takes `PrdNumber | IssueNumber`, with the
   reason beside it.
4. **The guard,** `scripts/id-types-guard.test.ts`, an AST walk over every source file (tests exempt) like
   the no-`as` guard, refuses:
   - a parameter, property or variable named `prd`, `prdNumber`, `pr`, `prNumber`, `issue`,
     `issueNumber`, `commentId`, `slice`, `sliceId`, `itemId` or `outboxItemId` whose declared type is a
     bare `number`, `string` or `number | string`;
   - a zod object field of one of those names whose schema is a plain `z.number()` or `z.string()` chain.
   No allowlist, no comment escape.
5. **Agents are told:** a decision record and the playbook's `conventions` form say an ID is parsed into
   its brand where it enters, and never declared bare.

Runtime behaviour, stored data, wire formats and the kit's command output do not change: a branded value
is the same number or string at run time.

## Decisions

Taken in the brainstorm on 2026-10-03 with the person who asked for this PRD.

- **Split from the parsed environment.** Asked for as "branded IDs + parsed env"; they share no code, so
  the environment is its own PRD, after this one.
- **Kinds:** the four numbers plus slice and item ids. Branch names stay strings.
- **Reach: everywhere, with a guard** (approach A), over B (kit and the GitHub App first) and C (brands at
  the parsers only, opt-in): without the guard, agents drift back to bare types.
- **Callers first, the kit last.** A branded value is still a number or string, so the packages that call
  the kit adopt brands first and the kit tightens last; every slice compiles alone.
- **The bare field name `number` is not policed by name:** in GitHub payloads it means an issue or a pull
  request. The GitHub schemas brand it anyway.
- **zod brands,** over hand-written type predicates: zod is already how this repository reads data from
  outside (ADR-0054), and a brand needs no cast.
- **No proof video:** nothing visible changes.
- **The voice.** F-E Developer objected that hundreds of signatures change for a bug nobody has hit, and
  that every arcade page reading a PRD number from its URL must now parse it. Settled `none`: the person
  approved the design as shown.

## User stories

1. As an agent, when I pass a pull request number where a PRD number belongs, the compiler refuses it and
   names both kinds.
2. As an agent, when I write a new function taking a PRD number, the guard refuses `prd: number` and
   points me to `PrdNumber`.
3. As an agent reading a plan or an outbox file, a malformed slice or item id fails where it is read, not
   three calls later.
4. As a reviewer, the calls that pass one kind as another on purpose (a pull request to the issue-comment
   API, an issue as a fix's dossier) say so in their types.

## Scope

In:

- `kit/lib/ids.ts` and its tests, type tests included.
- The ID-typed parameters, fields and schemas of `kit/`, `apps/omni-app`, `apps/galaxy`, `game/`,
  `packages/` and `scripts/`, and their entry parsers.
- `scripts/id-types-guard.test.ts`.
- A decision record and the `conventions` form.

Out:

- Branch names, and the bare field name `number` in the guard.
- The environment variables (the next PRD).
- Any change to behaviour, output, stored data or the database schema.

## Test seams

- **`ids.ts`:** each `parse…` accepts the valid forms and refuses 0, negatives, non-integers, `"12a"`,
  `s`, `S1` and an item id with no slug; the numeric ones accept every digit string `positiveInt` accepts.
- **Types** (vitest `expectTypeOf` and `// @ts-expect-error` in a test file): a `PrNumber` does not fit a
  `PrdNumber`; a `PrdNumber` fits an `IssueNumber`, not the reverse; a plain `number` fits none.
- **The guard,** on fixture sources: it flags `prd: number`, `slice: string` and `pr: z.number()`, and
  passes their branded forms and a field named `number`.
- **Unchanged behaviour:** the existing suite passes with test-side changes only (values made through the
  `parse…` functions); the kit bundle is rebuilt and its dist test passes; `pnpm schemas:verify --local`
  parses real rows with the branded schemas.
- Tests follow the repository's testing form: fixture repositories through `makeRepo()`, no network.

## Risks

Merging changes types across every package and rebuilds the kit's bundle (`kit/dist/`,
`.omni-loop/bin/omni.mjs`), which installed repositories pick up on their next update; its behaviour does
not change. A schema that now refuses a value it used to accept (a zero or a malformed id in stored data)
would fail loudly where it reads: `schemas:verify` checks the stored rows first. No migration runs.

**Rollback:** revert the feature PR. The guard can also be reverted alone, leaving the brands in place.

## Acceptance criteria

- `kit/lib/ids.ts` exports `IssueNumber`, `PrdNumber`, `PrNumber`, `CommentId`, `SliceId` and
  `OutboxItemId`, each with its schema and `parse…` function, and its tests pass.
- Passing a `PrNumber` where a `PrdNumber` is expected fails to compile; a `PrdNumber` where an
  `IssueNumber` is expected compiles.
- No source file declares an ID-named parameter, property, variable or zod field as a bare `number`,
  `string` or `number | string`, and the guard test proves it on every source file.
- `PrdNumber = number | string` no longer exists, and the PRD folder regex exists once.
- The kit's commands print the same output on the fixture repositories as before.
- `pnpm typecheck`, `pnpm typecheck:tsc`, `pnpm test`, `pnpm lint` (0 findings), the fallow audit and
  `pnpm schemas:verify --local` pass.
- `omni kb show conventions` tells agents to parse IDs into their brands where they enter.
