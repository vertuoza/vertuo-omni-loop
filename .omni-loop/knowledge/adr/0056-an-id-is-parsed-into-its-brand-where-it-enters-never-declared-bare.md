# ADR-0056 — An ID is parsed into its brand where it enters, and never declared bare

**Status:** accepted · **Date:** 2026-10-03 · **PRD:** #1049

## Context

AI agents build this repository and pass identifiers around all day: PRD numbers, pull request
numbers, issue numbers, comment ids, slice ids and outbox item ids. Each was a bare `number` or
`string`, so a pull request number passed where a PRD number belongs compiled, ran, and failed far
away, on the wrong issue or the wrong folder. PRD 1049 gave each kind a zod brand in
`kit/lib/ids.ts` and moved every package onto them. Without a guard, the next agent writes
`prd: number` again.

## Decision

1. **One brand per kind,** in `kit/lib/ids.ts`: `IssueNumber`, `PrdNumber` (which fits where an
   `IssueNumber` is expected), `PrNumber`, `CommentId`, `SliceId` (which fits where a `WorkSliceId`
   is expected) and `OutboxItemId`, each with its schema and a `parse…` function. A brand is made
   only by parsing, never by a cast.
2. **Parse where the ID enters:** an argument, a folder name, a plan table, front matter, a GitHub
   payload, a stored row, a route. Past that point the brand travels; nothing re-parses it.
3. **Never declare one bare.** `scripts/id-types-guard.test.ts` reads every source file (tests and
   generated files exempt, as the no-`as` guard chooses them) and fails on a parameter, a property
   (an interface or type-literal member, a class field) or a variable named `prd`, `prdNumber`,
   `pr`, `prNumber`, `issue`, `issueNumber`, `commentId`, `slice`, `sliceId`, `itemId` or
   `outboxItemId` declared as a bare `number`, `string` or `number | string`, and on a zod object
   field of such a name whose schema is a plain `z.number()` or `z.string()` chain that never
   reaches `brand`, `pipe` or `transform`. It names the file, the line and the name.
4. **`number | null` and `string | undefined` are still bare:** an ID that may be absent is a
   branded ID that may be absent, `PrdNumber | null`.
5. **No allowlist, no comment escape.** A name on the list that holds something else is renamed
   after what it holds (`sliceLabel`, `product`), or typed from where its value comes from.
6. **A public config key keeps its name.** `branches.slice` holds a branch template and
   `labels.prd` a label's name; users' `.omni-loop/config.yml` files carry those keys, so renaming
   them would break installed repositories. Their schemas in `kit/lib/config.ts` are named by what
   they hold (`branchTemplate`, `labelName`), and every view of them in the kit and the arcade is
   typed from `Config` (`Pick<Config['branches'], …>`), so no declaration writes them bare. The
   same holds for the `slice` key of `omni decide outbox-risk`'s state file, which the skills write:
   the file keeps the key, and the arcade reads it as `sliceLabel`.
7. **The field name `number` is not policed:** in a GitHub payload it is an issue or a pull request,
   and the GitHub schemas brand it by what it holds.

## Consequences

- A pull request number passed as a PRD number is a compile error naming both kinds.
- A new ID-named parameter written bare fails `pnpm test` with the file, line and name.
- The guard reads declared annotations and plain zod chains only: a value typed by inference, or a
  zod field built from a named schema, is not read. Such a schema is a declaration of its own, and
  review is where a named bare schema for an ID is caught.
- A seventh kind of ID needs a brand in `kit/lib/ids.ts` and its names on the guard's list.
