# Plan: Bug fixes prove a bug that only shows in a production build

PRD #2275, spec beside this plan (`spec.md`). The feature branch `feat/prod-build-bugs` merges into
`main` through the feature PR (`Closes #2275`); each slice is a sub-PR from
`feat/prod-build-bugs--<slice>` into the feature branch (`Part of #2275`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `commands.smoke` is a config key: `null` when absent, read as written, an empty one refused with an error naming it | `kit/lib/config.ts` `kit/lib/config.test.ts` | — | 1 | light |
| s2 | `/omni:bug-fix` proves a build-level bug at the smoke level: a passing reproduction has three readings, the third moves up to `setup` then `commands.smoke`, stop rule 7 stops with no runnable smoke, a stop keeps the reproduction on a pushed branch, a critical stop opens with the `[!CAUTION]` alert, the guard is the smoke run by CI, and the record names its level; the `bug-fixing` form's kit default says the same | `kit/plugin/skills/bug-fix/` `kit/test/bug-fix-smoke.test.ts` `kit/test/bug-fix-proof.test.ts` `kit/templates/playbook/bug-fixing.md` `kit/porting/plugin--bug-fix.md` `kit/porting/templates--bug-fixing.md` | — | 1 | build |
| s3 | `/omni:bug-fix` posts its triage at once with Reproduction and Branch `pending`, edits it in place at steps 5 and 7, adds the `Production:` line (the deployed version, the first occurrence in UTC read from the report's source and matched against releases), and takes a release range as regression evidence | `kit/plugin/skills/bug-fix/` `kit/test/bug-fix-smoke.test.ts` `kit/porting/plugin--bug-fix.md` | — | 2 | build |
| s4 | `/omni:mega-bug-fix` follows both in each target: its rule and **Never** allow a target's committed `setup`, preflight, then `smoke`; step 4 reads each target at the deployed tag; step 7 moves up to a target's smoke, or stops by rule 7 naming the target and pushing nothing elsewhere; the guide tells a target how to commit `commands.smoke` and when the skills run it | `kit/plugin/skills/mega-bug-fix/` `kit/test/bug-fix-smoke.test.ts` `docs/guide/several-repositories.md` | s2, s3 | 3 | build |

**Shared ground.** `kit/plugin/skills/bug-fix/` and `kit/porting/plugin--bug-fix.md` are declared by
s2 (steps 7, 9, 11, 13, the stop rules and **Never**) and s3 (step 3 and the step 5 and 7 edits of
the triage): s3 moves to wave 2 so the two never share a wave. `kit/test/bug-fix-smoke.test.ts`, the
one file that tests this PRD's skill text, is declared by s2, s3 and s4, in waves 1, 2 and 3: each
adds its own `describe` block. `kit/test/bug-fix-proof.test.ts` pins stop rule 3's comment text
(`the reproduction misses the bug or the bug is already gone`); s2 alone may touch it, only where
its rule 3 wording changes. The law proofs and the pinned rule text in `kit/test/plugin.test.ts`
and `kit/bin/help.test.ts` (`other than its own committed setup, then its own committed
preflight`) belong to no slice: s4 keeps that phrase whole and appends the smoke after it, so they
stay green unchanged. `kit/dist/` and `apps/omni-app/api/` are generated: no slice commits them,
and the wave rebuilds them once after merging.

## Per slice: done when

### s1 (light: one config key and its test)

- `parseConfig('kit: 1\n').commands.smoke` is `null`.
- `parseConfig` reads `commands:\n  smoke: bun run build && bun run test:smoke` as that string.
- `commands:\n  smoke: ""` throws an error naming `commands.smoke`, as `commands.design` does.
- The key carries a comment naming PRD 2275 and its meaning: it builds what the repository ships to
  production, then runs checks against the built output; only the bug-fix skills run it.

### s2

- Step 7 names three readings of a passing reproduction, in order: it misses the bug, the bug is
  already gone, this level cannot see it; and says when the third applies (an error the source
  cannot produce, or a regression range that changes the toolchain).
- Under the third reading, step 7 runs `setup` then `commands.smoke` with the case added, before
  any fix: smoke red is the red; smoke green too is stop rule 3; smoke set but not runnable here
  takes the CI run of smoke on the reproduction alone when CI runs it; otherwise stop rule 7.
- **Stop rules** hold rule 7 verbatim: *The bug lives in the build and the repository commits no
  `commands.smoke` it can run: stop, keep the reproduction, comment on the issue with the suspect,
  the production evidence and the line to commit. Never fix without red.* Rule 3 says a unit-level
  pass alone never reaches it while the third reading applies.
- Stop rules 3, 4 and 7 commit the reproduction and push the branch; rule 7 also opens the draft PR
  labelled `labels.needsFix`; the stop's comment links the branch and names the reproduction.
  **Never** says the reproduction, its branch and its worktree are never deleted on a stop.
- A stop whose risk is `critical` starts its comment with `> [!CAUTION]` and
  `> critical — nothing is fixed.`, mentions nobody, and the hand-off prints that line first.
- Step 9 writes `Guard: <the case> in commands.smoke, run by CI` when a workflow under
  `.github/workflows/` runs the command, else `Guard: none — <repository>'s CI does not run
  commands.smoke` with the CI step named in the PR body and on the issue; it says the skill never
  edits CI.
- The record template's **Reproduction** holds `- **Level:** <unit | acceptance | smoke>`.
- `kit/templates/playbook/bug-fixing.md`'s Steps name the third reading, and its Guard names the
  smoke run by CI; `omni kb show bug-fixing` prints both as the kit default.
- `kit/test/bug-fix-smoke.test.ts` checks each line above in the skill text, section by section;
  `kit/test/bug-fix-proof.test.ts` and `kit/test/plugin.test.ts` stay green.
- The porting logs record the change under PRD 2275.

### s3

- Step 3 posts the `<!-- omni-bug:triage -->` comment with `- **Reproduction:** pending` and
  `- **Branch:** pending`; steps 5 and 7 edit those two lines in place, found by the marker.
- The triage template holds `- **Production:** <deployed version> · first seen <YYYY-MM-DD HH:MM>
  UTC (<source>) · <count> occurrences`, after **Regression**, only when the report comes from
  production.
- Step 3 says the first occurrence is read from the report's source with its time zone, never from
  the issue's date, written in UTC, and matched against `gh release list --json tagName,publishedAt`
  and the repository's GitHub deployments; the deployed version is the last one before it; an
  unminified stack's top frame is cited as `<file>:<line>`.
- The regression evidence accepts `<previous tag>..<tag> (first seen <time> UTC, none before)`, and
  the suspect diff is read with `git log <previous tag>..<tag>`.
- `kit/test/bug-fix-smoke.test.ts` gains a block checking each line above.

### s4

- The paragraph **Code runs only from a target's own config** and **Never** allow, beyond `git` and
  `gh`, a target's own committed `setup`, then its own committed preflight, then its own committed
  `smoke` when step 7 moves up to it, and keep the phrase `other than its own committed setup, then
  its own committed preflight` whole.
- Step 4 reads each target at the deployed tag the triage names, besides its default branch; the
  fix is still cut from the default branch.
- Step 7 says the third reading moves up to the target's `commands.smoke`, read from its default
  branch's config; with none it can run, stop rule 7 names the target in the plan repository's issue
  and pushes nothing to any other target.
- The triage's **Production** line is read in the target the report comes from.
- `docs/guide/several-repositories.md` shows a target's `commands.smoke` beside its `setup` and
  preflight, says it builds what ships and checks it, and that the bug-fix skills run it only when a
  passing reproduction cannot see the bug.
- `kit/test/bug-fix-smoke.test.ts` gains a block checking each skill line above; the tests of
  `kit/test/plugin.test.ts`, `kit/test/mega-bug-fix-product.test.ts` and `kit/bin/help.test.ts`
  stay green.
