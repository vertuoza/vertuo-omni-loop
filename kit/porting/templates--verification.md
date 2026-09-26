# `kit/templates/playbook/verification.md`

Source: `docs/agents/verification.md` @ `vertuo-ai-domain@db67fd9da`, with the briefing's
before-every-push line (`docs/agents/briefing.md`). The kit default of the verification form: slots
`preflight`, `before-push`, `checks`, in the spec's order.

## Read from config instead of hard-coded

| upstream | here |
|---|---|
| `pnpm quality:preflight` | `{config:commands.preflight}` (slot `preflight`) |
| `pnpm quality:preflight --full` | `{config:commands.preflightFull}` (slot `before-push`) |

## Dropped (repository literals)

- **The commit hook's mechanics:** Husky, `prepare: husky`, lint-staged, Prettier on the staged
  files, `pnpm quality:guards` and its six seconds, `dist`, `dead-code`, `typecheck`, `lint`, the
  Acceptance `gate`, `AI Evidence QA`, ADR 0060, `lint-staged.config.mjs`,
  `FORMATTABLE_EXTENSIONS`, `scripts/format-changed.mjs`. Kept: a hook runs only the checks that
  need no build, because a slow hook is skipped; a green commit is not a green branch; never skip a
  hook (slot `before-push`).
- **The pre-PR check's steps:** frozen-lockfile install, Node version, Prettier, the Turbo build
  graph and `...[merge-base]`, the guard suites, the dead-code gate, the docs build, `coverage`,
  `test-postgres`, `smoke`, `audit`, `.claude/worktrees/`, ADR 0073, ADR 0061, the PR-creation
  hook. Kept: the preflight runs what a laptop can, stops at the first failure, and names what only
  CI runs (slot `preflight`).
- **The PR gate:** `main` protection, `all-green`, `.github/workflows/ci.yml`,
  `pnpm check:ci-gate`, `pnpm check:workflow-outputs`, `needs.<job>.outputs.<name>`, the release
  note anecdote, and the twelve-row CI job table (`build`, `typecheck`, `lint`, `guards`, `format`,
  `audit`, `test`, `test-postgres`, `coverage`, `smoke`, `docs`, `dead-code`, each with its
  `pnpm quality:*` alias). Kept: every CI job has a local command that runs the same check (slot
  `checks`). The aggregate-counts-a-skip rule is the ci form's (`gating`).
- **`pnpm quality:ci`**, and the two checks outside it (`TEST_DB_DIALECT`, `TEST_DATABASE_URL`,
  `pnpm quality:coverage`, `system-db-core`'s scratch schema, the 67% / 41% figures).
- **Ratchets' specifics:** the 760 unformatted files, `quality:format`, `pnpm format`,
  `pnpm exec prettier --write`, `coverage-thresholds.json`, `pnpm check:coverage-thresholds`, the
  two- and five-point margins, `apps/e2e`, `pnpm coverage:ratchet --raise`,
  `pnpm quality:dead-code`, `.fallowrc.jsonc`, `ignoreDependencies`, `fallow-ignore`,
  `require-suppression-reason`, `pnpm check:suppressions`, `@ts-expect-error`, `eslint-disable`,
  `pnpm check:migration-keys`, `MigrationSet`, Kysely, Cloud Run. Kept: a ratchet only holds or
  improves; never relax one to turn a check green; raising a budget is its own reviewed change; a
  gate never rewrites its own thresholds (slot `checks`). "Format only what you touched" is the
  conventions form's (`formatting`).
- **Driving a browser scenario, whole:** `E2E_BASE_URL`, the Railway preview URL, `E2E_DOOR_SECRET`,
  `AUTH_SERVICE_DOOR_SECRET`, the `E2E_TENANT_*` credentials, `pnpm --filter @vertuo-ai/e2e`,
  `playwright install chromium`, `bddgen`, `railway variables`, QA and the ERP. The acceptance run is
  the kit's `acceptance.run`; "a scenario that passes once has not been shown to pass" stays in
  `/omni:do-work`, and "what a run writes, it keeps" moved to the testing form (`data`).
- **When To Use Which Check:** `pnpm check:layering`, `pnpm quality:typecheck`,
  `pnpm quality:test`, `pnpm quality:dead-code`, `pnpm quality:format`, `pnpm quality:docs`,
  VitePress, and the links to `./testing.md` and `./ci-triage.md`.
- **Handoff Checks:** "New agent guidance remains under `docs/agents/`, with `CLAUDE.md` linking to
  it." The playbook is that place now.
- **From `briefing.md`:** `VERTUO_PREFLIGHT_SKIP=1`. Its rule (an escape hatch is for emergencies,
  and the pull request says why) is the briefing form's (`hooks`).

## Changed

- The opener "Use this page before handing off changes." reads "Use this page when handing off
  changes: …", the spec's "Use this page when …" shape.
- **Workflow** and **Handoff Checks** fold into `checks`: narrowest check first, broaden for shared
  contracts, layering, runtime behaviour or documentation links, and name every check run or skipped.

## Added

- Slot `before-push`: "A sub-pull request runs no CI, so this is its only grade", from the
  briefing's "a sub-PR gets no other grading".
- The spec's slot markers, headings and opener.
