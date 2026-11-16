# Gate rules

## BR-PRODUCT-3

When the only red check is the outbox context and only person-answered items remain, /omni:pr reports this in the status comment and stops. It never counts this as a failed attempt and never applies the labels.outboxGo override.

Serves: P-PRODUCT-3
Source: .omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md, entry s4-03-outbox-check-red-is-the-gate, PRD #7
Enforced by: kit/test/plugin.test.ts
Governs: ^kit/plugin/skills/(pr)/, ^kit/test/plugin\.test\.ts$
Locked: @pierrederval, 2026-10-13
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #9
Kept id: moved from product, PRD 2346

## BR-PRODUCT-5

A feature pull request stays a draft while any question is open, with each open question posted on it. It is marked ready only after the work has been shipped, committed and pushed.

Serves: P-PRODUCT-5
Source: .omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md, entry s9-01-gate-red-stays-draft, PRD #7
Enforced by: kit/test/plugin.test.ts
Governs: ^kit/plugin/skills/(yolo|pr)/, ^kit/test/plugin\.test\.ts$
Locked: @pierrederval, 2026-10-13
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #9
Kept id: moved from product, PRD 2346

## BR-PRODUCT-6

The live outbox check passes the pull request's changed files to the gate, so a risky change nobody explained turns it red, as do open questions and unfinished rework.

Serves: P-PRODUCT-5
Source: .omni-loop/delivery/shipped/0028-omni-app-outbox-check/outbox/settled.md, entry s5-01-check-grades-changed-files, PRD #28
Enforced by: apps/omni-app/src/outbox-check/outbox-check.test.ts
Governs: ^apps/omni-app/src/outbox-check/, ^kit/lib/outbox/
Locked: @pierrederval, 2026-10-13
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #29
Kept id: moved from product, PRD 2346

## BR-GATE-1

When a feature spans several repositories, the planning pull request stays a draft while any of its pull requests is held waiting on another, and is marked ready only once every held one is ready or merged.

Serves: P-PRODUCT-5
Source: .omni-loop/delivery/shipped/2746-hold-consumer/outbox/settled.md, entry s3-03-held-target-holds-plan-pr, PRD #2746
Enforced by: kit/test/hold-ready.test.ts
Stated: 2026-11-13
Decided: nobody — adopted when raised (medium), 2026-11-13
Merged: @pierrederval, 2026-11-13, PR #2747
Proposed: harvest 2026-11-13

## BR-GATE-2

With no CI job named for the full tests and lint, that ready check reads not judged with its reason, never passed. A named job counts only by a run of its exact name or each of its matrix legs, all of which must succeed; a job with a merely similar name never counts.

Serves: P-PRODUCT-7
Source: .omni-loop/delivery/shipped/2898-ready-five-checks/outbox/settled.md, entry s1-03-full-jobs-default-none, PRD #2898
Enforced by: kit/lib/ready/checks.test.ts, kit/lib/config-ready.test.ts
Stated: 2026-11-16
Decided: nobody — adopted when raised (medium), 2026-11-15
Merged: @pierrederval, 2026-11-16, PR #2902
Proposed: harvest 2026-11-16

## BR-GATE-3

With the ready gate set to missions only, a PRD gets its ready check while its mission is running, waiting on a person or paused. A PRD of a draft, delivered or stopped mission gets no check.

Serves: P-PRODUCT-5
Source: .omni-loop/delivery/shipped/2898-ready-five-checks/outbox/settled.md, entry s7-02-waiting-missions-gate-too, PRD #2898
Enforced by: apps/omni-app/src/ready-check/store.test.ts
Stated: 2026-11-16
Decided: nobody — adopted when raised (medium), 2026-11-15
Merged: @pierrederval, 2026-11-16, PR #2902
Proposed: harvest 2026-11-16

## BR-GATE-4

When a group of checks completes on the latest commit of a pull request into the default branch, the App runs its ready check again. When the verdict is unchanged it posts nothing new; a sub-PR's completed checks refresh nothing.

Serves: P-PRODUCT-5
Source: .omni-loop/delivery/shipped/2898-ready-five-checks/outbox/settled.md, entry s7-03-ready-check-refreshes-when-ci-ends, PRD #2898
Enforced by: apps/omni-app/src/webhook/webhook.test.ts, apps/omni-app/src/ready-check/ready-check.test.ts
Stated: 2026-11-16
Decided: nobody — adopted when raised (medium), 2026-11-15
Merged: @pierrederval, 2026-11-16, PR #2902
Proposed: harvest 2026-11-16

## BR-GATE-5

The App's ready check completes as success only for a ready verdict and as failure for not ready. A not finished verdict stays in progress, updated in place, while any check is unfinished, and completes neutral once only not-judged checks remain; it is never success.

Serves: P-PRODUCT-5
Source: .omni-loop/delivery/shipped/2898-ready-five-checks/outbox/settled.md, entry s7-04-not-finished-shows-in-progress, PRD #2898
Enforced by: apps/omni-app/src/ready-check/ready-check.test.ts
Stated: 2026-11-16
Decided: nobody — adopted when raised (medium), 2026-11-15
Merged: @pierrederval, 2026-11-16, PR #2902
Proposed: harvest 2026-11-16

## BR-GATE-6

A test titled AC-n proves criterion n only when its file is among those the feature's pull request added or changed and the spec holds that number; an e2e result counts only when tagged prd-<n>. An older feature's test never counts.

Serves: P-GATE-1
Source: .omni-loop/delivery/shipped/2898-ready-five-checks/outbox/settled.md, entry s5-05-criterion-tests-from-changed-files, PRD #2898
Enforced by: scripts/acceptance-report.test.ts
Stated: 2026-11-16
Decided: nobody — adopted when raised (medium), 2026-11-15
Merged: @pierrederval, 2026-11-16, PR #2902
Proposed: harvest 2026-11-16

## BR-GATE-7

While a pull request's screen tests wait for a runner, its acceptance check shows as still running and says no runner has run them yet. It is never green while it waits, and turns green or red only from the runner's result.

Serves: P-PRODUCT-5
Source: .omni-loop/delivery/shipped/2898-ready-five-checks/outbox/settled.md, entry s8-02-app-writes-acceptance-while-it-waits, PRD #2898
Enforced by: apps/omni-app/src/ready-check/runner-fallback.test.ts, apps/omni-app/src/ready-check/ready-check.test.ts
Stated: 2026-11-16
Decided: nobody — adopted when raised (medium), 2026-11-15
Merged: @pierrederval, 2026-11-16, PR #2902
Proposed: harvest 2026-11-16
