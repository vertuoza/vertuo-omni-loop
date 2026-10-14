# Plan: The decisions form prints the latest 20 records

PRD #1951, the spec beside this plan (`spec.md`). The feature branch `feat/decisions-latest` goes
into `main` with `Closes #1951`; each slice is a sub-PR from `feat/decisions-latest--<slice>` into
the feature branch with `Part of #1951`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `omni kb show decisions` prints the latest 20 records, a live count of the older ones naming `--all`, and the next free number; `--all` prints every one; `check context` measures that view under a `form:decisions` ceiling of 6,144 bytes; the Numbering slot here and in the kit template, and `omni help kb`, name `--all` | `kit/lib/budgets/measure` `kit/bin/commands/kb.ts` `kit/bin/kb.test.ts` `kit/lib/help/entries.ts` `kit/bin/help.test.ts` `kit/templates/playbook/decisions.md` `.omni-loop/knowledge/adr/README.md` `.omni-loop/budgets/context.json` | — | 1 |

**Shared ground.** One slice, so none. The change is one command's output, the measure that counts
it, and the words and ceiling that describe it: split, the ceiling could only drop once the command
had merged, and the words would describe a flag that did not exist yet. `kit/dist/` is generated:
the slice rebuilds it to test and commits none; the wave rebuilds it once after merging.

## Per slice: done when

**s1**
- On a `makeRepo()` fixture of 25 records, `omni kb show decisions` prints records 0006 to 0025 in
  order, then `… 5 older records: omni kb show decisions --all`, then `Next free number: 0026`
  (`kit/bin/kb.test.ts`).
- On the same fixture, `--all` prints all 25 records and no "older" line; `--json` carries all 25.
- A fixture of 20 records prints all 20 and no "older" line.
- A number shared by two of the older records still prints its `! <n> is used by …` warning in the
  default view.
- `omni kb show testing --all` exits with a usage error naming `--all`.
- `kit/lib/budgets/measure.test.ts`: `form:decisions` equals the bytes the default view prints on
  the 25-record fixture.
- `.omni-loop/budgets/context.json` holds `"form:decisions": 6144`, and `omni check context` is green
  on the slice branch.
- The Numbering slot of `.omni-loop/knowledge/adr/README.md` and of
  `kit/templates/playbook/decisions.md` names `omni kb show decisions --all` and says to look a
  decision up before writing a new record; `omni help kb` shows `omni kb show <form> [--json]
  [--all]`.
- `readDecisions`, the harvest's classifier and the record writer are unchanged.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` are green.
