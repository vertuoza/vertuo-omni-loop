# Plan: install for any coding agent

PRD #1890, specified in `spec.md` beside this plan. The feature branch `feat/install-any-agent`
merges into `main` with `Closes #1890`; each slice is a sub-PR from `feat/install-any-agent--<slice>`
into the feature branch, with `Part of #1890`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The config takes `agents: [claude, codex, cursor, gemini]`, default `[claude]`, refusing an unknown or repeated agent by name, and the init's config text writes it | `kit/lib/config` `kit/lib/types.ts` `kit/lib/init/config-text` | — | 1 |
| s2 | The bundle carries every skill file byte-identical, and `kit/lib/agents/` writes `.agents/skills/omni-<name>/` from them (name rewritten, generated line, body unchanged, siblings copied) with a manifest of what it owns, stopping on an unowned `omni-*` folder and removing owned folders a version dropped | `kit/build.ts` `kit/lib/agents/` `kit/test/dist.test.ts` | — | 1 |
| s3 | `omni init --agent <a>` (repeatable, or asked in the terminal) sets `agents`, writes the copies when a non-Claude agent is listed and the Claude plugin and settings only when `claude` is, and commits exactly those paths; N-PRODUCT-13 carries the amended text | `kit/bin/commands/init.ts` `kit/bin/init.test.ts` `kit/lib/init/` `.omni-loop/knowledge/product/invariants.md` | s1, s2 | 2 |
| s4 | `omni update` rewrites, adds and removes the owned copies from the new bundle, removes them all when `agents` is `[claude]`, and its PR body lists **Skills for other agents** one line per changed copy | `kit/bin/commands/update.ts` `kit/bin/update.test.ts` `kit/lib/update/` | s1, s2 | 2 |
| s5 | `omni check agents`, in `omni check all`, is red on a hand-edited, missing or never-installed copy, naming `omni update`, and green otherwise | `kit/bin/commands/check.ts` `kit/bin/check-agents` `kit/lib/agents/check` | s1, s2 | 2 |
| s6 | `omni help` shows each skill in each listed agent's form under "Run these", drive's tick for the agents without a loop, the Claude-only line for the status line and the HUD; the install guide names `--agent` | `kit/lib/help/` `kit/bin/help.test.ts` `apps/galaxy/src/docs/skills.test.ts` `docs/guide/install.md` | s3, s4, s5 | 3 |

**Shared ground.** `kit/lib/init/config-text` is s1's and inside s3's `kit/lib/init/`: waves 1
and 2. `kit/lib/agents/check` is s5's and inside s2's `kit/lib/agents/`: waves 1 and 2. s3, s4 and
s5 call s2's writer and read s1's key without editing them. `kit/lib/help/` is s6's alone, after the
check's and the init's words exist. `kit/dist/` is generated: no slice commits it; the wave rebuilds
it.

## Per slice: done when

**s1**
- `omni config agents` prints `["claude"]` in a repository that never set it; `omni check config`
  refuses `agents: [claude, copilot]` naming `copilot`, and `agents: []` and a repeated agent.
- The init's rendered config writes the `agents` key it is given.

**s2**
- `kit/test/dist.test.ts` finds every file under `kit/plugin/skills/` carried byte-identical in the
  bundle.
- In a temporary repository, the writer for `[codex]` writes one `.agents/skills/omni-<name>/` per
  skill: `name: omni-<name>`, the generated line with the version, the body byte-identical,
  `pixel-perfect`'s sibling files under the same relative paths; and `.omni-loop/agents.json` with
  each owned path and its sha-256.
- A foreign `.agents/skills/my-skill/` stays byte-identical; an unowned `omni-x` folder stops the
  writer before any write, naming it; a rerun with a skill dropped removes only that owned folder.
- `kit/lib/agents/write.test.ts` holds all of the above.

**s3** (`law: N-PRODUCT-13 · owner @pierrederval`)
- Breaking this law lets the install overwrite a person's own settings or files: the amendment
  needs @pierrederval's approval on the feature PR.
- `omni init --agent codex --agent claude` writes `agents: [codex, claude]`, the copies, the
  manifest and the two settings keys, and the install PR commits exactly those paths and the usual
  `.omni-loop/` ones; `[claude]` writes no `.agents/` path; `[cursor, gemini]` writes no
  `.claude/settings.json` and installs no plugin.
- A terminal init without `--agent` asks which agents, Claude ticked.
- `kit/bin/init.test.ts`'s "writes nothing outside" assertion and snapshot allow the owned folders
  and nothing else; `kit/lib/init/settings.test.ts` passes.
- N-PRODUCT-13's entry carries the amended text, `Governs:` gains `^kit/lib/agents/` and
  `^kit/lib/update/`, and `Enforced by:` gains `kit/lib/agents/write.test.ts`.

**s4**
- `omni update` rewrites a changed copy, adds a new skill, removes a dropped one, and removes every
  owned folder and the manifest when `agents` is `[claude]`.
- Its PR body has **Skills for other agents**, one line per changed copy (`omni-yolo: 3 lines
  changed`, `new`, `removed`) and the generated-copies sentence; no section when nothing changed.
- `kit/bin/update.test.ts` passes, the person's checkout untouched as today.

**s5**
- `omni check agents` is green with matching hashes, and with `agents` `[claude]` and no manifest.
- It is red, with `run omni update to rewrite the copies`, on a hand-edited file, a missing file,
  and a non-Claude agent listed with no manifest.
- `omni check all` runs it.

**s6**
- `omni help` with `agents: [claude, codex, cursor, gemini]` shows `/omni:yolo <n>`, `$omni-yolo <n>`,
  `/omni-yolo <n>` and the Gemini form under "Run these"; with `[claude]` it shows the Claude form
  alone.
- Drive shows `/loop /omni:drive` for Claude and its tick for the others, with "run it again after
  the wait it names".
- `omni help statusline` says the status line and the HUD are Claude Code's alone.
- `docs/guide/install.md` names `--agent` and the `agents` key.
- The full `pnpm test`, `pnpm lint` and `pnpm typecheck` are green.
