# Plan: a mission's pull request is ready only when five checks prove it

PRD #2898, specified in `spec.md` beside this plan (its before/after in `before-after.html`). It is
built on the feature branch `feat/ready-five-checks` into `main` (`Closes #2898`), each slice a
sub-PR from `feat/ready-five-checks--<slice>` into the feature branch (`Part of #2898`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The rule: a pure validator (facts in, verdict out) of the five checks, each `pass`, `fail`, `not finished` or `not judged · <why>`, ready only on five `pass`; the loosening detector of the four kinds; the parser of `### AC-n · kind` Gherkin criteria and of the acceptance report; excuses read only from an item's `excuses:` paths and its settled verdict; the settings `ready.checks` (`off` by default), `ready.full`, `acceptance.kind`, `e2e.ci`, `e2e.repo` and the label `omni:ready-check`; `omni item new` writing `excuses:`, refusing a folder or a pattern | `kit/lib/ready/` `kit/lib/config` `kit/lib/schema/` `kit/lib/outbox/` `kit/bin/commands/item.ts` `kit/bin/item.test.ts` `kit/lib/help/entries.ts` `kit/lib/help/entries.test.ts` | — | 1 | deep |
| s2 | The AC format in specs: `omni check inbox` refuses an `AC-` number missing or twice, a missing or unknown kind, a scenario without a Given, a When and a Then, and still reads plain bullets; `/omni:brainstorm` writes each criterion as an `### AC-n · <kind>` scenario, the kind from `acceptance.kind` | `kit/lib/inbox/` `kit/plugin/skills/brainstorm/` `kit/porting/plugin--brainstorm.md` `kit/test/brainstorm-` | s1 | 2 | build |
| s3 | `omni ready <prd> [--json]`: reads through `gh` the head commit's runs, the `acceptance` check run, the diff against the default branch, the plan and the ledger at the head, and whether the PRD is in a running or paused mission; runs the rule and prints the five checks and the verdict, exit 0 only on 5 of 5; listed in the help | `kit/bin/commands/ready.ts` `kit/bin/ready.test.ts` `kit/bin/commands/index.ts` `kit/lib/ready/gh-facts` `kit/lib/mission/` `kit/lib/help/entries.ts` `kit/lib/help/entries.test.ts` | s1 | 2 | build |
| s4 | The gate: `/omni:review`'s pass adds `omni:ready-check` to the draft, runs `omni ready <prd>` before `gh pr ready`, and on a red verdict leaves the draft and ends `changes`, the failing check its finding; `/omni:yolo` and `/omni:yolo-fix` run the same line only under `ready.checks: all` | `kit/plugin/skills/review/` `kit/plugin/skills/yolo/` `kit/plugin/skills/yolo-fix/` `kit/porting/plugin--yolo.md` `kit/porting/plugin--yolo-fix.md` `kit/test/review-skill.test.ts` `kit/test/ready-gate` | s3 | 3 | build |
| s5 | CI on a labelled draft: `omni:ready-check` starts the full checks, the e2e job and the preview on the draft's latest commit and again on each push; the test job writes the AC report; the e2e job waits for the preview, runs the PRD's `e2e` scenarios with `E2E_TELEMETRY_DISABLED=1` and keeps its HTML report as an artifact; the `acceptance` check run is written on the head commit; the e2e package installed with its config in `e2e/` | `.github/workflows/checks.yml` `.github/workflows/preview-debounce.yml` `scripts/checks-workflow.test.ts` `scripts/preview-debounce.test.ts` `scripts/acceptance-` `e2e/` `package.json` `pnpm-lock.yaml` `vitest.config.ts` | s1 | 2 | deep |
| s6 | `/omni:validate-e2e` turns each `e2e` scenario of a spec into one test titled `AC-n: …`, tagged `prd-<n>`, each Given and When an `agent.act`, each Then an `agent.assert`, the scenario's lines kept verbatim | `kit/plugin/skills/validate-e2e/` `kit/lib/e2e/` `kit/test/validate-e2e-` | s1 | 2 | build |
| s7 | The App's check `omni / ready`: on each new commit of a gated PR it reads the facts at the head, runs the same rule, posts the five states each linking its evidence, signed as the App's, and saves the verdict in `public.ready_verdicts` (members read, only the service role writes); it posts nothing under `ready.checks: off` | `apps/omni-app/src/ready-check/` `apps/omni-app/src/jobs/pr-checks` `apps/omni-app/src/jobs/delayed` `apps/omni-app/src/webhook/` `supabase/migrations/` `supabase/checks/ready_verdicts` `supabase/database.types.ts` | s1 | 2 | deep |
| s8 | The runner fallback: when `e2e.ci` is false (or no key) and the PRD has an `e2e` criterion, a new commit queues a runner job that runs the scenarios against the preview, and the App writes the `acceptance` check run from its result; with no runner, check 3 reads `not finished · no runner has run the e2e scenarios yet` | `apps/omni-app/src/ready-check/` `kit/lib/runner/` `apps/galaxy/src/runners/` `apps/galaxy/app/api/runners/` `supabase/migrations/` | s5, s7 | 3 | deep |
| s9 | The PRD page's Ready panel: the latest verdict, `Ready for review · 5 of 5` or `4 of 5` with the failing check named at the top, each check one tap from its evidence, each AC with its three lines, kind, proof and state, then `Ready for review, not merged. Only a person merges.` and **Review PR <n>**; no verdict, no panel | `apps/galaxy/src/dossier/page/ReadyPanel` `apps/galaxy/src/dossier/page/ready` `apps/galaxy/src/dossier/page/DossierPage.tsx` `apps/galaxy/src/dossier/page/dossier.css` `apps/galaxy/src/dossier/page/page.test.ts` `.omni-loop/knowledge/design/screens/ready-checks.` `e2e/` | s5, s7 | 3 | build |
| s10 | The guide's page on what ready proves (the five checks, the AC format, the label, the settings, the fallback), the e2e page updated, and this repository switched on with `ready.checks: mission` once everything else is in | `docs/guide/` `apps/galaxy/src/docs/guide.test.ts` `apps/galaxy/src/docs/docs.test.ts` `.omni-loop/config.yml` | s2, s4, s6, s8, s9 | 4 | light |

**Shared ground.** `kit/lib/help/entries.ts` and its test are declared by s1 (`omni item new
--excuses`) and s3 (the `omni ready` entry): waves 1 and 2. `kit/lib/ready/` is s1's; s3 owns only
the new `kit/lib/ready/gh-facts` prefix inside it, a wave later. `apps/omni-app/src/ready-check/` and
`supabase/migrations/` are declared by s7 (the check, the `ready_verdicts` migration) and s8 (the
runner dispatch, the runner-skill list's migration): waves 2 and 3, each migration a file of its own,
re-dated with `node scripts/migration-order.ts` before ready when `main` moved. `e2e/` is declared by
s5 (the package's config) and s9 (AC-9's e2e test): waves 2 and 3. `kit/test/plugin.test.ts` reads
the skills s2, s4 and s6 change and no slice edits it. `kit/dist/` and `apps/omni-app/api/` are
generated: no slice commits them, the wave rebuilds them once after merging.

## Per slice: done when

### s1 (deep: the rule itself, the loosening detector and the excuse path BL-ASK-1 and BL-GATE-1 bind)

- A pure table test of the validator: each of the five checks passing, failing, `not finished` and
  `not judged · <why>`; the verdict ready only on five `pass`, one `not finished` or `not judged`
  making it not ready (BL-GATE-1); `omni / ready` left out of check 1, a skipped or cancelled run
  never green.
- Loosening fixtures, one per kind and per weakening the spec lists (deleted test, removed `it` or
  `describe`, `.skip` `.todo` `.only` `xit` `xdescribe`, fewer `expect(`, the three weakenings, a
  rewritten snapshot, `eslint-disable` `@ts-ignore` `@ts-expect-error`, a lowered floor, a raised
  timeout or retry, a grown `fallow/` or `layering/` baseline, a changed `AC-n:` test), plus clean
  diffs that pass (a test renamed, an assertion made stronger).
- An excuse only from an item's `excuses:` paths and its settled verdict: `agreed` for checks 4 and
  5, `adopted` for check 5 only; `drifted`, a prose answer, an open item or an item without the path
  excuses nothing (BL-ASK-1). The rule half of AC-2, AC-3, AC-4 and AC-5.
- The AC parser reads `### AC-n · test|e2e` with its `gherkin` block, and the acceptance report's
  format is one the validator and CI share.
- `omni config` prints `ready.checks` (`off` by default), `ready.full`, `acceptance.kind`, `e2e.ci`,
  `e2e.repo` and the `omni:ready-check` label; `omni item new --excuses <path>` writes the field and
  refuses a folder or a pattern.

### s2

- `omni check inbox` on fixture specs refuses each malformed case, naming the criterion: AC-6 green
  (AC-3 twice and an AC-4 with no Then, both named). A spec with plain bullets still passes.
- `/omni:brainstorm` step 4 writes `### AC-n · <kind>` scenarios, the kind from `acceptance.kind`; its
  guard test holds the line.

### s3

- `omni ready` against a fake `gh` (the runs, the report, the diff, the plan, the ledger), no real
  GitHub: AC-3 (check 2 `not finished` while the test job runs, verdict not ready), AC-4 (an
  out-of-territory file in an item's `excuses:`, answered A, passes check 5 naming the item) and
  AC-5 (a report proving only AC-1 fails check 3 naming AC-2) green.
- `--json` prints the shape of the before/after page; exit 0 only on 5 of 5; `omni help ready`
  shows it.

### s4

- Guard tests on `/omni:review`'s gate line (label, `omni ready`, then `gh pr ready`, else `changes`
  naming the check): AC-1 and AC-2 green.
- `/omni:yolo` and `/omni:yolo-fix` run `omni ready` only under `ready.checks: all`: AC-7 green
  (under `mission`, a PRD in no mission is marked ready as today).

### s5 (deep: CI gating on a label, a preview wait and a model call kept in secrets)

- `scripts/checks-workflow.test.ts` and `scripts/preview-debounce.test.ts` hold that a draft labelled
  `omni:ready-check` runs `test`, `lint`, the e2e job and the preview, again on a push, and an
  unlabelled draft still runs none of them.
- The test job writes the AC report and the `acceptance` check run on the head commit; the e2e job
  sets `E2E_TELEMETRY_DISABLED=1`, reads its model key from a secret only (L-GDPR-2), keeps its HTML
  report as an artifact, and does not run for a PRD with no `e2e` criterion. It is the job that runs
  AC-9's scenario.

### s6

- A guard test on `/omni:validate-e2e`: one test per `e2e` scenario, titled `AC-n: …`, tagged
  `prd-<n>`, each Given and When an `agent.act`, each Then an `agent.assert`, the lines verbatim,
  read from the spec and never from a `.feature` file.

### s7 (deep: a migration with its policies, and a check every gated commit runs; `ui: yes`)

The slice keeps the locked laws its migration path lists (BR-PRODUCT-28, -63, -64, -12, -29, -39, -59,
N-PRODUCT-16) without changing one: the check reads only the PR's own repository, and the table is
written by the service role alone.

- Against a fake GitHub, as `budgets-check` is tested: AC-8 green (`omni / ready` shows the same five
  states `omni ready` prints, each with a link, signed as the App's, and the verdict row is saved).
- Under `ready.checks: off` it posts nothing; it never blocks `omni ready`.
- `supabase/checks/` proves members of the workspace read `ready_verdicts` and only the service role
  writes it; `supabase/database.types.ts` regenerated.

### s8 (deep: a runner job queued by a check, across the App, the server and the kit; `ui: yes`)

The slice keeps BR-PRODUCT-39 and BR-PRODUCT-59 without changing them: the job runs only in the PR's
own workspace, and the e2e model key stays a secret, never in the job's payload or log (L-GDPR-2).

- AC-10 green: with `e2e.ci` false and an `e2e` criterion, a new commit queues a runner job that runs
  the scenario against the preview, and the App writes the `acceptance` check run from its result.
- With no runner, check 3 reads `not finished · no runner has run the e2e scenarios yet` and the
  verdict stays not ready. The runner sets `E2E_TELEMETRY_DISABLED=1`.

### s9 (`ui: yes`)

- A render test of the Ready panel at 5 of 5 and at 4 of 5 (the failing check named at the top), each
  check linking its evidence, each AC with its lines, kind, proof and state; the word "merged" never a
  state; its words pass `omni design words`.
- AC-9's e2e test in `e2e/`, titled `AC-9: …` and tagged `prd-2898`, runs green against a local app
  with its recording.

### s10 (light: docs and one config line; `ui: yes`)

- The guide has a page on what ready proves, listed in `docs/guide/meta.json` and in the docs tests;
  the e2e page names the `AC-n` tests and the runner fallback.
- `.omni-loop/config.yml` sets `ready.checks: mission`, `ready.full: [test, lint]`; every AC of the
  spec is green on the feature branch.
