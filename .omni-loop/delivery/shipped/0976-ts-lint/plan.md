# Plan: Type-aware linting at zero, on a suite that holds under load

PRD #976, specified in `spec.md` beside this plan. The feature branch `feat/ts-lint` merges into
`main` through the feature PR (`Closes #976`); each slice is a sub-PR from `feat/ts-lint--<slice>`
into the feature branch (`Part of #976`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The suite holds under load: the kit tests that spawn the CLI in a loop run the loop in process, keeping one real process per behaviour only a process proves | `kit/bin/ask-hook.test.ts` `kit/bin/ask.test.ts` `kit/bin/statusline.test.ts` `kit/bin/version.test.ts` `kit/test/bundle-playbook.test.ts` `kit/test/plugin.test.ts` `kit/test/test-timeouts.test.ts` | — | 1 |
| s2 | The linter lands green: `eslint.config.ts` (strictTypeChecked, numbers allowed in template strings, React's hooks rules on the arcade, `noInlineConfig`), `pnpm lint` reading one ceiling file per area under `scripts/lint-ceilings/`, the `lint` job in CI, the guard refusing `eslint-disable`, `defined` and `at` in `kit/lib/narrow.ts`, and the test assertion helper | `eslint.config.ts` `package.json` `pnpm-lock.yaml` `.github/workflows/checks.yml` `scripts/lint` `scripts/typescript-guard.test.ts` `kit/lib/narrow` `kit/test/assert` `.omni-loop/knowledge/playbook/verification.md` | s1 | 2 |
| s3 | Area kit-bin at zero | `kit/bin/` `scripts/lint-ceilings/kit-bin.json` | s2 | 3 |
| s4 | Area kit-lib-ask-policy-outbox at zero | `kit/lib/ask/` `kit/lib/policy/` `kit/lib/outbox/` `scripts/lint-ceilings/kit-lib-ask-policy-outbox.json` | s2 | 3 |
| s5 | Area kit-lib-rest at zero: every other folder and file of `kit/lib`, the release and the build | `kit/lib/bug/` `kit/lib/care/` `kit/lib/concept/` `kit/lib/constituents/` `kit/lib/credits/` `kit/lib/delivery/` `kit/lib/dossier/` `kit/lib/help/` `kit/lib/inbox/` `kit/lib/init/` `kit/lib/knowledge/` `kit/lib/launch/` `kit/lib/plan-repo/` `kit/lib/playbook/` `kit/lib/proof/` `kit/lib/releases/` `kit/lib/schema/` `kit/lib/status` `kit/lib/update/` `kit/lib/version/` `kit/lib/visual/` `kit/lib/voice/` `kit/lib/board` `kit/lib/check-report` `kit/lib/commands` `kit/lib/config` `kit/lib/context` `kit/lib/fix-verdict` `kit/lib/front-matter` `kit/lib/git` `kit/lib/laws` `kit/lib/layout` `kit/lib/markers` `kit/lib/narrow` `kit/lib/openrouter` `kit/lib/signature` `kit/lib/types` `kit/release/` `kit/build.ts` `scripts/lint-ceilings/kit-lib-rest.json` | s2 | 3 |
| s6 | Area kit-test-packages-scripts at zero | `kit/test/` `packages/` `scripts/personas-import` `scripts/settle-head` `scripts/supabase-types` `scripts/ts-rename` `scripts/vercel-ignore` `scripts/typescript-guard.test.ts` `scripts/lint-ceilings/kit-test-packages-scripts.json` | s2 | 3 |
| s7 | Area game at zero | `game/` `scripts/lint-ceilings/game.json` | s2 | 3 |
| s8 | Area app-retro-tests at zero: the retro's two largest test files | `apps/omni-app/src/retro/retro.test.ts` `apps/omni-app/src/retro/publish.test.ts` `scripts/lint-ceilings/app-retro-tests.json` | s2 | 3 |
| s9 | Area app-core at zero: every App folder but the retro | `apps/omni-app/src/canon/` `apps/omni-app/src/evaluate/` `apps/omni-app/src/git-write/` `apps/omni-app/src/inbox-check/` `apps/omni-app/src/inngest-client.ts` `apps/omni-app/src/knowledge-harvest/` `apps/omni-app/src/octokit-for.ts` `apps/omni-app/src/outbox-check/` `apps/omni-app/src/pr-stats/` `apps/omni-app/src/publish/` `apps/omni-app/src/snapshot/` `apps/omni-app/src/stage-forward/` `apps/omni-app/src/verdict-comment/` `apps/omni-app/src/webhook/` `scripts/lint-ceilings/app-core.json` | s2 | 3 |
| s10 | Area app-test-api at zero | `apps/omni-app/test/` `apps/omni-app/api/` `scripts/lint-ceilings/app-test-api.json` | s2 | 3 |
| s11 | Area arcade-game at zero | `apps/galaxy/src/arcade/` `scripts/lint-ceilings/arcade-game.json` | s2 | 3 |
| s12 | Area arcade-dossier at zero | `apps/galaxy/src/dossier/` `scripts/lint-ceilings/arcade-dossier.json` | s2 | 3 |
| s13 | Area arcade-ask at zero: ask mode, sign-up, the working pings and the proxy | `apps/galaxy/src/ask/` `apps/galaxy/src/signup/` `apps/galaxy/src/working/` `apps/galaxy/src/proxy/` `apps/galaxy/proxy.ts` `scripts/lint-ceilings/arcade-ask.json` | s2 | 3 |
| s14 | Area arcade-business at zero | `apps/galaxy/src/business/` `apps/galaxy/src/business-api/` `scripts/lint-ceilings/arcade-business.json` | s2 | 3 |
| s15 | Area arcade-dashboard-jev at zero | `apps/galaxy/src/dashboard/` `apps/galaxy/src/jev/` `scripts/lint-ceilings/arcade-dashboard-jev.json` | s2 | 3 |
| s16 | Area arcade-data-nav at zero: data, navigation, home and stages | `apps/galaxy/src/data/` `apps/galaxy/src/nav/` `apps/galaxy/src/home/` `apps/galaxy/src/stages/` `scripts/lint-ceilings/arcade-data-nav.json` | s2 | 3 |
| s17 | Area arcade-work at zero: engineering, agent connect, outbox, knowledge, repositories, waiting and docs | `apps/galaxy/src/engineering/` `apps/galaxy/src/agent-connect/` `apps/galaxy/src/outbox/` `apps/galaxy/src/knowledge/` `apps/galaxy/src/repositories/` `apps/galaxy/src/waiting/` `apps/galaxy/src/docs/` `scripts/lint-ceilings/arcade-work.json` | s2 | 3 |
| s18 | Area arcade-rest at zero: every arcade folder and file no other slice names | `apps/galaxy/src/releases/` `apps/galaxy/src/fleets/` `apps/galaxy/src/proof/` `apps/galaxy/src/play-dock/` `apps/galaxy/src/fixes/` `apps/galaxy/src/profile/` `apps/galaxy/src/constituents/` `apps/galaxy/src/design/` `apps/galaxy/src/timings/` `apps/galaxy/src/people/` `apps/galaxy/src/switch/` `apps/galaxy/src/outbox-waiting/` `apps/galaxy/src/skeleton/` `apps/galaxy/src/design-system` `apps/galaxy/src/no-vertuoza-fleets` `apps/galaxy/src/page-width` `apps/galaxy/src/perf-sql` `apps/galaxy/app/` `apps/galaxy/scripts/` `apps/galaxy/artifact/` `apps/galaxy/next.config.ts` `apps/galaxy/source.config.ts` `scripts/lint-ceilings/arcade-rest.json` | s2 | 3 |
| s19 | Area app-retro at zero: the rest of the retro | `apps/omni-app/src/retro/` `scripts/lint-ceilings/app-retro.json` | s8 | 4 |
| s20 | Zero, for good: `scripts/lint-ceilings/` and the ceiling logic deleted, so `pnpm lint` passes only with no finding at all | `scripts/lint` `package.json` | s3, s4, s5, s6, s7, s9, s10, s11, s12, s13, s14, s15, s16, s17, s18, s19 | 5 |

**Shared ground.**

- **s1 and s2.** s2 waits for s1 (wave 2), so the ceilings it writes are counted after s1 has
  reshaped the kit tests it owns. Otherwise the kit-bin ceiling would be wrong the moment s1 merged.
- **The ceilings.** s2 writes one file per area under `scripts/lint-ceilings/`, named as in the
  table, each holding the area's path prefixes and its ceiling. A finding outside every area fails.
  Each wave-3 slice edits only its own area's file, so sixteen slices run side by side without
  sharing a line. s20 deletes the folder.
- **`scripts/`.** s6 names its scripts file by file, so it never covers `scripts/lint` (s2, s20) or
  `scripts/lint-ceilings/` (every area slice).
- **The retro.** `apps/omni-app/src/retro/` is split: s8 owns its two largest test files (671
  findings) in wave 3, s19 the rest in wave 4, because s19's folder prefix covers s8's files.
- **`kit/lib/narrow`.** s2 adds `defined` and `at` (wave 2); s5 may then use and lint it (wave 3).
  No wave-3 slice other than s5 edits it. A slice that finds another narrowing pattern writes its
  helper inside its own territory and says so in its sub-PR.
- **Kit source and the bundle.** s3, s4 and s5 change kit source in the same wave, and
  `kit/test/dist` pins `kit/dist/omni.mjs` to a fresh build. None of them commits the bundle; the
  wave check rebuilds it once on the feature branch, as PRD 942's did.

## Per slice: done when

**s1**

- No test in its territory spawns a process inside a loop: the matrix cases run in process through
  `main()`, and each behaviour only a real process proves (the plugin's `hooks.json` wiring, the
  end-to-end run, "never fails a hook", the version and statusline entry points) spawns once.
- Every behaviour the files proved before is still proved; the test count is at least what it was.
- `kit/bin/ask-hook.test.ts` passes while a second full `pnpm test` runs at the same time.
- `pnpm typecheck`, `pnpm test`, `fallow audit` and `omni check all` are green.

**s2**

- `eslint.config.ts` sets `strictTypeChecked`, `restrict-template-expressions` with numbers
  allowed, `rules-of-hooks` and `exhaustive-deps` on `apps/galaxy`, `noInlineConfig: true`, and
  ignores only `supabase/database.types.ts` and `kit/dist/`.
- `pnpm lint` runs it over every `.ts` and `.tsx` file git tracks, counts the findings per area, and
  fails when an area's count differs from its ceiling, or a finding falls outside every area, each
  with a message naming the area and the number to write. Fixtures prove above, below, equal and
  outside.
- The seventeen ceiling files under `scripts/lint-ceilings/` hold today's counts; `pnpm lint` passes.
- The `lint` job runs `pnpm lint` in `.github/workflows/checks.yml` beside `typecheck`.
- `scripts/typescript-guard.test.ts` fails on an `eslint-disable` comment, naming the line; the
  arcade's existing `react-hooks` comments are deleted, their findings counted in the ceilings.
- `defined` and `at` in `kit/lib/narrow.ts`, and the assertion helper under `kit/test/assert`, each
  with a test that accepts and one that refuses.
- The verification playbook names `pnpm lint` among the checks.
- `pnpm typecheck`, `pnpm test`, `fallow audit` and `omni check all` are green.

**s3 to s19** (each in its own territory)

- `pnpm lint` reports no finding in the territory, and the area's ceiling file says 0.
- No `eslint-disable` comment, and no check deleted on the type's word alone: a value from outside
  that was not parsed is widened or parsed instead.
- The arcade slices: every `exhaustive-deps` fix keeps the effect running on the same changes, and
  the sub-PR names each one.
- The sub-PR's body gives the territory's count before and after, per rule.
- A real bug a rule revealed is an outbox item; the slice fixes it only when the fix changes no
  output.
- `pnpm typecheck`, `pnpm test` (at least as many tests as before), `fallow audit` and
  `omni check all` are green.

**s20**

- `scripts/lint-ceilings/` and the code that read it are gone; `pnpm lint` is the linter over the
  repository, failing on any finding.
- `pnpm lint` passes, and so do `pnpm typecheck`, `pnpm test`, `fallow audit` and `omni check all`.
