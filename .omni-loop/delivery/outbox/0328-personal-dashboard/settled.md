# Settled outbox items — PRD 328

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-dashboard-part-contract -->

## s2-01-dashboard-part-contract — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-dashboard-part-contract
prd: 328
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

What does each part of the dashboard get to work with, so that the people building the rankings, the chart and the counts never have to touch a shared file?

## The decision, in plain words

Every part gets the same things: who is reading, their workspace, their GitHub login and fleet, the time, the season, and the game's scores, read once for the whole page. A part that fails to load says so on its own, and the rest of the page still shows.

## The intro, for fun

Three builders, one page, and nobody may touch the shared walls.

## The punchline, for fun

So every room got the same set of keys, and one shared copy of the scoreboard.

## The options, in plain words

A. A: the wider input, the option built: person, workspace, login, fleet, time, season, and the galaxy read once for the page.
B. B: only what the plan named (person, workspace, login, time): each part reads its own galaxy and fleet, and a visit may read the whole ledger up to three times.
C. C: the wider input, and the crew's names read once for the page too, for the rankings.

## What I had to decide

Whether the input every part's loader receives carries the person's fleet, the season and one shared read of the galaxy, beyond the person, workspace, login and time the plan named.

## What I did meanwhile

Each part's loader receives the database as the person, the workspace id, the user id, the GitHub login in lower case, the fleet, now, the season, and a galaxy read made once per request for whichever parts ask. It resolves with its value or unreadable, and a loader that throws is read as unreadable with its error logged. Each part's view receives its value and the season; each part's demo receives the demo world and the demo person.

## What it costs to change later

One type and the page's loader: the three parts are stubs today, so nothing reads the extra fields yet, and dropping one breaks no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether wave 2 needs more in the shared input, such as the crew's names, which each part reads for itself today (author)

```

<!-- /omni-outbox-settled: s2-01-dashboard-part-contract -->

<!-- omni-outbox-settled: s2-02-dashboard-heading-without-player -->

## s2-02-dashboard-heading-without-player — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-dashboard-heading-without-player
prd: 328
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

What is the dashboard's heading for someone who has not joined a fleet yet, or when their player details cannot be loaded?

## The decision, in plain words

It is their first name from their Google account, so the page always opens with who it is for. The card that sends them to the arcade, or the line saying it could not load, follows it.

## The intro, for fun

No hero yet, but the page still wants to say hello to someone.

## The punchline, for fun

It borrows the name Google already knows, until the arcade hands out a better one.

## The options, in plain words

A. A: the first name from the Google account, the option built.
B. B: a fixed heading such as Your dashboard, with no name.
C. C: the join card's own sentence as the heading.

## What I had to decide

The dashboard's one heading when there is no player's display name to show.

## What I did meanwhile

The account's first name from Google, as the arcade greets a visitor who has not joined yet.

## What it costs to change later

One line of the page's view.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a greeting would read better than a bare first name was not asked (author)

```

<!-- /omni-outbox-settled: s2-02-dashboard-heading-without-player -->

<!-- omni-outbox-settled: s2-03-fleet-name-on-light-theme -->

## s2-03-fleet-name-on-light-theme — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-fleet-name-on-light-theme
prd: 328
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

The spec shows the fleet's name in the fleet's own colour. On the light theme a pale fleet colour, such as yellow, cannot be read on a white page: what should the name look like there?

## The decision, in plain words

The name is written in the fleet's colour on the Omni and dark themes. On the light theme it is written in the normal text colour, and a small square in the fleet's colour sits beside it on every theme.

## The intro, for fun

Yellow on white is technically a colour, and practically invisible.

## The punchline, for fun

So the light theme gets a little coloured square to carry the fleet's colours for it.

## The options, in plain words

A. A: the fleet's colour on the dark themes, ink with a colour square on light, the option built.
B. B: the name in the fleet's colour on every theme, as the spec reads, pale fleets hard to read on light.
C. C: the name always in ink, and the colour square alone carrying the fleet's colour.

## What I had to decide

How the fleet's name keeps its colour and stays readable on each of the three themes.

## What I did meanwhile

A square in the fleet colour beside the name on every theme; the name itself in the fleet colour on Omni and Dark, and in the ink colour on Light.

## What it costs to change later

Two lines of the dashboard's stylesheet.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether every fleet colour reaches readable contrast on the Omni and dark grounds was not measured (author)

```

<!-- /omni-outbox-settled: s2-03-fleet-name-on-light-theme -->
