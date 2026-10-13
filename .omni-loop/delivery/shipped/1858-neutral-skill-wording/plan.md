# Plan: neutral skill wording

PRD #1858, specified in `spec.md` beside this plan. The feature branch `feat/neutral-skill-wording`
merges into `main` with `Closes #1858`; each slice is a sub-PR from
`feat/neutral-skill-wording--<slice>` into the feature branch, with `Part of #1858`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The briefing carries an **Any agent** section of at most 950 bytes, printed as a kit default where a repository's briefing has none; this repository's `briefing` and `session` ceilings rise to 4096 and 10240; each skill's `omni` commands and guards are snapshotted from `main` and held by a test | `kit/templates/playbook/briefing.md` `.omni-loop/budgets/context.json` `kit/test/skill-steps` `kit/test/briefing-any-agent` `kit/test/no-literals.test.ts` | — | 1 |
| s2 | Every skill says each Claude-only action in neutral words with the Claude way in `(in Claude: …)`, and step 0 runs `omni session start`; the tests that read skill text assert the new wording | `kit/plugin/skills/` `kit/test/plugin.test.ts` `kit/test/flow-points.test.ts` `kit/test/no-literals.test.ts` `kit/test/stage-words.test.ts` `kit/test/no-game-words.test.ts` `kit/test/skills-dossier-link.test.ts` `kit/test/brainstorm-concept.test.ts` `kit/test/design-skills.test.ts` `kit/test/mega-brainstorm-product.test.ts` `kit/test/product-dry-run.test.ts` `kit/lib/commands.test.ts` `kit/lib/help/entries.test.ts` `kit/lib/inbox/territory.test.ts` `kit/lib/roadmap/human-work.test.ts` `kit/bin/decide.test.ts` `apps/galaxy/src/docs/skills.test.ts` | s1 | 2 |
| s3 | A test fails on any Claude tool name in a skill outside an `(in Claude: …)` bracket, naming the file and the line | `kit/test/agent-neutral` | s2 | 3 |

**Shared ground.** `kit/test/no-literals.test.ts` reads both the playbook templates and the skills:
s1 declares it for the briefing section, s2 for the reworded skills, in waves 1 and 2. Every other
test that reads skill text is s2's alone. `kit/dist/` is generated: no slice commits it; the wave
rebuilds it.

## Per slice: done when

**s1**
- `kit/templates/playbook/briefing.md` has an **Any agent** section between **Links** and **Where to
  read next**, with the skills, asking (the `omni ask question` exit codes 0, 3 and 4), parallel
  agents (one after another), waiting and fresh-session paragraphs, at most 950 bytes as printed.
- `kit/test/briefing-any-agent.test.ts`: `omni kb show briefing` in a fixture repository whose
  briefing has no such section prints it marked `[kit default]`, and the section's size is checked.
- `.omni-loop/budgets/context.json` holds `briefing` 4096 and `session` 10240, every other ceiling
  unchanged; `omni check context` is green.
- `kit/test/skill-steps.snapshot.json` is taken from the skills as they are on `main` (each skill's
  sorted `omni <verb>` commands and guard phrases); `kit/test/skill-steps.test.ts` passes on them,
  reads `kb show briefing` and `session start` as the same step, and fails on a fixture skill that
  drops `omni plan check`.

**s2**
- Every row of the spec's mapping is applied in every `SKILL.md` and `pixel-perfect` reference
  file, and nothing else changes in them.
- Every skill whose step 0 ran `omni kb show briefing` runs `omni session start`.
- `kit/test/skill-steps.test.ts` passes unchanged against its snapshot.
- `plugin.test.ts` and every listed test assert the new wording where they asserted a Claude string.
- The full `pnpm test`, `pnpm lint` and `pnpm typecheck` are green.

**s3**
- `kit/test/agent-neutral.test.ts` passes on every skill file, fails on a fixture holding `type
  /clear` (naming the line), passes on `start a fresh session (in Claude: \`/clear\`)`, and fails on
  a name in a code block outside a bracket.
- The full `pnpm test`, `pnpm lint` and `pnpm typecheck` are green.
