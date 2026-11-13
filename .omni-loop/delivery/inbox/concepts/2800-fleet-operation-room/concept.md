---
concept: 2800
title: A Fleet with an operation room, on runners that never lose work
kind: product
scale: vast
---

## The brief

Omni Loop should become a delivery crew that takes an idea to delivered software, while the
person's laptop is closed: the laptop is where a person watches and decides, never where the work
runs. This concept is the first step: the **Fleet** section and the execution foundation under it,
not the whole crew.

What the person said:

- At the start: a persistent **mission** per approved roadmap, one execution job at a time per
  mission, run on the runner fleet only. A lightweight supervisor on the App's existing scheduling
  reconciles before it dispatches, never sends the same job twice, and waits without a model call
  or a runner slot. Interrupted work is saved before cleanup and resumed; a replaced runner can
  never overwrite the work that replaced it; transient failures retry with bounded backoff; a
  provider limit is waited out; repeated failure stops and explains. A retro runs on failure,
  repetition, no progress or a milestone, and may create bounded, deduplicated repairs that must
  pass verification; it proposes rule changes, never rewrites them. Mission memory is explicit
  events with provenance, never a transcript, never a credential. "Ready for review" is not
  "merged", and success is verified, never an agent's last message. Tests use fake runners.
- After round 1 ("WAY too high"): a **Fleet** section where you drive missions. The fleet comes
  with a **PM** (brainstorming, business knowledge, go-to-market, the pitch video), a **full-stack
  engineer** (implementation under the repository's rules, the pull request, review replies, CI and
  bug fixes), an **architect** (checks the engineer's work against the architecture, helps the PM
  plan within the rules), a **QA** (reviews the work and may fix a bug itself, then hands it back
  to the engineer) and a **reviewer** (checks the engineer's work before it becomes the actual pull
  request). A **Fleet operation room** shows who is doing what, when, as a ledger.
- At the crown: an agent is not a person. Nothing on these pages imitates one: no standup, no
  narrator, no first names for agents. The seat is called **Reviewer**, and the word joins the
  glossary.
- At the area map: runner jobs that never lose work come first.

What was assumed: an approved roadmap is a roadmap whose phase 0 merged, or a product roadmap with
an approval on its page; the supervisor runs as a kind on the App's own job ledger (ADR-0123); a
fleet keeps its meaning (a named group of a workspace's runners) and gains seats.

## The vision

**The Operation Room.** The sidebar's existing **Fleet** entry grows tabs: **Operation room ·
Missions · Seats · Board**. The room opens on five "now" lines, one per seat, then the **ledger**:
one row per thing that happened, newest first, each signed by its role (`Reviewer · agent`), with
its pull request, its state and a role and mission filter. A seat is held by an agent or by a
person: the Engineer, Reviewer and QA run on the fleet's runners; the PM and Architect read "A
person does this today" until their skills run unattended. Hand-offs between seats are typed
verdicts (`pass`, or `changes` with at most five findings), at most two rounds, then a person
decides. The room is the job ledger itself, never narration.

The wow moments, in the vision tour's order:

1. **Start a mission** from approved roadmap R12: the seats, one estimate line ("Likely ready for
   review Monday 9am. May ask you once."), **Start mission**.
2. **The room at 07:00**, after a night with the laptop closed: five now lines, "Nothing to clean
   up", the ledger.
3. **The Reviewer sends PR 2817 back** before anyone sees it: a test was loosened; its findings,
   "Round 1 of 2".
4. **QA takes the branch** to fix a bug and hands it back to the Engineer: one writer at a time.
5. **A runner goes silent:** the work resumes on another runner from its last save, four minutes
   redone, nothing lost.
6. **Waiting for room** or for a provider limit, until when, with no tokens spent.
7. **PR 2817 ready for review · 5 of 5 checks:** CI green on the latest commit, full tests and lint
   ran, every success criterion has its proof, no test was loosened, the change stayed in its area.
   Not merged: only a person merges.
8. **Seats:** who holds each seat, what it runs today, its limits as sentences.

One moment of motion: a live hand-off row slides in at the top of the ledger, never on load, and
reduced motion turns it off.

## Why this one

The person crowned **A, The Operation Room**, over **B, The Standup**, in round 2.

- **Last scores** (Wow · User value · Craft · Fit · Feasibility): Visionary 5·5·4·5·3; Craft
  3·5·5·5·4; Skeptic 4·5·4·5·3 (at the crown); Value 4·5·4·5·4; persona:Lead Engineer 3·5·5·5·4;
  persona:B-E DEv 3·5·5·5·4; persona:F-E Developer 3·5·5·5·4; persona:Paul - Product Manager
  5·3·3·3·3; persona:Irisa 4·2·4·3·3.
- **Stances.** Craft: the ledger with its role lines wins. Skeptic: crown it, ship the runners'
  survival and the Reviewer first; the room stays honest only while every row is a real ledger row.
  Value: the engine under a mixed crew's page is what a hosted Omni sells (offering#316), and the
  Reviewer is the seat people pay for first, because it guards review time. Lead Engineer: the one
  I'd trust. B-E DEv: the one I can debug, each row a job id. F-E Developer: a filter on the
  Reviewer shows every verdict and its findings, and "ready" shows its proof.
- **Dissent.** Paul and Irisa wanted the Fleet to open on a summary of what waits on them; the
  person rejected the standup as imitating a person. The Visionary's role-first swimlanes were
  refused as the front page (hours drawn as a guess) and never prototyped. The Skeptic vetoes
  shipping five agent seats at once. The F-E Developer and the B-E DEv want only the Engineer to
  write a branch; the person's own words let QA fix a bug itself, so QA takes the branch while it
  fixes and hands it back.

## Killed and why

- **Round 1, A Shadow Drive** (shadow the laptop's loop on the server, then cut over): a rollout
  path, not a product; its first phase needs the laptop.
- **Round 1, B Relay Baton** (unlosable runner jobs, a mission as a chain of jobs): not killed, it
  became the foundation, now the first area.
- **Round 1, C Flight Recorder** (the mission as an event log; save an incident as a test): kept as
  the replay harness under every area, not a page.
- **Round 1, D Dress Rehearsal** (simulate the roadmap before Start): the forecast is noise at our
  volume and rewards marking work ready on schedule; only the estimate line at Start survives.
- **Round 1, E Mandate** (agents propose, plain code validates): its validator survives as what
  "ready" proves and as the seats' limits; its planning job per move was dropped.
- **Round 1, F Git Baton** (the work as a git ref in the repository): its repair-as-fresh-fork
  survives; frequent refs in customer repositories were refused.
- **Round 1, G Turn Taking** (no supervisor, runners take model-free turns): availability depends
  on the fleet and on mixed kit versions.
- **Round 1, H Logbook in the Repository** (the mission as commits on a ref): an audit export at
  most; product roadmaps have no single repository.
- **Round 1 as a whole:** the person found it "WAY too high" and redirected to a Fleet section with
  seats and an operation room.
- **Round 2, B The Standup** (a report built from the ledger, the room behind it): "a gimmick we DO
  NOT WANT to mimick human behavior... an agent is not a human".

## Fuel

**Product facts read:** the design form and the craft floor; the screen library (all drafts;
`app-shell`, `runners`, `fleet-settings`, `waiting-board`, `prd-dossier` relevant); the
architecture form; ADR-0123 (background jobs on the App's job ledger), ADR-0034 (one retro at a
time per repository), ADR-0081 (the loop's wake times); PRD 2537 (runner turnover) and bug 2170
(restarted runner jobs); the glossary.

**Code verified at the start** (every observation of the brief held): `omni next`'s decision core
is pure but the command reads a checkout; runner jobs carry only a skill line, and their account
and context handoffs live inside one runner; 90 seconds of silence or a restart ends a job as
`failed · runner lost`, never retried; cleanup force-removes the worktree and deletes an unpushed
branch with nothing saved first; the App's job ledger has leases, a stale-claim refusal that works
as a fencing token, saved steps, renewal and waking, driven by a cron every minute. No fleet-wide
capacity exists; `/omni:drive` runs only on a laptop; the reviewer has no skill and the architect
no unattended one.

**References looked at:** Kubernetes controllers' level-triggered, idempotent reconcile
(https://notes.kodekloud.com/docs/Kubernetes-Operators/Building-The-WebApp-Operator-Core-Reconcile/Inside-the-Reconcile-Loop/page);
fencing tokens over leases
(https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html); Temporal's
heartbeat details as a checkpoint and queue time that never retries
(https://docs.temporal.io/develop/typescript/activities/timeouts); Buildkite's queues, tags and
lost-agent reassignment (https://buildkite.com/docs/agent/v3/queues); the transactional outbox with
idempotent consumers
(https://scour.ing/p/https:/james-carr.org/posts/2026-01-15-transactional-outbox-pattern/).

**Business claims cited:** offering#316, rival#44, trade#38.

## Areas

| id | area | brief | PRD |
|---|---|---|---|
| unlosable-jobs | Runner jobs that never lose work | Each attempt gets an epoch and a lease and an older one's writes are refused; work is saved before any cleanup (a pushed checkpoint, or kept on the runner with an owner, a lifetime and a disk budget, said to be local-only); a lost job resumes from its save on another runner; one writer per branch; transient failures retry with bounded backoff; proven on fake runners. || #2809 |
| room-and-reviewer | The mission, the Operation room and the Reviewer | A Zod-checked mission record and events, a mission kind on the App's job ledger that reconciles first and dispatches at most one job per run under a key that never repeats, a runnable Reviewer skill returning pass or at most five findings over at most two rounds, the Fleet's Operation room tab read from the ledger, the clean-up line, start, pause and resume from an approved roadmap, and Reviewer added to the glossary. | |
| ready-five-checks | What "ready for review" proves | A pure validator refuses to mark a feature PR ready unless CI is green on its latest commit, the full tests and lint ran, every success criterion has its proof, no test was loosened and the change stayed in its area; each check one tap under "ready", never "merged". | |
| fleet-capacity | Waiting for room or the provider | Capacity counted across the fleet, per runner and per provider account, where one job may weigh more than one unit; a mission waits for room or a limit's reset, never fails for it, and queue time never counts as a try; a recovery job can still run when execution is full. | |
| qa-seat-and-seats | QA hands back, and the Seats tab | A QA turn proves the work and may fix a bug itself, holding the branch while it does, then hands a typed verdict back to the Engineer; the Seats tab shows who holds each seat, agent or person, what it runs and its limits in sentences. | |
| mission-retro-repair | Stop and explain, never loop | A retro on a runner after a failure, a repeat, no progress or a milestone returns Zod-checked, fingerprinted findings; at most two verified repairs each, deduplicated, within budget, then the mission stops and explains; a rule change only ever becomes an outbox item. | |
