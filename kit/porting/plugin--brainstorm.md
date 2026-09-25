# `kit/plugin/skills/brainstorm/SKILL.md` (`/omni:brainstorm`)

Source: `.claude/skills/vertuo-brainstorming/SKILL.md` @ `vertuo-ai-domain@c4a210122`. Its step 1
("invoke `superpowers:brainstorming` and follow it to the letter") is replaced by that skill's steps
written in (spec §2: no `superpowers:` dependency), taken from `superpowers` 6.4.1
`skills/brainstorming/SKILL.md`. Its executable policy, `phase-0-policy.mjs`, was ported earlier as
`kit/lib/policy/phase-0.mjs` (see `policy--phase-0.md`) and is reached through `omni phase0`.

## Read from config instead of hard-coded

| upstream | here |
|---|---|
| no Step 0 | `omni config`, stop in one line when it fails (spec §2.1 rule 1) |
| `docs/inbox/<prd>-<topic>.md` (the spec) | `spec.md` in the PRD's folder `<nnnn>-<topic>`, in the `inbox` folder under `paths.delivery` |
| `docs/public/inbox/<topic>.html`, `BEFORE_AFTER_MAX_BYTES` (512,000) | `before-after.html` in the same folder; `limits.beforeAfterMaxBytes` |
| `docs/superpowers/plans/<date>-<topic>.md` | `plan.md` in the same folder, written by `/omni:plan` |
| `apps/e2e/features/<area>/<behaviour>.pending.feature` | a file under `acceptance.dir` ending in `acceptance.pendingSuffix`, only when `acceptance.enabled` |
| `docs/glossary.md`, `docs/agents/bdd-acceptance.md` | `paths.glossary` when set, and `paths.context` |
| `feat/<topic>` (`fix/<topic>`), `docs/phase-0-<topic>` | `branches.feature`, `branches.phase0` |
| `.claude/worktrees/<topic>`, `…-phase-0` | `worktrees` |
| `origin`, `main` | `repo.remote`, `repo.defaultBranch` |
| `--label prd` ("create it if missing") | `labels.prd`, under `/omni:pr`'s **Labels** rules (spec §2.1 rule 5) |
| `--label pr:phase-0` ("create it if missing"), `Refs #<prd>` | `labels.phase0` under **Labels**, `prLinks.phase0` |
| `pnpm check:inbox` | `omni check inbox` |
| `pnpm check:phase-0 <prd>` (`scripts/check-phase-0.mjs`) | `omni phase0 <n>`, run after the phase-0 commit (it grades `<base>...HEAD`) |
| `vertuo-plan`, `vertuo-pull-request` | `/omni:plan`, `/omni:pr` |
| `/vertuo-deliver #<n>` or `/vertuo-yolo #<n>` | `/omni:yolo <n>` only |

## Dropped

- **`/vertuo-deliver` as a hand-off:** out of scope (spec §4); the last line is `/omni:yolo <n>`.
- **The `plan:` front-matter field** and upstream's step 6.1 (fill `plan:` and commit): the kit's
  inbox guard refuses a `plan` field by name; the plan is always the sibling `plan.md`.
- **The `## Delivery` spec section:** the plan beside the spec and the Handoff carry it; PRD 7's own
  spec has none.
- **`pnpm check:feature-glossary`:** the kit has no such guard. "Every noun and verb exists in
  `paths.glossary`" stays as prose.
- **`scripts/acceptance-scope.mjs`, issue #217, PRD #985, the VitePress `/docs` route, the worked
  example `inbox-and-planner.html`:** upstream history and repository literals. The claude.ai
  artifact warning keeps its reason without the PRD number.
- **superpowers' Visual Companion:** it runs a script shipped inside the superpowers plugin, which
  this plugin does not carry. The before/after page is the visual output here.
- **superpowers' "write the design doc to `docs/superpowers/specs/…`" and "invoke writing-plans":**
  the spec is the PRD's `spec.md` and the plan step is `/omni:plan`.
- **superpowers' bounded path "implement, no plan document":** a brainstorm here writes no code; a
  bounded idea still becomes a (short) PRD, as upstream's Scaling already had it.
- **superpowers' checklist-as-tasks and the process-flow graph:** the numbered steps are the flow.

## Changed

- **Order:** upstream cut the branch and committed the page and scenarios first, then created the
  issue, then wrote the spec. The page now lives inside a folder named after the PRD number, so the
  issue comes first (step 2), then the branch, then every file.
- **The before/after page is always written** (item s11-01). Upstream wrote none for a change with
  nothing to show; `omni phase0` requires one, so that case writes a short today-beside-after page.
  Scaling's "bounded skips the page" goes with it.
- **`/omni:plan` reuses the feature worktree** (item s11-02): its step 2 would otherwise try to add
  a second worktree on a branch this skill already checked out.
- **The phase-0 PR follows `/omni:pr`'s lifecycle** (item s11-03), as `/omni:pr` already states,
  instead of upstream's "open it (not draft) and stop". A person still merges it.
- **Phase-0 files are taken from `<remote>/<feature branch>`,** not the local branch name: this
  skill's feature branch is checked out in another worktree.
- **The phase-0 check runs after the commit,** because `omni phase0` grades the committed range.
- **The pointer issue body:** paths inside the PRD folder, a `Scenarios:` line only when
  `acceptance.enabled`, and no `#` before the PRD number in commands.
- **`areas`** (new in the kit's inbox format) is described as optional, only when a knowledge
  folder exists.
- **Guardrails section added:** nothing built before approval, one idea one PRD, and spec §2.1
  rule 5 in one line.

## Written in from superpowers brainstorming

- Establish shared understanding: discover intent, write back your understanding, carry it into
  the design.
- The three paths (spike, bounded, architectural), announced before the first question; heavier in
  doubt; the one-way ratchet; decompose an idea holding several subsystems.
- One question per message, multiple choice when possible; two or three approaches, recommended
  first; the design in sections, approval after each; design for isolation; YAGNI.
- The hard gate: a reply approves only the stage it was shown.
- Spec self-review (placeholders, consistency, scope, ambiguity) and the user review of the
  written spec before planning, for the architectural path.
