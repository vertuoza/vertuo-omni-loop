# Plan: the plan advises a model tier for each slice

PRD #1934, specified in `spec.md` beside this plan. The feature branch `feat/model-tiers` merges into
`main` with `Closes #1934`; each slice is a sub-PR from `feat/model-tiers--<slice>` into the
feature branch, with `Part of #1934`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The config maps tiers to a model and effort per agent, `omni check config` refuses a bad mapping, and `omni tier <tier> --agent <agent>` prints the model and effort or `inherit` | `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/lib/tiers` `kit/bin/commands/tier` `kit/bin/commands/index.ts` `kit/bin/tier` `kit/bin/check-config.test.ts` `kit/lib/help/entries.ts` `kit/bin/help.test.ts` | — | 1 | build |
| s2 | A plan's slice table may carry a `tier` column, read by name: `omni plan check` refuses a bad cell, `omni board --json` gives each slice its `tier`, and `/omni:plan` writes the column with a reason for any tier but `build` | `kit/lib/inbox/territory.ts` `kit/lib/inbox/territory.test.ts` `kit/lib/inbox/plan-grade.ts` `kit/lib/inbox/plan-grade.test.ts` `kit/lib/board.ts` `kit/lib/board.test.ts` `kit/lib/types.ts` `kit/bin/plan.test.ts` `kit/bin/board.test.ts` `kit/plugin/skills/plan/` | — | 1 | build |
| s3 | `/omni:wave` starts each slice's agent on its tier's model and effort, retries a refused launch once on the terminal's model, and reports the tier; `/omni:do-work` returns and stamps it on the sub-PR; the briefing's **Any agent** says an agent without per-subagent models inherits; the guide explains tiers | `kit/plugin/skills/wave/` `kit/plugin/skills/do-work/` `kit/templates/playbook/briefing.md` `kit/test/briefing-any-agent.test.ts` `docs/guide/any-agent.md` | s1, s2 | 2 | light |

No prefix is declared by more than one slice. `kit/dist/` is rebuilt by each slice to test and
committed by none; the wave rebuilds it once after merging. s1 and s2 share no file: the command
registry and the help entries are s1's alone, the slice-table parser and the board are s2's alone.

## Per slice: done when

### s1

- `tiers` is an optional key of `ConfigSchema`: each agent row optional, each of `deep`, `build`,
  `light` optional, each `{ model: non-empty string, effort?: low | medium | high | xhigh | max }`.
- `omni check config` refuses, each naming its key: an agent under `tiers` that `agents` does not
  list, a tier other than the three, `model: ""`, an unknown `effort`. A config without `tiers` is
  valid and reads as before.
- `resolveTier(config, agent, tier)` in `kit/lib/tiers.ts` answers `{ model, effort? }` or
  `inherit`, unit-tested on every branch (mapped with and without effort, agent row missing, tier
  missing, no `tiers`, a null tier).
- `omni tier light --agent claude` prints `model: haiku` and `effort: low` for a mapped tier, and
  `inherit` for an unmapped one, both exit 0; an unknown tier exits 2 naming it.
- `omni help tier` describes the command; `omni config tiers.claude` prints the row.

### s2

- `parsePlanSlices` reads a `tier` column by name in any position; each `Slice` gains
  `tier: 'deep' | 'build' | 'light' | null` (`null` for a blank, an em dash or no column).
- `omni plan check` refuses a cell that is none of those, naming the slice and the value; a plan
  without the column grades exactly as before.
- `omni board <n> --json` gives each slice its `tier`.
- `/omni:plan` writes a `tier` column after `wave` for every slice of a new plan, picks the tier by
  the spec's table (`deep`, `build`, `light`), and gives a one-clause reason on each done-when
  heading whose tier is not `build`.

### s3 (light: skill wording and one template line)

- `/omni:wave` reads each claimed slice's `tier` from the board, runs `omni tier <tier> --agent
  <its agent>`, and starts the subagent with that model and effort (in Claude: the Agent tool's
  `model` and `effort`), or with neither on `inherit`; it passes the resolved values in the
  subagent's prompt.
- A refused launch is started again once on the terminal's model, never counted red, and stamped
  `inherited (<agent> refused <model>)`; the inline path stamps `inherited (inline)`.
- `/omni:do-work`'s result JSON carries `tier`, and its sub-PR body a `Tier:` line under the
  summary; the wave's report shows each slice's tier and model beside its outcome.
- With no `tiers` key, the wave's launch text sets no model and no effort: it starts subagents
  exactly as today.
- The template briefing's **Any agent** gains a **Models** line, and
  `kit/test/briefing-any-agent.test.ts` checks it.
- `docs/guide/any-agent.md` has a short **Model tiers** section: the three tiers, the config
  example, silence approves the plan's advice, and no mapping inherits.
