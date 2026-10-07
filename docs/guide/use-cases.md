---
title: Use cases
description: What to type for each thing you want to do, from an idea to a pull request that stays red.
---

Each section below is one situation: what to type, what happens, and what comes next. Slash
commands go in Claude Code, at the root of the repository; `omni` commands go in a terminal there,
or in Claude Code with `!` before them. In the examples, `7` stands for your PRD's number.

| You want to… | Type |
|---|---|
| [turn an idea into a PRD](#i-have-an-idea) | `/omni:brainstorm <the idea>` |
| [explore a vast idea before any PRD](#explore-a-vast-idea) | `/omni:think-big <the idea>` |
| [deliver a milestone of several PRDs](#deliver-a-milestone-of-several-prds) | `/omni:roadmap <your plan>`, then `/loop /omni:drive --roadmap 1200` |
| [make a small visual change](#make-a-small-visual-change) | `/omni:visual-fix <the change>` |
| [fix a bug](#fix-a-bug) | `/omni:bug-fix <the bug>` or `/omni:bug-fix 612` |
| [build an approved PRD](#build-an-approved-prd) | `/omni:yolo 7` |
| [answer the agents' questions](#answer-the-agents-questions) | a comment on the feature pull request, then `/omni:yolo-fix 7` |
| [build it one wave at a time](#build-one-wave-at-a-time) | `/omni:wave 7` |
| [help on a PRD you do not own](#help-on-a-prd-you-do-not-own) | `/omni:wave 7` |
| [build one slice by hand](#build-one-slice-by-hand) | `/omni:do-work 7 s3` |
| [pick up a build that stopped](#pick-up-a-build-that-stopped) | `/omni:yolo 7` again |
| [fix a pull request that stays red](#fix-a-pull-request-that-stays-red) | `/omni:pr 42` |
| [see where things are](#see-where-things-are) | `/omni:status`, `omni board 7` |
| [look up a rule of the product](#look-up-a-rule-of-the-product) | `omni knowledge <id>` |
| [answer Claude's questions on a web page](#answer-claudes-questions-on-a-web-page) | `/omni:ask on` |
| [refresh what the loop knows](#refresh-what-the-loop-knows) | `/omni:invade --refresh` |
| [move to a newer kit](#move-to-a-newer-kit) | `omni update` |

## Start

### I have an idea

```text agent
/omni:brainstorm Let people export their invoices as a CSV file
```

Claude says how big it thinks the idea is, then asks its questions one at a time, and shows you the
design before it writes anything. A **spike**, a "can we…?" question, ends there, with an answer and
no pull request. Anything bigger ends with the PRD issue, the **phase-0 pull request** (the PRD's
documents, going into your default branch) and a draft **feature pull request**.

**Then:** read the phase-0 pull request, and merge it when it is what you want. It goes into your
default branch on purpose: that merge puts the PRD in the inbox, approved, for everyone
([why](/docs/loop#why-the-phase-0-pull-request-goes-into-the-default-branch)). Something wrong? Do
not merge: tell Claude what to change, in the same session. The whole walk is
[Your first PRD](/docs/first-prd).

### Explore a vast idea

An idea that spans the whole product and would take several PRDs: a new identity, a rewrite, a new
experience for every user. Before anyone cuts it into PRDs, see what the whole could be.

```text agent
/omni:think-big Give every employee an agenda in our app
```

Claude says how big it thinks the idea is, and what kind: a new experience, a new identity or a new
way to build. A tweak gets the `/omni:visual-fix` line; an idea one PRD would carry is offered
`/omni:brainstorm` or a lite run. A vast one carries on. A studio of agents shows you six to eight
rendered concepts on one page, each with the moment a user would tell a colleague about, while a
panel (a Visionary, a Craft critic, a Skeptic, a Value critic and one or two real users) argues over
each by name. You keep, kill, merge or push further; the next round turns the ones you kept into
clickable prototypes. You crown one, click through its vision tour, and edit its **areas**: the
PRD-sized parts of it, in build order, the first one the wedge. A full run spawns many agents: stop
after any round, and nothing is written.

Once you crown one, it opens an issue labelled `omni:concept` and one pull request into your default
branch that carries the concept's folder, such as
`.omni-loop/delivery/inbox/concepts/0712-team-agenda/`: `concept.md`, the vision tour, every board
as you saw it and the debate. No spec, no plan, no code.

**Then:** open the vision tour, and merge the pull request: the concept is in the inbox. Then
brainstorm its areas one at a time, the wedge first, each in a clean session:

```text agent
/omni:brainstorm --concept 712 day-view
```

Each starts from the area's brief and the concept's vision, and ends like any brainstorm, with a
phase-0 pull request. The concept's Areas table shows which area became which PRD. It never merges
itself.

### Deliver a milestone of several PRDs

A milestone that takes a dozen PRDs or more, some waiting on others, and a plan that already says
what each one does: a page, a file in the repository, or text you paste.

```text agent
/omni:roadmap docs/plans/crew.md
```

Claude reads the plan and shows you **one map**: every PRD it will write, what blocks each and why,
the wave each sits in, and the open questions. You answer it in one message. It then writes every
PRD's issue, spec and before/after page, with no plan yet, opens the roadmap's issue, writes
`roadmap.md`, and opens **one phase-0 pull request** for the whole roadmap. In a plan repository,
type `/omni:mega-roadmap` instead: it also says where each PRD lands.

**Then:** read the phase-0 pull request and merge it, which approves every PRD at once. Then drive
it, with the roadmap's number:

```text agent
/loop /omni:drive --roadmap 1200
```

Each PRD is planned and built once the PRDs it waits on have merged; one that waits names the pull
request to review first. Merge each feature pull request as it becomes ready: that is what unblocks
the next ones. Follow it on the **Roadmaps** page of the app, and answer a question that parks a PRD
with `omni roadmap answer`. The whole walk is [Roadmaps](/docs/roadmaps).

### Make a small visual change

A colour, a spacing, a label, a hover state: a change you judge by looking at the screen, too small
for a PRD.

```text agent
/omni:visual-fix The sidebar background is too light
```

It opens an issue labelled `omni:visual` (or give it the number of an issue that already says what
to change), finds the screen, and shows you a page with today beside four or five variations,
lettered A to E. You pick one, or ask for another round. It applies the pick on a fix branch, looks
at the real screen once, and opens one pull request into your default branch that closes the issue,
with a before/after page. There is no spec, no plan and no phase-0 pull request.

When the change turns out to need data, a route, an API or a new screen, it stops, says so on the
issue, and gives you the `/omni:brainstorm` line to run instead.

**Then:** open the pull request's preview, and merge it if it looks right. It never merges itself.

### Fix a bug

Something a user, a browser or an API caller can see going wrong, where the right behaviour is
already clear: too small for a PRD.

```text agent
/omni:bug-fix Saving twice duplicates the row
```

It opens an issue labelled `omni:bug` (or give it an issue that already reports the bug: `612`,
`#612` or its link), and posts a triage on it: which area owns it, how bad it is (a
`omni:risk-<level>` label), and whether a change broke it (`omni:regression`). On a fix branch it
writes a test that shows the bug and runs it before any fix: it must fail. Then it fixes the bug,
adds the cheap check that would have caught it, and opens one pull request into your default branch
that closes the issue, with a **Bug** section saying what failed before the fix. There is no spec,
no plan and no phase-0 pull request.

A flaky check is not a bug: it says so on the issue and stops. When the fix needs a product
decision, a change to stored data or a shared interface, or a new screen, route or API, it stops,
says so on the issue, and gives you the `/omni:brainstorm` line to run instead.

**Then:** review the pull request, and merge it if it is right. It never merges itself.

## Build

### Build an approved PRD

The phase-0 pull request is merged. Start from a clean session (`/clear`) and a checkout with no
uncommitted changes, then:

```text agent
/omni:yolo 7
```

It asks you nothing. It plans the PRD if it has no plan yet, builds every slice wave by wave, merges
each sub-pull request into the feature branch, then reads the outbox. Its reply always ends with
**What is next?**, whose last line says what to do:

- **`Nothing to run: merging #… is yours.`** No question is open, and the feature pull request is
  ready for review: review it, and merge it.
- **`/omni:yolo-fix 7`**: questions wait for you. See
  [Answer the agents' questions](#answer-the-agents-questions).
- **`/omni:yolo 7`**: something holds it. See [Pick up a build that stopped](#pick-up-a-build-that-stopped).

It leaves your checkout on a detached commit: `git switch main` brings you back.

### Answer the agents' questions

The feature pull request has a comment listing every decision the agents took alone, each under a
number, with the option they built (A) and the others. Reply in a new comment on that pull request,
one line per question:

```text github
1: A
2: B because the export must include cancelled invoices
```

`go with recommendation`, alone on a line, keeps what was built for every question. A question that
asks you to do something, such as adding a secret, takes `3: ok` once it is done. Then, in a clean
session:

```text agent
/omni:yolo-fix 7
```

It records your answers, rebuilds every part where you chose another option, one sub-pull request
each and never wider than the question said, and marks the feature pull request ready when nothing
is left open. It raises no question of its own.

### Build one wave at a time

You would rather look at each wave before the next one starts:

```text agent
/omni:wave 7
```

It builds the next wave only: it claims every slice that can run, has one agent build each, and
merges them into the feature branch one at a time. Look at what it merged, then run it again for
the next wave. When the board has nothing left to build, `/omni:yolo 7` finishes: it runs the
outbox gate, and ships or posts the questions. A PRD with no plan yet needs `/omni:plan 7` first.

### Help on a PRD you do not own

Anyone with a free agent can lend it to a PRD being built. See what is left to build:

```bash terminal agent
omni board 7
```

A slice that is **runnable** is free to take; one **in flight** is someone's, its draft sub-pull
request marked `omni:in-progress`. Then run the wave on that PRD:

```text agent
/omni:wave 7
```

It claims only the slices nobody holds, and a claim left stale, builds them, and merges them into
the PRD's feature branch. Several people can run it on the same PRD: a slice is claimed, with its
draft sub-pull request, before any agent builds it, and a claimed slice is left to whoever holds it. The PRD stays its owner's: its questions
and its feature pull request are theirs to answer and to merge. Tell them you are lending a hand.

### Build one slice by hand

To build one slice yourself, with Claude, name the PRD and the slice, as `plan.md` names it:

```text agent
/omni:do-work 7 s3
```

It reads the repository's rules first, works test-first, changes only the files the slice may touch,
and ships the slice as a sub-pull request into the feature branch. The next `/omni:wave` or
`/omni:yolo` on the PRD merges it. Given only a PRD number, run `/omni:yolo` instead.

## When it does not go through

### Pick up a build that stopped

`/omni:yolo` ended with `/omni:yolo 7` as its last line: a slice could not be built, a check stayed
red, or something only a person can do holds it. Step 1 of its **What is next?** links the pull
request that holds it, and step 2 says what to do. Do it, then, in a clean session:

```text agent
/omni:yolo 7
```

It picks up where it stopped: the board is read again from GitHub, and what is merged stays merged.

### Fix a pull request that stays red

A pull request of the loop carries `omni:needs-fix`: a slice or a check stayed red after its tries,
and its status comment says what a person must do. Do that first: a missing secret or an access
right is never the agent's to fix. When its CI is red, or it conflicts with its base, hand it to the
skill that watches the loop's pull requests, with its number:

```text agent
/omni:pr 42
```

It picks the pull request up and works on it until its checks are green and it merges cleanly, or
stops after a few tries and says what a person should look at. Then run `/omni:yolo` on the PRD
again to carry on. The errors a first run meets are
in [When something goes wrong](/docs/troubleshooting).

## Know

### See where things are

```text agent
/omni:status
```

One screen: how many PRDs have shipped, wait in the inbox, are being built or wait for review, and
the ones that are yours. It reads git only; `/omni:status --fetch` fetches first. For one PRD:

```bash terminal agent
omni prd 7
omni board 7
omni status 7
```

`omni prd` says where the PRD lives and lists its files, `omni board` its slices and what can run
next, `omni status` with its number whether questions are still open. The **PRDs** page of the app
shows every PRD of your workspace, with its stage and what to do next.

### Look up a rule of the product

The agents read the repository's knowledge base before they build: its rules, and its playbook,
which says how to test, what a pull request looks like, and more.

```bash terminal agent
omni kb show briefing
omni knowledge BR-QUOTE-1
```

The first prints one form of the playbook as the agents read it (`testing`, `conventions`,
`pull-requests`…). The second prints one rule, by an id from your own registers. `omni kb status`
lists every form and the questions still open in them. The **Knowledge** page of the app draws the
same rules as a map.

### Know what a command does

```text agent
/omni:help yolo
```

With no name, `/omni:help` prints the whole loop and every command on one screen.

## Work your way

### Answer Claude's questions on a web page

Ask mode sends every question Claude asks you to a web page, a tab per terminal, where you read and
answer it, from any device. It needs your sign-in (`omni signin`, once per laptop). Then, in Claude
Code:

```text agent
/omni:ask on
```

It prints the page's link. Whenever the page cannot answer, the question shows in the terminal as
usual. A question can be shared with a teammate, who answers it on its own link; the workspace keeps
every question, searchable, under **Questions**. `/omni:ask off` turns it off.

### Follow a PRD from its page

With dossiers on, every PRD has a page on the Omni page: every version of its spec, its plan and its
before/after, for your whole workspace. `/omni:brainstorm` prints the link as it starts ("follow
along at…"); later, the PRD's link:

```bash terminal agent
omni dossier link 7
```

## Keep the repository in shape

### Refresh what the loop knows

The repository has changed a lot since it was invaded: new packages, new rules, new commands.

```text agent
/omni:invade --refresh
```

It redoes only what went stale, never rewrites what a person wrote, and opens one docs pull request
for someone to review and merge. Everything it writes is **proposed**: a rule becomes a law only when
a person deletes its `Proposed:` line. See [Invade](/docs/invade).

### Move to a newer kit

```bash terminal agent
omni version
```

It says which kit the repository runs, and whether a newer one exists. To move to it:

```bash terminal agent
omni update
```

It opens one pull request that brings the repository to the newer kit, and updates the `omni`
plugin on your laptop. Once someone merges it, everyone else updates their own plugin, once per
laptop:

```bash terminal
claude plugin marketplace update omni-loop
claude plugin update omni@omni-loop
```

then `/reload-plugins` in an open Claude Code.

[Next → When something goes wrong](/docs/troubleshooting)
