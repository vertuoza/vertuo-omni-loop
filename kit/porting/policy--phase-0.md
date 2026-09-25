# `kit/lib/policy/phase-0.mjs`

Source: `.claude/skills/vertuo-brainstorming/phase-0-policy.mjs` @ `vertuo-ai-domain@c4a210122`.

## Mapping applied

This module changes more than the other two ports in this task, because its whole subject —
"where does a PRD's spec/plan/before-after live" — is exactly the thing the folders layout (Task
2) replaced upstream's flat `docs/inbox/`/`docs/public/inbox/` scheme with. The task brief's own
clarification names the new shape directly:

> a phase-0 PR's paths are the PRD's own folder files (`spec.md`, `plan.md`, `before-after.html`
> under `ctx.layout.whereIs(prd).dir`) plus, when `ctx.config.acceptance.enabled`, files under
> `acceptance.dir` ending with `acceptance.pendingSuffix` (or `.feature` when the suffix is null).
> Everything else makes the PR not docs-only. `phase0Paths(prd, {ctx})` → `{ spec, plan,
> beforeAfter, acceptanceDir }`.

- `import { BEFORE_AFTER_DIR, INBOX_DIR } from '../../../scripts/inbox.mjs'` and their re-export:
  **deleted**. Neither constant exists in the kit; a PRD's spec/plan/before-after paths are now
  `ctx.layout.specPath(prd)` / `planPath(prd)` / `beforeAfterPath(prd)` (`kit/lib/layout.mjs`,
  Task 2), which resolve through `ctx.layout.whereIs(prd)` rather than a fixed directory constant.
- `PHASE_0_LABEL` (`'pr:phase-0'`) → **deleted** as a module constant; every read site now uses
  `ctx.config.labels.phase0` (defaults to `'pr:phase-0'`, `kit/lib/config.mjs`), per the mapping
  table row (`PHASE_0_LABEL` → `ctx.config.labels.phase0`). No longer exported — not in the task's
  `Produces:` list.
- `PHASE_0_BASE` (`'main'`) → **deleted**; every read site now uses `ctx.config.repo.defaultBranch`
  (defaults to `'main'`), per the mapping table row. No longer exported.
- `PLAN_DIR` (`'docs/superpowers/plans'`): **deleted**. Upstream used it nowhere in this file except
  as an unused-by-this-module export (the plan file's path in the folders layout is
  `ctx.layout.planPath(prd)`, already inside the PRD's own folder — there is no separate "plans"
  directory to name). Not in the task's `Produces:` list.
- `PENDING_FEATURE_SUFFIX` (`'.pending.feature'`) → **deleted** as a module constant; replaced by
  `ctx.config.acceptance.pendingSuffix ?? '.feature'` (the task's own clarification: "or `.feature`
  when the suffix is null"), read inside a new private `acceptanceSuffix(ctx)` helper.
- `inboxFilePath(prd, topic)` / `beforeAfterPath(topic)`: **deleted**. Both built a path from a
  topic string under a fixed directory; the folders layout instead resolves a PRD's own file paths
  directly from `ctx.layout`, with no topic argument needed at this module's level (the topic lives
  inside the folder name, e.g. `1015-inbox-and-planner/`, which `ctx.layout.whereIs` already
  parses). Not in the task's `Produces:` list.
- `PHASE_0_REQUIRED_KINDS`: kept, but renamed its first element from `'inbox'` to `'spec'` —
  `['inbox', 'plan', 'before-after']` → `['spec', 'plan', 'before-after']` — matching the folders
  layout's own file name (`spec.md`, not an inbox file) and `phase0Paths`'s own field name (`spec`,
  per the task's `Produces:` line).
- `PHASE_0_PATH_KINDS` (`['inbox', 'plan', 'before-after', 'pending-feature', 'docs', 'source']`):
  **deleted, and the `'docs'` kind dropped entirely** — the task's own clarification is explicit:
  "Everything else makes the PR not docs-only." Upstream tolerated a fourth bucket (an
  incidental document — a glossary entry, the inbox format's own README) that counted as neither a
  required kind nor a violation; the ported version has no such bucket. This is a **deliberate
  behavior change** from upstream, not an oversight — see the rewritten test named for it below.
  Not in the task's `Produces:` list, so not exported.
- `classifyPhase0Path(path)` → `classifyPhase0Path(path, { ctx, prd })`, per the task's own
  `Produces:` line. Completely rewritten:
  - The three specific kinds (`inbox`/`plan`/`before-after` upstream) are now computed by an exact
    string match against `phase0Paths(prd, { ctx })`'s three fields — **specific to the one PRD
    named**, not "any PRD's own folder." **Design decision, since the brief does not spell out
    whether the match is per-PRD or structural:** grading a candidate phase-0 pull request always
    happens for a known PRD (the one the brainstorm is about), and a path belonging to a
    *different* PRD's own folder showing up in that diff is exactly the kind of out-of-scope change
    a phase-0 gate exists to catch — so it classifies as `'source'`, not as a document. See the new
    test "a file in a DIFFERENT PRD's own folder is source too."
  - The acceptance-pending kind (`'pending-feature'` upstream, renamed `'pending-acceptance'` here
    to match `ctx.config.acceptance`'s own name) is still PRD-agnostic — the acceptance directory
    is a single repository-wide config value, not nested per PRD — computed by a new private
    `isPendingAcceptance(file, ctx)`, gated on `ctx.config.acceptance.enabled` per the task's own
    clarification ("acceptance paths are a phase-0 kind only when `acceptance.enabled`").
  - The `'docs'` kind and its own two-line special case (`docs/inbox/README.md` reading as a
    document rather than an inbox file) are gone — there is no README special case any more,
    because there is no `'docs'` bucket to fall into (see above). Anything that is not the PRD's
    own three files or a pending-acceptance file is `'source'`.
- `isDocsOnly(paths)` → `isDocsOnly(paths, { ctx })`. **Interpretation, since the task's own
  interface line gives this function no `prd` parameter** (`isDocsOnly(paths, { ctx })`, unlike
  `classifyPhase0Path`'s and `phase0Verdict`'s own `{ ctx, prd }`): it cannot do the exact,
  PRD-specific match `classifyPhase0Path` does, so it instead asks a **structural** question — is
  each path SOME PRD's own `spec.md`/`plan.md`/`before-after.html` (via a new private
  `ownDeliveryFileKind(file, ctx)`, a regex built from `ctx.layout.dirs.inbox`/`dirs.shipped`,
  matching any folder name) or a pending-acceptance file — without asking WHICH PRD. This makes
  `isDocsOnly` a looser, PRD-agnostic sibling of `classifyPhase0Path`'s stricter, PRD-exact
  check: a path can pass `isDocsOnly` (it looks like a document) while still classifying as
  `'source'` under `classifyPhase0Path` for a specific PRD (it is some OTHER PRD's document) — see
  the same new test above, which exercises both functions on the one path to make the asymmetry
  explicit.
- `sourceFiles(paths)`: **no longer exported** (not in the task's `Produces:` list) — kept as a
  private helper `isDocsOnly` calls; `phase0Verdict`'s own `carries.source` computation is
  independent (built from `classifyPhase0Path`, the PRD-exact check), so the two never share one
  implementation.
- `phase0Verdict(paths, { needsBeforeAfter = true } = {})` → `phase0Verdict(paths, { ctx, prd,
  needsBeforeAfter = true } = {})`, per the task's own `Produces:` line. Body rewritten to classify
  every path with `classifyPhase0Path(file, { ctx, prd })` (the PRD-exact check, not `isDocsOnly`'s
  looser one — a verdict is always about one named PRD); `carries`'s keys renamed `inbox` → `spec`
  and `pending-feature` → `pending-acceptance`; `label`/`base` fields now read `ctx.config.labels.
  phase0` / `ctx.config.repo.defaultBranch` instead of the deleted `PHASE_0_LABEL`/`PHASE_0_BASE`
  constants.
- `phase0Reason`: unchanged logic; its `ok` branch's wording changed from "the inbox file, the plan
  and the before/after" to "the spec, the plan and the before/after" (kind renamed, per above).
- `beforeAfterHandoff(value)`: **the task's own `Produces:` line gives this function no `ctx` (and
  no `prd`) at all** — `beforeAfterHandoff(value)`, unlike every other function in this module.
  Upstream's own version validated a candidate path against the fixed literal `BEFORE_AFTER_DIR`
  (`docs/public/inbox/`); with no `ctx`, this port cannot know a specific PRD's own delivery folder
  (`ctx.layout.whereIs(prd).dir`, which varies per PRD and needs `ctx` and `prd` both to resolve).
  **Design decision:** the check is loosened to a structural one — the stated path's basename must
  be exactly `before-after.html`, wherever it sits — since that is the one invariant this function
  can check without `ctx`. A caller that also has `ctx` and `prd` can additionally compare the
  accepted path against `phase0Paths(prd, { ctx }).beforeAfter` for an exact match; the module doc
  says so. This **is a real loosening of upstream's own rule** ("the right place is named"), and is
  reflected in the rewritten test below, since it could no longer be proven with this signature.
- `refusal(value, reason)`: unchanged.
- Module doc comment: reworded throughout to drop `.claude/skills/vertuo-brainstorming/SKILL.md`,
  `scripts/inbox.mjs`, `docs/inbox/`, `docs/public/inbox/`, `docs/superpowers/plans` literals in
  favour of "the brainstorming skill", `ctx.layout.specPath`/`planPath`/`beforeAfterPath`, and the
  PRD's own delivery folder.
- No CLI half to remove: `.claude/skills/vertuo-brainstorming/phase-0-policy.mjs` never had a
  `process.argv[1] === fileURLToPath(...)` block, so rule 3 applies vacuously.

## Test (`phase-0.test.mjs`)

Rewritten against folders fixtures (`makeRepo`, `kit/test/fixture.mjs`), per the task's own
instruction — upstream's fixtures are flat (`docs/inbox/1015-…`); the kit's own production layout
is folders (`.omni-loop/delivery/inbox/1015-inbox-and-planner/`), so every fixture path changed.
Every SKILL.md-dependent case is deleted (this task ports only the policy module, not a skill file —
there is no `SKILL.md` beside `phase-0.mjs` in the kit at all). Each surviving upstream case keeps
its name/intent per the task's own instruction; every rewrite is listed below.

- Fixture helper `docsOnlyRepo({ files, config })`: seeds one PRD's own `spec.md`/`plan.md`/
  `before-after.html` under `.omni-loop/delivery/inbox/1015-inbox-and-planner/` plus one pending
  acceptance file under `features/`, with `acceptance.enabled: true`, `acceptance.dir: 'features'`,
  `acceptance.pendingSuffix: '.pending.feature'` — the folders-layout equivalent of upstream's
  `DOCS_ONLY` array fixture.
- **"the spec is in an inbox file, named after the PRD and sorted by it"** → **rewritten** as "the
  spec sits in the PRD's own folder, and phase0Paths finds it": drops `inboxFilePath`/`INBOX_DIR`
  (deleted) and instead asserts `phase0Paths(PRD, { ctx })` against `` `${DIR}/spec.md` `` etc.,
  and `classifyPhase0Path(paths.spec, { ctx, prd: PRD })` is `'spec'`. Same intent (the spec lives
  at a predictable, PRD-named location) under the new layout.
- **"the issue is a pointer and the spec is a file, and the skill says which is which"** →
  **deleted**. Reads `SKILL.md` text directly; no such file exists to port against in this task.
- **"a phase-0 pull request offers it for review — docs-only, into main, labelled"** →
  **rewritten** as "…into the default branch, labelled": same intent, asserting `verdict.ok`,
  `docsOnly`, `missing`, `label` (now `ctx.config.labels.phase0`, still `'pr:phase-0'` by default),
  `base` (now `ctx.config.repo.defaultBranch`, still `'main'` by default), and `carries.spec`/
  `plan`/`before-after`/`pending-acceptance` (renamed from `carries.inbox`/`carries['pending-
  feature']`) — against the folders fixture's own paths.
- **"no source file is in that pull request — one is enough to refuse it, and it is named"** →
  ported near-verbatim, same intent, against the folders fixture's paths and `isDocsOnly(…, {
  ctx })`/`phase0Verdict(…, { ctx, prd: PRD })`'s grown signatures.
- **"a test beside the skill is refused too"** → **rewritten** as "an unrelated file elsewhere is
  refused too": same intent (an incidental extra file breaks docs-only), using
  `kit/lib/policy/phase-0.test.mjs` and `package.json` in place of `scripts/inbox.test.mjs` (which
  does not exist in the kit).
- **"docs-only is not enough — a pull request carrying no plan is a docs change, not a phase-0"** →
  ported near-verbatim, same intent, against `phase0Verdict([paths.spec], { ctx, prd: PRD })`.
- **"a change with nothing to show says so, and is not made to invent a page"** → ported
  near-verbatim, same intent, `needsBeforeAfter: false`.
- **"the README of the inbox format is a document, never mistaken for an inbox file"** →
  **rewritten with the OPPOSITE assertion**, per the deliberate behavior change documented above:
  now named "any other file is not a recognized phase-0 document, even a harmless one, and breaks
  docs-only" — asserts `classifyPhase0Path` returns `'source'` (not `'docs'`, which no longer
  exists) for `` `${DIR}/README.md` `` and `'docs/glossary.md'`, and that carrying one alongside the
  PRD's own spec breaks `isDocsOnly`. This is the one case where the ported assertion's *outcome*,
  not just its plumbing, is the opposite of upstream's — flagged here per rule 6's spirit, even
  though rule 6 speaks of literal substitutions rather than a policy shape change; the task's own
  clarification text is the authority for the new outcome.
- **New (not in upstream, added to exercise the PRD-exact vs. PRD-agnostic asymmetry documented
  above):** "a file in a DIFFERENT PRD's own folder is source too — this PRD carries only its own
  three" and "names the three required kinds once, in the order a reviewer wants them" (the latter
  simply pins `PHASE_0_REQUIRED_KINDS`, which upstream's own test file never asserted directly).
- **"the skill still runs the upstream brainstorm, still writes Gherkin only where a browser can
  see it, and still plans"** → **deleted**. Reads `SKILL.md` text directly.
- **"the before/after is a self-contained page in the repository"** → ported near-verbatim, against
  `phase0Paths(PRD, { ctx }).beforeAfter` in place of `beforeAfterPath('inbox-and-planner')`.
- **"the handoff points at that path rather than a private link"** → ported verbatim; `
  beforeAfterHandoff` takes no `ctx` either upstream or here, so nothing changed.
- **"any published link is refused, not only a claude.ai one"** → ported verbatim, same reason.
- **"a repository path somewhere else is refused, and the right place is named"** → **rewritten**
  as "a repository path with the wrong file name is refused", per the loosening documented above:
  upstream refused `'docs/before-after.html'` by name (the wrong DIRECTORY, checked against the
  fixed `BEFORE_AFTER_DIR` constant); this port cannot check a directory at all without `ctx`/`prd`,
  so the rewritten case instead refuses `'docs/before-after-page.html'` for the wrong FILE NAME —
  the one thing `beforeAfterHandoff` can still check. **This is a narrower guarantee than
  upstream's own test proved**, and is called out here per rule 6.
- **"a change with nothing to show states none, and a blank line is not that statement"** → ported
  verbatim.
- **"the skill's own handoff names a repository path and no claude.ai URL"**,
  **"the skill stops publishing an artifact, and says in prose why a private link is not enough"**,
  **"the skill names the phase-0 label and base exactly once each, as constants this module
  holds"** → **all three deleted**. All three read `SKILL.md` text directly; no such file exists
  to port against in this task.

## Gate

`pnpm vitest run kit/lib/policy/phase-0.test.mjs kit/test/no-literals.test.mjs` — 15/15 pass (14 in
`phase-0.test.mjs`, 1 in `no-literals.test.mjs`).
