---
prd: 1796
title: Domain contracts as pointer entries
blocked-by: none
spec: file
---

## Problem

The knowledge registers say what the product decides (principles), what may or may not happen
(rules) and what must hold in the code (invariants). They have no place for the shape of the
domain itself: which entities exist, how they relate, and which states each one moves through.

That shape is real and already enforced, by a schema or a type in the code. But nothing in the
knowledge base says it in one plain line, or says which file holds it. A newcomer reads code to
learn that "an invoice moves Draft → Sent → Partially paid → Paid". An agent does the same, or
guesses.

The kinds of entry are a closed set today. `EntryKind` is `'principle' | 'rule' | 'invariant'`
(`kit/lib/knowledge/registers.ts:57`), `LAYER_FILES` maps only `principles.md`, `rules.md` and
`invariants.md` (`registers.ts:124`), and `ID_SOURCE` knows only `X-`, `BR-`, `P-`, `N-` and `N<n>`
ids (`registers.ts:131`). A file named `contracts.md` in a register folder is never read, and a
`## DC-…` heading in a known file is not an entry: the parser treats it as an unknown heading and
skips its body. Writing a contract today is possible only as prose nothing checks, and that prose
goes stale silently when the schema file moves.

## Solution

A fourth kind of entry, the **domain contract**.

- **Id:** `DC-<CODE>-<n>`, `<CODE>` the folder's code exactly as for the other kinds
  (`DC-PRODUCT-1` in `product/`, `DC-INVOICING-1` in `domains/invoicing/`).
- **Where:** a new layer file, `contracts.md`, in `product/` and in each `domains/<name>/` folder.
  The file is optional: a folder without it is not a violation, so every repository stays green.
  `LAYER_FILES` gains `'contracts.md': 'contract'`.
- **What it holds:** one statement, one or two plain sentences on an entity's structure or
  lifecycle, and a `Points to:` line naming the schema or type file(s) that enforce it.

```
## DC-INVOICING-1

An invoice moves Draft → Sent → Partially paid → Paid, or is offset by a credit note.
A project has many invoices.

Points to: src/invoicing/invoice-status.ts, src/invoicing/invoice.schema.ts
Source: PRD 412
Stated: 2026-10-13
```

**A pointer, never a second copy.** The statement says what a person needs in one reading; the
pointed file holds the truth. A contract never lists fields, and nothing asks it to.

**What `omni check knowledge` checks on a contract** (`kit/lib/knowledge/check-knowledge.ts`):

- a statement, a `Source:` line that leads somewhere, and a `Stated: YYYY-MM-DD` line, as for a rule;
- a `Points to:` line, naming one or more comma-separated repository paths;
- each `Points to:` path is a file that exists in the tree. A missing path, a directory or a
  glob is refused, naming the contract and the path. An imported copy (`ctx.copyOf`, PRD 522) is
  not asked, as for `Enforced by:` today;
- the id is a `DC-` id carrying its folder's code (or a `Kept id:` line);
- no `Enforced by:`, `Locked:`, `Proposed law:` or `Governs:` line (see Decisions).
  `Serves:` is optional and, when present, checked as an invariant's is.

The check's summary line counts contracts beside the other kinds:
`check knowledge — 81 principle(s), 96 rule(s), 12 invariant(s), 1 contract(s) across …`.

**The gate.** `law-text` (`kit/lib/outbox/decision-coverage.ts`, `isLawText`) fires today on a
change to `principles.md`, `rules.md` or `invariants.md`. It fires on `contracts.md` too: adding,
rewording or removing a contract needs a high outbox item any person answers, exactly as a rule
does. A change to a pointed file does not fire anything by itself. If the change deletes or moves
that file, `omni check knowledge` goes red until the contract's `Points to:` is fixed, and that edit
to `contracts.md` fires `law-text`.

**Where the new kind shows.**

- `readRegisters` returns `contracts` beside `principles`, `rules` and `invariants`.
- `omni knowledge <id>` prints a contract with its `Points to:` line (`kit/lib/knowledge/describe.ts`).
- The registers' README (`.omni-loop/knowledge/README.md` and the template `kit/templates/README.md`)
  names the fourth kind in one line.
- `/omni:invade`'s list of layer files (`kit/plugin/skills/invade/SKILL.md`) names `contracts.md`
  as optional. Invade writes no contract.
- Every place that acts on rules and invariants only (`omni kb laws`, `isLaw`, `isConfirmedRule`,
  the harvest, the knowledge graph's `KINDS` in `kit/lib/knowledge/graph.ts:75`) leaves contracts
  out, unchanged.

**This repository's first contract.** `product/contracts.md` gains `DC-PRODUCT-1`: "An outbox item
has exactly one rank: human-action, high or medium.", pointing to `kit/lib/schema/front-matter.ts`.
It proves the kind end to end, in the repository that builds it.

## Decisions

- **Domain contracts stay in the repository, in its registers,** because they point at its schema.
  Legal and Glossary live per product on the Omni page (P3, #1795); contracts do not.
- **A domain contract is a pointer entry.** Its `Points to:` names the file that enforces it; the
  entry never copies the schema, and no field-by-field prose is required.
- **A contract carries no `Governs:` line.** Its `Points to:` already names the files it is about,
  and `omni kb laws --paths` stays a list of rules and laws. This is the most reversible choice: a
  later PRD can allow the line without breaking a single entry, while allowing it now and removing
  it later would. `omni check knowledge` refuses a `Governs:` on a contract with that reason.
- **A contract is never a law.** It carries no `Locked:`, `Proposed law:` or `Enforced by:` line.
  The schema it points to is its enforcement; a lock belongs on a rule or an invariant (PRD 1726).
- **Editing a contract's text is risky; changing its pointed file is not, by itself.** A change to
  `contracts.md` fires the existing `law-text` rule and needs a high item any person answers,
  consistent with rules. No new rule id is added. A change to a pointed file fires nothing new; a
  deleted or moved pointed file turns `omni check knowledge` red, which forces the contract edit
  and so the high item.
- **`contracts.md` is optional** in every register folder. Its absence is never a layout violation.
- **Contracts live in `product/` and `domains/<name>/` only.** A cross-domain file holds rules and
  invariants, as today; a `DC-` id there is refused as "not an X- id" by the existing check.
- **A contract names no glossary term in this PRD.** Linking a contract to the glossary terms it
  uses waits for P3 (#1795) and the graph (P5, #1797).

## User stories

1. As a **developer new to a domain**, I read `contracts.md` and learn how its entities relate and
   move, in a few lines, with the file to open for the details.
2. As an **agent building a slice**, I find the schema that enforces a lifecycle through
   `omni knowledge DC-<CODE>-<n>`, instead of searching the code.
3. As a **maintainer who moves a schema file**, `omni check knowledge` tells me which contract
   now points nowhere, before the pull request is reviewed.
4. As a **person answering the outbox**, a reworded contract reaches me as a high item, as a
   reworded rule does.

## Scope

**In:**

- the `contract` kind, the `DC-<CODE>-<n>` id, the `contracts.md` layer file and the `Points to:`
  field, read by `kit/lib/knowledge/registers.ts`;
- the contract checks and the summary count in `kit/lib/knowledge/check-knowledge.ts`;
- `contracts.md` in the `law-text` rule of `kit/lib/outbox/decision-coverage.ts`, and the one-line
  wording of `law-text` in the bug-fix and visual-fix skills' tables;
- `omni knowledge <id>` printing a contract;
- the registers' README, its template, and invade's list of layer files;
- `DC-PRODUCT-1` in this repository's `product/contracts.md`;
- the rebuilt `kit/dist/omni.mjs` and `apps/omni-app/api/`.

**Out:**

- Legal entries and the glossary, and a contract naming its glossary terms: P3 (#1795).
- Walking contracts and their `Points to:` links as a graph: P5 (#1797) from the CLI, P6 (#1798)
  on the server.
- The briefing as a risky change: P1 (#1793).
- Escalating an unanswered owner: P2 (#1794).
- Invade drafting contracts from the code.
- Harvesting contracts from outbox items.
- Locking a contract, or a `Governs:` line on one.
- Checking that a statement matches its schema. The check proves the pointer resolves, not that the
  prose is right.
- Any screen change.

## Test seams

Following `omni kb show testing`: tests beside the code, on fixtures, never calling GitHub.

- `kit/lib/knowledge/registers.test.ts`: `contracts.md` is read in `product/` and in a domain
  folder; `DC-` ids are entry headings; `Points to:` is parsed into its paths; `readRegisters`
  returns `contracts`; a folder without `contracts.md` reads as before.
- `kit/lib/knowledge/check-knowledge.test.ts`: a valid contract passes; each refusal fires once,
  naming the contract: missing `Points to:`, a path that does not exist, a directory, a glob, a
  missing `Source:` or `Stated:`, an `Enforced by:`, a `Locked:`, a `Proposed law:`, a `Governs:`,
  a `BR-` id in `contracts.md`, a `DC-` id with another folder's code; an imported copy skips the
  path check; a folder without `contracts.md` is no violation.
- `kit/lib/outbox/decision-coverage.test.ts`: `law-text` fires on `product/contracts.md` and on
  `domains/<d>/contracts.md`, and on no other new path; a change to a pointed file alone fires
  nothing.
- `kit/lib/knowledge/describe.test.ts`: a contract prints its `Points to:` line.
- `kit/bin/kb.test.ts` through `makeRepo()`, where `omni check knowledge` is already exercised: `omni check knowledge`
  on a fixture with one contract prints the contract count, and exits 1 once its pointed file is
  deleted.
- `pnpm mutation:changed` on `kit/lib/outbox/decision-coverage.ts` (delivery core).

## Risks

- **What merging publishes.** The kit (`kit/dist/omni.mjs` and the plugin) and the Omni GitHub App
  (`apps/omni-app/api/`, which shares the kit's knowledge code). A repository that updates the kit
  sees no change until it writes a `contracts.md`. Once it does, edits to that file need a high
  item.
- **A schema move turns the knowledge check red.** This is the point, but it lands on whoever moves
  the file. The refusal names the contract and the path, so the fix is one line.
- **Code that assumes three kinds.** Some code types counts by kind (`countsOf` in
  `kit/lib/knowledge/graph.ts:110`) or prefixes by kind (`PREFIX_OF_KIND` in
  `check-knowledge.ts:112`). The typecheck finds each place once `EntryKind` grows.
- **Rollback.** Revert the merge. The previous kit does not read `contracts.md`, so contracts left
  in the registers become inert prose, and `law-text` stops firing on them.
- **The locked laws it touches.** The design changes `kit/lib/outbox/decision-coverage.ts`, which
  three locked laws govern:
  - BR-PRODUCT-6: a risky change nobody explained reaches the main branch, and the reviewer is never
    told. Changing it needs @pierrederval to approve the pull request on GitHub.
  - N-PRODUCT-3: a badly ranked question slips past, and the person who answers decides without the
    facts they need. Changing it needs @pierrederval to approve the pull request on GitHub.
  - N-PRODUCT-14: a rule quietly loses its test, and the team only learns it when the server refuses
    the pull request. Changing it needs @pierrederval to approve the pull request on GitHub.

  This PRD widens `law-text` and changes none of these laws' text or tests.

## Acceptance criteria

1. A `## DC-<CODE>-<n>` entry in `product/contracts.md` or `domains/<name>/contracts.md` is read as
   a contract, and `omni knowledge <id>` prints it with its `Points to:` line.
2. `omni check knowledge` passes on a contract whose `Points to:` names files that exist, and its
   summary line counts the contract.
3. `omni check knowledge` exits 1 and names the contract and the path when a `Points to:` path does
   not exist, is a directory or is a glob, or when the `Points to:` line is missing.
4. `omni check knowledge` refuses a contract that carries `Enforced by:`, `Locked:`,
   `Proposed law:` or `Governs:`, or whose id does not match its file and folder.
5. A register folder without `contracts.md` raises no violation; this repository's check stays
   green on everything it held before.
6. A pull request that changes a `contracts.md` file fires `law-text`, and its outbox check stays red
   until a high item covers it.
7. A pull request that changes only a pointed schema file fires no risky rule it did not fire
   before this PRD.
8. `omni kb laws`, with or without `--paths`, prints no contract.
9. This repository's `product/contracts.md` holds `DC-PRODUCT-1`, pointing to
   `kit/lib/schema/front-matter.ts`, and `omni check knowledge` passes on it.
