---
prd: 1299
title: Phase 0 approved on the server
blocked-by: none
spec: file
---

# Phase 0 approved on the server

**Date:** 2026-10-09 · **PRD:** #1299 · **From:** concept #1269, area `server-approval` (the wedge)
· **Touches:** `supabase/migrations/` (a `phase0` column on `repositories`, a `birthplace` column on
`dossiers`, a new `approvals` table and its `dossier_approve` RPC), `apps/galaxy` (the flag on a
repository's row, the Approve button and its states on the PRD page, two API routes),
`apps/omni-app` (the display label on approval, and the stage-forward and stage sync dating `inbox`
at approval), `kit/lib` (a new `prdState()` reader, the approval client, `omni check inbox` accepting
`phase0: server`), `kit/bin/commands` (a new `omni approval`, and `omni prd`, `omni status`,
`omni next` reading `prdState()`), `kit/lib/config.ts` (`labels.approved`), and the skills
`brainstorm`, `plan`, `yolo`, `wave` and `drive`.
**Out of scope:** the handshake (`omni wait approval`, the phone push, the HUD toast, "approval
voided" at push time: area `approval-handshake`), approvers per product and products as the
umbrella (area `product-home`), the `omni/approved` check on target feature PRs and the
multi-repository skills (area `product-gate`), and moving any other reader of the inbox folder onto
`prdState()`.

## Problem

Every PRD's phase 0 (its spec, plan, before/after, voice) is approved today by merging a docs-only
phase-0 PR. Each one costs a branch, a pull request, an issue link, a CI run on Markdown, the GitHub
App's inbox check and several App calls, and the App's quota is being hit. The approval itself is
implicit: "approved" means `omni prd <n>` finds the PRD's folder in `inbox/` (`whereIs`,
`kit/lib/layout.ts`). Nobody records who approved, and nothing ties what was approved to what is
built: the folder on the feature branch can change after the phase-0 merge and `/omni:yolo` builds it
all the same.

The server already keeps every version of a PRD's files with its `sha256` (`dossier_versions`), and
everyone in the workspace reads them on the PRD page. It is the natural place to approve, if the
loop trusts it.

## Solution

A repository can switch its phase 0 to the server. A PRD born there is approved on its PRD page. The
server records who approved and when and pins the hashes of the approved files, and the building
skills trust only that record. A repository left on `pr` runs exactly as today.

### 1. The flag, per repository, on the server

`repositories.phase0` is `pr` or `server`, `pr` by default. A workspace owner flips it on the
repository's row of the page (step 4 of the concept's rollout ladder). The kit reads it with
`GET /api/repositories/phase0?repo=<owner/name>`, which answers `{ "phase0": "pr" | "server" }`.

### 2. The birthplace, for life

`/omni:brainstorm` reads the flag at step 0. With `server`, the PRD is born on the server (◆):

- its spec's front matter carries `phase0: server`, which `omni check inbox` accepts, with no other
  value;
- its dossier's `birthplace` is `server`, set once when the dossier is born and never changed.

With `pr`, or when the flag cannot be read (unreachable, no sign-in, refused), the PRD is born in the
repository (◇), as today, and the brainstorm says why in one line. Flipping the flag later changes no
PRD that already exists: a ◆ PRD stays ◆ and a ◇ PRD keeps its phase-0 PR.

### 3. The approval

An `approvals` table, append-only: one row per approval, with the dossier, the approver (user id), the
time, and `files`, one entry per approved file: its kind (`spec`, `plan`, `before-after`, `voice`, a
scenario), its path, its `sha256` and its `version_id`. The latest row is the approval in force. Rows
are never updated or deleted.

The `dossier_approve(dossier_id)` RPC writes a row only when the caller is a member of the
dossier's workspace (`is_member`), the dossier's birthplace is `server`, and it holds a spec, a plan
and a before/after. It pins the latest version of each of the dossier's files. Any member may
approve, the PRD's author included.

On the PRD page, a ◆ PRD shows:

- **waiting for approval**, with an **Approve** button, until it is approved;
- **approved**, with who and when, once it is;
- **drifted · approve again**, when a version newer than a pinned one was pushed since, with the
  Approve button back.

When the approval is written, the GitHub App adds `labels.approved` (`omni:approved`) to the PRD's
issue. The label is for display: nothing reads it. The issue stays open, and the feature PR closes it
as today.

### 4. `omni approval <n>`

`omni approval <n> [--json]` reads the approval in force through
`GET /api/dossiers/approval?repo=&prd=` and compares each pinned file with the file of the same kind
on the tree being read (the feature branch, in the skills), hashed with the kit's `sha256(utf8)`, the
hash `omni dossier push` already sends. Files are paired by kind, never by path, so `omni ship` moving
the folder does not trip it. It answers one state:

| state | when | the line |
|---|---|---|
| `approved` | an approval is in force, its approver is a workspace member today, and every pinned file matches | `approved by <login> · <time>` |
| `pending` | no approval yet | `PRD <n> waits for approval: <dossier link>` |
| `drifted` | a pinned file differs, or is missing | `≠ <file> · content` (or `· whitespace only`) `· ✗ refuse · restore it, or approve again: <dossier link>` |
| `unreachable` | no answer within 5 seconds and one token refresh | `server unreachable · held, not failed` |
| `refused` | the approver is no longer a workspace member, or the page answered an error | `approver <login> is not a workspace member` (or `refused (<status>)`) |

It exits `0` on `approved` and `1` on every other state, the line printed either way.

### 5. One `prdState()` reader, at the gates

`prdState(n)` in `kit/lib` reads the PRD's folder as today. For a ◇ PRD it returns exactly what it
returns today. For a ◆ PRD (its spec says `phase0: server`), the server's approval replaces one fact
only, "the phase-0 PR merged": the folder's `inbox` holds only when `omni approval` says `approved`;
`pending` reads as stage `prd`; `drifted`, `unreachable` and `refused` read as that state, which the
gates refuse with the line above. Everything after (building, outbox, shipped) is read from the branch
as today.

The gates read it, and only they do in this PRD:

- `omni prd <n>`, which `/omni:plan`, `/omni:yolo` and `/omni:wave` require to say `inbox`;
- `omni status` and `omni next` (so `/omni:drive` parks a `pending` ◆ PRD the way it parks an open
  phase-0 PR today, naming its dossier link);
- on the server, the stage sync (`apps/galaxy/src/stages/sync`) and the App's stage-forward date a ◆
  PRD's `inbox` at its approval, never at a phase-0 merge.

Every other reader of the inbox folder stays as it is.

### 6. `/omni:brainstorm` under `server`

Steps 1 to 8 run as today: the spec, the before/after, the voice and the plan are written on the
feature branch and pushed to the dossier. Step 9 opens **no** phase-0 PR and runs no `omni phase0`.
The hand-off links the PRD page, says "approve it there, then run `/omni:yolo <n>`", and its "Where it
is" block marks approval, not a merge, as the move into the inbox.

## Decisions

- **The flag lives on the server**, on `repositories.phase0`, not in `.omni-loop/config.yml`: the
  person chose to keep it away from the source, so a flip is one click on the page, not a pull
  request. Consequence: the brainstorm needs the server to be born ◆, and falls back to ◇ when it
  cannot read it.
- **The birthplace is written twice**, in the spec's front matter and on the dossier: the kit knows
  offline that a PRD must ask the server (and refuses when it cannot), and the page knows it without
  reading git.
- **The PRD folder stays on the feature branch**, and that copy is checked against the pinned hashes.
  It reaches the default branch only when the feature PR merges.
- **Any workspace member approves, the author included.** Approvers per product come with
  `product-home`.
- **`prdState()` covers the gates only**: `omni prd`, `omni status`, `omni next`, the stage sync and
  stage-forward. The other readers of the inbox folder (about 90) move in later areas.
- **Drift refuses whatever it is**, whitespace included; the line only says which kind it is.
- **The voice objected** (persona:F-E Developer, persona:Lead Engineer): without a phase-0 PR no
  engineer sees the spec and plan on GitHub, and self-approval lets a PM approve what nobody technical
  read. Settled `none`: the person approved the design as is.

## User stories

- As a PM on a repository switched to `server`, I brainstorm an idea and get a PRD with no phase-0
  PR; I approve it on its PRD page and run `/omni:yolo`.
- As a workspace owner, I switch one repository to `server` on the page, and switch it back, without
  a pull request, and no PRD in flight changes.
- As the person running `/omni:yolo`, I am refused, with one line saying why and what to do, when the
  approved files changed, when the server does not answer, or when the approver left the workspace.
- As anyone in the workspace, I see on the PRD page who approved it and when, and whether what is on
  the branch is still what was approved.

## Scope

In: §1 to §6. Out: everything the header lists as out of scope.

## Test seams

Every test runs on fixtures: none calls GitHub or Supabase (`omni kb show testing`).

- **`prdState()`**, a pure module tested with one table: ◇ and ◆ birthplaces against the folder's
  states and the five approval states. The server is faked behind `kit/lib/ask/client.ts`.
- **`omni approval`**, through `main()` on a fixture repository (`makeRepo()`), with the approval
  route stubbed: each state, its line and its exit code; pairing by kind after the folder moved;
  `content` against `whitespace only`.
- **`omni prd`, `omni status`, `omni next`**: characterization tests pinning today's ◇ output before
  the change, then the ◆ cases.
- **`omni check inbox`**: `phase0: server` accepted, any other value refused by name.
- **The migration and the RPC**: a member approves; a non-member is refused; a dossier without a
  plan is refused; a ◇ dossier is refused; a second approval adds a row and never updates the first.
- **The galaxy routes**: the flag route and the approval route, their validation, response shape and
  failures; the PRD page's three states.
- **The App**: the label added on approval; stage-forward dating `inbox` at approval, against the
  stubbed GitHub.
- `kit/lib/layout.ts` and `kit/lib/inbox/` are mutation-tested core: run `pnpm mutation:changed` on
  the slices that change them.

## Risks

- **Merging publishes** a migration to the production database (the columns, the table, the RPC),
  the kit (`omni approval`, `prdState()`, the skills) and the galaxy and App changes. Rollback: every
  repository's flag defaults to `pr`, so nothing changes until an owner flips one; flipping it back
  stops new ◆ PRDs. The migration only adds, so it is left in place.
- **A ◆ PRD in flight when the server is down** is held, not failed: `/omni:yolo` refuses with
  `server unreachable · held, not failed` and carries on once the server answers.
- **The gates now depend on the network** for ◆ PRDs only; ◇ PRDs never call the server.
- **Two readers of the stage disagree** while the other ~90 inbox readers are not moved: for a ◆ PRD
  that is not approved, a reader outside the gates may still see its folder as `inbox`. None of them
  starts building; the gates do.

## Acceptance criteria

1. A repository whose flag is `pr` (the default) brainstorms, opens a phase-0 PR and builds exactly
   as today: `omni prd`, `omni status` and `omni next` print what they print on `main` today.
2. A workspace owner switches a repository to `server` on the page; the flag route answers `server`.
3. A brainstorm in that repository writes `phase0: server` in the spec, sets the dossier's birthplace
   to `server`, opens **zero** phase-0 PRs, and hands off with the PRD page link.
4. Before approval, `omni prd <n>` reports stage `prd` and `/omni:yolo <n>` refuses with
   `PRD <n> waits for approval: <link>`; `omni next` parks the PRD naming that link.
5. A workspace member presses Approve; the page shows who and when, the issue gets `omni:approved`,
   and `omni approval <n>` prints `approved by <login> · <time>` and exits `0`.
6. After approval, `/omni:yolo <n>` passes its gate and starts wave 1.
7. A change to `plan.md` on the feature branch after approval makes `omni approval <n>` print
   `≠ plan.md · content · ✗ refuse …` and `/omni:yolo` refuse; a newer version pushed to the dossier
   shows **drifted · approve again** on the page, and a new approval lets it pass.
8. With the server unreachable, `/omni:yolo` on a ◆ PRD refuses with `server unreachable · held, not
   failed`; on a ◇ PRD it makes no server call.
9. An approval whose approver is no longer a workspace member is refused.
10. Switching the repository back to `pr` changes neither an existing ◆ PRD's gate nor its stage.
