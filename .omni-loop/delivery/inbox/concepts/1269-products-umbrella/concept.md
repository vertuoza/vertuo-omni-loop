---
concept: 1269
title: Products replace plan repositories, with phase 0 approved on the server
kind: platform
scale: vast
---

## The brief

The person wants fewer GitHub issues, PRs, CI runs on Markdown and GitHub App calls (the App quota is
being hit), no sync between two copies of the same state, and no repository kept only to host the
loop's state.

What the person said:

- **The umbrella.** An umbrella on the Omni server knows its target repositories. The multi-repository
  skills (`/omni:mega-brainstorm`, `/omni:mega-drive`, `/omni:ultra-yolo`, `/omni:ultra-wave`,
  `/omni:mega-bug-fix`, `/omni:mega-roadmap`) run from it, with no parent plan repository.
- **Phase 0 on the server.** Phase 0 (spec, plan, before/after, voice, pending scenarios) lives in the
  PRD's dossier on the server, behind a per-repository **on/off flag**. Off means today's docs-only
  phase-0 PR, so the person can fall back.
- **Approval.** A person approves on the PRD page. The server records who and when, and a display-only
  label goes on the PRD's GitHub issue, which stays.
- **Pinned hashes.** Approval pins the hashes of the approved files, as a guard against a spoofed PRD.
  `/omni:yolo` and `/omni:ultra-yolo` trust only the server's record. They refuse when the feature
  branch's files differ, when the server is unreachable, or when the approver is not a workspace
  member.
- **Products are the umbrella** (said at the crown): each product holds its roadmap, ideas, PRDs, bug
  fixes, visual fixes, questions and the rest.

What was assumed, and accepted:

- The code stays on GitHub: feature branches, sub-PRs, and one feature PR per target repository.
- Success means a PM creates a product, adds two repositories, and runs `/omni:mega-brainstorm`, then
  approves on the page, then runs `/omni:ultra-yolo`, with no plan repository. A one-repository PRD
  with the flag on opens zero phase-0 PRs.

## The vision

**C, The Ledger, under Products.** A workspace has several **products**. A product is the umbrella:
it holds its repositories and its approvers, and it has these tabs:

- **Ledger:** what waits on whom.
- **Roadmap**, **Ideas**, **PRDs**, **Bug fixes**, **Visual fixes**.
- **Questions:** the outbox questions waiting on people.
- **Constellation.**

A product replaces both `plan.targets[]` and the plan repository. A one-repository PRD lives in an
automatic product of one, which shows only as the repository's name. The phase-0 flag stays per
repository, and a PRD keeps its birthplace (◆ server / ◇ repo) for life. So flipping the flag never
tears a PRD that is already in flight.

The wow moments:

- **The handshake.** The agent parks on `omni wait approval 918`
  (`◌ Mobile · waiting for Irisa or Paul`). A **push notification** lands on Irisa's phone with a
  one-line before/after, the target repositories and the pinned hashes. She taps Approve and the
  **seal** stamps. The terminal and the Claude session **HUD** toast fire together, and wave 1 starts.
  If a push then changes a pinned file, the seal is voided on the spot
  (`approval voided by your push e41c→f02a · ask Irisa again?`), and re-approval shows only the diff.
- **One check, one record.** Every target's feature PR carries one `omni/approved` check. Its details
  page is the attestation: the seal, who approved and when, and the pinned hashes against today's
  files. Three states read the same on the page, the check and the terminal: **building**, **held**
  (`server unreachable since 14:05 · held, not failed`) and **drifted** (`≠ plan.md in f02a · content`
  or `· whitespace only`, then `✗ refuse`, then `restore` / `ask again`).
- **Constellation.** A read-only "how this product is looking" view: repositories are stars, inferred
  `consumes` edges are lines, and building slices move along them. A shared API shows as a visiting
  star from its home product. A flag-off repository is docked, tethered to its phase-0 PR. Only what
  waits on the viewer pulses.
- **The rollout ladder** runs per repository: approval, then the gate, then the outbox, then phase 0
  born on the server, then roadmaps and bugs. When every repository has climbed it, the plan
  repository is archived.

## Why this one

C was ranked first by every panelist and by all five personas, in both rounds.

Round 2 scores, as Wow / User value / Craft / Fit / Feasibility:

| Panelist | Score |
|---|---|
| Visionary | 4/5/4/5/4 |
| Craft | 4/5/4/5/4 |
| Skeptic | 4/5/4/5/4 |
| Value | 4/5/4/5/4 |
| Personas (average) | 4.2/4.6/4.2/4.4/4 |

Their stances:

- **Visionary:** "The spine — build it first, behind the birthplace rule."
- **Craft:** "The umbrella is its face; three states, same words everywhere."
- **Skeptic:** "Mostly wiring tables we already have." The missing parts are an approvals table, an
  outbox table, and one `prdState()` reader in place of the "folder in `inbox/`" check, which is read
  across about 110 files.
- **Value:** "The destination: the hosted app becomes where work is decided" (offering#316).

What the person folded into C: D's map, as the Constellation tab; F's handshake, as the approval
moment, with the phone push and the HUD toast.

**Dissent, kept:**

- The Skeptic and all five personas wanted a separate **Project** table: many-to-many over
  repositories, because a shared API sits in two umbrellas, and optionally tagged with one product.
  The person chose **Products**. How a shared repository belongs to more than one product is left to
  the `product-home` area: either a home product with "consumed by" links, or a many-to-many link,
  which would rewrite the voice, claims and token lookups that resolve repository → product today.
- persona:B-E DEv: "A server-only record I cannot read in my editor is more 'tool' than I want." The
  answer is a read-only view, and no writable local folder.
- The Visionary held, against the others, that the map is the front door and not an add-on. The
  person made it a tab.

## Killed and why

- **A · Job by Job** (seven switches moving the plan repository's jobs one at a time) did not stand on
  its own: seven half-states nobody can read. Its ordered **ladder** became C's rollout.
- **B · Born on the Server** (new PRDs born on the server, old ones drain) became C's
  **birthplace-for-life** rule and the `prdState()` seam, rather than a concept of its own.
- **D · The Contract Graph** (a project as a graph, with quorum signing) became the read-only
  **Constellation** tab. The mandatory quorum was dropped: co-sign is opt-in per edge, later.
- **E · Ghost Checkout** (a server-backed local folder) was dropped, because a writable folder is a
  second copy and a sync. Its **refusal grammar** became the voice of every failure.
- **F · Handshake Ledger** (documents kept in git, a ledger on the server) lost its "docs stay in git"
  axis: a multi-repository spec has no natural lead repository, and target CI would run on Markdown.
  Its **handshake** became C's approval moment.
- **G · The Lead Repo** (state in the target repositories, approval by GitHub's "Review deployments")
  was ranked last: it makes PMs approve in GitHub's deployment UI and leaves the hosted app deciding
  nothing. Its webhook projection, with no polling, stays as the way C saves App quota.
- **H · The Signed Bundle** (a passkey signature verified offline) would overturn the stated rule to
  refuse when the server is unreachable, and it needs an approver PR in every target. Its **seal**
  became the visible mark of approval.

## Fuel

The product facts read:

- **Today's approval rule.** "The folder is the status" (`kit/lib/layout.ts`).
- **Phase 0 today.** `omni phase0`, the App's inbox check, and roadmaps whose folders exist only on
  `main`.
- **What a plan repository holds:**
  - `plan.targets[]`;
  - the plan PR as the one outbox gate;
  - relayed outbox items;
  - imported knowledge copies;
  - `roadmap.md`;
  - bug records with a Fixes table;
  - "Part of" target PRs.
- **What the server already has:**
  - `workspaces`;
  - `products`;
  - `repositories.product_id`;
  - `roadmaps.product_id`;
  - `dossiers` and append-only `dossier_versions` with `sha256`, `git_blob` and `commit_sha`;
  - `loops`;
  - `sectors`, which belongs to the game.
- **GitHub load:** the shared GitHub client with a budget per installation, the 15-minute stages sync,
  dossier summaries, and prStats. This repository's own CI already skips Markdown and phase-0
  branches.

References looked at:

- Nx's 2026 roadmap, the "synthetic monorepo": the graph lives in the platform, not in a repository.
  https://nx.dev/blog/nx-2026-roadmap
- Linear and GitHub: the tracker is the record, GitHub only signals by events, and one issue links PRs
  from many repositories. https://linear.app/docs/github
- The meta-repo pattern: hand-kept maps drift, and it "improves visibility but not transactions".
  https://devnewsletter.com/p/meta-repo-pattern/
- Sigstore and in-toto, from a search summary only, not opened: an attestation binds a digest to who
  did a step, and the check is who may sign, not only that something is signed.

Business claims cited: offering#316, size#37, rival#44.

## Areas

| id | area | brief | PRD |
|---|---|---|---|
| server-approval | Phase 0 approved on the server | A per-repository flag `phase0: server` or `pr`. Phase 0 and its scenarios live in the dossier, approval pins the hashes, and /omni:yolo trusts only the server record. One prdState() reader replaces the inbox-folder readers. A one-repository PRD opens 0 phase-0 PRs. | |
| approval-handshake | The handshake | omni wait approval, a phone push notification, a HUD toast, and "approval voided" when a push changes a pinned file. | |
| product-home | Products hold everything | Products own their repositories (role, knowledge, read-at, consumes) and their approvers, replacing plan.targets[]. The product page holds ideas, PRDs, roadmap, bug fixes, visual fixes and questions. Decides how a shared API belongs to more than one product. | |
| product-gate | One gate, no plan PR | Outbox items and answers are written through typed verbs, each target PR gets one omni/approved check, and the multi-repository skills run from a product. Webhook-first, to save App quota. | |
| product-records | Roadmaps, bugs and knowledge move in | Roadmap specs become dossiers, Fixes rows replace the record PR, and knowledge is served as packs. After that, the plan repository is archived. | |
| constellation-tab | How the product is looking | The read-only map tab: repositories as stars, consumes edges as lines, live slice state. Co-sign per edge comes later, as an opt-in. | |
