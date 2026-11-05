---
title: Approvals
description: How a PRD is approved before anything is built — the product approval, the optional Tech Approval and /omni:tech-review, what voids an approval, and the omni/approved check.
---

Nothing is built until a person approves the PRD. This page says who approves, where, and what
happens to an approval when a file changes.

| | Product approval | Tech Approval |
|---|---|---|
| **What it judges** | the PRD as a whole: what it builds and why | the coding side only: architecture and harness |
| **When it applies** | every PRD | only when the PRD's author asks for one, on a PRD approved on its page (◆) |
| **Who gives it** | the product's approvers ([the approval handshake](#the-approval-handshake)), or whoever merges the phase-0 pull request | the one member the author names, never the author |
| **Where** | **Approve** on the PRD's page, or merging the phase-0 pull request | **Give Tech Approval** on the PRD's page, after `/omni:tech-review <n>` |
| **Order** | second, when a Tech Approval was asked for | first |

## Through a phase-0 pull request

By default a PRD is born in its repository (◇), and merging its phase-0 pull request approves it.
[How the loop works](/docs/loop#why-the-phase-0-pull-request-goes-into-the-default-branch) says why
that pull request goes into the default branch. Such a PRD has no Tech Approval.

## Phase 0 approved on the server

A workspace owner can switch a repository so that its phase 0 is approved on the Omni page instead
of through a phase-0 pull request: **Settings › Repositories**, the **Phase 0 on the server** switch
on its row. It is off (`pr`) by default, and only an owner can flip it, both ways.

- **Where a PRD is born.** `/omni:brainstorm` reads the switch once, with `omni approval flag`. On, the
  PRD is born on the server (◆): its spec says `phase0: server`, its dossier records it, and no
  phase-0 pull request is opened. Off, or when the switch cannot be read, the PRD is born in the
  repository (◇) and goes through a phase-0 pull request. A PRD keeps its birthplace for life: flipping the switch later
  changes no PRD that already exists.
- **Approving.** A ◆ PRD is approved with **Approve** on its page, by a member allowed to approve it
  ([the approval handshake](#the-approval-handshake) says who). The page records who and when, shows
  the seal, and pins the hash of each approved file (spec, plan, before/after). The personas' voice is
  not pinned: the loop adds their rounds after approval. The PRD's issue gets the `omni:approved`
  label, for display only.
- **What the loop trusts.** `/omni:plan`, `/omni:yolo`, `/omni:wave` and `/omni:drive` read the
  approval through `omni prd`, never a label. `omni approval <n>` says where it stands:

  | state | what you see | what to do |
  |---|---|---|
  | waiting | `PRD <n> waits for approval: <link>` | approve it on its page |
  | approved | `approved by <login> · <time>` | nothing: building may start |
  | drifted | `≠ plan.md · content`, or `· whitespace only` | run `omni approval restore <n>` ([below](#restore-a-drifted-file)), or approve again: the page shows **drifted · approve again** |
  | unreachable | `server unreachable · held, not failed` | wait: the PRD carries on once the page answers |
  | refused | `approver <login> is not a workspace member` | approve again, as a member |

- **What stays the same.** The PRD's folder still lives on its feature branch, and reaches the
  default branch when the feature pull request merges. Everything after the approval (building, the
  outbox, shipping) runs as [How the loop works](/docs/loop) says.

## The approval handshake

In a repository whose phase 0 is approved on the server, there is no phase-0 pull request: a PRD
born there (◆) is approved with **Approve** on its page on the Omni page. The loop asks for that
approval, and waits for it, instead of stopping.

- **Who approves: per product.** A workspace owner lists each product's **Approvers** on
  **Settings › Products**: workspace members, each one *asked to approve* or *skipped*. Every member
  reads the list. Once a product lists someone asked to approve, only those members may approve its
  PRDs; a skipped member, or anyone outside the list, sees no **Approve**. A repository with no
  product, or a product with nobody asked yet, keeps the earlier rule: any member of the workspace.
- **Who is asked.** The product's members asked to approve, except the PRD's author. When that
  leaves nobody, the author is asked.
- **How each person is reached** is their own choice, on their profile page: **Phone alerts** (a
  notification on this device, once the Omni page is installed on it; on an iPhone, added to the home
  screen first) and **Email**; email is on by default, phone alerts are off. Each request also shows in the page's bell.
- **The wait.** `/omni:yolo <n>` on a ◆ PRD waiting for approval runs `omni wait approval <n>`: it
  asks the approvers, prints `◌ PRD <n> · waiting for ana or ben`, and follows the approval as it
  happens. The moment someone approves, it prints `✓ PRD <n> approved by <login> · <time> · <k> files
  pinned` and the build starts wave 1, with nothing typed again. The status line's band shows the same
  lines. You can run `omni wait approval <n>` alone too: it exits 0 once approved.
- **When it holds.** Signed out, it ends with `no sign-in (omni signin) · held`; past its
  `--timeout` (60 minutes by default), with `held: still waiting for <names> after <minutes> min`.
  Both exit 1, and `/omni:yolo` ends held on that line: run it again later. A lost connection is
  resumed on its own; after three failed tries in a row it says `server unreachable · held, not
  failed`, and keeps trying.
- **A change voids the approval.** An `omni dossier push` that changes an approved file (spec, plan,
  before/after) voids the approval: the approver is told by phone and email, the page shows
  **voided · approve again** with only what changed, `omni approval <n>` reads `drifted`, and a
  waiting terminal prints `✗ approval voided by <pusher>'s push` and asks again.
- **`/loop /omni:drive` never waits.** It parks a PRD waiting for approval, as it parks one whose
  phase-0 pull request is open, and a later tick builds it once it is approved.

## Tech Approval

A ◆ PRD may carry a second approval, a **Tech Approval**, asked for one PRD at a time. At the end of
`/omni:brainstorm` the author is asked **Request a Tech Approval?**; yes names one workspace member (the
author may also press **Request a Tech Approval** on the PRD's page, before the PRD is approved, or run
`omni approval tech request <n> --to <login>`). A PRD with no request has the product approval alone.

- **Tech first, then product.** The named person sees the request in their **Waiting** section and by
  email, runs `/omni:tech-review <n>`, and presses **Give Tech Approval** on the PRD's page. Only then are
  the product's approvers asked. Until it is given the product approval is refused, so `/omni:yolo`,
  `omni approval <n>` and the `omni/approved` check all read "not approved yet", and `omni wait approval <n>`
  prints `waiting for <login>'s tech approval`.
- **`/omni:tech-review <n>` covers coding only.** The agent shows the choices already made, then grills
  the architecture and the harness one question at a time, each with a recommended answer. It changes
  the spec's Conventions, Test seams and Risks, the technical side of Solution and Decisions, the
  before/after page's Technical tab and the plan's slices, territories, blockers and waves; never the
  Problem, User stories, Scope, Acceptance criteria, the proof or e2e choices. A question only the PM can
  settle becomes a comment on the PRD's issue naming the author. Each settled question is recorded under
  `### Tech review` in the spec's Decisions, and each change reaches the page as a new version.
- **The skill never approves.** Only the named person presses the button. It refuses a PRD with no plan or
  no open request, anyone but the named person, a PRD with a merged sub-PR, and any run under
  `OMNI_UNATTENDED`: a grill needs a person.
- **It cannot be skipped or withdrawn,** and a push that changes a pinned file voids both approvals, the
  named person's first.

## The omni/approved check

A ◆ PRD's approval also shows where the code is reviewed: the omni-loop App posts one check, named
`omni/approved`, on its pull requests. It reads the approval in force on the Omni page and compares
each pinned file with the same file at the pull request's head, with the same judge as
`omni approval <n>`: the terminal and the check never disagree. A repository may rename the check
with `ci.approvedContext` in its config.

- **Which pull requests get it.** The feature pull request of a PRD born on the server (◆), and every
  target pull request whose body starts `Part of <owner/repo>#<n>`, for PRD n of that
  repository (a plan repository's PRD that lands in several). A product's PRD gets it too, on each
  target pull request that is `Part of <key>-<n>` ([Products](products.md)): one check, one set of
  states, whichever kind of PRD it is.
  A sub-PR never gets it, nor the pull request of a PRD born in its repository (◇: its merged phase-0
  pull request was its approval), nor a pull request that names no PRD.
- **Its states**, the same for every PRD. Each title is shown here for a ◆ PRD, judged at the pull
  request's head:

  | state | conclusion | the check's title |
  |---|---|---|
  | building | success | `building · <k> of <k> pinned`: every pinned file is the one approved |
  | pending | failure | `pending · PRD <n> waits for approval` |
  | drifted | failure | `drifted · ≠ <file> in <head> · content` (or `· whitespace only`, `· missing`, `· voided by <pusher>'s push`); its summary says to run `omni approval restore <n>`, or approve again |
  | refused | failure | `refused · approver <login> is not a workspace member` |
  | held | neutral | `held · server unreachable · held, not failed` |

  A drift is a failure: a pull request built on plan files nobody approved must not look fine. A
  server that cannot be read, or that answered an error, is never one: the check is held, neutral,
  and reruns.
- **When it runs: webhooks only, no poll.** It reruns on a pull request when it is opened, pushed
  to, reopened, edited or marked ready. It reruns on every open pull request of a PRD when the PRD's
  issue gains or loses the `omni:approved` label: the Omni page adds it when a member approves, and
  removes it when the approval is voided. So approving turns every target's pull request green at
  once, and a void turns them back. Runs are debounced per pull request and spend the App's GitHub
  budget like its other checks.

### The Details

The check's **Details** open the PRD's page on the Omni page, `/prd/<id>`, at the proof behind the
check: a ◆ PRD's approval (`#approval`), with who approved it and when, and each pinned file; a
product's PRD's attestation (`#attestation`, [Products](products.md)). The check's own summary says
which head it read, and names each file that drifted.

### Restore a drifted file

A push that changed a pinned file by mistake, or only its whitespace, needs nobody's approval:

```bash terminal
omni approval restore <n>
```

It reads the approval in force, as `omni approval <n>` does, and writes each drifted file back from
the version that was approved, after checking that its content hashes to the pinned sha256. It
prints one line per file, `restored <file> · <how> · sha256 <hash>`. It writes nothing for a version
whose content does not hash as pinned, a version the page cannot send, or an approval a push voided:
each says `approve again: <PRD page>`. It never commits and never pushes: review the diff, commit,
push, and the check turns green. Only a content change you want to keep needs a member to approve
the PRD again.

### Make it a required check

The check is a signal: it blocks nothing until a repository asks it to. To enforce the gate on a
repository, an admin adds it to the default branch's required checks on GitHub: **Settings ›
Branches** (or **Settings › Rules › Rulesets**), the rule of the default branch, **Require status
checks to pass before merging**, then add `omni/approved` (or the name `ci.approvedContext` gives).
The check must have run once on a pull request of the repository for GitHub to offer it. From then
on, a check that failed (pending, drifted, refused) blocks the merge. A held check is neutral and
never blocks a merge, even when required. A repository that leaves it out keeps the check as a
signal.

[Next → Your first PRD](/docs/first-prd)
