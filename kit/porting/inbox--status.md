# `kit/lib/inbox/status.mjs`

Source: `scripts/inbox-status.mjs` @ `vertuo-ai-domain@c4a210122`.

## Mapping applied

- No shebang line, no CLI half, no `main()` existed in this module upstream (`deriveStatus` and its
  two helpers were always pure, with no filesystem or process access) — nothing to delete under
  rule 3.
- `STALL_DAYS` (module constant, `5`) → **removed**, per the task's own mapping table
  (`STALL_DAYS` → `ctx.config.limits.stallDays`, passed in as `stallDays`). `deriveStatus` grows a
  required `stallDays` parameter instead of closing over the constant; there is no default, so a
  caller must say what it means explicitly, matching this task's "context, not root" rigor (a
  pure function taking a narrow, caller-supplied value rather than an ambient constant).
- `CLOSES_RE = /Closes #(\d+)/` and `PART_OF_RE = /Part of #(\d+)/` (module-level, fixed regexes) →
  **removed**, per the task's own mapping table ("Closes #/Part of # regexes … built from
  `ctx.config.prLinks.feature`/`.sub` by replacing `{prd}` with the number and escaping the rest").
  Replaced by a new `prLinkPattern(template, prd)` that builds a single-PRD regex on demand from a
  `{prd}`-templated string (e.g. `'Closes #{prd}'`) and the PRD number being checked:
  - The template is split on the literal `{prd}` token; both surrounding pieces are escaped
    (`escapeRegExp`, the same character class every other kit marker-building helper uses —
    `kit/lib/markers.mjs`'s own `escape`), and the PRD number is substituted verbatim between them.
  - **A word boundary (`\b`) is inserted immediately after the number**, per the task's own
    clarification ("`Closes #{prd}` must not match `Closes #1234` for prd 123 (word boundary after
    the number)"). Upstream's fixed regex captured *any* digit run and compared it numerically
    (`Number(match[1]) === Number(prd)`), which already had this property implicitly (`123` parsed
    from `#1234` is `1234`, not `123`, so it never matched either) — building a PRD-specific regex
    from the start needs its own explicit boundary to keep the same guarantee, since the new regex
    embeds the number as literal text rather than capturing and comparing it.
- `refersTo(regex, body, prd)` (upstream: took a pre-built generic regex, matched, then compared the
  captured group numerically) → `refersTo(template, body, prd)`: builds the PRD-specific regex via
  `prLinkPattern` and simply `.test()`s it — no capture-and-compare step needed, since the number is
  now baked into the pattern itself.
- `findFeaturePr(prd, prs)` → `findFeaturePr(prd, prs, prLinks)`; `findSubPrs(prd, prs)` →
  `findSubPrs(prd, prs, prLinks)` — both grow the `prLinks` parameter per the task's own interface
  list, threading `prLinks.feature`/`prLinks.sub` into `refersTo` in place of the deleted
  `CLOSES_RE`/`PART_OF_RE`.
- `deriveStatus({ prd, featurePrs, lastCommit = null, now = Date.now() })` → `deriveStatus({ prd,
  featurePrs, lastCommit = null, now = Date.now(), stallDays, prLinks })`, per the task's own exact
  signature. Body unchanged in structure — `findFeaturePr`/`findSubPrs` calls now thread `prLinks`
  through, and the stall check reads the injected `stallDays` instead of the deleted `STALL_DAYS`.
- `isMerged(pr)`, `daysSince(date, now)`: unchanged.
- Module doc comment: reworded to drop `.github/workflows/outbox.yml`, `docs/agents/pull-request.md`
  and `.claude/skills/vertuo-pull-request/SKILL.md` literals/references (the last one matches
  `kit/test/no-literals.test.mjs`'s `/vertuo/i` pattern) in favor of "a workflow greps for" and "the
  configured `prLinks.feature`/`prLinks.sub`"; adds a sentence on the new word-boundary guarantee.

## Test (`status.test.mjs`)

Pure module, ported near-verbatim per the task's own instruction ("port upstream tests verbatim …
passing `stallDays: 5` and `prLinks: { feature: 'Closes #{prd}', sub: 'Part of #{prd}' }`") — every
case keeps its name and its expected outcome; the only changes are the new required parameters
threaded through every call, plus one added case for the new word-boundary guarantee.

- Added local `const STALL_DAYS = 5;` (a test-only constant now, since the module no longer exports
  one — `kit/test/no-literals.test.mjs` only scans non-test `.mjs` files, so a plain numeric literal
  here is unrestricted) and `const prLinks = { feature: 'Closes #{prd}', sub: 'Part of #{prd}' };`,
  matching the task's own defaults (`kit/lib/config.mjs`'s `prLinks` section defaults to exactly
  these two templates).
- Every `deriveStatus({ … })` call gains `stallDays: STALL_DAYS, prLinks` — a call-signature
  addition on every single call in the file, not an `expect(...)` change, required by the task's
  own grown signature; listed here in full since it touches every case, not repeated case-by-case
  below. Renamed two case titles that named the deleted constant directly ("… for STALL_DAYS" → "…
  for stallDays", "not stalled a day short of STALL_DAYS" → "… of stallDays") — wording only, same
  assertions.
- Every `findFeaturePr(prd, prs)` / `findSubPrs(prd, prs)` call gains a third `prLinks` argument,
  same reasoning.
- **No assertion values changed** — `prLinks` defaults to the exact templates `CLOSES_RE`/
  `PART_OF_RE` already matched, and `STALL_DAYS = 5` is the same number the deleted constant held,
  so every existing expectation (`'unplanned'`, `'planned'`, `'in-flight'`, `'stalled'`, `'done'`,
  pull-request objects, `toHaveLength(2)`, …) is untouched.
- **Deleted:** nothing — no case here ever read the real upstream repository or relied on
  `STALL_DAYS`/`CLOSES_RE`/`PART_OF_RE` being importable in a way this task's rename breaks; every
  case survives with only the signature additions above.
- **Added**, under `describe('findFeaturePr', …)`, per the task's own word-boundary clarification
  (not from upstream — upstream's numeric-comparison approach made this case impossible to write as
  a *regression* test, since it could never have failed): "does not match a Closes # referring to a
  different, longer PRD number" — a feature PR whose body is `'Closes #1234'`, checked against
  `findFeaturePr(123, prs, prLinks)`, expected `null`. TDD RED confirmed by temporarily dropping the
  `\b` from `prLinkPattern`: `npx vitest run kit/lib/inbox/status.test.mjs -t "longer PRD number"`
  failed, returning the PR object instead of `null` (`123` matched inside `1234` with no boundary).
  GREEN confirmed after restoring the `\b`; full file re-run, 14/14.

## Gate

`pnpm vitest run kit/lib/inbox/status.test.mjs kit/test/no-literals.test.mjs` — 15/15 pass (14 in
`status.test.mjs`, 1 in `no-literals.test.mjs`).
