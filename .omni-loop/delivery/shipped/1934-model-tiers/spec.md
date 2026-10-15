---
prd: 1934
title: The plan advises a model tier for each slice, and the wave runs it on that tier's model
blocked-by: none
spec: file
phase0: server
---

## Problem

Every slice a wave builds runs on whatever model the person's terminal runs, usually the most
expensive one. `/omni:wave` starts one subagent per slice (in Claude, the Agent tool with
`isolation: "worktree"`) and never sets its model, so each subagent inherits the session's. A slice
that renames a field costs what a planning session costs.

The plan already knows how hard each slice is: it names the territory, the blockers and what "done"
means. Nothing carries that judgement to the run. The config has no word for a tier or a model
(PRD 1890 added `agents`, which only says where the skills are installed), the slice table has no
column for it (`| id | slice | territory | blocked by | wave |`, "exactly", in the plan skill), and
nothing records which model built a slice, so whether a cheaper model holds up cannot be measured
afterwards.

This PRD is about a person running the loop in their own terminal. `omni runner`
(`kit/lib/runner/job.ts`), which runs `claude --dangerously-skip-permissions -p` on the team's own
servers, stays as it is.

## Solution

**The plan advises, the config maps, the wave obeys, the sub-PR says what ran.** Without a
mapping, nothing changes.

### 1. The tiers and the config key `tiers`

Three tiers, named for the capability a slice needs, never for a vendor or a model:

| tier | for |
|---|---|
| `deep` | a slice whose design is subtle: an algorithm, a concurrency or migration hazard, a law path |
| `build` | a bounded slice with a territory and a test-first spec, the ordinary case |
| `light` | a mechanical slice: a rename, wording, docs, a config line |

`.omni-loop/config.yml` gains an optional `tiers` key, one row per coding agent:

```yaml
agents: [claude, codex]
tiers:
  claude:
    deep:  { model: opus,   effort: high }
    build: { model: sonnet, effort: medium }
    light: { model: haiku,  effort: low }
  codex:
    build: { model: <id> }
```

- Each agent row is optional, and so is each tier in it. `model` is a non-empty string the agent
  understands; `effort` is optional, one of `low`, `medium`, `high`, `xhigh`, `max`.
- `omni check config` refuses, naming the key: an agent under `tiers` that is not in `agents`, a
  tier other than `deep`, `build`, `light`, an empty `model`, an unknown `effort`.
- No `tiers` key, no row for the session's agent, or no entry for a slice's tier: the slice runs on
  the terminal's model, as today. The kit ships no mapping of its own.
- `omni config tiers.<agent>` prints a row, as any key prints.

### 2. The plan advises a tier per slice

- `/omni:plan` writes a `tier` column in the slice table, after `wave`, for every slice, whether or
  not the config maps tiers: the advice is visible in review either way. It picks the tier from the
  table above and, when it is not `build`, says why in one clause in the slice's done-when heading
  (`### s3 (light: wording only)`).
- The column is read by name, like `landing` and `contract`: its position in the row is free.
  A blank cell or an em dash advises nothing (the terminal's model). A plan with no `tier` column
  grades and runs as it always did.
- `omni plan check` (`kit/lib/inbox/plan-grade.ts`) refuses a cell that is not `deep`, `build`,
  `light`, a blank or an em dash, naming the slice and the value.
- `omni board <n> --json` gives each slice its `tier` (`null` when none).

**The person's say.** The tiers are part of the plan a person reviews before anything is built: on
the PRD's page, or in the phase-0 pull request. To change one, they edit the cell (or ask for it in
review). Saying nothing approves the plan's advice: no extra question, no extra gate.

### 3. The wave obeys

When `/omni:wave` starts a slice's subagent, it reads the slice's `tier` from the board and the row
of its own agent from the config, through one command:

```bash
node .omni-loop/bin/omni.mjs tier <tier> --agent <agent>
```

It prints `model: <model>` and `effort: <effort>` (each line only when set) and exits 0, or prints
`inherit` and exits 0 when nothing maps the tier. The wave starts the subagent with that model and
effort (in Claude: the Agent tool's `model` and `effort`), or with neither on `inherit`.

- **The launch is refused** (the agent does not know the model, or cannot set a model per
  subagent): the wave starts the slice again once on the terminal's model, and the slice's stamp
  says `inherited (<agent> refused <model>)`. It is never a red slice and never a question.
- **The inline path** (a plan under `wave.inlineBelow`) and `/omni:do-work` run alone start no
  subagent: they stay on the terminal's model and stamp `inherited (inline)`.
- **An agent without per-subagent models** inherits, and the playbook's **Any agent** section
  (`kit/templates/playbook/briefing.md`) says so in one line under a new **Models** rule.
- The config read is the one at the wave's start: changing `tiers` mid-PRD changes the next wave,
  never the plan's advice.

### 4. The stamp

- `/omni:do-work`'s result JSON gains `"tier": { "tier": "build", "agent": "claude", "model":
  "sonnet", "effort": "medium" }`, or `"tier": { "tier": "build", "inherited": "<why>" }`. The
  wave passes the resolved values in the subagent's prompt, so do-work reports what it was given.
- The slice's sub-PR body gains one line under its summary:
  `Tier: build · claude sonnet · medium` (or `Tier: build · inherited (no mapping)`).
- The wave's report shows the tier and model beside each slice's outcome (green first try, red,
  attempts).

That stamp is the data a later PRD can tune tiering with; this one builds no dashboard.

## Decisions

- **The plan advises; skills carry no default** (the person, in the design). A step with no advice
  runs on the terminal's model, the default the person already chose.
- **Silence approves the advice** (the person). The plan is reviewed before anything is built; no
  separate tier gate.
- **Slices only** (the person). Wave integration, pr-care, settle, the gate and yolo-fix run on the
  terminal's model.
- **No mapping inherits** (the person). The plan still writes the column; nothing runs differently
  until a person adds `tiers`.
- **The mapping is per agent** (the person): a Codex terminal and a Claude terminal on the same
  repository each read their own row.
- **Measurement is a stamp per slice** (the person): result JSON, sub-PR line, wave report. No Loop
  page change.
- **The voice:** persona:F-E Developer objected that slices go to a cheaper model behind the
  reviewer's back. The person approved the design unchanged: the tier is in the plan reviewed before
  building, stamped on every sub-PR, and every slice passes the same tests, lint, mutation floor
  and CI whatever its model. Settled: `none` (design unchanged).
- **Out of scope**, each a candidate PRD: `omni runner` launching other agents or models;
  escalating a red slice to a higher tier; a judge from another vendor at the outbox gate; falling
  back to another agent when one is rate-limited; a mapping per product; tier data on the Loop
  page.

## User stories

- As a person running `/omni:yolo` in my terminal on the top model, I want the mechanical slices to
  run on a cheaper model, so that a PRD costs what its work needs.
- As the reviewer of a plan, I want to see each slice's advised tier and change it before anything
  is built, so that a slice I find risky does not run on a light model.
- As a lead engineer, I want every sub-PR to say which model built it, so that I can tell later
  whether the cheaper tiers hold up.
- As a person on Codex, I want my own row in the mapping, so that a teammate's Claude models never
  apply to my terminal.

## Scope

In:

- the `tiers` config key, its schema and its refusals (`kit/lib/config.ts`);
- `kit/lib/tiers.ts`: `resolveTier(config, agent, tier)` → `{ model, effort? } | inherit`;
- the command `omni tier <tier> --agent <agent>`, and its help line;
- the `tier` column: plan-grade's check, the board's `tier` field (`kit/lib/inbox/plan-grade.ts`,
  `kit/lib/board.ts`, `kit/lib/types.ts`);
- the skills: `/omni:plan` writes the column, `/omni:wave` resolves and launches with it,
  `/omni:do-work` reports and stamps it;
- the **Any agent** section's **Models** line (`kit/templates/playbook/briefing.md`);
- the guide: a short "Model tiers" section in `docs/guide/any-agent.md`;
- the rebuilt `kit/dist/`.

Out: everything listed under **Decisions › Out of scope**. This repository's own
`.omni-loop/config.yml` gains no `tiers` key in this PRD: a person adds it when they choose.

## Test seams

Unit tests with vitest beside the code (`omni kb show testing`), no network, no agent launched:

- `kit/lib/config.test.ts`: a valid `tiers`; each refusal (agent not listed, unknown tier, empty
  model, unknown effort), naming its key; no `tiers` is valid and changes no other key.
- `kit/lib/tiers.test.ts`: every branch of `resolveTier` (mapped with effort, mapped without, agent
  row missing, tier missing, no `tiers` at all, a blank advice).
- `kit/lib/inbox/plan-grade.test.ts`: a `tier` column in any position; a bad value refused with the
  slice and value named; a blank and an em dash accepted; a plan without the column graded as
  before.
- `kit/lib/board.test.ts`: the JSON gives each slice its `tier`, `null` without the column.
- The `omni tier` command: its two outputs and exit 0, an unknown tier refused with exit 2.
- The skill texts are covered by the kit's existing skill tests where they apply; `kit/test/dist.test.ts`
  catches a stale bundle.

## Risks

- **A cheaper model fails more.** A `light` slice may go red where `build` would not. The gates are
  the same whatever the model, so the cost is time and tokens, not quality; the stamp shows it.
  Rollback: remove `tiers` from the config, and every slice inherits again.
- **Model names drift.** A model id the agent no longer knows makes the launch fail; the wave
  retries on the terminal's model, so a stale mapping slows nothing down beyond one refused launch.
- **What merging publishes:** a kit release (`omni` CLI, plugin skills, template) through the
  release workflow (`omni kb show releasing`). Repositories see no change until they add `tiers`.
  Rollback: revert the feature PR; a `tier` column left in plans is then ignored by the board.
- The locked laws: none touched. `omni kb laws` lists every law of the product for
  `kit/lib/config.ts`, `kit/plugin/skills/wave/SKILL.md`, `kit/plugin/skills/plan/SKILL.md`,
  `kit/plugin/skills/do-work/SKILL.md` and the briefing template, and the design changes none of
  them: no merge, gate, ask, install or secret behaviour moves. The rule BR-PRODUCT-4 (every slice
  claimed by a draft pull request) holds as is: the claim comes before the launch, whatever the
  model.

## Acceptance criteria

1. With `tiers.claude.light: { model: haiku, effort: low }` in the config, `omni tier light --agent
   claude` prints `model: haiku` and `effort: low`; `omni tier deep --agent claude` with no `deep`
   entry prints `inherit`; both exit 0.
2. `omni check config` refuses `tiers.codex` when `agents` lists only `claude`, naming
   `tiers.codex`; it refuses `tiers.claude.huge`, `model: ""` and `effort: extreme`, each by key.
3. A plan whose slice table has a `tier` column with `deep`, `build`, `light`, a blank and an em
   dash grades green; a cell `fast` is refused, naming the slice and `fast`. A plan without the
   column grades exactly as before.
4. `omni board <n> --json` gives each slice `tier`: the cell's value, or `null`.
5. `/omni:plan` writes the `tier` column for every slice of a new plan, and a reason clause on each
   slice it advises other than `build`.
6. `/omni:wave` starts a slice whose tier is mapped on that tier's model and effort, and a slice
   whose tier is not mapped on the terminal's model.
7. A refused launch is retried once on the terminal's model; the slice is not red for it and its
   stamp says `inherited (<agent> refused <model>)`.
8. Every sub-PR a wave opens has a `Tier:` line, and do-work's result carries `tier`; the wave's
   report shows each slice's tier and model.
9. The briefing's **Any agent** section has a **Models** line saying an agent that cannot choose a
   model per subagent runs every slice on the terminal's model.
10. With no `tiers` key, a wave starts its subagents exactly as today (no model, no effort set).
