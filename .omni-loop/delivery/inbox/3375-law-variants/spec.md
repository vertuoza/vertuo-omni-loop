---
prd: 3375
title: A business law says for whom it plays out differently
blocked-by: none
spec: file
phase0: server
areas: [product-knowledge]
---

## Problem

A business law is a promise to every user of a product, and it stays one (team-platformengineering#1074). Yet the
product does not always deliver it the same way to everyone: a rollout group gets a feature behind a flag
before the others, new tenants start on a different screen, a session recorder loads for one group only. The
people and agents who read a law on the Omni page, or through `omni kb business-laws` and the knowledge MCP,
cannot see that: a law today is a statement, a `Why:` and an `Also:` line, and nothing else.

Vertuoza keeps this knowledge already, in `feature-flags/law-variants.json` of nimbus-automation-plan
(#1118): for its Expert+ pack, ten flags, each with the groups it is on for, what changes, the laws and Legal
entries it touches and how it was checked. That file sits outside the knowledge folder, so no pack carries it
and the Omni page never sees it (team-platformengineering#1092). And its shape is Vertuoza's own: the kit
serves every product, so it needs a general one.

## Solution

A product's **law variants** live in one JSON file of its law home's knowledge folder,
`<paths.knowledge>/product/law-variants.json`. A pack keeps every UTF-8 text file of that folder
(`apps/omni-app/src/knowledge-pack/files.ts`), so the file reaches the Omni page with no new upload path,
at the same commit as the laws it names. One pure kit module, `kit/lib/knowledge/law-variants.ts`, owns its
schema and parsing; every reader (the check, the CLI, the MCP, the page) goes through it, as every reader of a
law goes through `business-laws.ts`.

### The file (version 1)

```json
{
  "version": 1,
  "about": "What differs between user types in the Expert+ pack.",
  "staleAfterDays": 30,
  "audiences": [
    { "id": "INTERNAL", "label": "Internal" },
    { "id": "BETA", "label": "Beta" },
    { "id": "GENERAL", "label": "General" },
    { "id": "FINAL", "label": "Final" },
    { "id": "new-tenants", "label": "New tenants", "note": "tenants created after the flag was turned on" }
  ],
  "variants": [
    {
      "id": "remove-absences-sidebar-rh",
      "condition": { "kind": "flag", "key": "remove-absences-sidebar-rh" },
      "feature": "Where Absences are recorded",
      "on": "HR shows Time Entries only; Absences are recorded from the planning by person",
      "off": "HR also has an Absences planning (V1) where Absences are recorded",
      "audiences": { "INTERNAL": "on", "BETA": "off", "GENERAL": "off", "FINAL": "off", "new-tenants": "on" },
      "laws": ["BL-PLANNINGANDTIMETRACKING-1", "BL-PLANNINGANDTIMETRACKING-6"],
      "legal": [],
      "checked": { "how": "live", "on": "2026-11-27", "release": "v3.15.9", "note": null }
    }
  ]
}
```

| field | rule |
|---|---|
| `version` | `1` |
| `about` | optional; one line |
| `staleAfterDays` | optional whole number ≥ 1; default `30` |
| `audiences[]` | at least one; `id` (non-empty, unique), `label` (non-empty), `note` optional |
| `variants[]` | may be empty |
| `variants[].id` | non-empty, unique in the file; it is the anchor on the page |
| `variants[].condition` | `kind` and `key`, both non-empty text; `kind` is free (`flag`, `setting`, `plan`…) |
| `variants[].feature`, `.on`, `.off` | non-empty text, in product words |
| `variants[].audiences` | at least one entry; each key a declared audience id, each value `"on"` or `"off"`; an audience left out is unknown for that variant |
| `variants[].laws` | business-law ids of this knowledge folder; may be empty |
| `variants[].legal` | ids shaped `L-<CODE>-<n>`; may be empty |
| `variants[].checked` | `how`: `live` (seen in the running product), `code` (read in the code only) or `unchecked`; `on`: a `YYYY-MM-DD` date, required for `live` and `code`, `null` allowed for `unchecked`; `release`: text or `null`; `note`: text or `null` |

Unknown keys are refused, so a typo never passes as data.

### Freshness

`freshnessOf(checked, staleAfterDays, today)` is pure and takes the caller's clock: `unchecked` when `how` is
`unchecked`; else its age in whole days since `on`, and `stale` when the age is above `staleAfterDays`, else
`fresh`. Day 30 of 30 is fresh; day 31 is stale.

### The check

`omni check knowledge`, in the repository holding the file:

- **Offline, refused**, each problem named by the file and the JSON path
  (`law-variants.json: variants[3].audiences.BETTA — not a declared audience`): JSON that does not parse; a
  field off the schema; a duplicate variant or audience id; an undeclared audience; a `laws` id that is none
  of this knowledge folder's business laws; a `legal` id not shaped `L-<CODE>-<n>`; `live` or `code` with no
  `on`; an `on` that is not a real day or is after today.
- **Offline, warned:** the file over 512 KiB (a pack leaves out a file over 1 MiB).
- **Online**, riding the read `check-knowledge-legal.ts` already makes: a `legal` id the product does not list
  as active is a violation; no sign-in, the page unreachable or no product is a note, never a block.
- No file: nothing is read and nothing is printed.

Whether a flag key exists in the product's flag tool stays the product's own check: the kit knows no flag tool.

### The terminal

- **`omni kb business-laws`** (and `--domain`, `--spec`): under each law's `Why:` line, one line per variant
  naming it:
  `  Differs for: Internal, New tenants — Where Absences are recorded (flag remove-absences-sidebar-rh) · checked live 2026-11-27 · v3.15.9`.
  The audiences listed are those the variant maps to `on`, in the file's audience order. A stale check ends
  `· stale`; an unchecked one reads `· not checked`. The variants are read from the same place as the laws
  (`businessLawsAt`: this checkout's own files in the law home, else the law home's newest pack), so laws and
  variants are always of one commit.
- **`omni kb law-variants`** prints the whole file in words, a block per variant: the feature, the
  condition, who gets `on` and who gets `off`, the on and off text, the laws and Legal entries, and the check
  with its freshness. A variant naming no law is printed too.
- **`omni kb law-variants --base <ref>`** prints only what changed since `<ref>` (the file read with
  `git show <ref>:<path>`): the variants added, the variants removed, and per changed variant each changed
  field as `old → new` (`BETA: off → on`, `checked: live 2026-11-01 → live 2026-11-27`). A file absent at
  `<ref>` lists every variant as added. It exits 0 whatever it finds, and prints `law variants: no change
  since <ref>` when nothing changed. This is the readable review of a generated file.

### The knowledge MCP

- `get_knowledge` on a business law appends a **Differs for** paragraph to its body: one line per variant
  naming it, the same text as the terminal's line.
- `get_knowledge` on a Legal entry appends the same paragraph for each variant whose `legal` names it.
- Each variant's `condition.key` and `feature` join the searchable text of every law it names, so
  `search_knowledge hotjar` finds the law (or the Legal entry) a variant on `hotjar` touches.
- No new entry kind: a variant is read through the law or Legal entry it touches. The variants come from the
  law home's pack, as the laws do (`entries.ts`).

### The Omni page

The read of the law home's newest pack (`business-laws-load.ts`, one per request) also returns the variants,
parsed by the kit module from the same files. Everything stays read-only: a variant changes in its file,
through a pull request.

1. **Business laws table** (`BusinessLawsSection.tsx`), on the section and on a domain's page: a
   **Differs for** column after Domains. A law no variant names shows `—`. A named law shows a line per
   variant: the audiences mapped `on` as badges, the feature, the condition key as code, and a check badge
   (`live · 12d`, `code · 40d · stale` in the warning tone, `not checked` muted). The line links to the
   variant's row in Law variants (`…/knowledge/law-variants#<id>`).
2. **A Legal entry's page** (`LegalItem`): a **Differs for** block under the entry, the same lines, for each
   variant whose `legal` names it. With none, no block.
3. **Law variants** — a new sub-menu section, `law-variants`, right after Business laws: a matrix with a row
   per variant and a column per declared audience in file order, each cell `on`, `off` or `—`; the row's
   heading is the feature with its condition under it; then the Laws and Legal ids as links, and Checked
   (badge, date, release). Under each row, a disclosure with the on and off text and the check's note. A lede
   names where it was read: "Read from `<home>` · newest merge". States:
   - no file: "No law variant yet." then "Add `product/law-variants.json` in `<home>`.";
   - a file that does not read: a notice, "`law-variants.json` does not read at `<sha>`.", then the first
     problem on its own line. The Business laws table still draws, without its column;
   - no law home, no pack, unreadable: the texts Business laws already says.
   The Business laws section's lede becomes "Read from `<home>` · newest merge" too (the word pass: the old
   sentence stands at rest at 8 words).
4. **Demo mode** gets one fictional variant on the fictional law, so all three can be seen with no database.

### A file that does not read

Every reader treats a missing file as no variants and a file that does not read as one note
(`law variants: <file> does not read — <first problem>`), the laws shown as today. None throws.

### Vertuoza's move (outside this repository)

nimbus-automation-plan rewrites its file into its knowledge folder as
`.omni-loop/knowledge/product/law-variants.json`: its `groups` and `newTenants` become `audiences` declared
once (`INTERNAL`, `BETA`, `GENERAL`, `FINAL`, `new-tenants`) and each variant's map (`true` → `on`, `false`
→ `off`, `newTenants` absent → left out); `flag` becomes `condition: { kind: "flag", key }`; `seen` becomes
`checked.how` (`live` → `live`, `code only` → `code`, anything else → `unchecked` with the text as `note`);
the file's `snapshot` and `checkedOn` become each variant's `checked.on` and `checked.release`; `pack` goes
into `about`. Its `lawVariants.ts` keeps only the flag-key check. That work is tracked on #1092, not here.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | cli | `product/law-variants.json` (the file) | ← `kit/lib/knowledge/business-laws.ts:32` (`BUSINESS_LAWS_FILE`, a knowledge file named after what it holds) |
| vertuo-omni-loop | cli | `kit/lib/knowledge/law-variants.ts`, `LAW_VARIANTS_FILE`, `parseLawVariants`, `lawVariantProblems`, `freshnessOf`, `variantLines` | ← `kit/lib/knowledge/business-laws.ts:32` (`BUSINESS_LAWS_FILE`, `parseBusinessLaws`, `businessLawProblems`) |
| vertuo-omni-loop | cli | `omni kb law-variants [--base <ref>]` | ← `kit/bin/commands/kb.ts:19` (`kb business-laws`) |
| vertuo-omni-loop | ui | section key `law-variants`, label `Law variants` | ← `apps/galaxy/src/product-knowledge/knowledge-sections.ts:13` (`business-laws`, `Business laws`) |
| vertuo-omni-loop | ui | `LawVariantsSection.tsx`, `law-variants-section.ts` | ← `apps/galaxy/src/product-knowledge/BusinessLawsSection.tsx` and `business-laws-section.ts` |
| vertuo-omni-loop | ui | the label **Differs for** | no written convention: follows the page's plain-sentence column headers (`BusinessLawsSection.tsx`, "Domains", "Owner") |

## Decisions

- **A separate file, not lines in `business-laws.md`.** Laws keep their format (#1074), and a daily flag
  move never needs the law owner's approval of the law file. *Chosen by the person.*
- **JSON in the knowledge folder,** over a markdown file (a generator would have to write markdown) and over
  a separate push (a new upload path, table and row-level security). It rides the pack. *Chosen by the person.*
- **Audiences declared once, each variant mapping them to on or off**, over a free list per variant: the
  page can line variants up by audience and the check catches a typo. "New tenants" is one more audience.
  *Chosen by the person.*
- **Age and a stale mark**, past `staleAfterDays` (default 30), over the date alone or an age against the
  pack. *Chosen by the person.*
- **Surfaces:** the check, the law's row, `omni kb business-laws`, the knowledge MCP, a product-wide Law
  variants view, and the Legal entries a variant touches. *Chosen by the person.*
- **The voice's objection, accepted.** Lead Engineer (persona:Lead Engineer): a JSON file beside markdown
  knowledge is one more format the teams learn, and a generated file gets rewritten without anyone reading
  the diff. Settled `accepted`: the design gained `omni kb law-variants`, which prints the file in words, and
  `--base <ref>`, which prints only what changed as `old → new`, so a review reads changes, not JSON.
- **No proof video** (the person said no). E2E is off in this repository.
- **The kit checks law and Legal ids, never flag keys:** it knows no flag tool, and the Omni page never reads
  one live (out of scope in #1092).
- **Shorter words on the page** (the design word pass): the Business laws lede "Read from `<home>`, at its
  newest merged commit." becomes "Read from `<home>` · newest merge", and the Law variants empty and unreadable
  states split into a short line and a second line holding the path or the problem.
- **No new MCP entry kind:** a variant is always read through what it touches.

## User stories

- As a PM reading a business law on the Omni page, I see for whom it plays out differently, behind which
  condition, and whether that was checked recently, so I do not promise a customer what their group does not
  have.
- As a PM, I open Law variants and see every condition against every audience of my product at once.
- As an agent judging a spec against a law (`omni kb business-laws --spec`, or `get_knowledge`), I read the
  law's variants with it, so I do not write a spec that assumes one group's behaviour for all.
- As the owner of a Legal entry, I see on its page which rollout touches it (a session recorder on for Beta
  only).
- As a lead engineer reviewing a pull request that changes the variants file, I read
  `omni kb law-variants --base origin/main` and see what changed in words.
- As the person who maintains a product's knowledge, `omni check knowledge` tells me, by path, what in my
  variants file is wrong before it merges.

## Scope

In:

- `kit/lib/knowledge/law-variants.ts`: the schema, the parser, the problems, `freshnessOf`, the lines and
  the `--base` diff, all pure.
- `omni check knowledge`: the offline grade and the online Legal check.
- `omni kb business-laws` lines, `omni kb law-variants [--base <ref>]`.
- The knowledge MCP's law and Legal bodies, and its search text.
- The Omni page: the Differs for column, the Legal entry block, the Law variants section, the demo.
- The guide page on business laws (`docs/guide/`) gains the file's shape and the command.
- `kit/dist/` and `apps/omni-app/api/` rebuilt by the wave.

Out:

- Any change to the format of a business law or a Legal entry.
- Reading a flag tool (LaunchDarkly or any other) from the page or the kit.
- Editing a variant on the page.
- Vertuoza's move of its file, and its flag-key check (nimbus-automation-plan, #1092).
- Several variants files per product, or audiences combining a group and a pack (#1082): one file per law
  home; a pack is named in `about` or in an audience's `note` until that is designed.
- Any database table, migration or API route.

## Test seams

Following `omni kb show testing`, each beside its code, at the narrowest level that proves the risk; no test
calls GitHub or the network.

- `kit/lib/knowledge/law-variants.test.ts` (pure): every field rule above, each refusal's text and path,
  unknown keys, `freshnessOf` at day 30 and 31 and for `unchecked`, the line text, and the `--base` diff
  (added, removed, changed fields, absent at base, no change).
- The check: a new `kit/lib/knowledge/check-knowledge-law-variants.test.ts` (BR-PRODUCT-95's proof in
  `check-knowledge.test.ts` stays untouched): an unknown law, an undeclared audience, a bad Legal shape, a
  future date; the online read stubbed for a Legal id not active, and no sign-in as a note.
- `kit/bin/kb.test.ts` with `makeRepo()`: `kb business-laws` prints the Differs for line; `kb law-variants`
  prints the blocks; `--base` against a commit made in the fixture prints `BETA: off → on`.
- `kit/lib/knowledge/entries.test.ts`: a law's body and a Legal entry's body carry Differs for; the search
  text holds the condition key.
- `apps/galaxy/src/product-knowledge/`: `business-laws-section.test.ts` and a new
  `law-variants-section.test.ts` (pure: the lines, the matrix's cells, the states); render tests for the
  column, the Legal block and the section, including the three states and the demo.
- The clock is always passed in: no test depends on today's date.

## Risks

- **What merging publishes:** the kit (`kit/dist/omni.mjs`, the plugin) gains the check and the commands; the
  arcade's app pages gain the column, the block and the section on the next production deploy. No database
  change. **Rollback:** revert the pull request; a repository holding the file keeps it, and it simply stops
  showing.
- **The check refuses a file a product already wrote.** Only a product that adds `law-variants.json` meets
  it; none has one in its knowledge folder today. A product moving its file sees each refusal by path.
- **A generated file grows past 1 MiB** and a pack leaves it out silently: the check warns at 512 KiB.
- **A stale variant read as true:** the age and the stale mark are on every surface, and `not checked` is
  never shown as checked.
- **Reads stay as they are:** the variants ride the same pack read as the laws, as the signed-in person, so
  row-level security decides what each read returns, and only merged knowledge shows (the reads named in
  `business-laws-load.ts` and `law-home.ts`). BL-PRODUCTKNOWLEDGE-4 holds: a merge that changes the file
  reaches the page with nobody doing anything.
- **The Legal entries:** none touched. A variant only names Legal ids; no entry, owner or history changes.
- **The locked laws:** none touched (`omni kb laws --paths` on the files above printed no locked law that
  applies here).

## Acceptance criteria

1. In a repository whose knowledge folder holds `product/law-variants.json` as in the example above,
   `omni check knowledge` passes; changing `"BETA"` to `"BETTA"` in a variant's map makes it fail with
   `law-variants.json: variants[0].audiences.BETTA — not a declared audience`.
2. A `laws` id that is none of the folder's business laws, a `legal` id `COOK-1`, `"how": "live"` with
   `"on": null`, an `on` after today, a duplicate variant id and an unknown key are each refused, named by path.
3. With no sign-in, a `legal` id the product does not hold prints a note and does not fail the check; signed
   in, it is a violation.
4. `omni kb business-laws` prints, under `BL-PLANNINGANDTIMETRACKING-1`'s `Why:` line, `Differs for:
   Internal, New tenants — Where Absences are recorded (flag remove-absences-sidebar-rh) · checked live
   2026-11-27 · v3.15.9`, with ` · stale` added when today is more than 30 days after 2026-11-27.
5. `omni kb law-variants` prints one block per variant, a variant naming no law included.
6. After changing `"BETA": "off"` to `"on"` and committing, `omni kb law-variants --base HEAD~1` prints that
   variant with `BETA: off → on`, and nothing about the others.
7. `get_knowledge BL-PLANNINGANDTIMETRACKING-1` returns a body ending with a Differs for paragraph;
   `get_knowledge L-COOK-1` does too for a variant naming it; `search_knowledge remove-absences-sidebar-rh`
   lists the law.
8. On the Omni page, the Business laws table shows a Differs for column; the law's line shows the badges
   Internal and New tenants, the feature, the flag key and `live · <n>d`, and links to its row in Law
   variants. A law no variant names shows `—`.
9. A Legal entry named by a variant shows a Differs for block on its page; one named by none shows no block.
10. The Law variants section shows a matrix with a column per declared audience in file order and a row per
    variant, each cell `on`, `off` or `—`, and the disclosure under a row shows the on and off text.
11. With no file, the section says "No law variant yet." and names the file to add; with a file that does not
    parse, a notice says it does not read at the pack's commit, with its first problem under it, and the Business laws table still draws without
    the column.
12. In demo mode, the column, the section and the fictional variant show with no database.
