# `kit/plugin/skills/do-work/SKILL.md`

Source: `.claude/skills/vertuo-do-work/SKILL.md` @ `vertuo-ai-domain@c4a210122`, and the prose
duties of `outbox-policy.mjs` beside it (the module itself was ported earlier as
`kit/lib/policy/outbox-policy.mjs`, see `policy--outbox-policy.md`). Typed `/omni:do-work`.

## Read from config instead of hard-coded

| upstream | here |
|---|---|
| no Step 0 | `omni config`, stop in one line when it fails (spec §2.1 rule 1) |
| `docs/knowledge/`, `docs/glossary.md` | `paths.knowledge` (only when `laws.source` is `knowledge`), `paths.glossary`, every file in `paths.context` |
| plan, slice and PRD found by convention | `omni prd <n>` gives the plan, the spec and the outbox dir; the slice row gives the territory |
| `origin/feat/<topic>`, slice branch by hand | `repo.remote`, the feature branch as an input, `branches.slice` for the slice branch |
| `docs/outbox/<prd>/…` | the outbox dir `omni prd` prints; accounts at `<outbox dir>/accounts/<slice>.md` |
| `renderOutboxItem` + `adoptItem` called by hand, or `scripts/outbox-settle.mjs adopt` | `omni item new --prd --slice --file <file> --json`, which picks the rank and the id; `--adopt` for a medium item when running alone |
| `node scripts/check-decision-coverage.mjs origin/feat/<topic> <prd>` | `omni check coverage --base <remote>/<feature branch> --prd <n>` |
| `pnpm quality:preflight --full` | `commands.preflightFull`, falling back to `commands.preflight` |
| `pnpm check` (implied) | every command in `commands.checks`, then `omni check all` |
| `<behaviour>.pending.feature` → `.feature` | `acceptance.pendingSuffix` under `acceptance.dir`, only when `acceptance.enabled` |
| the browser scenarios run twice against Railway | `acceptance.run`, run twice, only when `acceptance.enabled` |
| `vertuo-pull-request` (PR kind, labels, `Part of #<prd>`, lifecycle) | "follow `/omni:pr`" — labels and link lines are that skill's, read from `labels.*` and `prLinks.*` |
| `vertuo-parallel-wave` dispatch | `/omni:wave`, signalled by the explicit `--in-wave` input |
| "Start From Architecture" (Zod-first, OpenRouter, Kysely, controller-service-repository, `use-intl`, ADR 0037/0040) | `.omni-loop/repo.md` when it exists: the repository's own architecture rules |

## Dropped

- **Railway e2e recipe:** `E2E_BASE_URL`, the door secret, the QA tenant login, `railway variables`,
  `playwright install`, `bddgen`. Replaced by `acceptance.run`.
- **OpenRouter / `system-ai` / `LlmClient`, Zod-first, Kysely / `system-db-core`, prompt/eval
  rules, i18n and `use-intl` (ADR 0037, ADR 0040):** repository architecture; now `.omni-loop/repo.md`.
- **`apps/e2e/handles.json` and `pnpm check:test-handles`:** repository-specific; a repository that
  wants it writes it in `.omni-loop/repo.md` and `commands.checks`.
- **ADR 0061 (PR-creation hook), ADR 0069 (legacy spec path), PRD #985/#1044/#1071/#1081/#1166
  references:** upstream history.
- **"Given a spec path" / standalone PR into `main`:** the loop builds slices only; a legacy spec is
  not an Omni Loop input.
- **"Right-Size The Model (When Delegating)":** a slice is built by one agent, and `/omni:wave`
  already sits two levels deep; do-work delegating further would near the three-level subagent limit.
- **"SOLID In This Repo" examples tied to OpenRouter/Kysely:** kept as three generic lines in Build.
- **"Pair With"** (`vertuo-fix-bug`, `vertuo-testing`, `docs/agents/*.md`): none has an `/omni:` twin.
- **Writing the item text by hand** (the letter-your-own-options fallback): `omni item new` renders it.

## Changed

- **Stops:** upstream's three stops (named law, human action, principles conflict) are now read
  from `omni item new`'s exit code and stderr: `must stop` / `nothing was written (stop)` is the stop
  outcome (named law or principles conflict, merged in one row); `is blocked` is the blocked outcome.
- **Medium items:** upstream always adopted at raise time. Here `--adopt` is passed only when
  running alone; under `--in-wave` the open file is left for `/omni:wave` to adopt after the wave
  merges (the rule the PRD 7 slices themselves follow, to avoid ledger races).
- **"A sub-PR has no CI"** (its lifecycle ends at a green preflight and no conflict with the feature
  branch) and the **Co-Authored-By trailer** line are kept, in the hand-off to `/omni:pr`; the
  Conventional-Commit title and the in-progress label are left to `/omni:pr`.
- **Reading `omni item new`'s outcome from stderr** (`must stop`, `nothing was written (stop)`,
  `is blocked`) is now reading its `--json` output instead (slice s13): `{ outcome, rank, id,
  file, adopted, reason }` on stdout. `outcome` is `null` — not one of `decideRecording`'s three
  values — for a failure that never reached the recording policy at all: an `--adopt` the ledger
  refused, or a rendered item the same check `omni check outbox` runs on every open item would
  reject; either way nothing is written and `reason` says why.
- **Account example** keeps the upstream three-line shape, with placeholders instead of a real path.

## Added

- The `--in-wave` input (explicit; upstream inferred "dispatched by the wave" from context).
- Claim first when running alone: follow `/omni:pr`'s Claim mode (empty claim commit, push, draft
  sub-PR, claimed status comment) before building (spec §2.1 rule 6). Upstream left the claim to the
  wave. Under `--in-wave`, the existing claimed slice branch is checked out, never cut afresh.
- Heartbeat: push work in progress at least every half of `limits.claimStaleMinutes`, so a long live
  slice never reads as a stale claim a second wave could take.
- `/omni:pr` owns marking the sub-PR ready once the preflight is green; do-work hands off to it.
- A `red` status in the wave's result shape, for a preflight or checks that never went green.
- The `--adopt` failure path (exit 1, `nothing was written:`): rerun without `--adopt`, name it in risks.
- "Territory only": a change outside the slice row's territory is a decision, not a fix.
- The item JSON field list, and "exit 2 means your JSON is wrong".
