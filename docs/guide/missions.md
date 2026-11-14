---
title: Missions
description: A goal a Virtual Fleet delivers while you are away — what a mission is, what its brief holds, and how to start one with /omni:mission.
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
| **Mandate** | how many PRDs may run at once, 1 to 4, 2 by default |

A mission is numbered by its GitHub issue, like a concept. It lives in two places: its page on the
Omni app, the source of truth while it runs, with every version kept; and the repository, as plain
files under `.omni-loop/delivery/missions/<nnnn>-<slug>/`, `mission.md` (the front matter the kit
reads) and `mission.html` (the brief, a page anyone can open).

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
