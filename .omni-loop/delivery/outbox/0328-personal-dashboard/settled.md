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

<!-- omni-outbox-settled: s3-01-individuals-without-github -->

## s3-01-individuals-without-github — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-individuals-without-github
prd: 328
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

When someone has not linked their GitHub account, the individual rankings cannot find them. What should the table say below the top three?

## The decision, in plain words

It shows the top three, then the line asking them to link their GitHub in the arcade, the same line the rest of the page uses, rather than telling them they have no points.

## The intro, for fun

The rankings looked for you everywhere, but you never told them your GitHub name.

## The punchline, for fun

So they send you to the arcade instead of guessing you scored nothing.

## The options, in plain words

A. The top three, then the line asking to link GitHub in the arcade, the option built.
B. The top three, then No points yet this season, as for someone who has not scored.
C. The top three alone, with no line below them.

## What I had to decide

What the individuals table shows below the top 3 for a person with no GitHub login: the spec's States table says the rankings show for a player with no GitHub linked, but not what stands in place of your rows.

## What I did meanwhile

Below the top 3, the individuals table shows the dashboard's shared 'Link your GitHub in the arcade' line (Notes.tsx, linking to /play), as the hero block, the chart and the two GitHub counts do. 'No points yet this season' stays for a person the season can find by login and who has not scored.

## What it costs to change later

One line of the rankings' view (Rankings.tsx), and the value's 'no-github' case.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec and the plan name the rankings as shown for a player with no GitHub linked, and do not say what the individuals table shows in place of their rows (author)

```

<!-- /omni-outbox-settled: s3-01-individuals-without-github -->

<!-- omni-outbox-settled: s3-02-rankings-when-names-fail -->

## s3-02-rankings-when-names-fail — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-rankings-when-names-fail
prd: 328
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The rankings need the season's scores and the players' names. If only the names cannot be loaded, should the rankings still show, with GitHub names in place of display names?

## The decision, in plain words

No: when either cannot be loaded, both rankings tables say they could not load, as every other part of the page does when one of its reads fails.

## The intro, for fun

The scores arrived on time, but the name tags got lost in the post.

## The punchline, for fun

Rather than seat everyone under their GitHub handle, the tables ask for a reload.

## The options, in plain words

A. Both tables say they could not load, the option built.
B. Both tables show, each person named by their GitHub login, and the error kept in the server's log.
C. The fleets table shows, and only the individuals table says it could not load.

## What I had to decide

What the rankings show when the season's galaxy is read but the workspace's players, whose display names the individuals wear, cannot be. The spec and the plan name only the galaxy's failure for the rankings.

## What I did meanwhile

The rankings' loader reads the galaxy and the workspace's players (loadCrew) in parallel; either failing throws, the page's settle logs the error and marks the whole part 'unreadable', and both tables read 'Couldn’t load this. Reload in a moment.'

## What it costs to change later

A few lines of the rankings' loader: catch the players' read, log it, and name every hero by login.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec and the plan say what the rankings show when the galaxy cannot be read, and do not name the players' read failing on its own (author)

```

<!-- /omni-outbox-settled: s3-02-rankings-when-names-fail -->

<!-- omni-outbox-settled: s4-01-week-axis-marks -->

## s4-01-week-axis-marks — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-week-axis-marks
prd: 328
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The chart's side scale marks whole numbers from zero to the busiest day. On a busy week, should it mark every single number, even when there are a dozen of them stacked in a small space?

## The decision, in plain words

Up to five merges on the busiest day, every whole number is marked. Past five, the scale counts in round steps of two, five or ten, and always marks the busiest day's number at the top, so it never crowds.

## The intro, for fun

Twelve merges in one day is a great week, and a terrible ladder to print every rung of.

## The punchline, for fun

So past five the scale skips rungs, and the top one always shows the record.

## The options, in plain words

A. Every whole number up to five, then round steps with the busiest day's number at the top, the option built.
B. Every whole number, however many, the marks growing closer as the week gets busier.
C. Only zero and the busiest day's number, whatever the week.

## What I had to decide

How the week chart's y-axis marks its whole numbers when the busiest day has more than five merges: every whole number, as the spec's words could be read, or a round step.

## What I did meanwhile

Every whole number from 0 to the busiest day while it is five or fewer; past five, the smallest step of 2, 5, 10, 20, 50 and so on that keeps five steps or fewer, plus the busiest day's own number at the top, dropping the step's last mark when it would sit within half a step of the top. The busiest bar always reaches the top mark, and no mark is ever a fraction.

## What it costs to change later

One small function in the week's folder and its tests: nothing is stored, and no other part reads it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the axis marks whole numbers only, from 0 to the highest bar, and its sketch shows a week of at most three; it does not say whether a busier week marks every number
- (author) How busy a person's busiest day usually is was not measured: the table fills only once the game workflow runs

```

<!-- /omni-outbox-settled: s4-01-week-axis-marks -->

<!-- omni-outbox-settled: s5-01-waiting-as-the-pages-show -->

## s5-01-waiting-as-the-pages-show — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-waiting-as-the-pages-show
prd: 328
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The spec counts a question as waiting while it is still open. Some questions stay open after the terminal has taken them over, or after their session has closed: should the Waiting for you tile count those?

## The decision, in plain words

It counts a question only while the Omni page can still answer it, exactly as the questions page and the shared-with-me page show it. A question the terminal already took over, or one in a closed session, does not count.

## The intro, for fun

A question left open by a terminal that went home is still, technically, open.

## The punchline, for fun

So the tile only counts the ones someone could actually answer right now.

## The options, in plain words

A. Count only the questions the page can still answer, as the questions pages show them (the option built).
B. Count every question still marked open, as the spec words it, even one the terminal took over or one in a closed session.

## What I had to decide

Whether Waiting for you counts every question whose round is still open, as the spec words it, or only those the page it links to would show as waiting.

## What I did meanwhile

waitingCount runs the ask pages' own rules over what readTabs and readForMe return: a session's newest open round counts while it is under nine minutes old (the hook's wait) and its session is not closed, as the tab list shows it needing you; a shared open round counts while forMeList would list it. The tile and the pages it links to always agree.

## What it costs to change later

One function in the counts' folder: dropping the time rule is two lines, and nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a round is always marked as moved when its terminal stops waiting, which would make the spec's literal rule agree with the pages, was not checked against the stored rounds

```

<!-- /omni-outbox-settled: s5-01-waiting-as-the-pages-show -->

<!-- omni-outbox-settled: s5-02-ask-counts-across-workspaces -->

## s5-02-ask-counts-across-workspaces — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-ask-counts-across-workspaces
prd: 328
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Someone can belong to several workspaces, and the dashboard shows one of them. Should Questions answered and Waiting for you count only that workspace's questions, or all of that person's questions?

## The decision, in plain words

They count all of the person's questions, as the questions pages do, since a question waiting in another workspace still waits for them. Outbox settled and PRDs created count only the workspace shown, like the rest of the dashboard.

## The intro, for fun

Two workspaces, one pile of questions, and a dashboard that can only wear one badge.

## The punchline, for fun

The game's numbers stay home, and the questions follow you wherever you go.

## The options, in plain words

A. Count the person's questions in every workspace, as the questions pages do (the option built).
B. Count only the questions of the workspace the dashboard shows, and let the page the tile links to show more than the tile.

## What I had to decide

Whether the two counts read from the ask tables are narrowed to the workspace the dashboard shows, as the part contract says of every read, or read as the ask pages read them, across every workspace the person belongs to.

## What I did meanwhile

Questions answered counts the rounds the person answered in any workspace they can read; Waiting for you uses readTabs and readForMe unchanged, which read every workspace. Outbox settled and PRDs created filter on the workspace shown. For a person in one workspace, both readings give the same numbers.

## What it costs to change later

One filter per read in the counts' folder; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) how many people belong to more than one workspace today was not checked
- (author) the part contract's line that every read filters on the workspace was written before the ask reads were built, and the spec's data table names no workspace for them

```

<!-- /omni-outbox-settled: s5-02-ask-counts-across-workspaces -->

<!-- omni-outbox-settled: s6-01-dashboard-screenshots-themes-and-width -->

## s6-01-dashboard-screenshots-themes-and-width — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-dashboard-screenshots-themes-and-width
prd: 328
slice: s6
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The plan asks for pictures of the dashboard at three screen sizes. Should they also show each of the three colour themes, and should the picture run stop when the page is too wide for a phone?

## The decision, in plain words

The run takes the dashboard in all three themes at every size, nine pictures in all. It stops with an error when the page is wider than the screen, naming what sticks out, and still saves the picture.

## The intro, for fun

Three sizes asked for, three themes on the switch, and nine pictures is a nicer number anyway.

## The punchline, for fun

And a page that sticks out past a phone's edge now gets caught before a person has to scroll for it.

## The options, in plain words

A. All three themes at every size, and a page wider than its window fails the run, the option built.
B. All three themes, and a page wider than its window only reported, like the small-text list.
C. Only the default theme at each size, as the plan words it, with no width check in the script.

## What I had to decide

What the /app screenshots in pnpm galaxy:shots cover beyond the plan's three sizes: whether they cover each theme, and whether a page wider than its window fails the run or is only reported.

## What I did meanwhile

scripts/shots.mjs opens /app in the demo at each size, picks Omni, Light and Dark on the app bar's switch (tap on the touch sizes, click on the computer), and saves the whole page each time as 34-app-omni, 35-app-light and 36-app-dark. When document.scrollingElement is wider than the window, the run exits 1 and names the innermost elements past the right edge; the screenshot is saved all the same. The text-size report now measures /app too. The README says all of it.

## What it costs to change later

A few lines of one script: the theme list is one constant, and turning the width failure into a report is one line. Nothing is stored, and pnpm test never runs the script.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan and the spec ask for the three sizes and a manual check of the three themes; they do not say whether the screenshots should cover the themes, nor whether the width check belongs in the script
- (author) Whether a sideways scroll at 852 or 1440 px, which the spec does not name, should fail the run as it does at 393 px was not asked

```

<!-- /omni-outbox-settled: s6-01-dashboard-screenshots-themes-and-width -->
