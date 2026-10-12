---
prd: 1612
title: The omni/approved gate — one check on every PR, the attestation one click away
blocked-by: none
spec: file
phase0: server
---

# The omni/approved gate

**Date:** 2026-10-11 · **PRD:** #1612 · **From:** concept #1269, area `product-gate` (its first PRD;
the area was split in four, below)
**Touches:**
- `kit/lib/approval/` (one shared judge, `omni approval restore`), `kit/bin/commands/approval.ts`,
  `kit/lib/config.ts` (`ci.approvedContext`), the help entries
- `apps/omni-app/src/approved-check/` (new), `src/webhook/`, `src/functions.ts`
- `apps/galaxy/app/api/approvals/judge/` (new, signed by the App), `apps/galaxy/src/approval/`
  (a void removes the approved label), `apps/galaxy/app/prd/[id]/attestation/` and
  `apps/galaxy/src/dossier/attestation/` (new page)
- `docs/guide/` (the approval page), omni-loop's screen library (a draft `attestation` screen)

## Problem

PRDs #1299 and #1322 put phase 0 on the server: a member approves a PRD on its page, the approval
pins the hashes of the approved files, and `/omni:yolo` trusts only that record. But the record is
invisible where the code is reviewed:

- **A PR says nothing about its approval.** A reviewer on GitHub cannot tell whether the PRD was
  approved, by whom, or whether the plan on the branch is still the plan that was approved. The
  only trace is the issue's `omni:approved` label, which is display only and never proof.
- **A target PR is blind.** A PRD that spans repositories opens one feature PR per target, each
  "Part of" the PRD. None of them carries the approval; the concept's "one check, one record" is not
  built (#1299 and #1322 left it to this area).
- **A drift is found late.** When a push changes a pinned file, `/omni:yolo` refuses on its next run.
  Nothing on the PR says so before.
- **Fixing a drift needs a person even when it should not.** A whitespace-only drift can be undone
  locally, but no command does it.

The concept's area `product-gate` holds four systems. This PRD builds the first, the rung of the
rollout ladder after approval:

1. **The `omni/approved` gate** (this PRD).
2. Outbox items and answers on the server, written through typed verbs.
3. The multi-repository skills run from a product, with no plan repository.
4. Webhook-first: the 15-minute poll replaced by webhook projections.

## Solution

### 1. One check, from the record

The omni-loop App posts one check run, named **`omni/approved`** (`ci.approvedContext`, the name a
repository may change), on:

- the feature PR of every PRD **born on the server** (◆, its spec says `phase0: server`);
- every **target PR** whose body starts `Part of <owner/repo>#<n>`, for PRD n.

A sub-PR never gets it, and neither does the PR of a PRD born in its repository (◇): its approval
was its merged phase-0 PR. A PR that names no PRD gets no check.

The check reads the PRD's **approval in force** from the server and compares each pinned file with
the same file at the PR's head, read through Git trees and blobs (never a clone, as the outbox
check's snapshot reads). It is one of four states, said the same way on the check, in the terminal
and on the page:

| state | conclusion | the check's title |
|---|---|---|
| approved, every pinned file matches | success | `approved by @<login> · <k>/<k> pinned files match` |
| waiting for approval | neutral | `waits for approval: <PRD page>` |
| drifted, a pinned file changed | failure | `≠ <file> · content` (or `· whitespace only`) `· run omni approval restore <n>, or approve again` |
| held, the server cannot be read | neutral | `server unreachable · held, not failed` |

The judge is **one function shared by the kit and the App** (`judgeApproval`, in
`kit/lib/approval/`), so `omni approval <n>` in the terminal and the check on GitHub can never
disagree.

### 2. When it runs: webhooks only

No poll. The App reruns the check on a PR when:

- the PR is opened, pushed to, reopened, edited, or marked ready (the outbox check's events);
- the PRD's issue gains or loses the approved label (`labels.approved`): galaxy adds it when a member
  approves (as today) and **removes it when the approval is voided** (new), so both reach the App as
  `issues.labeled` / `issues.unlabeled`, and the App reruns the check on every open PR of that PRD.

Runs are debounced per PR and go through the shared GitHub budget client, as the outbox check's do.

### 3. How the App reads the record

A new route on galaxy, **`GET /api/approvals/judge?repo=<owner/name>&prd=<n>`**, signed by the App
with the HMAC it already uses for stage events (`STAGE_EVENT_SECRET`). It returns the approval in
force (who, when, the pinned files with their sha256 and kind, voided or not) and the PRD page link.
Unsigned or wrongly signed: 401. The existing `GET /api/dossiers/approval`, which needs a person's
sign-in, is unchanged.

### 4. Fixing a drift from the terminal

**`omni approval restore <n>`** reads the approval in force, as `omni approval <n>` does, and writes
each drifted file back from the pinned version's content on the server (`dossier_versions.content`,
checked against its sha256 before anything is written). It prints one line per file it restored, and
says plainly when a version cannot be read (`approve again: <PRD page>`). It never commits and never
pushes: the person reviews the diff and pushes, and the check turns green.

The check's failure text ends with the command, so a developer fixes a whitespace drift without
waiting for anyone. Only a content change the person wants to keep needs a member to approve again.

### 5. The attestation, one click away

The check's **Details** opens a new page on the Omni page, **`/prd/<id>/attestation?head=<sha>`**:

- **the seal:** approved, held, or "seal stands · build refused" when drifted;
- **who and when:** the approver, a member of the workspace and an approver of the product;
- **the policy line:** the product's approvers, among the workspace's members;
- **pinned vs now:** each approved file, `=` when it matches the head, `≠` with both hashes when it
  does not, `?` when the head cannot be read;
- **what to do:** on a drift, `omni approval restore <n>` with a copy button, and Approve again for a
  member;
- **the target PRs** of the PRD, each with its own state.

It is a new screen: drawn in pixel-perfect terms (the before/after's Pixel perfect part), and
written to the screen library as a draft `attestation` screen.

### 6. Nothing blocks by default

The check is a signal. A repository makes it blocking only by adding `omni/approved` to its branch
protection's required checks; the guide says how. A neutral check never blocks a merge, even when
required.

## Decisions

- **Split the area in four, the gate first** (2026-10-11, the person): the gate is the next rung of
  the concept's rollout ladder, the smallest, and what it shows is what the outbox on the server and
  the product-run skills build on.
- **Webhooks, never a poll** (the concept: "webhook-first, to save App quota"): the approved label
  already travels as a webhook; a void now removes it, so no new channel from galaxy to the App.
- **One judge for the terminal and the check** (2026-10-11): two copies of the comparison would drift.
- **Drifted is a failure; held and waiting are neutral** (2026-10-11): a PR built on unapproved plan
  files must not look fine, and a server outage is never a failure.
- **The objection, accepted** (persona:B-E DEv): "One more red check on my PR that I can't fix from my
  editor, because only a PM's click on a web page turns it green." Settled `accepted`: the failure
  names `omni approval restore <n>`, which fixes any drift the person does not want to keep from the
  terminal; only a content change to keep needs a member's approval.
- **No new table:** the approval record (`approvals`, `approval_voids`, `dossier_versions`) is read
  as it is.
- **No proof video** (2026-10-11, the person).

## User stories

- As a **reviewer on GitHub**, I see on the PR whether its PRD was approved, by whom, and whether the
  plan on the branch is still the approved one, and one click shows the proof.
- As a **developer** whose push touched a pinned file by mistake, I run one command and the check is
  green again, without asking anyone.
- As a **PM approving a PRD**, every target repository's PR turns green the moment I approve.
- As a **lead engineer**, I can make `omni/approved` a required check on the repositories where I want
  the gate enforced, and leave it a signal elsewhere.

## Scope

**In:** the `omni/approved` check on ◆ feature PRs and "Part of" target PRs; the four states; the
shared judge; `omni approval restore`; the signed judge route; the label removed on void and the
`issues.labeled`/`unlabeled` reruns; the attestation page and its draft screen; the guide.

**Out** (the next three PRDs of the area): outbox items and answers on the server; the
multi-repository skills run from a product; replacing the 15-minute poll. Also out: making the check
required anywhere (a repository's choice), checks on sub-PRs, and checks on ◇ PRDs.

## Test seams

Unit tests next to each module, as `omni kb show testing` says; no test reaches the network.

- **Kit** (`kit/lib/approval/*.test.ts`, `kit/bin/approval.test.ts`): `judgeApproval` gives the four
  states from fixtures (match, waiting, content drift, whitespace drift, voided, unreachable);
  `omni approval restore` writes back a drifted file from a fixture version whose sha256 matches, refuses
  one whose content does not hash to its sha256, never commits, and prints one line per file;
  `ci.approvedContext` defaults to `omni/approved` (in a new test file: `kit/lib/config.test.ts` is a
  law's proof).
- **App** (`apps/omni-app/src/approved-check/*.test.ts`, `src/webhook/*.test.ts`): which PRs get the
  check (◆ feature, "Part of" target, never a sub-PR, a ◇ PRD or a PR naming no PRD); each state's
  conclusion and title; the reruns on `issues.labeled` / `unlabeled` of the approved label; a 401 or a
  timeout from galaxy reads held.
- **Galaxy** (`apps/galaxy/src/approval/*.test.ts`, `src/dossier/attestation/*.test.ts`): the judge
  route answers a signed request and refuses an unsigned one; a void removes the label; the
  attestation page renders the seal, the people, the policy line, pinned vs now and the targets for
  each state.

## Risks

- **What merging publishes:** a new kit version (the `release` workflow), a new App function deployed
  with omni-app, a new galaxy route and page. Every repository whose PRDs are born on the server
  starts seeing the check on its PRs; it blocks nothing unless a repository requires it.
- **A wrong red.** A judge bug could mark an approved PR drifted. The judge is the kit's, already used
  by `/omni:yolo`, and the check is never required by default.
- **App quota.** Each label change reruns the check on the PRD's open PRs; the budget client defers a
  background run below 20% remaining, as today.
- **Rollback:** revert the feature PR. The App stops posting the check; checks already posted stay
  on their PRs until the next push.

## Acceptance criteria

1. A feature PR of a ◆ PRD carries one `omni/approved` check; a target PR whose body starts
   `Part of <owner/repo>#<n>` carries one too; a sub-PR, a ◇ PRD's PR and a PR naming no PRD carry none.
2. The check reads success `approved by @<login> · <k>/<k> pinned files match` when approved and
   every pinned file matches the head.
3. It reads neutral `waits for approval: <PRD page>` before any approval.
4. It reads failure `≠ <file> · content` (or `· whitespace only`) ending with
   `omni approval restore <n>` when a pinned file differs at the head.
5. It reads neutral `server unreachable · held, not failed` when galaxy cannot be read.
6. Approving the PRD on its page reruns the check on every open PR of that PRD; voiding the approval
   removes the approved label and reruns it.
7. `omni approval <n>` and the check give the same state for the same head (one shared judge).
8. `omni approval restore <n>` writes each drifted file back to its pinned content, verified by its
   sha256, prints one line per file, and neither commits nor pushes.
9. The check's Details open `/prd/<id>/attestation?head=<sha>`, showing the seal, the approver, the
   policy line, each pinned file `=` / `≠` / `?`, the targets, and on a drift the restore command.
10. `GET /api/approvals/judge` answers a request signed by the App and refuses an unsigned one with 401.
11. The guide's approval page explains the check, its states, the attestation, restore, and how to
    make the check required.
12. omni-loop's screen library holds a draft `attestation` screen with its mockup.
