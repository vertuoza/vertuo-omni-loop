---
title: Missions
description: A goal a Virtual Fleet delivers while you are away — what a mission is, its three levels, what you still do at each, how to go back, and how to start one with /omni:mission.
---

A PRD is one change; a roadmap is a milestone of PRDs. A **mission** is the goal behind them: one
sentence of what changes and for whom, handed to a **Virtual Fleet** that builds the PRDs it needs
while your laptop is closed. It never merges, never answers for a person, and waits for a person
wherever one is needed: an approval, an answer, a merge.

## What a mission holds

| part | what it is |
|---|---|
| **Goal** | one sentence: what changes, and for whom |
| **Measures** | 1 to 5 signs it worked once deployed, each with how it is read and a target; recorded now, followed after deployment in a later release |
| **Fleet** | the Virtual Fleet that takes it: its heroes are the mission's team, and its jobs go to that fleet's runners |
| **Scope** | PRDs and roadmaps of this repository, in any mix: one PRD, four PRDs, a roadmap, two roadmaps |
| **Mandate** | how many PRDs may run at once, 1 to 4, 2 by default; and its level, below |

A mission is numbered by its GitHub issue, like a concept. It lives in two places: its page on the
Omni app, the source of truth while it runs, with every version kept; and the repository, as plain
files under `.omni-loop/delivery/missions/<nnnn>-<slug>/`, `mission.md` (the front matter the kit
reads) and `mission.html` (the brief, a page anyone can open).

## Three levels

A Virtual Fleet has a **level**. A mission takes its fleet's level when it starts. The level
decides how much the fleet does alone. A person still does the rest.

| level | key | what the fleet does | what you still do |
|---|---|---|---|
| **Reviews with you** | `with-you` | builds each PRD and opens its pull request into the default branch, as before. The default | merge each PRD's pull request. Answer every approval and every outbox item |
| **Own branch** | `own-branch` | builds each PRD on the mission branch, and joins it there once it passes the merge gate | answer approvals and outbox items as before. Merge the mission pull request, which lands the PRDs on the default branch |
| **Works alone** | `alone` | does what own branch does, and a committee approves PRDs and answers outbox items | answer what the committee sends back to you. Merge the mission pull request |

Only a workspace owner raises a fleet's level above `with-you`. Any member can lower it. A change
applies to missions started after it. A member who is not an owner cannot start a mission above
`with-you`, unless the fleet is already there.

Works alone needs the fleet to hold a PM, an Architect and a Reviewer.

### Own branch

- **The mission branch** is cut from the default branch when you press **Start**. Start refuses
  when the repository does not allow rebase merges. Turn on **Allow rebase merging** in its
  settings.
- **A PRD on it** is built on the mission branch. Its pull request targets the mission branch, and
  its checks run as they do for the default branch.
- **The merge gate.** A PRD joins the mission branch only when all of these hold:
  - every required check is green on its pull request;
  - the Reviewer's verdict is `pass` on that same commit;
  - no outbox item of high rank or human-action is open.

  A PRD that fails the gate waits, and the mission goes on. It is squash-merged onto the mission
  branch when it passes.
- **Shipped means on the default branch.** A PRD counts as shipped only when its commit is on the
  default branch, not when it joins the mission branch.
- **The mission pull request** carries the branch to the default branch. It lists each PRD in
  landing order. You can merge it at any time, and it carries what has joined so far. Merge it with
  **Rebase and merge**, so that the default branch gets one commit per PRD. After it lands, the next
  mission pull request opens, if PRDs remain.
- **When the default branch moves,** the fleet rebases the mission branch onto it. If the only
  conflicts are in built files, the ones the repository rebuilds, you rebuild the branch yourself. Any other
  conflict waits on you, and the mission page names the files.
- **A red branch stops the line.** When the mission branch goes red after a PRD joined, no more
  PRDs join. The mission waits on you, and the page names the PRD to drop.
- **Drop a PRD** with `omni mission drop <mission> <prd>`. The PRD leaves the branch, and its
  feature pull request reopens against the mission branch. PRDs that joined after it and touched
  the same territory are dropped with it, unless you add `--keep`. A dropped PRD stays dropped
  until you send it again.

### Works alone

- **The committee.** The PM chairs. The Architect and the Reviewer sit with it. The hero that wrote
  a PRD, or raised an item, sits out its own vote. Three `yes` carry a vote, or two when one member
  sits out. Anything else goes to you, with each member's verdict and one sentence.
- **Approvals.** The committee approves only a PRD whose phase 0 is on the Omni page. A PRD whose
  phase 0 is a pull request waits for you, as before.
- **Outbox items.** The committee answers an outbox item only when the workspace has turned on
  **Jev** for `outbox-risk` in **Settings › Jev**. An item with no score goes to you. Until Jev is
  on, every item comes to you.
- **What the committee never settles.** Its checks run before any vote, and these go to you at
  once:
  - an item ranked human-action;
  - a PRD or an item that bears on a locked law, a Legal entry or a business law;
  - an item whose hard-to-revert score is at or above the mission's bound (`mandate.hardToRevert`,
    0.6 by default);
  - a migration that drops or rewrites data.
- **What you see.** The mission page has a **Waiting on you** list, with only what was escalated
  and why, and a trust line: `<n> decisions by the fleet · <k> overturned`. The mission pull
  request opens with the lists **Approved by the fleet** and **Answered by the fleet**, each line
  with its verdicts. You are told about an escalation, a real conflict or a red branch. Nothing else
  asks you.
- **The PM's own PRDs.** Runners take `/omni:brainstorm`, `/omni:roadmap`,
  `/omni:mega-brainstorm` and `/omni:mega-roadmap` for a mission's job only, so the PM can write
  PRDs for the mission. This happens while the PRDs the fleet added are fewer than the mandate's
  `ownPrds` (0 by default). The PM gets one job per mission. A roadmap writes only the PRDs that fit
  under the cap, in order, and the mission page names the rest as `not written: the cap is <k>`.
  The Architect and the Reviewer approve a PRD the PM wrote, and the PM sits out. These skills ask
  no question: each one becomes a high outbox item. Where phase 0 is a pull request, the PM writes
  nothing.
- **Overturning.** Overturn a decision from the mission pull request's list, or with
  `omni mission overturn <mission> <decision>`. The decision stays on the record and your decision
  is added beside it. An overturned approval is void, and its PRD leaves the branch if it had
  joined. An overturned answer does not put the question back in the outbox.

### A plan repository

A mission in a plan repository can work alone for the committee only. It approves the PRDs and
answers their high items. Each PRD is built with `/omni:ultra-yolo` into each target repository's
feature pull request, and you merge each one yourself. There is no mission branch. The mission page
says `committee only: a person merges each target's pull request`. **Own branch** is refused there:
`a mission branch holds one repository: use with-you or alone`.

### Going back

- **Lower the fleet's level.** Any member can. Missions started after that use the new level.
- **Lower one mission.** Use **Change for this mission** on its Start screen. Going from Works alone
  to Own branch takes effect at the next decision. What the fleet already decided stays listed.
- **Going back to Reviews with you** is refused while a PRD sits on the mission branch. The page
  says `land or drop the <k> PRDs on <branch> first`. Land the mission pull request, or drop each
  PRD, and then lower the level.

## Token budgets

A mission can be bounded by the tokens it spends. There are two caps, and **both are off by
default**: no number ships, so nothing pauses until you set one.

- **The fleet's daily cap** (`Tokens per day`, on the virtual fleet's settings) covers every mission
  of the fleet over the last 24 hours. Only a workspace owner sets it. Empty means no cap.
- **A mission's budget** (`Token budget for this mission`) covers every job that mission has sent,
  on top of the fleet's cap. Set it on the mission's page while it is a draft. Empty means no cap.

**What counts:** a job counts once it has ended, as its input, output and cache-write tokens. Cache
reads are left out, so a long session that re-reads its context does not fill a cap. A job with no
recorded tokens counts as 0, and its row says so. A running job counts nothing until it ends.

**At a cap,** the mission sends nothing new and pauses, marked `Paused: budget reached`, with the cap
and what was spent. Running jobs finish; none is cancelled. A fleet's cap pauses every running
mission of that fleet together, in one stop. The question is asked once, on the mission's page and in
your bell, with three answers:

- **Raise the cap:** enter a new number. Each mission the stop paused runs again once it is under
  every cap.
- **Resume tomorrow** (the fleet's cap only): each paused mission wakes by itself once the fleet's
  last 24 hours are back under the cap.
- **Stop the mission:** it ends `stopped`, and its page says the budget stopped it.

Only your answer, or the wake of **Resume tomorrow**, ends a budget pause. Your own **Pause** and
**Resume** work as before. A mission you resume by hand while it is still over a cap is paused again
at its next run.

## Before the Reviewer: QA

Once the Engineer has built a PRD, QA checks it before the Reviewer reads it. QA opens the feature
pull request's preview, checks each acceptance criterion of the spec, then tries the edges the
criteria do not name, inside the PRD's scope.

- **Round 1.** QA files at most five bugs, the most serious first. Each is a GitHub issue labelled
  `bug`, with numbered steps to reproduce on the preview. A round with no bug goes straight to the
  Reviewer.
- **The Engineer fixes each bug.** The fleet's Engineer runs `/omni:bug-fix` for each bug, one at a
  time, into the PRD's feature branch. A fix that cannot land is marked on its bug, and the next bug
  goes on.
- **Round 2.** QA checks the criteria and round 1's bugs again. It checks two rounds at most, and
  files no new bug from the edges in round 2. A pass sends the PRD to the Reviewer.
- **Decide the bugs.** A bug still there after round 2 waits for you. The PRD reads `Waits for you ·
  Decide the bugs`, listing each bug by its issue. Pick **Send on to the Reviewer** to carry on with
  the bugs open, or **Stop this PRD**.

QA never writes the branch: it commits nothing, pushes nothing and opens no pull request. Each round
posts one comment on the feature pull request with its verdict and the bugs' links. Only the
Engineer's fixes reach the feature branch, and only you merge into the default branch. A plan
repository's PRD skips this pair, as it skips the Reviewer.

## When a step fails

A failed step no longer stops its PRD at once. The mission sends a **repair** first: a runner job
running `/omni:repair` on the job that failed. The repair reads why the step failed, writes down the
cause, and takes one way by its class. While it runs, the PRD reads `Repairing (1 of 3) · 8 left in
this mission`, and the room names the cause and the fix pull request.

| class | what the repair does |
|---|---|
| `code` | a bug fix into the mission branch. When its fix is green it lands there, and the step runs again |
| `flake` | a timeout, a lost network or a busy service: nothing is changed, and the step runs once more |
| `person` | only a person can decide. The PRD stops with the question |
| `omni-loop` | the kit, a skill or the runner is wrong. A scrubbed report goes to the Omni Loop repository, and the PRD waits on that bug |

The budget has two caps:

- **3 repairs per cause.** A cause is a fingerprint of its class, place and error, so the same cause
  gives the same one whichever run met it. A cause repaired 3 times stops its PRD, with the cause,
  each repair tried with its pull request and outcome, the proposed fix and how to resume.
- **9 repairs per mission,** across all its PRDs and every round. The 10th would-be repair stops
  its PRD and says the mission spent its 9.

A repair whose fix landed and whose step then passes ends **fixed**. A repair whose step fails again
ends **not fixed**, and the new failure is a new cause to look at. A repair job lost with its runner
spends nothing; one whose record cannot be read spends one.

**Resume** of a stopped mission opens a new round: each cause gets 3 repairs again, and the mission's
9 stay counted. The room reads what is left, for example `6 of 9 left in this mission`. A job a
person cancelled sends no repair: a person stopped it, so the PRD stays stopped.

## Start one

You need a Virtual Fleet first: a member creates it from the Fleet section of the Omni page, with
**+ New virtual fleet**. Then type the skill in your agent's form
([Any coding agent](/docs/any-agent#set-up-your-agent)).

```text agent
/omni:mission
```

It asks one question at a time: the fleet, the goal, the measures, the scope and the mandate. Then it
shows the brief whole and writes nothing before your yes. It opens the mission's issue, writes
`mission.md` and `mission.html`, sends both to the mission's page with `omni mission push`, and opens
a docs pull request you merge whenever you like.

For one PRD and no conversation, give the PRD and the goal:

```text agent
/omni:mission --prd 2803 'dark mode for quotes on site'
```

Nothing is asked but the fleet's key, when you have not given it with `--fleet`. The scope is that
PRD, there is no measure yet, and the mandate is the default.

## Starting never waits

The mission starts from its page, when a person presses **Start**, the moment its brief is there.
The docs pull request is the record in the repository: merging it is never a condition of starting.
Until someone presses Start, the mission stays a draft and sends nothing.

[Next → Repository flow](/docs/flow)
