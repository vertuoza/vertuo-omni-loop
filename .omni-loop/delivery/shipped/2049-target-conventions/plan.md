# Plan: Brainstorms and plans follow each repository's written conventions

PRD #2049, spec beside this plan (`spec.md`). The feature branch `feat/target-conventions` merges
into `main` with `Closes #2049`. Each slice is a sub-PR from `feat/target-conventions--<slice>` into
`feat/target-conventions`, its body opening with `Part of #2049`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `omni conventions [--root <dir>] [--json]` prints the index of the files where a directory writes its conventions (root `CLAUDE.md`/`AGENTS.md` and their `@` imports, `paths.context`, the `docs/` and `docs/adr/` readmes or the ADR list, and the pages they link to, one level), each with its title and the file that led to it, `missing` for a broken link; it reads files only and needs no omni config; `omni help conventions` describes it | `kit/lib/conventions/` `kit/bin/commands/conventions` `kit/bin/commands/index.ts` `kit/bin/conventions.test.ts` `kit/lib/help/entries.ts` | — | 1 | build |
| s2 | `/omni:mega-brainstorm` (step 3, step 5), `/omni:plan` in a plan repository (step 2) and `/omni:brainstorm` (step 1, step 4) run `omni conventions`, read the pages the design bears on (the database and GraphQL schema pages at the least), and write the spec's `## Conventions` section with a source for every name | `kit/plugin/skills/brainstorm/` `kit/plugin/skills/mega-brainstorm/` `kit/plugin/skills/plan/` `kit/porting/plugin--brainstorm.md` `kit/porting/plugin--plan.md` `kit/test/conventions-skills.test.ts` `kit/test/skill-steps.snapshot.json` | s1 | 2 | light |

**Shared ground.** None: the two territories share no prefix. `kit/dist/` is rebuilt by the wave
after merging and is listed in no territory.

## Per slice: done when

### s1

- `omni conventions --root <fixture>` on a fixture shaped like vertuo-backend-php (a `CLAUDE.md`
  whose table routes "Migration" to `docs/migrations.md`, a `docs/readme.md`, a `docs/adr/` folder)
  prints `CLAUDE.md`, `docs/readme.md`, `docs/migrations.md` and the ADR index, each with its title
  and the file that led to it, and exits 0 (spec, acceptance 1).
- On a directory with no `.omni-loop/` it prints its index and exits 0; on a `--root` that does not
  exist it prints one line saying so and exits non-zero (acceptance 2).
- A `CLAUDE.md` holding `@AGENTS.md` leads to `AGENTS.md`; `paths.context` is read from
  `.omni-loop/config.yml` when there is one; the `docs/` readme is found as `readme.md`, `README.md`
  or `index.md`; `docs/adr/` without a readme lists each ADR with its title.
- A link to a missing file is printed `missing`; a link outside the directory, a link to a
  non-Markdown file and a page two links away are not printed; no file is printed twice
  (acceptance 3).
- `--json` prints the same entries as an array of `{ path, title, from, missing }` (acceptance 4).
- `omni help conventions` describes the command (acceptance 8).

### s2 (light: skill wording only)

- `/omni:mega-brainstorm` step 3 runs `omni conventions --root <scratch>/<name>` on each clone and
  reads the pages the design bears on; its step 5 writes `## Conventions` after `## Repositories`
  (acceptance 5).
- `/omni:plan`, in a plan repository, runs `omni conventions --root` on each target's clone at its
  step 2 (acceptance 6).
- `/omni:brainstorm` runs `omni conventions` at its step 1; its step 4 adds `## Conventions` after
  `## Solution` to the spec's sections, with a source per name, `no written convention: follows
  <file>`, `No name chosen.`, and a question to the person when two conventions coexist with no page
  settling them (acceptance 7).
- `kit/test/conventions-skills.test.ts` reads the three `SKILL.md` and proves each of the above;
  `kit/test/skill-steps.snapshot.json` is updated, and the whole `pnpm test` is green.
