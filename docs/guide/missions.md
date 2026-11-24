---
title: Missions
description: A goal an AI Fleet delivers while you are away — what a mission is, its three levels, what you still do at each, how to go back, and how to start one with /omni:mission.
---

A PRD is one change; a roadmap is a milestone of PRDs. A **mission** is the goal behind them: one
sentence of what changes and for whom, handed to a **AI Fleet** that builds the PRDs it needs
while your laptop is closed. It never merges, never answers for a person, and waits for a person
wherever one is needed: an approval, an answer, a merge.

## What a mission holds

| part | what it is |
|---|---|
| **Goal** | one sentence: what changes, and for whom |
| **Measures** | 1 to 5 signs it worked once deployed, each with how it is read and a target; recorded now, followed after deployment in a later release |
| **Fleet** | the AI Fleet that takes it: its heroes are the mission's team, and its jobs go to that fleet's runners |
| **Scope** | PRDs and roadmaps of this repository, in any mix: one PRD, four PRDs, a roadmap, two roadmaps |
| **Mandate** | how many PRDs may run at once, 1 to 4, 2 by default; and its level, below |

A mission is numbered by its GitHub issue, like a concept. Its record is its page on the Omni app,
with every version of its brief and every retro kept: no pull request holds a copy. To keep it as
plain files, run `omni mission get <n>`: it writes `mission.md` (the front matter the kit reads),
`mission.html` (the brief, a page anyone can open), each retro and each retro item, under
`.omni-loop/delivery/missions/<nnnn>-<slug>/` or the folder you give with `--out`, and commits nothing.
When the page cannot be read it says `mission <n> not read: <why>` and stops.

## Three levels

An AI Fleet has a **level**. A mission takes its fleet's level when it starts. The level
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
  `ownPrds` (0 by default, 10 for a mission started from a goal alone). The PM gets one job per mission. A roadmap writes only the PRDs that fit
  under the cap, in order, and the mission page names the rest as `not written: the cap is <k>`.
  A PRD the PM wrote goes to no committee: the PM approves its plan and the Architect reviews it,
  as **From a goal alone** says below. These skills ask no question: each one becomes a high outbox
  item. Where phase 0 is a pull request, the PM writes nothing.
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

- **The fleet's daily cap** (`Tokens per day`, on the AI fleet's settings) covers every mission
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
| `omni-loop` | the kit, a skill or the runner is wrong. A scrubbed report goes to the Omni Loop repository, and the PRD waits on that bug (see [The Omni Loop bug team](#the-omni-loop-bug-team)) |

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

## The Omni Loop bug team

When a repair finds that Omni Loop itself is wrong, the App files a scrubbed report as a `bug` issue
on the Omni Loop repository, or adds a `+1` to the one already open. The **Omni Loop bug team** is a
standing mission that works through those reports. It is the one mission that never ends delivered.

**Starting it.** Run `/omni:mission --omni-bugs` on the Omni Loop repository. Its goal is fixed (`Fix
the Omni Loop bugs missions report`), it has no scope and no measure, and it takes the default mandate
(2 bug fixes at once). At most one runs at a time. Any other repository refuses it: `Only the Omni
Loop repository runs the Omni Loop bug team`.

**What it takes.** At each wake the team takes the open bugs, the most-reported first and then the
oldest, up to its mandate's running count. It skips a bug whose issue is closed, and one that already
has an open pull request closing it, since a person is on that one. Each bug it takes is sent to a
runner as `/omni:bug-fix #<issue>`, into the default branch. It takes only bugs the App filed: an issue
a person opened by hand with the `bug` label is never taken.

**A bug's states.** The room shows one row per bug the team holds:

| state | the room reads | what it means |
|---|---|---|
| open | no row | waits in line to be taken |
| fixing | `Fixing #<issue> · reported <n>×` | a bug-fix job is running |
| pr-opened | `#<issue> · <n>× · PR #<m> to merge` | the fix pull request waits for your merge |
| asked | `#<issue> · asked: <why>` | set aside; its question waits for you |
| merged | `#<issue> · <n>× · fixed, waits for its release` | the fix is on the default branch, not released yet |
| fixed | no row; the room's ledger reads `Omni Loop bug #<issue> is fixed in v0.0.N.` | a release holds the merge |
| wont-fix | no row; the ledger reads `Omni Loop bug #<issue> won't be fixed` | the issue was closed as not planned |

**Tries and questions.** A bug gets 3 tries. A try that ends `stuck`, `blocked` or with no outcome the
App can read goes back in line. The third such try sets the bug aside as asked, with what was tried. A
job lost with its runner spends no try. When a bug fix needs a person, needs a product decision, or
says the report may not be a bug, the bug is set aside and its question is asked once, in your bell and
in the room. The team moves on to the next bug and never asks that one again. Closing the issue as not
planned makes the bug `won't fix`.

**Fixed means released.** You merge each fix pull request yourself; nothing reaches the default branch
otherwise. A merged fix stays `merged` until a published release holds its merge commit, and then the
bug reads `fixed in v0.0.N`. A fix pull request closed without merging puts the bug back in line.

**A mission waiting on an Omni Loop bug.** A PRD that stopped on a bug reads `Waits on Omni Loop bug
#<issue>`. Its mission follows that bug:

- **Still open:** the PRD stays stopped, as before. A Resume of the mission sends it again.
- **Fixed in v0.0.N:** the room reads `Omni Loop bug #<issue> is fixed in v0.0.N.` What happens next
  depends on the kit the mission's repository pins (on the mission branch, or on the default branch
  when there is none):
  - at v0.0.N or later, the PRD's step is sent again at the next wake, spending no repair, and the room
    reads `PRD <n> resumed: the kit is at v0.0.N.`;
  - older, the PRD reads `Fixed in v0.0.N: update the kit to resume (omni update)`. Run `omni update` in
    that repository. The PRD goes again at the first wake that reads a kit new enough.
- **Mission paused or stopped:** the PRD waits for your Resume of the mission, then follows the rule
  above.
- **Won't fix:** the room reads `Omni Loop bug #<issue> won't be fixed: take this PRD by hand`, and the
  PRD stays stopped.

## Retros

A mission writes a **retro** on a runner in two cases: when it gets **stuck**, and when it reaches a
**milestone**. A retro says what went well and what to change, in one to five sentences each. Every
sentence cites an event, a PRD, a pull request or a repair, and a retro never holds a log excerpt, a
credential or a person's words.

| trigger | when it fires | what it writes |
|---|---|---|
| **Stuck** | five jobs in a row end and nothing moves | a stuck repair: `/omni:repair` reads the five jobs and takes one of the four ways above, with the same retro and fingerprint as a failed step |
| **Milestone** | a roadmap in the mission's scope is delivered (every one of its PRDs is merged or on the mission branch), and once more when the whole mission is delivered | a milestone retro, `/omni:mission-retro`: what went well and what to change, for that milestone only |

**What counts as stuck.** The mission counts the jobs that end. Something **moved** when, after a job
ended, a PRD reached its next step, read ready, joined the mission branch, was merged or was
unblocked. A job sent again (a hold, a stop mid-way, a resume, a provider limit, a flake retried) is
not a new step, and a retro job counts toward nothing. Time spent waiting on you adds nothing. At 5
ended jobs with nothing moved, the mission is stuck: one stuck repair is sent first in line, the
counter starts again, and no second one is sent while it runs.

**The budget.** A stuck repair is a repair: it spends one of the mission's 9, and one of the 3 for its
cause. So a mission that gets stuck again and again cannot retro for free. A milestone retro is not a
repair: it never pauses the mission and never sends a repair.

**Tokens.** A retro is a job, so it counts toward the fleet's daily cap and the mission's budget like
any other. Over a cap, the mission sends no retro. A milestone retro that a cap held back is sent once
the mission is under every cap again. A delivered mission that is over a cap reads
`Retro skipped: budget reached`.

**Paused by stuck.** The mission pauses by stuck, and asks you once, when the stuck repair's cause
needs a person, or when its cause's 3 repairs or the mission's 9 are spent. The question names the
cause, what was tried, and the proposed fix. **Resume** opens a new round: each cause gets 3 repairs
again and the stuck counter starts from 0. **Stop the mission** ends it as `stopped`, saying it was
stuck.

**Where a retro goes.** On the mission page, under **Retros**, each milestone retro is one card, reading
`Roadmap #<n> delivered` or `Mission delivered`, with *Went well* and *To change*, and a link to its
file. At every level the retro is kept on the mission page only, and its card says so: a retro is never
a commit or a pull request. `omni mission get <n>` writes it as `retros/<k>-<roadmap n | mission>.md`.

**Where a proposed rule change goes.** A retro never edits a rule, a law or a playbook form. When a
stuck repair or a milestone retro finds one of them wrong, it proposes the change as a mission item,
always high. The item names what it would change, the wording it proposes and the evidence, citing the
retro. Each item is kept on the mission page, and `omni mission get <n>` writes it under `outbox/`.
Under **Questions** on the mission page, each item is a card with **Adopt** or **Decline** and
an optional note. Your answer is written once and never changed.

**Adopt applies nothing.** The card then shows the one line that applies the change. For a law, it is
`/omni:knowledge-add amend <id>`, and only its owner approves it. For a rule or a playbook form, it is
a docs pull request that you open and merge. An open item never pauses the mission and never holds its
pull request.

## Start one

You need an AI Fleet first: a member creates it from the Fleet section of the Omni page, with
**+ New AI fleet**. Then type the skill in your agent's form
([Any coding agent](/docs/any-agent#set-up-your-agent)).

```text agent
/omni:mission
```

It asks one question at a time: the fleet, the goal, the measures, the scope and the mandate. Then it
shows the brief whole and writes nothing before your yes. It opens the mission's issue, writes
`mission.md` and `mission.html` in a folder outside the repository, and sends both to the mission's
page with `omni mission push --from`. It opens no branch, commit or pull request. If the push fails,
the folder is kept and the skill prints the line to run again,
`omni mission push <n> --from <folder>`.

For one PRD and no conversation, give the PRD and the goal:

```text agent
/omni:mission --prd 2803 'dark mode for quotes on site'
```

Nothing is asked but the fleet's key, when you have not given it with `--fleet`. The scope is that
PRD, there is no measure yet, and the mandate is the default.

### From a goal alone

You do not need a PRD or a roadmap. Give the fleet one goal and it writes the PRDs itself. A mission
started this way runs at **Works alone** only: the PM turns the goal into a roadmap of 1 to 10 PRDs,
plans each one, the Architect reviews each plan, the fleet builds them, and you merge every pull
request the build opens.

- **On the Omni page.** Open the fleet's **Missions** tab. In the **New mission** box, type the goal
  and press **Start**. Your press is the mission's Start: the mission is listed as **Writing the
  mission** until a runner has written it, then as **Writing the roadmap** while the PM writes the
  PRDs.
- **In your agent.** Type `/omni:mission --goal 'dark mode for quotes on site'`. It asks only the
  fleet, then gives you the mission's page, where you press **Start**.

Both refuse in the same cases. A member who is not an owner can start one only when the fleet is
already at Works alone: the box then reads `Works alone only. Ask an owner.` And a repository whose
phase 0 is a pull request refuses with `A goal-only mission needs phase 0 on the server`, because
the PM writes no PRD there.

If the PM writes no PRD, it is sent once more. After a second try with none, the mission waits on
you: its row reads **No PRD written**, and **Why** opens the mission's brief with the PM's reason.
A mission with no PRD is never shown as delivered.

#### How the PM's PRDs reach the build

Nothing a PRD needs before its build is written to the repository: no issue, branch, commit or pull
request. Each PRD the PM writes goes through four steps, each recorded on the mission, then the build.

1. **The PM writes it on Omni.** The PM writes each PRD's spec and before/after on its own page in
   your product, as `<key>-<n>` (`omni-loop-31`). Several PRDs make a product roadmap. The repository
   must belong to a product: one that belongs to none stops the mission with `this repository has
   no product: a goal-only mission needs one`, and no PM job is sent.
2. **The PM plans it.** It writes the PRD's plan on its page.
3. **The PM approves the plan.** Its approval names the plan version it read.
4. **The Architect reviews it, every time.** It reads the spec, the plan and the playbook's
   architecture, testing, conventions and CI forms, and the laws the plan's files touch. It fixes
   the plan's coding parts itself, as a new plan version, and approves. Its approval gives the PRD's
   Tech Approval, signed by the fleet's Architect, an agent. What it cannot settle it leaves to you,
   and the PRD waits.

**The build** (`/omni:ultra-yolo <key>-<n>`) starts only when the PM's approval and the Architect's
name the same plan version, the latest. A version the Architect changed goes back to the PM to
approve, two rounds at most, then to you. An Architect job that left no record is never read as an
approval: it is sent to you as `no record of the tech review`. The code reaches the repository only
in the build's pull requests, and you merge each one.

**What you see.** The fleet's **Operation room** shows, for each PRD of the PM's, a plan row (the
PM, the plan version it approved) and a tech row (the Architect, what it settled, or `Not reviewed
yet`). The points the Architect left to you are listed under **Waiting on you**: approve the PRD
on its page once you have settled them. A PRD a person wrote and put in the mission keeps the
committee.

## Starting never waits

The mission starts from its page, when a person presses **Start**, the moment its brief is there.
The page is the mission's record: there is no pull request to merge first.
Until someone presses Start, the mission stays a draft and sends nothing.

[Next → Repository flow](/docs/flow)
