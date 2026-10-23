# Settled outbox items — PRD 2410

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-which-issues-break-main -->

## s2-01-which-issues-break-main — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-which-issues-break-main
prd: 2410
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

Which new issues should count as a delivery having broken main?

## The decision, in plain words

An issue counts when a person opened it within the seven days and it names the delivery, or when it is marked as a regression and its triage names one of the delivery's pull requests. Issues opened by an app, and the retro's own issues, never count.

## The intro, for fun

The retro files issues about the delivery, and suddenly the delivery looks guilty of everything.

## The punchline, for fun

Only a person's report can break main; the robots are not allowed to tell on it.

## The options, in plain words

A. Count only issues a person opened, leaving out app-made and retro issues; read the triage only on issues marked as a regression (built).
B. Count every issue that names the delivery, the retro's own included.
C. Read the triage of every new issue, marked or not, at one more request per issue each day.

## What I had to decide

Whether the main watch counts an issue opened within the seven days only when a person opened it (not an app) and it does not carry `labels.retro`, and reads the `/omni:bug-fix` triage comment only on issues labelled `labels.regression`. Decided by: Jev (hardToRevert 0.42) · agent said false

## What I did meanwhile

Built as option A in `apps/omni-app/src/main-watch/signals.ts` (`isReport`, `tracer`): an issue naming `#<n>` (in a target repository, only `<plan>#<n>`) counts; a `labels.regression` issue counts when its body or its triage's Regression line names one of the lane's pull requests.

## What it costs to change later

A rule in one file: widening or narrowing it changes which future breaks are recorded, never a stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec says an issue naming the PRD counts, but the retro opens issues naming the PRD at every merge, so counting them would mark almost every PRD broke
- (author) a triage whose regression label could not be added is not read, since only labelled issues have their comments read

```

<!-- /omni-outbox-settled: s2-01-which-issues-break-main -->

<!-- omni-outbox-settled: s2-02-could-not-check-ends-the-watch -->

## s2-02-could-not-check-ends-the-watch — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-could-not-check-ends-the-watch
prd: 2410
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

When GitHub would not show part of a delivery's first week, should the watch keep asking after the seven days, or stop and say it could not check?

## The decision, in plain words

The watch stops after the seven days and stays marked as could not check, naming what it could not read. A repository of the delivery the app could not read at all is named the same way, so the delivery never reads clean.

## The intro, for fun

GitHub said no to one question, and the watch had to decide how long to keep knocking.

## The punchline, for fun

It knocks for a week, then writes could not check on the door and goes home.

## The options, in plain words

A. Stop after the seven days and leave the delivery as could not check, naming what was not read (built).
B. Keep asking once a day after the seven days until GitHub answers, then close it as clean or broke.

## What I had to decide

Whether a lane whose last look found a read refused (`unread` not empty) ends at its seven days as `watching` with `unread` named, the run then over, rather than looking again each day until GitHub answers; and whether a target the App could not read is named `target <name>` in the unread of the PRD's own lane, which then never closes clean.

## What I did meanwhile

Built as option A in `apps/omni-app/src/main-watch/main-watch.ts` (`finish`, `lanesOf`): the lane stays `watching` with its `unread`, and the page reads it as could not check once `watch_until` has passed.

## What it costs to change later

A constant of one function: looking on after the seven days is a bound on the loop and a rule for when to stop, with no stored shape changed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec says a refused read keeps the watch watching past its seven days, and does not say whether the App should keep reading after them
- (author) the page reading `target <name>` as could not check is s3's to show

```

<!-- /omni-outbox-settled: s2-02-could-not-check-ends-the-watch -->

<!-- omni-outbox-settled: s2-03-red-check-wakes-the-watch -->

## s2-03-red-check-wakes-the-watch — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-red-check-wakes-the-watch
prd: 2410
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

How soon after a red check on the merged change should a delivery read as having broken main?

## The decision, in plain words

A red check on the merged change wakes the watch at once, through a notice GitHub already sends the app. Without one, the watch looks after a day, then once a day on the retro's daily tick, reading everything again each time.

## The intro, for fun

Waiting for tomorrow to admit main is red today felt a little too relaxed.

## The punchline, for fun

Now the watch wakes up when main turns red, and naps the rest of the week.

## The options, in plain words

A. Wake on GitHub's notice that a group of checks finished red on the main branch, then look once a day (built).
B. Look once a day only, so a red check shows up to a day late.
C. Subscribe the app to workflow run notices as well, which asks every installation to accept a changed subscription.

## What I had to decide

Whether the webhook turns a `check_suite.completed` red on the default branch (already subscribed for the touches) into `omni-loop/main-watch.ci-red`, which ends the watch's first wait (`wait-ci`, a day at most) when its `sha` is a lane's merge commit; and whether the looks after it come on the retro's daily tick (`DAY_EVENT`, `DAY_WAIT`), each reading every signal in full. Decided by: Jev (hardToRevert 0.58) · agent said false

## What I did meanwhile

Built as option A in `apps/omni-app/src/webhook/webhook.ts` (`toMainWatchRequests`) and `apps/omni-app/src/main-watch/main-watch.ts` (`watchLanes`); the app's subscriptions and permissions are unchanged.

## What it costs to change later

A route and a wait: dropping the wake is deleting both, with no stored shape and no permission changed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether GitHub delivers `check_suite.completed` to the app for suites other apps made, GitHub Actions' included, is not checked against a live installation: the daily look reads the red job either way, at most a day later
- (author) a red re-run after the first wait is read at the next daily look, not at once

```

<!-- /omni-outbox-settled: s2-03-red-check-wakes-the-watch -->

<!-- omni-outbox-settled: s2-04-served-functions-test-outside-territory -->

## s2-04-served-functions-test-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-04-served-functions-test-outside-territory
prd: 2410
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

May this piece change a test outside the files it was given, when that test lists every job the app runs?

## The decision, in plain words

Yes: the test that lists every job the app runs now includes the new watch. Without it the full test run stays red, and the change is one line of the list and two counts.

## The intro, for fun

A new job joined the app, and the roll call in another room still had the old headcount.

## The punchline, for fun

One name added to the roll call, two numbers bumped, nobody else moved a chair.

## The options, in plain words

A. Update the list of the app's jobs in that test (built).
B. Leave the file to a later piece, with that test red until then.

## What I had to decide

Whether s2 edits `apps/omni-app/src/outbox-check/inngest-route.test.ts`, outside its territory, to add `MAIN_WATCH_FUNCTION_ID` to the functions `/api/inngest` serves, `function_count` 18 to 19 and the preview's 13 functions to 14. Decided by: Jev (hardToRevert 0.72) · agent said false

## What I did meanwhile

Built as option A: the three expectations follow `appFunctions`, which now serves `mainWatch`, and nothing else in the file changed.

## What it costs to change later

Three lines of one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan names `apps/omni-app/src/functions.test.ts` but not this second list of the served functions

```

<!-- /omni-outbox-settled: s2-04-served-functions-test-outside-territory -->

<!-- omni-outbox-settled: s3-01-could-not-check-shows-at-once -->

## s3-01-could-not-check-shows-at-once — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-could-not-check-shows-at-once
prd: 2410
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

When GitHub refused one read during the seven days, should the page say Could not check right away, or keep saying Watching until the seven days end?

## The decision, in plain words

The page says Could not check as soon as a watch holds an unread signal, and Broke main always wins over it. A watch that is still within its seven days and has nothing unread says Watching.

## The intro, for fun

One refused read, and the page cannot decide whether to worry.

## The punchline, for fun

It worries early; a quiet false alarm beats a loud missed one.

## The options, in plain words

A. Could not check as soon as a signal is unread (built).
B. Watching until the seven days end, then Could not check.

## What I had to decide

Whether Could not check shows during the seven days or only after them. The spec says a refused read keeps the watch watching and marked could not check past its seven days, and the acceptance line says a PRD whose reads were refused reads Could not check.

## What I did meanwhile

Built so any unread signal on a watch still being watched reads Could not check, whatever the days left.

## What it costs to change later

A constant: the rule is one condition in main-watch/status.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec does not say whether a refusal on day one already reads Could not check

```

<!-- /omni-outbox-settled: s3-01-could-not-check-shows-at-once -->

<!-- omni-outbox-settled: s3-02-main-reads-wired-outside-territory -->

## s3-02-main-reads-wired-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-main-reads-wired-outside-territory
prd: 2410
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

The page can only show a PRD's main status if its page code asks the database for it, and that code sits just outside this slice's list of files. Should the slice touch it?

## The decision, in plain words

The slice adds one read line to the page's loader and its streaming wrapper, and nothing else there, so the new status and tab have data to show.

## The intro, for fun

The status was ready; the pipe that carries it lived next door.

## The punchline, for fun

It borrowed two lines of the neighbour's wall and left the rest alone.

## The options, in plain words

A. Add the one read to the route and its streaming wrapper (built).
B. Leave them alone and ship the status with no data, for a later slice to wire.

## What I had to decide

Whether to add the watch read to the files that load the PRD page (the route and its streaming wrapper), which the slice's file list does not name.

## What I did meanwhile

Added one optional read to DossierRoute.tsx and to stream/DossierStream.tsx, each a few lines, with no other change there.

## What it costs to change later

Reverting the two small edits removes the data; the status and tab then stay hidden, as for an unwatched PRD.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan lists the page, its view and its head, but not the loader that feeds them

```

<!-- /omni-outbox-settled: s3-02-main-reads-wired-outside-territory -->

<!-- omni-outbox-settled: s3-03-glossary-terms-not-filed -->

## s3-03-glossary-terms-not-filed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-glossary-terms-not-filed
prd: 2410
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

The new words Broke main, main watch and rewind should be offered to the product glossary, which means writing to the product's knowledge on the server. Should the slice do that on its own?

## The decision, in plain words

The slice files nothing. It lists the three words and their meanings here, for a person to propose, and shows the words on the page already.

## The intro, for fun

Three new words walked onto the page without a badge.

## The punchline, for fun

They can stay in the hall until the glossary's owner opens the door.

## The options, in plain words

A. File nothing and list the three terms here (built).
B. File the three terms as product knowledge proposals now, from the slice.

## What I had to decide

Whether the slice writes glossary proposals to the product's knowledge itself. Proposed terms: Broke main: a shipped PRD whose merge turned a check red on main, had one of its pull requests reverted, or was named by a regression, within seven days. Main watch: the seven days after a PRD merges, in which the Omni App records what happens on main in each repository it merged into. Rewind: the walk back from a break on main, through how the PRD was built, to where the break started.

## What I did meanwhile

Showed the words on the page and filed no proposal; the terms above wait for a person to propose them with /omni:knowledge-add.

## What it costs to change later

Nothing to undo: a proposal filed later is one command.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the glossary lives on the server and no command of this slice's tools files a term without a person's session

```

<!-- /omni-outbox-settled: s3-03-glossary-terms-not-filed -->

<!-- omni-outbox-settled: s5-01-who-may-call-the-rewind -->

## s5-01-who-may-call-the-rewind — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-who-may-call-the-rewind
prd: 2410
slice: s5
rank: medium
bears-on: none
raised: 2026-10-23
wave: 3
---

## The question, in plain words

Who may call the two rewind endpoints: a member signed in at the terminal, or also an agent link (an omb_ token)?

## The decision, in plain words

Only a member signed in at the terminal, the same sign-in every other kit push uses. The agent links the page hands out are read-only and do not write anywhere.

## The intro, for fun

The rewind has two doors, and so far only one has a lock that opens for a signed-in member.

## The punchline, for fun

Agent links can still read the room, but they cannot move the furniture.

## The options, in plain words

A. A. Terminal sign-in of a member only (built).
B. B. Terminal sign-in or an agent link, the link resolved to its workspace for the write.
C. C. A new write-scoped agent link made for the rewind.

## What I had to decide

The spec says the endpoints answer only an agent link or a member of the PRD's workspace. An agent link (omb_...) is checked only by the MCP server, read-only, as nobody, with no write path in this app. The endpoints therefore take the member's terminal sign-in (Authorization: Bearer from omni signin), find the PRD's watch among the rows that member can read, and only then insert as the service role. A PRD of another workspace reads as no watch (BR-PRODUCT-63).

## What I did meanwhile

Built both routes on the terminal sign-in alone, as /api/knowledge/changes is: GET /api/rewind/facts and POST /api/rewind/findings in apps/galaxy/app/api/rewind/.

## What it costs to change later

Accepting agent links later means a second check in rewind.controller.ts that resolves the link to its workspace and passes the service that workspace instead of the caller's own read.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec does not say which of the two an agent link would resolve to a workspace for a write
- (author) a runner's job signs in with the member's or the app's token, which this slice did not exercise against a real runner

```

<!-- /omni-outbox-settled: s5-01-who-may-call-the-rewind -->

<!-- omni-outbox-settled: s5-02-main-tab-wiring-outside-territory -->

## s5-02-main-tab-wiring-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-main-tab-wiring-outside-territory
prd: 2410
slice: s5
rank: medium
bears-on: none
raised: 2026-10-23
wave: 3
---

## The question, in plain words

The findings list needed a few lines outside this slice's own files so the Main tab can show it: is that acceptable?

## The decision, in plain words

Yes: the findings are read for the page next to the watch, and the kit's client gained two small calls. Nothing else outside the slice's files changed.

## The intro, for fun

To show a list on a tab, somebody has to carry it from the database to the tab.

## The punchline, for fun

A few lines of plumbing, and the water runs the right way.

## The options, in plain words

A. A. Optional wiring in the four page files and the kit client (built).
B. B. Extend the main-watch store and its view to carry the findings, in s3's files.
C. C. Leave the page unwired and let s7 wire it.

## What I had to decide

The slice's territory lists MainPane and the new rewind folders, but the page reads its data in DossierRoute, DossierStream and view.ts, and DossierPage passes it on; the kit's HTTP calls live in kit/lib/ask/client.ts. To meet 'the Main tab lists the findings' the slice added one optional read and one prop in those four page files (apps/galaxy/src/dossier/page/DossierRoute.tsx, stream/DossierStream.tsx, view.ts, DossierPage.tsx) and two methods, readRewind and pushRewind, to client.ts. Every addition is optional and leaves the existing tests as they were. Decided by: Jev (hardToRevert 0.54) · agent said false

## What I did meanwhile

Added the wiring as optional fields so a page with no findings reads as before; no existing line changed meaning.

## What it costs to change later

Moving the findings read into the main-watch store instead would touch its recording test, which asserts the exact selects.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan names MainPane but not the files that carry its data, so the wiring's owner among s3, s5 and s7 is not stated

```

<!-- /omni-outbox-settled: s5-02-main-tab-wiring-outside-territory -->
