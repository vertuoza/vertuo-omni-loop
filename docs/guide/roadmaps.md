---
title: Roadmaps
description: A milestone delivered by many PRDs — written in one sitting from the plan you already have, reviewed in one phase-0 pull request, driven to the end, and followed on the Roadmaps page.
---

Large work is rarely one PRD. A milestone ("a company grants its first mandate after a trial week")
takes a dozen or more, some waiting on others, often across several repositories. Writing each one
through `/omni:brainstorm` means a design conversation per PRD for decisions your plan already took.

A **roadmap** is the milestone as its own object: a set of normal-sized PRDs, each blocked only by
the PRDs it really needs, every blocker saying why. You write it in one sitting, a person reviews it
in one pull request, and the loop drives it to the end.

![A roadmap from the plan you have to the end: your source goes through /omni:roadmap or /omni:mega-roadmap, one map and one answer; it writes roadmap.md and every PRD's issue and spec in one phase-0 pull request you merge; you start /loop /omni:drive --roadmap or /loop /omni:mega-drive --roadmap, and the loop plans and builds each PRD once it is unblocked; you merge each feature pull request, which unblocks the next PRDs](diagrams/roadmap.svg)

Twice a person decides: the phase-0 pull request, once for the whole roadmap, and each PRD's feature
pull request, as it comes. Everything between is the loop's.

## Write a roadmap

Give the skill the plan you have: a page link, a file in the repository, or the text pasted in.

```text agent
/omni:roadmap docs/plans/crew.md
```

In a **plan repository**, whose PRDs land in other repositories, use its twin, which also reads each
target repository (from a read-only clone, in which nothing runs) and says where each PRD lands:

```text agent
/omni:mega-roadmap https://example.com/crew-plan
```

Each refuses the other's kind of repository, printing the line to type instead.

The skill reads the plan and shows **one map**: every PRD it will write, what blocks each and why,
the wave each sits in, the open questions, and anything the check would refuse, already fixed. You
answer the whole map in one message; nothing is written before that, and nothing is asked after.

Then it writes, for every PRD, its issue, its inbox folder, its spec and its before/after page, with
the spec's `blocked-by` taken from the map. **Specs are written up front, plans are not:** each PRD
is planned when the loop reaches it, against the code that exists then. A plan written today for the
last phase would describe code nobody has written yet.

It opens the roadmap's issue, writes `roadmap.md`, checks it with `omni roadmap check` and the inbox
with `omni check inbox`, and opens **one phase-0 pull request** holding the roadmap and every PRD's
folder. Merging it approves the whole roadmap at once. It ends with the line that drives it.

## roadmap.md

The roadmap lives in the inbox, in a folder named after its issue, under `roadmaps/`:

```markdown file=.omni-loop/delivery/inbox/roadmaps/1200-crew/roadmap.md
---
roadmap: 1200
title: Vertuoza Crew — from skeleton to earned autonomy
milestone: A company grants its first mandate after a trial week.
product: Crew
target: 2026-12-18
source: https://example.com/crew-plan
---

## PRDs

| id | PRD | title | blocked by | why | wave |
|---|---|---|---|---|---|
| P1.1 | #1201 | Crew API and worker skeleton | – | – | 1 |
| P3.4 | #1213 | Stateless think endpoint | P1.1 | the endpoint is called by the worker | 2 |

## Open questions

| id | question | recommendation | blocks | kind |
|---|---|---|---|---|
| Q2 | Which model answers first? | the smallest that passes the evals | P3.4 | default |
```

### Its front matter

| field | what it holds |
|---|---|
| `roadmap` | the roadmap issue's number; it matches the folder's number |
| `title` | the roadmap's name, as the Roadmaps page lists it |
| `milestone` | the one sentence that says when the roadmap is done |
| `product` | optional: a product of your workspace, by its name. The Roadmaps list filters by it. A name the workspace does not have files the roadmap under no product, and `omni roadmap push` says so in one line |
| `target` | optional: a date a person gave, written `YYYY-MM-DD`. It is shown as given; the loop never computes one |
| `source` | optional: where the roadmap was read from, such as the plan's link. The roadmap's page links it |

Nothing else goes in the front matter.

### Its tables

- **Blockers are the narrowest the plan justifies.** A PRD waits for the whole previous phase only
  when the plan says nothing finer, and every blocker carries its `why`.
- **The wave** is 1 with no blocker, else one more than the highest blocker's wave.
- **A question's kind:** `default` runs on its recommendation, written into each blocked PRD's spec
  and accepted when the phase-0 pull request merges; `person` parks the PRDs it blocks until someone
  answers it.
- In a plan repository the PRDs table gains a `repos` column naming the target repositories each PRD
  lands in, by their short name. A target marked `readOnly` can never be named, and a PRD in a target
  that `consumes` another comes after the PRDs it waits on that change that other target:
  [Read-only and consumer targets](/docs/several-repositories#read-only-and-consumer-targets).

## What the check refuses

`omni roadmap check` reads every roadmap of the inbox, or one with its number
(`omni roadmap check 1200`), prints its PRDs wave by wave, then each thing it refuses, naming the row
or the question. `omni check inbox` runs it on every roadmap of the inbox.

```bash terminal agent
omni roadmap check 1200
```

It refuses a `roadmap.md` it cannot read:

- no front matter; a missing `roadmap`, `title` or `milestone`; a field that is not one of the six; a
  `target` that is not a `YYYY-MM-DD` date;
- no `## PRDs` section, no table in it, or a column missing from either table;
- an id, or an id in a `blocked by` or `blocks` cell, that is empty or holds a space, a comma or a
  pipe; a `PRD` cell that is not `#<number>`; a row with no title; a wave that is not a positive whole number; a question with no words, or whose
  kind is neither `default` nor `person`.

And a roadmap whose rows do not hold together:

- a `roadmap` number that does not match its folder's;
- an id used twice, among the PRDs and the questions together;
- a blocker that is not a row of the roadmap;
- a cycle among the blockers;
- a wave out of order: not 1 with no blocker, or not one more than the highest blocker's;
- a blocker without its `why`;
- a row whose PRD has no folder in the inbox or the shipped folder, or whose spec does not read;
- a spec whose `blocked-by` differs from its row's blockers;
- a question that blocks a row the roadmap does not have.

In a plan repository, also:

- no `repos` column, or a row that names no repository;
- a repository that is not a target of `plan.targets`, or one marked `readOnly`;
- a PRD in a consumer target in a wave not after a PRD it waits on, directly or through others, that
  changes a target it consumes. PRDs that do not wait on each other may share a wave.

Outside a plan repository, a `repos` column is refused.

A PRD's row still passes once that PRD has shipped: its folder counts in the inbox or in the shipped
folder, and its spec is compared wherever it lives. A roadmap does not fail its check because its
first PRD merged.

## Drive it

Once the phase-0 pull request is merged, drive the roadmap:

```text agent
/loop /omni:drive --roadmap 1200
```

or, in a plan repository:

```text agent
/loop /omni:mega-drive --roadmap 1200
```

![The PRDs of roadmap 1200 over time in two repositories: P1.1 and P1.2 build side by side; P3.4 is held, naming app#1201, the feature pull request of P1.1 it waits on; you merge P1.1, which unblocks P2.1 and P3.4, which then build side by side](diagrams/roadmap-waves.svg)

Every PRD whose blockers have merged is planned and built; a PRD whose blocker is still open waits,
and says which pull request it waits on and where that one stands:

```text agent
held: PRD 1213 — waits on app#1201 (P1.1 Crew API and worker skeleton): ready, waiting for your merge
```

A blocker stops blocking when its feature pull request is **merged**, so a PRD always builds on
reviewed code: the pull request named is the one to review first. In a plan repository, a blocker
has merged once its plan pull request and every target pull request it lands in have merged.
[Drive the loop](/docs/drive#drive-a-roadmap) explains the loop itself.

## Answer a question

A `person` question parks only the PRDs it blocks. Answer it from a checkout of the repository:

```bash terminal
omni roadmap answer 1200 Q5 "Weekly, by email"
```

It posts one comment on the roadmap's issue, which records the answer; the latest answer to a
question wins. It takes only a question the roadmap lists, and an answer of up to 1,000 characters.
The next tick takes the parked PRDs up.

On the roadmap's page, each `person` question not answered yet has an **answer box**. It posts
nothing itself: you write your answer in it, and it builds the `omni roadmap answer` line for you,
with a **Copy** button and a link to the roadmap's issue. Run that line from your checkout.

## The Roadmaps page

The Omni app shows every roadmap of your workspace under **Roadmaps**, in the sidebar's Work group,
above PRDs. The loop sends it where each PRD stands: `/omni:roadmap` once the roadmap is written, the
drive after every tick (`omni roadmap push`). It needs your terminal signed in (`omni signin`); with
the app out of reach, the push prints one line and the loop carries on.

### The list

One card per roadmap: its title, its milestone, its product, how many of its PRDs have merged, how
many wait on your merge, its target date when a person gave one, and **what blocks it now**. That is,
first, each `person` question nobody has answered yet, then each pull request a PRD waits on, once
each: the shortest list of what to do to move it. A card shows three lines and says how many more;
the roadmap's own page shows them all. Above the cards, one chip per product of the workspace that
has a roadmap filters the list, beside **Every product**.

A card also counts the roadmap's open [human work](#human-work), one chip per kind that has some
(`business 1 · dev ops 1 · delivery ops 2`); a kind with none shows nothing.

### A roadmap's page

At the top: its milestone, its progress, its repository, a link to its issue and to its source, and
what blocks it now. Then its Gantt, its human work, its open questions and its PRDs, each linking to
the PRD's own page.

To read the Gantt:

- **One row per PRD, grouped by wave**, in the table's order.
- **An arrow from each blocker**, from the end of the blocker's bar to the start of the bar it blocks.
- **The colour is the state:** waiting (not started), building, outbox (its questions wait for you),
  waiting for merge, merged, and closed unmerged. The legend under the chart names each.
- **Before any PRD has merged, nothing is dated:** each bar sits in its wave's column.
- **Once one has merged, the bars are on dates.** A PRD that started is solid from its start, to its
  merge or to today, then dashed to its projected end. A PRD not started is dashed from the latest end
  of its blockers. The projection is the median length of this roadmap's merged PRDs: its own
  history, never an estimate made up.
- **In a plan repository, each bar has a lane per repository** the PRD lands in.
- **The pull request a PRD waits on is on its bar**, linked, until the PRD merges.

Under the human work, the **open questions**: each with its recommendation and the rows it blocks,
the answer once someone gave one, and the answer box for a `person` question still open.

### Human work

Under the Gantt, the **Human work** item lists every piece of work across the roadmap's PRDs that only
a person can do, sorted into one of four kinds:

| kind | what it holds |
|---|---|
| `business` | a product or business choice: scope, priority, wording, who it is for |
| `development` | a code or design decision a developer makes, a stuck slice, a red CI after its attempts |
| `dev ops` | a right missing in the repository: a secret, a token scope, a grant, an app permission, branch protection |
| `delivery ops` | putting the roadmap in production: a deploy, a migration run, a console step, a production setting or variable |

It reads, from top to bottom:

- **a chip per kind** with how many of its entries are open, a kind with none showing `0`;
- **the open entries, grouped by kind**: each with its PRD (linking to the PRD's page), the repository
  the work is in, what it is, what a person must do word for word when it says, and a link to where
  it is answered;
- **the done entries, folded** under **Done**, with the same fields and the day each was settled.

With nothing recorded, it says `No human work recorded yet.`

`omni roadmap push` gathers it on every push, from four places:

- each `person` question of the roadmap nobody has answered;
- each outbox item ranked `human-action` or `high` on a PRD's open feature branch (in a plan
  repository, on each target's);
- a PRD the drive parked, from the `- loop: parked` line of its feature pull request's status comment;
- the `needs clarification` comment `/omni:plan` posts on a PRD's issue, until the PRD is planned.

Work the push no longer reads, because the question was answered, the item settled or adopted, the
PRD taken up again or planned, is marked done with the day of that push, and comes back open if it
reappears. A push from a kit that sends no human work changes nothing on the page.

**How an entry gets its kind.** The kit sorts each entry by rules: a question is `business`; work that
names a secret, a token, a scope, a permission, a grant, an access or branch protection is `dev ops`;
work that names a deploy, production, a migration run, a console or an environment variable is
`delivery ops`; anything else is `development`. The app can also ask **Jev** to classify each new
entry once, through its `hitl-category` decision under **Settings › Jev**. It starts **Off**, and the
rules' kind stands. **Shadow** asks Jev and logs its answer, keeping the rules' kind. **On** keeps
Jev's answer as the kind. An answer outside the four kinds, or Jev failing, keeps the rules' kind, and
the push never fails because of it. An entry keeps the kind it was first given on every later push.

[Next → Landings](/docs/landings)
