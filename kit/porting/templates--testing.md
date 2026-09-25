# `kit/templates/playbook/testing.md`

Source: `docs/agents/testing.md` @ `vertuo-ai-domain@db67fd9da`, with two lines from
`docs/agents/ci-triage.md` (wall-clock waits) and one from `docs/agents/verification.md` (what a
shared environment keeps). The kit default of the testing form: slots `commands`, `layout`,
`levels`, `never`, `data`, in the spec's order.

## Read from config instead of hard-coded

| upstream | here |
|---|---|
| `pnpm test` | `{config:commands.test}` (slot `commands`) |

## Dropped (repository literals)

- **The skill pointer:** "Use the repo-local Claude skill `vertuo-testing` …". No `/omni:` twin.
- **Database Tests, whole:** `createTestDatabase(migrations)`, `@vertuo-ai/system-db-core/server`,
  `createDatabase`, `engine.test.ts`, `await db.destroy()` in an `afterEach`, in-memory SQLite, the
  `docker run … postgres:17` recipe, `TEST_DB_DIALECT`, `TEST_DATABASE_URL`, the `test` and
  `test-postgres` jobs, `all-green`, Kysely's `db.introspection.getTables()`, `pragma_table_info`,
  `sqlite_master`, `current_schema()`, `libs/system-db-core/README.md`, `runMigrations`,
  `migrationTableSchema`. Kept, as doctrine: a test that creates shared state tears it down after
  itself (slot `data`).
- **Coverage, whole:** `pnpm test:coverage`, `scripts/run-coverage.mjs`, `process.cwd()`,
  `coverage/coverage-summary.json`, `pnpm coverage:report` and `--md`, `coverage-thresholds.json`,
  `pnpm coverage:ratchet`, the 80 / 80 / 80 / 70 floors, v8 branch counting, and the exclusion list
  (`*.migrations.ts`, `*.database.ts`, Kysely, `*.generated.*`, `registry.generated.ts`, `index.ts`
  barrels, `*.config.*`, `main.ts`, NestJS `*.module.ts`, `Test.createTestingModule()`, the contract
  `MANIFESTS` registry). Kept, as doctrine: coverage measures execution, not correctness; no
  assertion-free test; no floor lowered and no logic excluded to reach a number (slot `never`). The
  ratchet rule moved to the verification form (`checks`).
- **Structured logging specifics:** the captured logger destination stream, `correlationId`,
  `sessionId`, `feature`, HTTP / WebSocket / async correlation, LLM and session records. Kept: a log
  assertion reads emitted records, never a spy, and never expects sensitive content (slot `never`).
- **Canonical References:** `libs/system-logs/src/server/logger.test.ts`,
  `apps/vertuo-ai-api/src/common/correlation.middleware.test.ts`,
  `apps/vertuo-ai-api/src/common/http-logging.interceptor.test.ts`,
  `apps/vertuo-ai-api/src/common/ws-logging.test.ts`,
  `apps/vertuo-ai-api/src/voices/voice-stream.service.test.ts`, and the link to `./verification.md`.
  Kept as the rule behind them: name one existing test per kind, and start a new one from it (slot
  `layout`).
- **Test-level table rows:** "Zod schema" (now "A schema"), "Repository/persistence test" (now "A
  persistence test"), "Controller/API boundary" (now "An API boundary"), "React workflow" (now "A UI
  workflow"); the BDD row's "doctrine only, no current surface in this repo" and its link to
  `./bdd-acceptance.md` (now "An acceptance scenario"); the "Advisor bug" row and its link to
  `./bug-fixing.md`; the "Prompt, scorer, eval behavior" row.
- **From `ci-triage.md`:** `ReferencePickerDialog`, `useReferenceSearch`, `searchQuietMs`,
  `asyncUtilTimeout: 5000`, PR #374, PR #120 and `setTimeout`. Kept: a test never waits on
  wall-clock time it cannot name; raising a timeout is not a fix (slot `never`).
- **From `verification.md`:** the QA tenant, the ERP, "name, e-mail and phone". Kept: what a run
  writes to a shared environment, it keeps, so every record gets a name of its own (slot `data`).

## Changed

- **Workflow** and **What To Cover** are folded into `levels`; the upstream table keeps six of its
  eight rows, reworded as above.
- **Handoff Checks** are spread: "behaviour or risk, not implementation trivia" and the logging
  line to `never`; "invalid inputs and failure paths" to `levels`; "skipped or manual checks are
  named" to the verification form's `checks`.

## Added

- Slot `commands`: "While iterating, run the narrowest test …; run the whole suite before handing
  off", from `verification.md` › Workflow.
- The spec's slot markers, headings and opener; the headings `Where tests live` and `Never` are the
  before/after page's.
