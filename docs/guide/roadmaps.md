---
title: Roadmaps
description: A milestone delivered by many PRDs — written in one sitting from the plan you already have, reviewed in one phase-0 pull request, then driven to the end.
---

Large work is rarely one PRD. A milestone ("a company grants its first mandate after a trial week")
takes a dozen or more, some waiting on others, often across several repositories. Writing each one
through `/omni:brainstorm` means a design conversation per PRD for decisions your plan already took.

A **roadmap** is the milestone as its own object: a set of normal-sized PRDs, each blocked only by
the PRDs it really needs, every blocker saying why. You write it in one sitting, a person reviews it
in one pull request, and the loop drives it to the end.

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

- **Blockers are the narrowest the plan justifies.** A PRD waits for the whole previous phase only
  when the plan says nothing finer, and every blocker carries its `why`.
- **The wave** is 1 with no blocker, else one more than the highest blocker's wave.
- **A question's kind:** `default` runs on its recommendation, written into each blocked PRD's spec
  and accepted when the phase-0 pull request merges; `person` parks the PRDs it blocks until someone
  answers it.
- In a plan repository the table gains a `repos` column naming the target repositories each PRD
  lands in. A target marked `readOnly` can never be named, and a repository that `consumes` another's
  package waits for that provider's PRD to merge first.

`omni roadmap check` refuses a cycle, a wave out of order, a blocker without its why, a spec whose
`blocked-by` differs from its row, and in a plan repository a repository that is not a target or is
read-only. `omni check inbox` runs it on every roadmap of the inbox.

## Drive it

Once the phase-0 pull request is merged, drive the roadmap:

```text agent
/loop /omni:drive --roadmap 1200
```

or, in a plan repository:

```text agent
/loop /omni:mega-drive --roadmap 1200
```

Every PRD whose blockers have merged is planned and built; a PRD whose blocker is still open waits,
and says which pull request it waits on and where that one stands:

```text agent
held: PRD 1213 — waits on app#1201 (P1.1 Crew API and worker skeleton): ready, waiting for your merge
```

A blocker stops blocking when its feature pull request is **merged**, so a PRD always builds on
reviewed code: the pull request named is the one to review first. [Drive the loop](/docs/drive)
explains the loop itself.

## Answer a question

A `person` question parks only the PRDs it blocks. Answer it on the roadmap's page in the Omni app,
or from the terminal:

```bash terminal
omni roadmap answer 1200 Q5 "Weekly, by email"
```

The next tick takes the parked PRDs up. The roadmap's page shows the milestone as a Gantt, one row
per PRD by wave, with an arrow from each blocker and the pull request each waiting PRD waits on; the
loop sends it where each PRD stands after every tick (`omni roadmap push`).

[Next → Landings](/docs/landings)
