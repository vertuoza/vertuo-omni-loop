---
prd: 1322
feature-pr: 1324
merge-sha: a6cf334
runs: [merge, day-14]
model: anthropic/claude-opus-5.5
rules: 1
judge: 1
---

# Retro — PRD 1322, The approval handshake

The approval handshake was delivered over several slices. One failure ran through much of the work: the `check` job stayed red across three slices because the committed `database.types.ts` no longer matched what the migrations generate for `approval_request`. Four slices also changed paths outside their declared territory, mostly navigation, documentation and approval API files the plan had not assigned them. A service worker file was written and then rewritten within a single slice, and none of those first lines survived. The red check came from one cause repeated, not from many separate breakages.

## Findings

### F1 · Generated database types drifted from the migrations, again and again — `repeated-red:check` · [#1349](https://github.com/vertuoza/vertuo-omni-loop/issues/1349)

- **What happened:** The check `check` was red on 7 commits in 3 slices (s2, s3, s7): 7 of its 15 runs were red. The rules flag a check red on 2 or more commits, or in 2 or more slices.
- **Why it matters:** Every red run failed at `node scripts/supabase-types.ts --check` with the same message. The committed `database.types.ts` held `approval_request` on one line, while the migrations generate it across several lines. The same drift was carried from slice to slice instead of being fixed once, so the check stayed red for most of the delivery and later slices inherited a failure they did not cause.
- **Proposed lesson:** When a slice adds or changes a database function, regenerate `database.types.ts` with `scripts/supabase-types.ts` against a fresh `supabase db start` in that same slice, and never write the generated entries by hand.
- **Kept:** Neither the knowledge nor the earlier lessons say that the generated types file must be regenerated, never hand-written, in the slice that changes the schema, and this drift kept the check red across 3 slices.
- **Evidence:** [check on 04fc02a in s2](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/37921328591/job/113789690796), [check on 099be50 in s2](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/37922085961/job/113792170926), [check on 4594c30 in s2](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/37923339591/job/113796304705), [check on 709851b in s2](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/37924142973/job/113798926334), [check on 4eede98 in s3](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/37926603593/job/113806932249), [check on af43bbf in s7](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/37928456876/job/113812999065), [check on fa2490b in s3](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/37928426157/job/113812897752)
- **Stays here:** playbook/conventions#naming already states it: "The database types are generated, never written": regenerated from a fresh local database with each migration change, checked by the pre-push hook and the supabase workflow, citing this very issue (#1349).

### F2 · A slice edited a README outside its territory — `territory:s1`

- **What happened:** Slice s1 changed 1 path outside its territory and off the plan’s shared ground: `apps/galaxy/README.md`.
- **Why it matters:** A documentation edit landed in a slice whose plan row did not include that path, so the plan no longer described what the slice touched.
- **Evidence:** [#1325](https://github.com/vertuoza/vertuo-omni-loop/pull/1325/files)

### F3 · A slice built navigation and package changes it was not assigned — `territory:s2`

- **What happened:** Slice s2 changed 8 paths outside its territory and off the plan’s shared ground: `apps/galaxy/app/api/waiting/approvals/route.ts`, `apps/galaxy/package.json`, `apps/galaxy/src/nav/Bell.render.test.ts`, `apps/galaxy/src/nav/Bell.tsx`, `apps/galaxy/src/nav/bell.test.ts`, `apps/galaxy/src/nav/bell.ts`, `apps/galaxy/src/nav/sidebar.test.ts`, `pnpm-lock.yaml`.
- **Why it matters:** The slice added a notification control in the navigation, a waiting-approvals route and a dependency change, none of which the plan's table gave it. Work the plan does not declare cannot be checked for overlap with other slices.
- **Evidence:** [#1329](https://github.com/vertuoza/vertuo-omni-loop/pull/1329/files)

### F4 · A slice changed the in-app guide outside its territory — `territory:s8`

- **What happened:** Slice s8 changed 2 paths outside its territory and off the plan’s shared ground: `apps/galaxy/src/docs/guide.test.ts`, `apps/galaxy/src/docs/guide.ts`.
- **Why it matters:** The guide and its test were edited by a slice that did not declare them, so their ownership was unclear to the rest of the plan.
- **Evidence:** [#1331](https://github.com/vertuoza/vertuo-omni-loop/pull/1331/files)

### F5 · A slice changed the approval API it did not own — `territory:s6`

- **What happened:** Slice s6 changed 2 paths outside its territory and off the plan’s shared ground: `apps/galaxy/src/approval/approval-api.test.ts`, `apps/galaxy/src/approval/approval-api.ts`.
- **Why it matters:** The approval API and its test were changed by a slice whose plan row did not list them, which risks collision with the slice that did own that code.
- **Evidence:** [#1337](https://github.com/vertuoza/vertuo-omni-loop/pull/1337/files)

### F6 · The service worker was written, then fully rewritten — `churn:apps/galaxy/public/sw.js`

- **What happened:** `apps/galaxy/public/sw.js` had 40 lines added across 2 commits, none of them in the final diff: 40 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** None of the first lines written for the service worker survived to the final diff. The first approach to background notification was thrown away within the same slice.
- **Evidence:** [a55d3d8 (s9)](https://github.com/vertuoza/vertuo-omni-loop/commit/a55d3d8e7922581f25e77b174b2f74cd9d67bf6a), [1cb8bfe (s9)](https://github.com/vertuoza/vertuo-omni-loop/commit/1cb8bfeff5583859195568705773249cd92fd262)

## Proposed lessons

- When a slice adds or changes a database function, regenerate `database.types.ts` with `scripts/supabase-types.ts` against a fresh database in that same slice, so a generated-types drift never travels into later slices. (F1)

## Timeline

- Feature PR [#1324](https://github.com/vertuoza/vertuo-omni-loop/pull/1324): opened `2026-10-09T09:56:33Z`, ready `2026-10-09T12:53:50Z`, merged `2026-10-09T13:15:23Z`, 199 minutes in all.
- 9 slices; waves: 3 planned, 3 as merged; median slice: 44 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#1325](https://github.com/vertuoza/vertuo-omni-loop/pull/1325) | `2026-10-09T10:03:00Z` | `2026-10-09T10:35:13Z` | 32 | 1 | 1 |
| s4 | [#1326](https://github.com/vertuoza/vertuo-omni-loop/pull/1326) | `2026-10-09T10:03:08Z` | `2026-10-09T10:35:28Z` | 32 | 1 | 1 |
| s9 | [#1328](https://github.com/vertuoza/vertuo-omni-loop/pull/1328) | `2026-10-09T10:41:14Z` | `2026-10-09T11:31:24Z` | 50 | 2 | 2 |
| s2 | [#1329](https://github.com/vertuoza/vertuo-omni-loop/pull/1329) | `2026-10-09T10:41:22Z` | `2026-10-09T11:31:37Z` | 50 | 2 | 2 |
| s5 | [#1330](https://github.com/vertuoza/vertuo-omni-loop/pull/1330) | `2026-10-09T10:41:31Z` | `2026-10-09T11:31:54Z` | 50 | 2 | 2 |
| s8 | [#1331](https://github.com/vertuoza/vertuo-omni-loop/pull/1331) | `2026-10-09T10:41:39Z` | `2026-10-09T11:32:07Z` | 50 | 2 | 2 |
| s3 | [#1336](https://github.com/vertuoza/vertuo-omni-loop/pull/1336) | `2026-10-09T11:42:50Z` | `2026-10-09T12:26:33Z` | 44 | 3 | 3 |
| s6 | [#1337](https://github.com/vertuoza/vertuo-omni-loop/pull/1337) | `2026-10-09T11:43:00Z` | `2026-10-09T12:26:52Z` | 44 | 3 | 3 |
| s7 | [#1338](https://github.com/vertuoza/vertuo-omni-loop/pull/1338) | `2026-10-09T11:43:09Z` | `2026-10-09T12:27:10Z` | 44 | 3 | 3 |

## Decisions

- Decisions: 17 raised and settled — 17 adopted, 0 agreed, 0 drifted; by rank: 17 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 9 merged sub-PRs graded against the plan — 13 paths outside a slice’s territory, 4 more on shared ground.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 10 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F2 · A slice edited a README outside its territory; F3 · A slice built navigation and package changes it was not assigned; F4 · A slice changed the in-app guide outside its territory; F5 · A slice changed the approval API it did not own

## Checks

- 15 runs of 1 check on 15 commits in 7 slices, read from GitHub Actions: 7 red.

| check | runs | red | commits red | slices red | red then green |
| --- | --- | --- | --- | --- | --- |
| check | 15 | 7 | 7 | s2, s3, s7 | 0 |

Red runs:

| red run | slice | commit | from its log |
| --- | --- | --- | --- |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/37921328591/job/113789690796) | s2 | `04fc02a` | no test named: its last lines are kept as an excerpt |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/37922085961/job/113792170926) | s2 | `099be50` | no test named: its last lines are kept as an excerpt |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/37923339591/job/113796304705) | s2 | `4594c30` | no test named: its last lines are kept as an excerpt |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/37924142973/job/113798926334) | s2 | `709851b` | no test named: its last lines are kept as an excerpt |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/37926603593/job/113806932249) | s3 | `4eede98` | no test named: its last lines are kept as an excerpt |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/37928456876/job/113812999065) | s7 | `af43bbf` | no test named: its last lines are kept as an excerpt |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/37928426157/job/113812897752) | s3 | `fa2490b` | no test named: its last lines are kept as an excerpt |

Findings: F1 · Generated database types drifted from the migrations, again and again · [#1349](https://github.com/vertuoza/vertuo-omni-loop/issues/1349)

## Churn

- 34 commits read across 9 merged pull requests: 8470 lines added, 8393 in the final diff, 119 lines of churn.
- Left out as lockfiles: `pnpm-lock.yaml`.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/1322-approval-handshake/accounts/s5.md`, `.omni-loop/delivery/outbox/1322-approval-handshake/s1-01-push-and-email-packages-wait-for-their-sender.md`, `.omni-loop/delivery/outbox/1322-approval-handshake/s1-02-alert-settings-listed-in-the-galaxy-readme.md`, `.omni-loop/delivery/outbox/1322-approval-handshake/s2-01-bell-and-check-outside-the-plan-ground.md`, `.omni-loop/delivery/outbox/1322-approval-handshake/s2-02-what-the-phone-alert-and-email-say.md`, `.omni-loop/delivery/outbox/1322-approval-handshake/s2-03-who-the-author-is-and-when-a-request-stops-waiting.md`, `.omni-loop/delivery/outbox/1322-approval-handshake/s3-01-what-the-stream-replays-and-its-event-ids.md`, `.omni-loop/delivery/outbox/1322-approval-handshake/s3-02-stream-reads-outside-its-own-files-and-names-people-by-player.md`, `.omni-loop/delivery/outbox/1322-approval-handshake/s4-01-approval-stream-contract.md`, `.omni-loop/delivery/outbox/1322-approval-handshake/s4-02-waiting-file.md`, `.omni-loop/delivery/outbox/1322-approval-handshake/s5-01-which-wait-the-band-shows.md`, `.omni-loop/delivery/outbox/1322-approval-handshake/s6-01-one-void-per-changed-file-one-alert-per-push.md`, `.omni-loop/delivery/outbox/1322-approval-handshake/s6-02-approval-route-carries-voids.md`, `.omni-loop/delivery/outbox/1322-approval-handshake/s7-01-approvers-unread-shows-approve.md`, `.omni-loop/delivery/outbox/1322-approval-handshake/s8-01-docs-guard-knows-wait.md`, `.omni-loop/delivery/outbox/1322-approval-handshake/s9-01-push-payload-shape.md`, `.omni-loop/delivery/outbox/1322-approval-handshake/s9-02-phone-alerts-off-is-per-person.md`, `.omni-loop/delivery/outbox/1322-approval-handshake/s9-03-service-worker-address.md`.

Findings: F6 · The service worker was written, then fully rewritten

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.

## After merge

- No `bug` issue naming #1322 was opened within 14 days of the merge.
- 5 GitHub Actions jobs ran on the merge commit `a6cf334`: 4 green, 0 red, 1 neither.
