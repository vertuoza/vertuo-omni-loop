# Bug 1198: the inbox check fails on every roadmap phase-0 PR

## Triage

- **Domain:** Omni app — the inbox check (`apps/omni-app/src/inbox-check`)
- **Risk:** medium — every roadmap phase-0 PR gets a red inbox check although it is right; the reviewer can read past it and merge, but nothing of the roadmap is graded (Jev, 0.71)
- **Regression:** new bug — no evidence this ever worked (roadmaps came with PRD 1162, #1163; the inbox check was never taught them)

## Reproduction

- **File:** `apps/omni-app/src/inbox-check/evaluate-inbox.test.ts`
- **Red:** `× a green roadmap of two PRDs with no plan is success, listing each PRD wave by wave — AssertionError: expected 'failure' to be 'success'` (and on vertuo-vibe-master-plan PR #36: "no inbox folder for topic `roadmap-vertuoza-crew`")

## Fix

The inbox check took a phase-0 PR to be one PRD: a roadmap's branch, `docs/phase-0-roadmap-<topic>`,
matched no `<nnnn>-<topic>` folder, and its PRDs have no `plan.md` on purpose. Now a `roadmap-` topic
whose `roadmaps/<nnnn>-<topic>/roadmap.md` is on the head is graded as a roadmap: the rules of
`omni roadmap check` (plan-repository rules included), then each row, wave by wave, with its phase-0
verdict without a plan (`phase0Verdict`'s new `needsPlan: false`), inbox folder, PRD issue and canon
gates. Every other topic keeps the one-PRD path; a `roadmap-` topic without a roadmap names the path
it looked for.

## Guard

Roadmap fixtures shaped as `/omni:roadmap` and `/omni:mega-roadmap` write a phase-0 PR (a green one,
a blocked-by drift, a read-only target in a plan repository), graded end to end; they fail on the
check before this fix. Two more tests pin that the outbox check and `omni next` already read a
roadmap's phase-0 PR as phase 0, never as a missing PRD.

## Mutation

mutation: 172 killed, 49 survived in kit/lib/policy/phase-0.ts (one survivor in the changed lines, :213 ConditionalExpression → false, after one strengthened rerun)
