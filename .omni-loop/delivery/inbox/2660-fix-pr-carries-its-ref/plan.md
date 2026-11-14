# Plan: A fix's pull request carries its issue's reference, and is ready once its fix is pushed

PRD #2660, its spec beside this plan (`spec.md`). The feature branch `feat/fix-pr-carries-its-ref`
merges into `main` with `Closes #2660`; each slice is a sub-PR from
`feat/fix-pr-carries-its-ref--<slice>` into the feature branch, with `Part of #2660`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `formatTitle` upgrades a title that reads as `pr.ref`'s `none` when a reference exists (the `none` text taken off, the `title` format applied), and keeps a title that already reads as the `title` format with any valid reference, so no title carries two; `omni ref` prints it, with and without `--repo`; the guide says so | `kit/lib/ref/` `kit/bin/ref.test.ts` `docs/guide/flow.md` | — | 1 | build |
| s2 | `/omni:mega-bug-fix` marks each target pull request ready with `gh pr ready` once its red and its fix are pushed and its preflight is green; level D and `labels.needsFix` stay a draft; `/omni:bug-fix`'s ready rule is unchanged | `kit/plugin/skills/mega-bug-fix/` `kit/test/skill-steps.snapshot.json` `kit/test/mega-bug-fix-ready` | — | 1 | light |

**Shared ground.** None: s1 and s2 declare no common prefix. `kit/test/pr-ref-repo.test.ts` reads
the target pull request bullet s2 edits; s2 keeps its `/omni:pr --repo <slug> --issue <n>` text, and
no other slice touches that test. `kit/dist/` is generated: no slice lists it, and the wave rebuilds
it once after merging.

## Per slice: done when

### s1

- `formatTitle({ title: "[{ref}]-{title}", none: "[NoRef]-{title}", … }, "ABC-123", "[NoRef]-fix: x")`
  returns `[ABC-123]-fix: x`; with a suffix format (`{title} ({ref})`, `none` `{title} (none)`),
  `fix: x (none)` gives `fix: x (ABC-123)`.
- A title reading as the `title` format with another valid reference (`[XYZ-9]-fix: x`) is returned
  unchanged, and one with this reference too; the former test `prefixes again when the title carries
  another ref` is replaced by this one.
- A `none` text shaped like a reference (`[NoRef]-`) is still upgraded: the `none` reading is tested
  first.
- With no reference, a title takes `none` once, and a title already reading as `none` is unchanged.
- `$` in a title stays literal.
- `omni ref 12 --title "[NoRef]-x"` on an issue with `<!-- omni-ref: ABC-123 -->` prints
  `title: [ABC-123]-x`, and with `--repo acme/api` the target's format; the tests use a fake `gh`.
- The guide's paragraph on `omni ref` says a `none` title is upgraded when a reference exists, and a
  title that carries one is kept.
- `pnpm mutation:changed` on `kit/lib/ref/ref.ts` keeps its floor.

### s2 (light: one skill step made explicit)

- `/omni:mega-bug-fix`'s target pull request step says to run `gh pr ready <pr>` once its red and its
  fix are pushed and its preflight is green, and that a target whose proof was not produced (level D)
  or that stopped `labels.needsFix` stays a draft.
- A test under `kit/test/mega-bug-fix-ready*` reads that step and checks both; `/omni:bug-fix`'s ready
  rule (ready once `omni bug` prints `ok` on a produced proof) is unchanged.
- `kit/test/pr-ref-repo.test.ts` and the step snapshot stay green.
