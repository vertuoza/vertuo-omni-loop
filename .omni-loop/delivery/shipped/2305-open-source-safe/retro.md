---
prd: 2305
feature-pr: 2307
merge-sha: 0816414
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
judge: 1
---

# Retro — PRD 2305, The code base is safe to be open source

The delivery cleaned internal names out of the code base across many slices and added a guard script with per-area baseline files. The most visible friction was the lockfile. Slices renamed a workspace package dependency without updating `pnpm-lock.yaml`, so the frozen install failed in both the quick and full checks on several commits. A later slice then edited the lockfile outside its declared territory to repair it, and that change reverted the rename in the lockfile. The baseline files were written early and emptied later as the cleanup removed what they had listed, which is the expected life of a shrinking baseline. A few lines of the guard script were reworked across the first and last slices.

## Findings

### F1 · Quick check failed on a stale lockfile in several slices — `repeated-red:quick` · [#2341](https://github.com/vertuoza/vertuo-omni-loop/issues/2341)

- **What happened:** The check `quick` was red on 3 commits in 3 slices (s3, s2, s7): 3 of its 19 runs were red. The rules flag a check red on 2 or more commits, or in 2 or more slices.
- **Why it matters:** Each failing run stopped at the frozen install. The lockfile still named the old workspace dependency, `nimbus-plan@workspace:*`, while the package manifest named `omni-loop@workspace:*`. No test ran at all, so the slices got no signal on their own changes until the lockfile was fixed.
- **Proposed lesson:** A change that renames a workspace package, or changes which workspace packages depend on it, regenerates `pnpm-lock.yaml` in the same commit. The plan gives that rename and its lockfile update to one slice that lands first, rather than leaving later slices to inherit a broken install.
- **Kept:** Neither the knowledge nor earlier lessons say that a workspace package rename must carry its regenerated lockfile in the same change. Earlier lessons only cover database types.
- **Evidence:** [quick on c6f2b46 in s3](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39597621777/job/119214261364), [quick on 444e26a in s2](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39597798550/job/119214846859), [quick on 615208d in s7](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39604086667/job/119236344431)

### F2 · Full check failed on the same stale lockfile — `repeated-red:check`

- **What happened:** The check `check` was red on 2 commits in 2 slices (s3, s2): 2 of its 4 runs were red. The rules flag a check red on 2 or more commits, or in 2 or more slices.
- **Why it matters:** The full check hit the same frozen-lockfile error after migrations and the migration-order guard had passed. The cost was the same broken install, seen in a second check.
- **Proposed lesson:** Regenerate the lockfile together with any change to workspace package names or dependencies.
- **Evidence:** [check on c6f2b46 in s3](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39597592902/job/119213664362), [check on 444e26a in s2](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39597756409/job/119214211344)

### F3 · A later slice edited the lockfile outside its territory — `territory:s7`

- **What happened:** Slice s7 changed 1 path outside its territory and off the plan’s shared ground: `pnpm-lock.yaml`.
- **Why it matters:** The lockfile was not declared as shared ground, yet a slice had to change it to get its install working. The lockfile is a single central file that several slices depended on.
- **Proposed lesson:** Declare the lockfile as shared ground, or give it to one slice, when the plan changes workspace packages.
- **Evidence:** [#2315](https://github.com/vertuoza/vertuo-omni-loop/pull/2315/files)

### F4 · Baseline file written, then emptied by the cleanup — `churn:scripts/open-source.baseline/galaxy.json`

- **What happened:** `scripts/open-source.baseline/galaxy.json` had 586 lines added across 2 commits, none of them in the final diff: 586 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** The first slice recorded known internal names in a baseline. Later slices removed those names and shrank the baseline. This churn is how a shrinking baseline is meant to work.
- **Evidence:** [cb2da9e (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/cb2da9e7ac894e59444381a1d64377b153ec4dad), [762fe61 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/762fe61659750c892d08bb17dec55aa1daac6bfd)

### F5 · History baseline written, then emptied by the cleanup — `churn:scripts/open-source.baseline/history.json`

- **What happened:** `scripts/open-source.baseline/history.json` had 200 lines added across 2 commits, none of them in the final diff: 200 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** Entries recorded at the start were removed once the history files were cleaned, as designed.
- **Evidence:** [cb2da9e (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/cb2da9e7ac894e59444381a1d64377b153ec4dad), [615208d (s7)](https://github.com/vertuoza/vertuo-omni-loop/commit/615208d840db79d2619d3c2a39d6992c1432a263)

### F6 · App baseline written, then emptied by the cleanup — `churn:scripts/open-source.baseline/omni-app.json`

- **What happened:** `scripts/open-source.baseline/omni-app.json` had 153 lines added across 2 commits, none of them in the final diff: 153 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** The baseline emptied as the app's internal names were removed, as designed.
- **Evidence:** [cb2da9e (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/cb2da9e7ac894e59444381a1d64377b153ec4dad), [66a72c6 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/66a72c683b09d7b5f6b1df36d085419df6c9911e)

### F7 · Kit baseline written, then emptied by the cleanup — `churn:scripts/open-source.baseline/kit.json`

- **What happened:** `scripts/open-source.baseline/kit.json` had 136 lines added across 2 commits, none of them in the final diff: 136 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** The baseline emptied as the kit's internal names were removed, as designed.
- **Evidence:** [cb2da9e (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/cb2da9e7ac894e59444381a1d64377b153ec4dad), [11e80c1 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/11e80c1b1371b980af6ba56c99cdb219995dfac6)

### F8 · Database baseline written, then emptied by the cleanup — `churn:scripts/open-source.baseline/supabase.json`

- **What happened:** `scripts/open-source.baseline/supabase.json` had 42 lines added across 2 commits, none of them in the final diff: 42 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** The baseline emptied once the migrations stopped carrying internal names, as designed.
- **Evidence:** [cb2da9e (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/cb2da9e7ac894e59444381a1d64377b153ec4dad), [1b34f8e (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/1b34f8e43fd787771ce96f85d9267f688a4eacb1)

### F9 · Guard script lines reworked in the first and last slices — `churn:scripts/open-source.ts:165-166`

- **What happened:** Lines 165-166 of `scripts/open-source.ts`, as merged, were written and rewritten in 3 commits, in s1 and s8; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** A few lines of the guard were adjusted again at the end, likely as its matching rules were tuned. The evidence shows no defect.
- **Evidence:** [cb2da9e (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/cb2da9e7ac894e59444381a1d64377b153ec4dad), [4b4c5e2 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/4b4c5e22a4fd6379432bccc55f113b5a090f3769), [bd8e780 (s8)](https://github.com/vertuoza/vertuo-omni-loop/commit/bd8e78067df9a556b7c8d3068fb2cbac492e801b), [`scripts/open-source.ts` lines 165-166, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/26b666b996cd2b05a48b9df082c32084bb9e6844/scripts/open-source.ts#L165-L166)

### F10 · Guard script line reworked in the first and last slices — `churn:scripts/open-source.ts:170-170`

- **What happened:** Lines 170-170 of `scripts/open-source.ts`, as merged, were written and rewritten in 3 commits, in s1 and s8; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** Same tuning of the guard as the neighbouring lines.
- **Evidence:** [cb2da9e (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/cb2da9e7ac894e59444381a1d64377b153ec4dad), [4b4c5e2 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/4b4c5e22a4fd6379432bccc55f113b5a090f3769), [bd8e780 (s8)](https://github.com/vertuoza/vertuo-omni-loop/commit/bd8e78067df9a556b7c8d3068fb2cbac492e801b), [`scripts/open-source.ts` lines 170-170, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/26b666b996cd2b05a48b9df082c32084bb9e6844/scripts/open-source.ts#L170-L170)

### F11 · Guard script line reworked in the first and last slices — `churn:scripts/open-source.ts:184-184`

- **What happened:** Lines 184-184 of `scripts/open-source.ts`, as merged, were written and rewritten in 3 commits, in s1 and s8; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** Same tuning of the guard as the neighbouring lines.
- **Evidence:** [cb2da9e (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/cb2da9e7ac894e59444381a1d64377b153ec4dad), [4b4c5e2 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/4b4c5e22a4fd6379432bccc55f113b5a090f3769), [bd8e780 (s8)](https://github.com/vertuoza/vertuo-omni-loop/commit/bd8e78067df9a556b7c8d3068fb2cbac492e801b), [`scripts/open-source.ts` lines 184-184, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/26b666b996cd2b05a48b9df082c32084bb9e6844/scripts/open-source.ts#L184-L184)

## Proposed lessons

- A change that renames a workspace package, or changes which workspace packages depend on it, regenerates `pnpm-lock.yaml` in the same commit. The plan gives that rename and its lockfile update to one slice that lands first. (F1, F2, F3)

## Timeline

- Feature PR [#2307](https://github.com/vertuoza/vertuo-omni-loop/pull/2307): opened `2026-10-21T11:09:54Z`, ready `2026-10-21T14:18:31Z`, merged `2026-10-21T15:42:47Z`, 273 minutes in all.
- 8 slices; waves: 3 planned, 3 as merged; median slice: 48 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#2308](https://github.com/vertuoza/vertuo-omni-loop/pull/2308) | `2026-10-21T11:12:33Z` | `2026-10-21T11:43:03Z` | 31 | 1 | 1 |
| s2 | [#2309](https://github.com/vertuoza/vertuo-omni-loop/pull/2309) | `2026-10-21T11:50:59Z` | `2026-10-21T13:04:10Z` | 73 | 2 | 2 |
| s3 | [#2310](https://github.com/vertuoza/vertuo-omni-loop/pull/2310) | `2026-10-21T11:51:10Z` | `2026-10-21T13:02:20Z` | 71 | 2 | 2 |
| s6 | [#2311](https://github.com/vertuoza/vertuo-omni-loop/pull/2311) | `2026-10-21T11:51:21Z` | `2026-10-21T12:46:21Z` | 55 | 2 | 2 |
| s4 | [#2314](https://github.com/vertuoza/vertuo-omni-loop/pull/2314) | `2026-10-21T12:12:06Z` | `2026-10-21T12:54:24Z` | 42 | 2 | 2 |
| s7 | [#2315](https://github.com/vertuoza/vertuo-omni-loop/pull/2315) | `2026-10-21T12:13:09Z` | `2026-10-21T13:05:47Z` | 53 | 2 | 2 |
| s5 | [#2319](https://github.com/vertuoza/vertuo-omni-loop/pull/2319) | `2026-10-21T12:47:09Z` | `2026-10-21T13:17:39Z` | 31 | 2 | 2 |
| s8 | [#2327](https://github.com/vertuoza/vertuo-omni-loop/pull/2327) | `2026-10-21T13:32:15Z` | `2026-10-21T13:49:32Z` | 17 | 3 | 3 |

## Decisions

- Decisions: 12 raised and settled — 6 adopted, 6 agreed, 0 drifted; by rank: 6 high, 6 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 8 merged sub-PRs graded against the plan — 1 path outside a slice’s territory.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 9 pull requests — 1 review (1 by people, 0 by bots), 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F3 · A later slice edited the lockfile outside its territory

## Checks

- 96 runs of 5 checks on 19 commits in 8 slices, read from GitHub Actions: 5 red.

| check | runs | red | commits red | slices red | red then green |
| --- | --- | --- | --- | --- | --- |
| check | 4 | 2 | 2 | s3, s2 | 0 |
| gitleaks | 26 | 0 | 0 | — | 0 |
| open-source | 26 | 0 | 0 | — | 0 |
| quick | 19 | 3 | 3 | s3, s2, s7 | 0 |
| settle | 21 | 0 | 0 | — | 0 |

Red runs:

| red run | slice | commit | from its log |
| --- | --- | --- | --- |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39597592902/job/119213664362) | s3 | `c6f2b46` | no test named: its last lines are kept as an excerpt |
| [quick](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39597621777/job/119214261364) | s3 | `c6f2b46` | no test named: its last lines are kept as an excerpt |
| [quick](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39597798550/job/119214846859) | s2 | `444e26a` | no test named: its last lines are kept as an excerpt |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39597756409/job/119214211344) | s2 | `444e26a` | no test named: its last lines are kept as an excerpt |
| [quick](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39604086667/job/119236344431) | s7 | `615208d` | no test named: its last lines are kept as an excerpt |

Findings: F1 · Quick check failed on a stale lockfile in several slices · [#2341](https://github.com/vertuoza/vertuo-omni-loop/issues/2341); F2 · Full check failed on the same stale lockfile

## Churn

- 30 commits read across 10 merged pull requests: 6192 lines added, 4875 in the final diff, 1317 lines of churn.
- Left out as lockfiles: `pnpm-lock.yaml`.
- Left out as the loop's own delivery record: `.omni-loop/delivery/bugs/0876-outbox-skip-non-omni-prs/bug.md`, `.omni-loop/delivery/bugs/1178-wave-judges-sub-pr-threads/bug.md`, `.omni-loop/delivery/bugs/1198-inbox-check-roadmap/bug.md`, `.omni-loop/delivery/bugs/1199-roadmap-prd-links/bug.md`, `.omni-loop/delivery/bugs/1883-runner-job-launch/bug.md`, `.omni-loop/delivery/bugs/1912-runner-bg-wait/bug.md`, `.omni-loop/delivery/bugs/2018-people-prs-tracked-repos/bug.md`, `.omni-loop/delivery/inbox/1277-e2e-after-deploy-on-qa/spec.md`, `.omni-loop/delivery/shipped/2030-pitch-scenes/spec.md`, `.omni-loop/delivery/inbox/2038-pitch-music-sync/spec.md`, `.omni-loop/delivery/inbox/2039-pitch-own-media/spec.md`, `.omni-loop/delivery/inbox/concepts/0746-business-context/board-r1.html`, `.omni-loop/delivery/inbox/concepts/0746-business-context/board-r2.html`, `.omni-loop/delivery/inbox/concepts/0746-business-context/debate.md`, `.omni-loop/delivery/inbox/concepts/0746-business-context/vision.html`, `.omni-loop/delivery/inbox/concepts/1269-products-umbrella/board-r1.html`, `.omni-loop/delivery/inbox/concepts/1269-products-umbrella/board-r2.html`, `.omni-loop/delivery/inbox/concepts/1269-products-umbrella/vision.html`, `.omni-loop/delivery/inbox/concepts/2024-launch/board-r2.html`, `.omni-loop/delivery/inbox/concepts/2024-launch/concept.md`, `.omni-loop/delivery/inbox/concepts/2024-launch/debate.md`, `.omni-loop/delivery/inbox/concepts/2024-launch/vision.html`, `.omni-loop/delivery/inbox/roadmaps/1280-e2e-validation/roadmap.md`, `.omni-loop/delivery/outbox/2305-open-source-safe/accounts/s2.md`, `.omni-loop/delivery/outbox/2305-open-source-safe/accounts/s3.md`, `.omni-loop/delivery/outbox/2305-open-source-safe/accounts/s4.md`, `.omni-loop/delivery/outbox/2305-open-source-safe/accounts/s5.md`, `.omni-loop/delivery/outbox/2305-open-source-safe/accounts/s6.md`, `.omni-loop/delivery/outbox/2305-open-source-safe/s1-01-baseline-skips-names-only.md`, `.omni-loop/delivery/outbox/2305-open-source-safe/s1-02-guard-runs-in-security-workflow.md`, `.omni-loop/delivery/outbox/2305-open-source-safe/s1-03-ci-form-names-new-jobs.md`, `.omni-loop/delivery/outbox/2305-open-source-safe/s2-01-s2-law-proof-fixtures-renamed.md`, `.omni-loop/delivery/outbox/2305-open-source-safe/s3-01-s3-law-proof-fixtures-renamed.md`, `.omni-loop/delivery/outbox/2305-open-source-safe/s4-01-kit-law-proof-fixtures-renamed.md`, `.omni-loop/delivery/outbox/2305-open-source-safe/s5-01-packages-law-proof-fixtures-renamed.md`, `.omni-loop/delivery/outbox/2305-open-source-safe/s6-01-checks-own-workspace-initech.md`, `.omni-loop/delivery/outbox/2305-open-source-safe/s6-02-old-migration-keeps-its-file-name.md`, `.omni-loop/delivery/outbox/2305-open-source-safe/s6-03-law-proofs-renamed-fixtures.md`, `.omni-loop/delivery/outbox/2305-open-source-safe/s8-01-open-source-green-line-keeps-baseline-wording.md`, `.omni-loop/delivery/outbox/2305-open-source-safe/settled.md`, `.omni-loop/delivery/shipped/0003-omni-loop-kit/before-after.html`, `.omni-loop/delivery/shipped/0003-omni-loop-kit/plan.md`, `.omni-loop/delivery/shipped/0003-omni-loop-kit/spec.md`, `.omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md`, `.omni-loop/delivery/shipped/0007-omni-loop-skills/spec.md`, `.omni-loop/delivery/shipped/0039-omni-init/before-after.html`, `.omni-loop/delivery/shipped/0039-omni-init/plan.md`, `.omni-loop/delivery/shipped/0039-omni-init/spec.md`, `.omni-loop/delivery/shipped/0045-knowledge-forms/before-after.html`, `.omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md`, `.omni-loop/delivery/shipped/0045-knowledge-forms/plan.md`, `.omni-loop/delivery/shipped/0045-knowledge-forms/spec.md`, `.omni-loop/delivery/shipped/0068-omni-invade/before-after.html`, `.omni-loop/delivery/shipped/0068-omni-invade/spec.md`, `.omni-loop/delivery/shipped/0094-game-boy-handheld/outbox/settled.md`, `.omni-loop/delivery/shipped/0099-omni-man-credits/before-after.html`, `.omni-loop/delivery/shipped/0099-omni-man-credits/spec.md`, `.omni-loop/delivery/shipped/0100-workspaces/before-after.html`, `.omni-loop/delivery/shipped/0100-workspaces/plan.md`, `.omni-loop/delivery/shipped/0100-workspaces/spec.md`, `.omni-loop/delivery/shipped/0216-prd-dossiers/before-after.html`, `.omni-loop/delivery/shipped/0315-help-and-status/before-after.html`, `.omni-loop/delivery/shipped/0315-help-and-status/spec.md`, `.omni-loop/delivery/shipped/0347-cli-releases/before-after.html`, `.omni-loop/delivery/shipped/0347-cli-releases/spec.md`, `.omni-loop/delivery/shipped/0522-mega-invade/before-after.html`, `.omni-loop/delivery/shipped/0522-mega-invade/plan.md`, `.omni-loop/delivery/shipped/0522-mega-invade/spec.md`, `.omni-loop/delivery/shipped/0523-knowledge-repo-menu/before-after.html`, `.omni-loop/delivery/shipped/0533-roomier-questions/before-after.html`, `.omni-loop/delivery/shipped/0549-mega-brainstorm/before-after.html`, `.omni-loop/delivery/shipped/0549-mega-brainstorm/plan.md`, `.omni-loop/delivery/shipped/0549-mega-brainstorm/spec.md`, `.omni-loop/delivery/shipped/0556-bug-fix/spec.md`, `.omni-loop/delivery/shipped/0563-ultra-yolo/before-after.html`, `.omni-loop/delivery/shipped/0563-ultra-yolo/spec.md`, `.omni-loop/delivery/shipped/0572-dashboards/before-after.html`, `.omni-loop/delivery/shipped/0572-dashboards/spec.md`, `.omni-loop/delivery/shipped/0598-pr-checks/spec.md`, `.omni-loop/delivery/shipped/0603-several-repositories-guide/before-after.html`, `.omni-loop/delivery/shipped/0603-several-repositories-guide/spec.md`, `.omni-loop/delivery/shipped/0612-engineering-board/before-after.html`, `.omni-loop/delivery/shipped/0612-engineering-board/spec.md`, `.omni-loop/delivery/shipped/0645-engineering-repo-page/before-after.html`, `.omni-loop/delivery/shipped/0645-engineering-repo-page/plan.md`, `.omni-loop/delivery/shipped/0645-engineering-repo-page/spec.md`, `.omni-loop/delivery/shipped/0714-loop-health/before-after.html`, `.omni-loop/delivery/shipped/0725-typescript/outbox/settled.md`, `.omni-loop/delivery/shipped/0728-points-every-repo/before-after.html`, `.omni-loop/delivery/shipped/0728-points-every-repo/outbox/settled.md`, `.omni-loop/delivery/shipped/0728-points-every-repo/spec.md`, `.omni-loop/delivery/shipped/0748-business-store/before-after.html`, `.omni-loop/delivery/shipped/0752-readable-questions/before-after.html`, `.omni-loop/delivery/shipped/0752-readable-questions/spec.md`, `.omni-loop/delivery/shipped/0774-business-evidence-draft/before-after.html`, `.omni-loop/delivery/shipped/0774-business-evidence-draft/spec.md`, `.omni-loop/delivery/shipped/0839-canon-check/before-after.html`, `.omni-loop/delivery/shipped/0855-agent-connect/before-after.html`, `.omni-loop/delivery/shipped/0855-agent-connect/spec.md`, `.omni-loop/delivery/shipped/0976-ts-lint/outbox/settled.md`, `.omni-loop/delivery/shipped/1066-import-boundaries/before-after.html`, `.omni-loop/delivery/shipped/1066-import-boundaries/outbox/settled.md`, `.omni-loop/delivery/shipped/1066-import-boundaries/plan.md`, `.omni-loop/delivery/shipped/1066-import-boundaries/spec.md`, `.omni-loop/delivery/shipped/1108-pitch-studio/spec.md`, `.omni-loop/delivery/shipped/1118-mega-care-bug-fix/before-after.html`, `.omni-loop/delivery/shipped/1118-mega-care-bug-fix/spec.md`, `.omni-loop/delivery/shipped/1130-mega-retro/before-after.html`, `.omni-loop/delivery/shipped/1139-loop-drive/before-after.html`, `.omni-loop/delivery/shipped/1162-roadmap/before-after.html`, `.omni-loop/delivery/shipped/1162-roadmap/spec.md`, `.omni-loop/delivery/shipped/1162-roadmap/voice.json`, `.omni-loop/delivery/shipped/1218-roadmap-prerequisites/before-after.html`, `.omni-loop/delivery/shipped/1218-roadmap-prerequisites/spec.md`, `.omni-loop/delivery/shipped/1276-e2e-first-product-use/spec.md`, `.omni-loop/delivery/shipped/1299-server-approval/before-after.html`, `.omni-loop/delivery/shipped/1318-layered-data-access/plan.md`, `.omni-loop/delivery/shipped/1318-layered-data-access/spec.md`, `.omni-loop/delivery/shipped/1318-layered-data-access/voice.json`, `.omni-loop/delivery/shipped/1322-approval-handshake/before-after.html`, `.omni-loop/delivery/shipped/1364-product-home/before-after.html`, `.omni-loop/delivery/shipped/1548-product-gate/before-after.html`, `.omni-loop/delivery/shipped/1548-product-gate/spec.md`, `.omni-loop/delivery/shipped/1548-product-gate/voice.json`, `.omni-loop/delivery/shipped/1612-approved-gate/before-after.html`, `.omni-loop/delivery/shipped/1628-cloud-sign-in/before-after.html`, `.omni-loop/delivery/shipped/1679-context-budgets/spec.md`, `.omni-loop/delivery/shipped/1726-locked-laws/spec.md`, `.omni-loop/delivery/shipped/1798-knowledge-graph-api/spec.md`, `.omni-loop/delivery/shipped/1814-same-gate-every-agent/spec.md`, `.omni-loop/delivery/shipped/1830-runners/before-after.html`, `.omni-loop/delivery/shipped/1830-runners/plan.md`, `.omni-loop/delivery/shipped/1830-runners/spec.md`, `.omni-loop/delivery/shipped/1870-plan-contract-column/before-after.html`, `.omni-loop/delivery/shipped/1870-plan-contract-column/spec.md`, `.omni-loop/delivery/shipped/1894-runner-claude-token/spec.md`, `.omni-loop/delivery/shipped/1904-runner-live-logs/before-after.html`, `.omni-loop/delivery/shipped/1911-runner-cleanup/before-after.html`, `.omni-loop/delivery/shipped/1911-runner-cleanup/spec.md`, `.omni-loop/delivery/shipped/1972-bug-fix-service-proof/before-after.html`, `.omni-loop/delivery/shipped/1972-bug-fix-service-proof/spec.md`, `.omni-loop/delivery/shipped/1972-bug-fix-service-proof/voice.json`, `.omni-loop/delivery/shipped/1975-merged-pr-points/before-after.html`, `.omni-loop/delivery/shipped/1975-merged-pr-points/spec.md`, `.omni-loop/delivery/shipped/2011-product-records/before-after.html`, `.omni-loop/delivery/shipped/2011-product-records/plan.md`, `.omni-loop/delivery/shipped/2011-product-records/spec.md`, `.omni-loop/delivery/shipped/2022-api-keys-v1/before-after.html`, `.omni-loop/delivery/shipped/2022-api-keys-v1/spec.md`, `.omni-loop/delivery/shipped/2049-target-conventions/before-after.html`, `.omni-loop/delivery/shipped/2049-target-conventions/plan.md`, `.omni-loop/delivery/shipped/2049-target-conventions/spec.md`, `.omni-loop/delivery/shipped/2100-bug-proof-guard/before-after.html`, `.omni-loop/delivery/shipped/2100-bug-proof-guard/spec.md`, `.omni-loop/delivery/shipped/2102-runner-health/before-after.html`, `.omni-loop/delivery/shipped/2102-runner-health/outbox/settled.md`, `.omni-loop/delivery/shipped/2102-runner-health/spec.md`, `.omni-loop/delivery/shipped/2124-outbox-all-prds/before-after.html`, `.omni-loop/delivery/shipped/2174-constellation-real-scale/before-after.html`, `.omni-loop/delivery/shipped/2174-constellation-real-scale/spec.md`, `.omni-loop/delivery/shipped/2175-runner-dead-claims/before-after.html`, `.omni-loop/delivery/shipped/2175-runner-dead-claims/spec.md`, `.omni-loop/delivery/shipped/2188-remove-repository/before-after.html`, `.omni-loop/delivery/shipped/2188-remove-repository/spec.md`, `.omni-loop/delivery/shipped/2232-archive-product/before-after.html`, `.omni-loop/delivery/shipped/2239-before-after-two-tabs/spec.md`, `.omni-loop/delivery/shipped/2251-runner-follow/before-after.html`, `.omni-loop/delivery/shipped/2251-runner-follow/spec.md`, `.omni-loop/delivery/shipped/2255-need-human/before-after.html`, `.omni-loop/delivery/shipped/2255-need-human/spec.md`, `.omni-loop/delivery/shipped/2270-fix-when-answered/before-after.html`, `.omni-loop/delivery/shipped/2270-fix-when-answered/spec.md`, `.omni-loop/delivery/shipped/2275-prod-build-bugs/before-after.html`, `.omni-loop/delivery/shipped/2275-prod-build-bugs/spec.md`, `.omni-loop/delivery/shipped/2305-open-source-safe/outbox/s7-01-s7-adr-names-renamed.md`, `.omni-loop/delivery/shipped/2305-open-source-safe/outbox/settled.md`, `.omni-loop/delivery/visual/0703-prd-list-pill-and-filters/before-after.html`, `.omni-loop/delivery/visual/0703-prd-list-pill-and-filters/variations-r1.html`, `.omni-loop/delivery/visual/0703-prd-list-pill-and-filters/variations-r2.html`, `.omni-loop/delivery/visual/0850-dashboard-phone/before-after.html`, `.omni-loop/delivery/visual/0850-dashboard-phone/variations-r1.html`, `.omni-loop/delivery/visual/1010-product-select-arrow/before-after.html`, `.omni-loop/delivery/visual/1010-product-select-arrow/variations-r1.html`, `.omni-loop/delivery/visual/1598-products-page/before-after.html`, `.omni-loop/delivery/visual/1598-products-page/variations-r1.html`.

Findings: F4 · Baseline file written, then emptied by the cleanup; F5 · History baseline written, then emptied by the cleanup; F6 · App baseline written, then emptied by the cleanup; F7 · Kit baseline written, then emptied by the cleanup; F8 · Database baseline written, then emptied by the cleanup; F9 · Guard script lines reworked in the first and last slices; F10 · Guard script line reworked in the first and last slices; F11 · Guard script line reworked in the first and last slices

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
