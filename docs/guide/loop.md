---
title: How the loop works
description: The loop in three drawings — its six stages and who acts at each, the pull requests you will see, and which skill runs which.
---

One PRD goes around one loop, from an idea to a retro. At three points it waits for a person;
everywhere else, agents do the work, and write down every decision they took without you. This page
shows the loop three ways: its stages, its pull requests, and its skills.
[Use cases](/docs/use-cases) then says what to type for each thing you want to do.

## The loop, stage by stage

![The Omni Loop: idea, PRD, inbox, outbox, shipped and retro, and who moves a PRD from each stage to the next](diagrams/loop.svg)

| Stage | What it means | Where you see it | What moves it on |
|---|---|---|---|
| **idea** | talked through with Claude, nothing written yet | your Claude Code session | `/omni:brainstorm` writes the PRD; a vast idea goes through `/omni:think-big` first |
| **PRD** | a spec, a plan and a before/after page, waiting for a person's approval | the PRD issue, the phase-0 pull request | you merge the phase-0 pull request |
| **inbox** | approved, ready to build | `.omni-loop/delivery/inbox/` | `/omni:yolo` builds it |
| **outbox** | being built; what the agents decided alone waits for you | the feature pull request, a draft | you answer the questions, then merge the feature pull request |
| **shipped** | the change is on the default branch | `.omni-loop/delivery/shipped/` | the Omni App opens the retro and knowledge pull requests |
| **retro** | how the delivery went, and what it taught | the retro and knowledge pull requests | you merge them, and the next idea starts from what they keep |

Three rules hold the loop together:

- **The folder is the status.** A PRD's folder sits in the inbox until it ships, and in the shipped
  folder after. `omni prd` followed by a PRD's number says where it is, and every skill looks there
  before it acts.
- **Only a person merges into the default branch.** The agents merge slices into a PRD's feature
  branch, never further. The phase-0, feature, retro and knowledge pull requests are yours to merge.
- **Every decision an agent takes alone becomes an outbox item,** which you answer or adopt. Nothing
  is decided behind your back, and nothing stops a build to wait for you.

## Your three gates

1. **The phase-0 pull request.** Merging it approves the PRD and puts it in the inbox, on the
   default branch (why, below). It holds documents only, no code: this is the cheapest moment to
   change your mind.
2. **The outbox.** When the build is done, the feature pull request lists every question the agents
   met, in plain words, each with the option they built (always A) and the others. You answer them
   all in one comment, and `/omni:yolo-fix` rebuilds what you changed. The lighter decisions are
   adopted as each wave merges: they stand unless someone objects later.
3. **The feature pull request.** It is marked ready for review once no question is left open. Its
   description says what was built, how it was checked, the risk and how to roll it back. Merging it
   ships the PRD.

Between two gates, nothing asks you anything. Only two things hold a slice: a confirmed rule of your
knowledge base it would break, and an action only a person can take, such as adding a secret. Both
come back to you with what to do.

### Why the phase-0 pull request goes into the default branch

The PRD's feature branch already holds the spec, the plan and the before/after: `/omni:brainstorm`
wrote them there. The phase-0 pull request carries the same files, byte for byte, into the
**default branch**, and it is that merge which puts the PRD in the **inbox**. It matters for four
reasons:

- **The inbox is read on the default branch.** The folder is the status, and `omni status`, the
  status line and every teammate's checkout read the folders from the default branch. Until the
  phase-0 pull request is merged, they show the PRD as `in review`: counted apart, not yet
  approved. Once merged, its folder sits in `.omni-loop/delivery/inbox/` for everyone: approved,
  ready to build.
- **The merge is the approval, on record.** Only a person merges into the default branch. The merge
  says who approved which spec and which plan, and when, before a line of code was written.
- **The next PRDs can build on it.** Every new PRD starts from the default branch, so from then on
  it can read this spec and this plan, and name this PRD among the ones it waits for
  (`blocked-by`), which the kit accepts only for a PRD already in the inbox or shipped.
- **The feature pull request stays about the code.** Before it ships, `/omni:yolo` merges the
  default branch into the feature branch; the two copies of the documents are identical, so they
  reconcile to nothing. The feature pull request then shows what changed since the approval: the
  code, and the PRD's folder moving from `inbox/` to `shipped/`. You read the documents once, at
  phase 0, and the code once, at the end.

## The pull requests you will see

![The pull requests of one PRD over time: the phase-0 pull request, the feature branch and its sub-pull requests wave by wave, the merge of the feature pull request, then the retro and knowledge pull requests](diagrams/pull-requests.svg)

Every PRD opens the same few issues and pull requests, each with its label:

| Label | What it is | Opened by | Merged by |
|---|---|---|---|
| `omni:prd` | the PRD's issue: its number is the PRD's number | `/omni:brainstorm` | closed when the PRD ships |
| `omni:phase-0` | the PRD's folder alone: spec, plan, before/after | `/omni:brainstorm` | you, into the default branch |
| `omni:feature` | the whole change: a draft until no question is open | `/omni:plan`, run by `/omni:brainstorm` | you, into the default branch |
| `omni:sub` | one slice, or one rework | `/omni:wave`, `/omni:do-work` | the loop, into the feature branch |
| `omni:retro` | how the delivery went | the Omni App, once shipped | you |
| `omni:knowledge` | the decisions you settled, written back into the knowledge base | the Omni App, once shipped | you |

The retro and knowledge pull requests open only when the delivery taught something worth keeping.
Three more labels say a state rather than a kind:

- **`omni:in-progress`**: an agent is working on this pull request right now. Leave it be.
- **`omni:needs-fix`**: a slice or a check stayed red after its tries. Its status comment says what
  a person must do.
- **`omni:outbox-go`**: a person lets the outbox gate pass while questions are still open. The loop
  never adds it.

Each of the loop's pull requests carries a status comment, kept current: where it is, and the steps
left to a person.

## Laws and their tests

When your repository keeps its laws in the knowledge base (`laws.source: knowledge` in
`.omni-loop/config.yml`), each rule and invariant there says what must stay true, and its
`Enforced by:` line names how. A **law** is a decision worth a test, and it carries that test.
Everything in this section is off unless `laws.source` is `knowledge`.

`Enforced by:` reads one of three ways:

| `Enforced by:` | What it means |
|---|---|
| a path, such as `src/quotes/total.test.ts` | the law's test: the outbox gate treats any change to it as a change to the law |
| `pending #<n>` | a law that waits for its test: law issue `#<n>` is open, and agents respect the law already |
| `unenforced` | a law with no test and no issue yet; refused once `laws.requireProof` is on, below |

### Worth a law?

When a feature pull request merges, the knowledge harvest writes back the decisions you settled.
Each one it calls a rule or an invariant takes one of three paths:

1. **The feature changed a test that proves it.** It becomes a law, with that test in its
   `Enforced by:`.
2. **No test, and not worth a law.** It stays out of the knowledge base. Its PRD's `settled.md` keeps
   it, with the note `not worth a law`, and who decided.
3. **No test, and worth a law.** The knowledge pull request writes it with `Enforced by: pending #<n>`,
   and the harvest opens **law issue** `#<n>`, titled `Law: <statement>` and labelled `omni:law`
   (`labels.law`). Its body names the entry, its register, its source and where its test would live.

"Is this worth a law?" is answered by the model that classifies the decision. When your workspace
turns the **`law-worth`** decision on in **Settings › Jev** on the Omni page, Jev's answer counts
instead, whenever it is confident enough. It starts **Off** in every workspace; **Shadow** lets you
read how often Jev agrees before you trust it. When Jev cannot answer, the model's answer stands, and
the harvest still completes.

### Give a law its test: `/omni:enforce`

```text agent
/omni:enforce 1400
```

It takes one law issue to one pull request. It writes one test of the law where your testing form
says tests live, then **proves** it: it breaks the law in the code with the smallest change it can
find and sees the test go red, then restores the code and sees it green. A test that cannot go red
proves nothing. It then rewrites the entry's `pending #<n>` to the test's path, on a branch
`test/law-<id>` (`branches.law`), and opens one pull request into the default branch that closes the
issue, its description showing the red line and the green one. **You merge it.**

When the test cannot be made to go red, or the law is already broken, it opens no pull request: it
comments on the issue with what is stuck, and the law stays `pending`.

### Move your repository onto it: the sweep

A repository that kept laws before this has many `unenforced` ones. Once, from a terminal at its
root, with `OPENROUTER_API_KEY` set:

```bash terminal
omni knowledge judge
```

It asks "worth a law?" of every `unenforced` rule and invariant, the model first, then
`omni decide law-worth` with your sign-in, whose answer counts when your workspace turned `law-worth`
on. A **yes** opens its law issue and turns the entry into `pending #<n>`; a **no** takes the entry
out of its register and records it in its PRD's `settled.md` as not worth a law, and the report
names every entry that cited it, for you to fix. Once every law is judged, it sets
`laws.requireProof: true`. It only writes files: commit them on a `docs/knowledge-<topic>` branch
(`branches.knowledge`), open the knowledge pull request, review it and merge it.

From then on, `omni check knowledge` refuses a rule or an invariant whose `Enforced by:` is
`unenforced`: each one names a test, or `pending #<n>`. Until a repository runs its sweep,
`laws.requireProof` stays `false` and nothing changes, so a kit update never turns your checks red.

### A person answers every change to a law

Four changes count as a change to a law:

- **`law-proof`**: the law's test changes;
- **`law-text`**: a register of the knowledge base, or a decision record, changes;
- **`test-removed`**: a test file is deleted;
- **`law-demoted`**: a law's test path turns back to `pending` or `unenforced`, or a law leaves the
  knowledge base.

Each needs a question ranked `high`, one a person answers on the pull request. An account that says
`spec <where>`, or names a `medium` question the loop adopted by itself, does not count: the outbox
check stays red. Which pull request gets which check:

| Pull request | Its outbox check |
|---|---|
| a feature pull request | as always, with the four law changes answered only by `high` questions |
| a fix (`/omni:bug-fix`, `/omni:visual-fix`) | `success` when it touches no law. One that does needs a small `outbox/` in the fix's folder, one `high` question per change: the fix skills raise them, and the check names the law and stays red until you answer |
| a knowledge pull request, or one `/omni:enforce` opened | never blocked: merging it is your answer. The check lists the laws it touches |

## Slices and waves

The PRD's plan, `plan.md`, cuts it into thin slices. Each slice has a **territory**, the files it
may touch; the slices it waits for; and a **wave**. The slices of a wave are built side by side,
each by its own agent in its own copy of the repository, each ending in its own sub-pull request.
The loop merges them into the feature branch one at a time, checks the wave as a whole, then starts
the next wave.

When `/loop /omni:drive` drives several PRDs, their waves also run side by side: a **pool** of up to
`limits.parallelSteps` steps at once, 3 by default, each step its own agent in its own worktree. A
step joins the pool only when it passes four rules against every step running: it is of **another
PRD**, its PRD has **no open blocker**, its slices share **no path in the same repository** with a
running step's, and **the plan allows it** (the steps it comes after are done). A step kept back is
held, with the rule and the step it waits on. Set `limits.parallelSteps: 1` in
`.omni-loop/config.yml` to run one step per tick, as before ([Drive the loop](/docs/drive)).

A slice that stays red after its tries gets `omni:needs-fix`; it holds only the slices that wait for
it, and the rest go on. To see a PRD's slices, which are merged, in flight, stuck, ready or waiting,
and what can run next:

```bash terminal agent
omni board 7
```

## Which skill runs which

![Which skill runs which: you type /omni:brainstorm, /omni:yolo and /omni:yolo-fix; they run /omni:plan, /omni:wave, /omni:do-work and the dossier skills; every pull request goes through /omni:pr; for a milestone of several PRDs, you type /omni:roadmap, then /loop /omni:drive --roadmap](diagrams/skills.svg)

| Skill | Type it when | It ends with |
|---|---|---|
| `/omni:think-big` | you have a vast idea, one that would take several PRDs, and want to see bold directions before any is cut | the concept pull request, with its vision tour and its areas, and the concept's page under **Work › Concepts** on the Omni page; its last line is the `/omni:brainstorm --concept` line of the first area |
| `/omni:brainstorm` | you have an idea | the PRD issue, the phase-0 pull request and the draft feature pull request; its last line is the `/omni:yolo` line |
| `/omni:yolo <n>` | the phase-0 pull request is merged | every slice merged into the feature branch; the feature pull request ready, or questions for you |
| `/omni:yolo-fix <n>` | you answered the questions | what you changed rebuilt, and the feature pull request ready |
| `/omni:roadmap <source>` | a milestone takes several PRDs, and you have its plan | every PRD's issue and spec, `roadmap.md`, and one phase-0 pull request; its last line is the `/loop /omni:drive --roadmap` line ([Roadmaps](/docs/roadmaps)) |
| `/loop /omni:drive` | PRDs, or with `--roadmap <n>` a roadmap, are approved and you want them built without typing each next command | each PRD ready, or parked with what it waits on; up to `limits.parallelSteps` steps (3 by default) run at once when they share no ground, and the loop stops itself ([Drive the loop](/docs/drive)) |
| `/omni:plan <n>` | a PRD has no plan yet; `/omni:yolo` runs it for you | `plan.md`, and the draft feature pull request |
| `/omni:wave <n>` | you want one wave at a time; `/omni:yolo` runs it for you | the wave's slices merged into the feature branch |
| `/omni:do-work <n> <slice>` | you want one slice alone; `/omni:wave` runs it for you | one sub-pull request into the feature branch |
| `/omni:pr` | a pull request of the loop is red or conflicts; the skills run it for you | the pull request green, or stuck, with the reason |
| `/omni:enforce <issue>` | a law issue (`omni:law`) waits for its test ([Laws and their tests](#laws-and-their-tests)) | one pull request a person merges: the law's test, seen red with the law broken and green with it restored |
| `/omni:invade` | once, after the install; with `--refresh` when the repository has changed a lot | one docs pull request: the knowledge base |
| `/omni:status` | you want to see where the PRDs are | one screen |
| `/omni:help` | you want to know what a command does | one screen |
| `/omni:ask on` | you would rather answer Claude's questions on a web page | the page's link |
| `/omni:dossier-open`, `/omni:dossier-push` | never: `/omni:brainstorm`, `/omni:think-big` and `/omni:plan` run them | the PRD's page on the Omni page, or a concept's page under **Work › Concepts** |

Every skill, what it does and when to use it: [Skills](/docs/skills).

Given a name, `/omni:help` explains one skill or command: `/omni:help yolo`.

## In a terminal

A few `omni` commands are for you, in a terminal at the root of the repository or from Claude Code
with `!` before them. None of them changes anything, except `omni signin`, `omni update`, `omni knowledge judge`, which
writes the sweep's edits into your working tree and opens law issues, and the last two:
`omni roadmap answer` comments on the roadmap's issue, and `omni roadmap push` updates the roadmap's
page.

| Command | What it says |
|---|---|
| `omni status` | where the repository's PRDs are, read from git; with `--fetch`, fetched first |
| `omni status 7` | whether PRD 7 still has open questions: its outbox gate |
| `omni prd 7` | where PRD 7 lives, and its files |
| `omni board 7` | PRD 7's slices, and what can run next |
| `omni roadmap check 1200` | whether roadmap 1200 holds together: its PRDs wave by wave, or what it refuses |
| `omni kb show briefing` | one form of the playbook, as the agents read it: `briefing`, `testing`… |
| `omni knowledge BR-QUOTE-1` | one rule of the knowledge base, by its id |
| `omni knowledge judge` | the sweep: asks "worth a law?" of every `unenforced` law, once per repository ([Laws and their tests](#laws-and-their-tests)) |
| `omni signin` | signs this laptop in to the Omni page |
| `omni version` | which kit the repository runs, and whether a newer one exists |
| `omni update` | opens the pull request that brings the repository to the newer kit |
| `omni help` | every command, on one screen |
| `omni roadmap answer 1200 Q5 "…"` | answers question Q5 of roadmap 1200, in a comment on its issue |
| `omni roadmap push 1200` | sends where each PRD of roadmap 1200 stands to its page; the drive runs it after every tick |

The skills run the others themselves, such as `omni ship` or `omni adopt`: you never need to.

[Next → Your first PRD](/docs/first-prd)
