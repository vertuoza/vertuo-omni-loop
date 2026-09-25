# `kit/lib/policy/outbox-policy.mjs`

Source: `.claude/skills/vertuo-do-work/outbox-policy.mjs` @ `vertuo-ai-domain@c4a210122`.

## Mapping applied

- `import { ACCOUNTS_DIR } from '../../../scripts/outbox-account.mjs'` →
  `import { ACCOUNTS_DIR } from '../outbox/account.mjs'` (the kit's own location, Task 8).
- `import { bearsOnFloorsHigh, floorRank, OPTION_LETTERS, OUTBOX_DIR, RANK_VALUES } from
  '../../../scripts/outbox.mjs'` → `import { floorRank, OPTION_LETTERS, RANK_VALUES } from
  '../outbox/outbox.mjs'`. `OUTBOX_DIR` no longer exists in the kit's `outbox.mjs` (Task 5); every
  use below goes through `ctx.layout.outboxDir(prd)` instead. `bearsOnFloorsHigh` is no longer
  imported at all — `decideRecording`'s "a law it can name" check now calls `laws.floorsHigh
  (bearsOn)` directly, per this task's own clarification, rather than through the wrapper.
  `floorRank`'s own signature grew to `floorRank(bearsOn, proposed, laws)` (Task 5), so every call
  site here (`proposeRank`, `renderOutboxItem`) now threads `laws` through.
- `import { idParts } from '../../../scripts/registers.mjs'` → `import { idParts } from
  '../knowledge/registers.mjs'` (Task 5's own location; unchanged signature).
- Added `import { COMMANDS } from '../commands.mjs'` (Task 2).
- `proposeRank({ bearsOn = 'none', hardToRevert = false } = {})` → `proposeRank({ bearsOn = 'none',
  hardToRevert = false, laws } = {})`; body `floorRank(bearsOn, proposed)` → `floorRank(bearsOn,
  proposed, laws)`.
- `decideRecording({ bearsOn, breaksNamedLaw, needsHumanAction, hardToRevert, principlesConflict }
  = {})` → gained a required trailing `laws` field, per this task's own `Produces:` line
  (`decideRecording({ …, laws })`):
  - `breaksNamedLaw && bearsOnFloorsHigh(bearsOn)` → `breaksNamedLaw && laws.floorsHigh(bearsOn)`,
    per the task's own clarification ("`decideRecording`'s 'a law it can name' → `laws.floorsHigh
    (bearsOn)`").
  - `proposeRank({ bearsOn, hardToRevert: hardToRevert || breaksNamedLaw })` → same call, `laws`
    added.
  - `conflictingPrinciples(principlesConflict)` → `conflictingPrinciples(principlesConflict,
    laws)`, whose own body gained the task's second clarification: "a `P-` principle conflict stops
    only when `laws.source === 'knowledge'`". **Interpretation, since the brief states the rule but
    not the exact shape:** where `laws.source !== 'knowledge'`, a `principlesConflict` list is read
    as no conflict at all — the function returns `[]` without validating the ids or throwing —
    rather than being graded and refused. The rationale: a `P-…` id only resolves against a
    knowledge register (`idParts`'s own id shape is a pure string parse, but "is this a principle
    that can conflict" is a knowledge-register concept); a repository that keeps its laws
    elsewhere, or nowhere, has no principles to conflict, so `principlesConflict` names a concept
    this repository does not have. Added a new (not-in-upstream) test for this exact branch: "a
    conflict is read as none at all where laws.source is not 'knowledge'" — see the test section
    below.
- `unknowable`, `AUTHOR_MARK`, `SLICE_STATUSES`, `RECORDING_OUTCOMES`, `recordingDecision`: bodies
  unchanged.
- `CONSULTATION_POLICIES` keyed by `'/vertuo-deliver'` / `'/vertuo-yolo'` → keyed by
  `COMMANDS.deliver` (`/omni-deliver`) / `COMMANDS.yolo` (`/omni-yolo`), per the task's own mapping
  table row ("consultation keys `'/vertuo-deliver'`, `'/vertuo-yolo'` → `COMMANDS.deliver`,
  `COMMANDS.yolo`"); every `command:` field inside each policy object uses the same constant.
- `renderOutboxItem`: `const settledRank = floorRank(bearsOn, rank);` → `const settledRank =
  floorRank(bearsOn, rank, laws);`, and the function gained a required `laws` field on its input
  object (needed for the same reason `proposeRank` did — `floorRank`'s grown signature).
- `SLICE_TIME_GUARD.script`: `'scripts/check-decision-coverage.mjs'` →
  `'.omni-loop/bin/omni.mjs check coverage'`, per the mapping table row ("`pnpm
  check:decision-coverage` / `node scripts/check-decision-coverage.mjs` text | `node
  .omni-loop/bin/omni.mjs check coverage`"). `sliceTimeGuardCommand`'s own template (`` `node
  ${SLICE_TIME_GUARD.script} ${base} ${prd}` ``) is unchanged — the new `script` value already
  omits the leading `node `, so the rendered command is byte-identical in shape to upstream's own:
  `node .omni-loop/bin/omni.mjs check coverage <base> <prd>`.
- `SLICE_TIME_GUARD.caughtBy`: `'the branch-level run — `.github/workflows/outbox.yml` through
  `scripts/outbox-status.mjs`'` → `` "the branch-level run — the outbox gate (`outbox/status.mjs`'s
  `gateResult`)" `` — `.github/workflows/outbox.yml` does not exist in the kit (Task 15 wires CI),
  so the reference is dropped in favour of the kit's own module, matching the wording
  `kit/porting/outbox--status.md` already used for the same idea.
- `accountFile(prd, slice)` → `accountFile(prd, slice, { ctx })`, per the task's own `Produces:`
  line. Body `` `${OUTBOX_DIR}/${prd}/${ACCOUNTS_DIR}/${slice}.md` `` →
  `ctx.layout.outboxDir(prd)` (throwing `PRD ${prd} has no inbox or shipped folder` when it is
  `null`, the same message `settle.mjs`'s own outbox-directory lookups throw) then `` `${outboxDir}
  /${ACCOUNTS_DIR}/${slice}.md` ``.
- `planAccount({ prd, slice, graded, risky, accountFor })` → `planAccount({ prd, slice, graded,
  risky, accountFor, ctx })` — the new trailing `ctx` is needed because its own `file:` field calls
  `accountFile(prd, slice, { ctx })`, which now requires it.
- `ACCOUNT_FORMS`, `renderAccount`, `accountLine`, `changeKey`: bodies unchanged; `ACCOUNT_FORMS.
  item.why` reworded to drop the `docs/outbox/<prd>/` literal in favour of "the PRD's own outbox
  directory".
- Module doc comment: reworded throughout to drop `scripts/outbox.mjs`, `scripts/outbox-settle.mjs`,
  `docs/outbox/<prd>/settled.md`, `docs/outbox/<prd>/accounts/<slice>.md`, `docs/outbox/README.md`,
  `/vertuo-deliver`, `/vertuo-yolo`, `scripts/check-decision-coverage.mjs`,
  `scripts/outbox-status.mjs` and `.github/workflows/outbox.yml` literals/references in favour of
  `outbox.mjs`, `settle.mjs`, `laws.mjs`, `COMMANDS.deliver`/`COMMANDS.yolo`, "the item's own outbox
  directory's settled.md", "the outbox directory's own README", `decision-coverage.mjs` and
  `outbox/status.mjs`'s own `gateResult`.
- No CLI half to remove: `.claude/skills/vertuo-do-work/outbox-policy.mjs` never had a
  `process.argv[1] === fileURLToPath(...)` block, so rule 3 applies vacuously.

## Test (`outbox-policy.test.mjs`)

- Added imports: `flatCtx` (`kit/test/flat-layout.mjs`), `COMMANDS` (`kit/lib/commands.mjs`).
- `import { compare, parseAccount } from '../../../scripts/outbox-account.mjs'` → `from
  '../outbox/account.mjs'`; `import { AnswerSchema, adoptItem } from '../../../scripts/
  outbox-settle.mjs'` → `from '../outbox/settle.mjs'`; `import { gateResult } from '../../../
  scripts/outbox-status.mjs'` → `from '../outbox/status.mjs'`; `import { floorRank,
  parseOutboxItem, RANK_VALUES } from '../../../scripts/outbox.mjs'` → `from '../outbox/outbox.mjs'`.
- Added a module-level `laws` stub, the same shape and the same regex as `kit/lib/outbox/
  outbox.test.mjs`'s own stub (Task 5): `{ source: 'knowledge', floorsHigh: (b) => /^(N\d+|(?:P|BR|
  N)-[A-Z0-9]+-\d+|X-[A-Z0-9]+-[A-Z0-9]+-\d+)$/.test(b) }` (no `resolve` — nothing in this file
  calls `laws.resolve`).
- `itemFields(overrides)`: gained `laws` in its defaults, so every `renderOutboxItem(itemFields(…))`
  call site is unchanged and still gets a `laws` value automatically.
- Every `decideRecording({ … })` / `proposeRank({ … })` call: gained `laws` (or `laws:
  noKnowledge` for the one new case below) as a new field, per Port Protocol rule 6 ("pass
  `markers`/`laws` where a signature grew"). No assertion's *value* changed by this addition alone.
- `CONSULTATION_POLICIES['/vertuo-deliver']` / `CONSULTATION_POLICIES['/vertuo-yolo']` →
  `CONSULTATION_POLICIES[COMMANDS.deliver]` / `CONSULTATION_POLICIES[COMMANDS.yolo]`, per the
  mapping table; `consult({ command: '/vertuo-deliver', … })` / `'/vertuo-yolo'` →
  `COMMANDS.deliver` / `COMMANDS.yolo`; `asksAbout('/vertuo-deliver', …)` /
  `asksAbout('/vertuo-yolo', …)` → `asksAbout(COMMANDS.deliver, …)` / `asksAbout(COMMANDS.yolo,
  …)`. `const COMMANDS = Object.keys(CONSULTATION_POLICIES);` (a local const shadowing the
  imported module) → renamed to `COMMAND_NAMES` to avoid the shadow, values unchanged (now
  `['/omni-deliver', '/omni-yolo']`).
- **Assertion changed, per the task's own mapping table** (command names): `expect(() =>
  consultationPolicy('/vertuo-ship-it')).toThrow(/vertuo-ship-it/);` → `expect(() =>
  consultationPolicy('/omni-ship-it')).toThrow(/omni-ship-it/);` (an arbitrary unknown-command
  string; the `/vertuo-*` shape only mattered for consistency with the other command names in the
  file — rewritten as `/omni-*`, per the brief's own allowance: "assertion changes allowed only for
  command names").
- **Assertion changed, per the task's own mapping table** (the coverage command text):
  `expect(sliceTimeGuardCommand({ base: 'origin/feat/decision-coverage', prd: 1044 })).toBe('node
  scripts/check-decision-coverage.mjs origin/feat/decision-coverage 1044');` → `.toBe('node
  .omni-loop/bin/omni.mjs check coverage origin/feat/decision-coverage 1044');`.
- **Assertion changed** (dependency shape, not this task's own mapping table, but required for the
  test to pass against the already-ported `gateResult`, Task 9): `expect(gateResult('985', {
  root })).toEqual({ ok: true, items: [], overridden: false });` → gained `unreworked: []` and
  `overrideLabel: 'outbox:go'`, matching `gateResult`'s real current shape (see
  `kit/porting/outbox--status.md`) — `{ root }` also became `{ ctx: flatCtx(root) }`.
- `mkdtempSync`/`rmSync`/`existsSync`/`join`/`tmpdir` fixture in "end to end: a medium record
  adopts…": `adoptItem({ root, itemText: text })` → `adoptItem({ ctx: flatCtx(root), itemText:
  text })`; `gateResult('985', { root })` → `gateResult('985', { ctx })` (same `ctx` reused).
- `planAccount({ … })` (every call in `describe('The guard runs on the agent and on the branch',
  …)`): gained a trailing `ctx` field (a plain `flatCtx('/virtual-repo')` — `accountFile` only
  builds a string from `ctx.layout.outboxDir(prd)`, and `flatLayout`'s `outboxDir` never touches
  disk, so no real fixture tree is needed for these pure-shape assertions). `plan.file` still
  equals `'docs/outbox/1044/accounts/s6.md'`, byte-identical to upstream, since `flatLayout`'s
  `outboxDir(1044)` is `` `docs/outbox/1044` ``.
- **`withFixtureRoot`/`fixtureRoot()` helper, in "A skipped account is caught by the branch":**
  renamed to `fixtureCtx()` and now returns `flatCtx(root, { risk: { storedShape: ['^libs/[^/]+/
  src/server/migrations\\.ts$'], sharedContract: ['libs/system-api-contract/'] } })` instead of a
  bare `root`. **Not from this task's own mapping table**, but required: upstream's
  `decision-coverage.mjs` hard-coded the `stored-shape` regex as a module constant, so
  `STORED_SHAPE`'s path always fired regardless of the fixture; the kit's own `decision-coverage.
  mjs` (Task 8) reads `ctx.config.risk.storedShape` instead (`[]` by default), so the fixture must
  set it — reusing the exact literal `decision-coverage.test.mjs`'s own `RISK` constant already
  uses (`kit/porting/outbox--decision-coverage.md`), so the assertion values themselves (`result.
  unaccounted`) are unchanged. `gateResult(1044, { root, changes })` → `gateResult(1044, { ctx:
  tctx, changes })`.
- **Added, not required by the task's own mapping table** (a gap the ported cases alone never
  exercise): `it('a conflict is read as none at all where laws.source is not "knowledge"', …)` —
  builds a `principlesConflict` of two well-formed `P-…` ids against a `laws` stub whose `source`
  is `'none'`, and asserts `decision.outcome` is `'record'` rather than `'stop'`. Proves the
  interpretation documented above under "Mapping applied".
- **Deleted:** nothing. Every upstream test case is ported; none reads the real upstream
  repository, so Port Protocol rule 6's deletion clause never applies here.

## Gate

`pnpm vitest run kit/lib/policy/outbox-policy.test.mjs kit/test/no-literals.test.mjs` — 55/55 pass
(54 in `outbox-policy.test.mjs`, 1 in `no-literals.test.mjs`).

## Final review fixes

- `sliceTimeGuardCommand` emits the CLI's flag form, `node .omni-loop/bin/omni.mjs check coverage
  --base <ref> --prd <n>` (upstream's script took the two positionally; `omni check` takes
  flags). The upstream assertion's expected string changes accordingly; `kit/bin/omni.test.mjs`
  runs the emitted command through `main()` against a fixture holding that base ref.
