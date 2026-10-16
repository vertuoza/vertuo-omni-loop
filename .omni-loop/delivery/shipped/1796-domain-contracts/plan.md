# Plan: Domain contracts as pointer entries

PRD #1796, the spec beside this plan (`spec.md`). The feature branch `feat/domain-contracts` goes
into `main` with `Closes #1796`; each slice is a sub-PR from `feat/domain-contracts--<slice>` into
the feature branch with `Part of #1796`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | a `## DC-<CODE>-<n>` entry in `product/contracts.md` or `domains/<name>/contracts.md` is read as a contract with its `Points to:` paths, `omni check knowledge` checks it and counts it, a folder without `contracts.md` stays green, `omni kb laws` prints no contract, and this repository's `product/contracts.md` holds `DC-PRODUCT-1` | `kit/lib/knowledge/registers` `kit/lib/knowledge/check-knowledge` `kit/lib/knowledge/write` `kit/lib/knowledge/graph` `kit/lib/codeowners-laws` `kit/lib/playbook/write-forms` `kit/bin/kb.test.ts` `.omni-loop/knowledge/product/contracts.md` | — | 1 |
| s2 | a pull request that changes a `contracts.md` file fires `law-text`, a change to a pointed file alone fires nothing new, and the bug-fix and visual-fix skills' tables word `law-text` to name a contract | `kit/lib/outbox/decision-coverage` `kit/plugin/skills/bug-fix/SKILL.md` `kit/plugin/skills/visual-fix/SKILL.md` | — | 1 |
| s3 | `omni knowledge DC-<CODE>-<n>` prints a contract with its `Points to:` line, the registers' README and its template name the fourth kind, and invade's list of layer files names `contracts.md` as optional | `kit/lib/knowledge/describe` `kit/bin/commands/knowledge.ts` `kit/templates/README.md` `.omni-loop/knowledge/README.md` `kit/plugin/skills/invade/SKILL.md` | s1 | 2 |

**Shared ground.** None: no prefix is declared by two slices. s1 and s2 share wave 1 and touch
disjoint files: `law-text` matches a path, so it needs nothing from the parser. s3 prints what s1
parses, so it waits for s1 in wave 2. `kit/dist/` and `apps/omni-app/api/` are generated: each
slice rebuilds them to test and commits none; the wave rebuilds them once after merging.

## Per slice: done when

**s1**
- `kit/lib/knowledge/registers.test.ts`: `contracts.md` is read in `product/` and in a domain
  folder; a `## DC-…` heading is an entry of kind `contract`; `Points to:` is parsed into its
  comma-separated paths; `readRegisters` returns `contracts`; a folder without `contracts.md` reads
  exactly as before.
- `kit/lib/knowledge/check-knowledge.test.ts`: a valid contract passes; each refusal fires once,
  naming the contract (and the path where there is one): a missing `Points to:`, a path that does not
  exist, a directory, a glob, a missing `Source:` or `Stated:`, an `Enforced by:`, a `Locked:`, a
  `Proposed law:`, a `Governs:` (with the reason the spec gives), a `BR-` id in `contracts.md`, a
  `DC-` id with another folder's code; an imported copy (`ctx.copyOf`) skips the path check; a
  folder without `contracts.md` raises no violation; a `DC-` id in a cross-domain file is refused.
- The summary line reads `check knowledge — <p> principle(s), <r> rule(s), <i> invariant(s),
  <c> contract(s) across …`.
- `kit/bin/kb.test.ts` (through `makeRepo()`): `omni check knowledge` on a fixture with one contract
  prints the contract count and exits 0, then exits 1 naming the contract and the path once its
  pointed file is deleted; `omni kb laws`, with and without `--paths <pointed file>`, prints no
  contract.
- `isLaw`, `isConfirmedRule`, the harvest and the graph's `KINDS` leave contracts out; a new
  repository's knowledge scaffold (`write-forms`) writes no `contracts.md`.
- `.omni-loop/knowledge/product/contracts.md` holds `DC-PRODUCT-1` ("An outbox item has exactly one
  rank: human-action, high or medium."), pointing to `kit/lib/schema/front-matter.ts`, with its
  `Source: PRD 1796` and `Stated:` lines, and `node .omni-loop/bin/omni.mjs check knowledge` is green
  on the slice branch, counting 1 contract.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` are green.

**s2** (`law: BR-PRODUCT-6 · owner @pierrederval`) (`law: N-PRODUCT-3 · owner @pierrederval`) (`law: N-PRODUCT-14 · owner @pierrederval`)
If these laws break, a risky change nobody explained, a badly ranked question or a rule that lost its
test reaches `main` unseen; widening `law-text` changes none of their text or tests, but the feature
PR waits for @pierrederval's approval on GitHub.
- `kit/lib/outbox/decision-coverage.test.ts`: `law-text` fires on `product/contracts.md` and on
  `domains/<d>/contracts.md`, and on no other new path; a change to a pointed schema file alone fires
  no rule it did not fire before.
- An outbox check on a fixture pull request that changes `contracts.md` stays red until a high item
  covers it.
- The `law-text` rows of the bug-fix and visual-fix skills' tables say it covers a contract too.
- `pnpm mutation:changed` on `kit/lib/outbox/decision-coverage.ts` holds its floor.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` are green.

**s3**
- `kit/lib/knowledge/describe.test.ts`: a contract prints its statement and its `Points to:` line.
- `omni knowledge DC-PRODUCT-1` in this repository prints the contract with
  `Points to: kit/lib/schema/front-matter.ts`.
- `.omni-loop/knowledge/README.md` and `kit/templates/README.md` name the fourth kind, the domain
  contract in an optional `contracts.md`, in one line each.
- `kit/plugin/skills/invade/SKILL.md` lists `contracts.md` among the layer files as optional, and
  says invade writes no contract.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` are green.
