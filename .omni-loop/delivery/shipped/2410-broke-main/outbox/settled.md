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

<!-- omni-outbox-settled: s6-01-knowledge-add-on-a-runner -->

## s6-01-knowledge-add-on-a-runner — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s6
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-knowledge-add-on-a-runner
prd: 2410
slice: s6
rank: medium
bears-on: none
raised: 2026-10-23
wave: 4
---

## The question, in plain words

A runner may now run knowledge-add, as the plan asks, but that skill refuses to write anything when nobody is at the terminal, and it only knows constituents, Legal entries and glossary terms. Should a runner job of it stay a no-op for now?

## The decision, in plain words

I listed knowledge-add among the skills a runner may run, as planned, and left the skill itself unchanged. A runner job of it ends at once and says it wrote nothing, until the skill learns to propose a playbook or register rule on its own.

## The intro, for fun

A helper was hired for the night shift, but its contract still says to wait for a yes.

## The punchline, for fun

So it clocks in, finds nobody to ask, and politely goes home.

## The options, in plain words

A. A. List knowledge-add as runnable now, as built: the job ends writing nothing until the skill learns to run unattended
B. B. Take knowledge-add off the runner lists until the skill can run unattended
C. C. Teach knowledge-add an unattended path that proposes a playbook or register rule, never writes it directly, in s7 or a follow-up PRD

## What I had to decide

Pick A to keep it as built, B to take knowledge-add off the runner lists, or C to give it a way to propose a playbook or register rule with nobody at the terminal (s7 or a follow-up PRD).

## What I did meanwhile

The runner lists name knowledge-add; the skill writes nothing under OMNI_UNATTENDED, so an approved playbook or register finding queues a job that ends at once, writing nothing.

## What it costs to change later

Taking it off is one word in each runner list and the guide; teaching it to run unattended is a change to its skill, which lies outside this slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The line check refuses quotes, so the line s7 queues cannot read /omni:knowledge-add '<the finding>' as the spec writes it; s7 must send the finding another way. (author)
- Whether an unattended knowledge-add should propose (wait for the section's owner) or apply was not asked. (author)

```

<!-- /omni-outbox-settled: s6-01-knowledge-add-on-a-runner -->

<!-- omni-outbox-settled: s6-02-runner-skills-test-outside-territory -->

## s6-02-runner-skills-test-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s6
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-runner-skills-test-outside-territory
prd: 2410
slice: s6
rank: medium
bears-on: none
raised: 2026-10-23
wave: 4
---

## The question, in plain words

Adding the two skills to the runner lists turned red a test outside this slice's files: the one that compares the database's fixed skill list with the app's. Was it right to widen that test here, instead of adding the two names to the database?

## The decision, in plain words

I widened that test so it allows the two new skills to be missing from the database's list, as it already allowed one earlier skill. The database is unchanged: the app and the runner still refuse a repository skill that borrows one of these names.

## The intro, for fun

Two new names joined the guest list, and the bouncer's old copy did not have them.

## The punchline, for fun

We told the bouncer they were late additions, not gate-crashers.

## The options, in plain words

A. A. Widen the test to the names added after its migration, as built
B. B. Add the later names to the database's fixed list in a new migration, and narrow the test back

## What I had to decide

Pick A to keep it, or B to add the three later names to the database's list in a new migration and narrow the test back.

## What I did meanwhile

The test excludes retro-apply, rewind and knowledge-add from the comparison; the database's list holds the twelve older names.

## What it costs to change later

B is one small migration and one line of the test, in a later slice or PRD.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A repository owner could still allow a repository skill named rewind or knowledge-add in the database; the app and the runner refuse its line, so it never runs. (author)

```

<!-- /omni-outbox-settled: s6-02-runner-skills-test-outside-territory -->

<!-- omni-outbox-settled: s6-03-finding-signed-in-its-fix -->

## s6-03-finding-signed-in-its-fix — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s6
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-03-finding-signed-in-its-fix
prd: 2410
slice: s6
rank: medium
bears-on: none
raised: 2026-10-23
wave: 4
---

## The question, in plain words

Each finding must say an agent wrote it, but a finding has no author field and its card shows none. Is a closing sentence in the finding's own fix text the right place for that mark?

## The decision, in plain words

The rewind ends every finding's fix with one fixed sentence saying an agent wrote it, not a person. It travels with the finding wherever the text goes, the issue an approved setup finding opens included.

## The intro, for fun

Every note in the suggestion box now ends with the same polite signature.

## The punchline, for fun

Nobody can mistake the robot's handwriting for the boss's.

## The options, in plain words

A. A. End every finding's fix with the agent's sentence, as built
B. B. Mark the findings as an agent's on the Main tab instead, and drop the sentence

## What I had to decide

Pick A to keep the sentence, or B to have the Main tab show an agent badge on every finding and drop the sentence.

## What I did meanwhile

Each finding's fix ends with: Written by an agent (/omni:rewind), not by a person.

## What it costs to change later

B is a small change to the Main tab and one line of the skill.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the Main tab should also mark findings as an agent's was not asked; the tab is s3, s5 and s7's ground. (author)

```

<!-- /omni-outbox-settled: s6-03-finding-signed-in-its-fix -->

<!-- omni-outbox-settled: s7-01-finding-sent-as-a-plain-line -->

## s7-01-finding-sent-as-a-plain-line — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s7
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-finding-sent-as-a-plain-line
prd: 2410
slice: s7
rank: medium
bears-on: none
raised: 2026-10-23
wave: 5
---

## The question, in plain words

When a member approves a finding, the job a runner gets cannot carry the finding in quotes as the spec wrote it, because the runner refuses quotes and long lines. How should the finding travel to the job?

## The decision, in plain words

The job carries the finding as a plain description: the delivery it came from, then what happened (or the fix, for a knowledge finding), with every character a runner refuses dropped and the line cut at a word to fit.

## The intro, for fun

The runner only reads plain letters, and the finding arrived wearing quotes and dashes.

## The punchline, for fun

So it travels light: no quotes, no frills, just the story in one line.

## The options, in plain words

A. Send the finding as a plain description, cut to fit the runner's line (built).
B. Send a link to the finding, and teach the job to read it in full.
C. Let the runner's line take one quoted argument, as the spec wrote it.

## What I had to decide

Pick A to keep the plain description, B to send a link to the finding that the job reads in full, or C to let the runner take one quoted argument.

## What I did meanwhile

Approve on a repository finding queues /omni:bug-fix rewind of PRD <n>: <what happened>, and on another knowledge finding /omni:knowledge-add rewind of PRD <n>: <its fix>, each at most 200 characters, every character other than letters, digits, spaces and ._/:#- dropped, and a run of dashes made one, so the text never reads as a flag. The runner's own line check accepts every line built this way (rewind.approval.test.ts).

## What it costs to change later

B needs the job to read the finding back from the page (a read the runner's sign-in does not make today) and a change to the two skills' inputs; C changes the runner's line check in the kit and the app, which every runner then has to update to.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A finding longer than the line loses its tail: bug-fix opens its issue from the cut description, so its first words carry the whole bug.
- (author) Whether the job should also carry the finding's fix, and not only what happened, was not asked; the line has no room for both.

```

<!-- /omni-outbox-settled: s7-01-finding-sent-as-a-plain-line -->

<!-- omni-outbox-settled: s7-02-approved-knowledge-rule-writes-nothing -->

## s7-02-approved-knowledge-rule-writes-nothing — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s7
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-02-approved-knowledge-rule-writes-nothing
prd: 2410
slice: s7
rank: medium
bears-on: none
raised: 2026-10-23
wave: 5
---

## The question, in plain words

Approving a finding about the playbook or a register sends a job that writes nothing: the helper it starts refuses to write with nobody at the screen, and it does not write playbook or register rules at all. Is that acceptable for now, though the spec promises the rule gets written?

## The decision, in plain words

Approve sends the job as the spec says, and the card tells the member right after the click that, on a runner, it writes nothing yet and the rule still waits for a person to write it.

## The intro, for fun

The member said yes, the helper was called, and the helper only works when someone is watching.

## The punchline, for fun

So the yes is kept on file, and the rule waits politely for a human pen.

## The options, in plain words

A. Queue /omni:knowledge-add as the spec says; the card says it writes nothing on a runner yet (built).
B. Queue nothing: record the approval and say the rule waits for a person to write it.
C. Teach /omni:knowledge-add to propose a playbook or register rule with nobody at the screen, in a follow-up PRD.

## What I had to decide

Pick A to keep sending the job with the warning, B to send nothing and only record the approval, or C to give the helper a way to propose a playbook or register rule with nobody at the screen, in a follow-up PRD. Decided by: Jev (hardToRevert 0.48) · agent said true

## What I did meanwhile

A knowledge finding that names no glossary term (in backticks or quotes) and no Legal code (L-<CODE>) queues /omni:knowledge-add rewind of PRD <n>: <its fix> on a runner, sent by the member who approved. The skill stops at once under OMNI_UNATTENDED (settled item s6-01), and it only handles constituents, Legal entries and glossary terms, so nothing is written. The card's answer reads: Queued /omni:knowledge-add on a runner of the workspace, sent by you. On a runner it writes nothing yet: the rule still waits for a person to write it.

## What it costs to change later

B is one branch of the approval plan and one sentence of the card. C is a change to the knowledge-add skill (an unattended path that proposes a playbook or register rule for its owner, never writes it) and to the runner's docs, outside this PRD's territory; Approve itself would not change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec promises that Approve on a playbook or register finding gets the rule written; with the skill as it is, that promise is not kept on a runner, and the member is told so only on the card.
- (author) Whether an unattended knowledge-add should propose (wait for the section's owner) or apply was not asked.

```

<!-- /omni-outbox-settled: s7-02-approved-knowledge-rule-writes-nothing -->

<!-- omni-outbox-settled: s7-03-glossary-or-legal-read-from-the-fix -->

## s7-03-glossary-or-legal-read-from-the-fix — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s7
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-03-glossary-or-legal-read-from-the-fix
prd: 2410
slice: s7
rank: medium
bears-on: none
raised: 2026-10-23
wave: 5
---

## The question, in plain words

A finding does not say in a field whether it is about a glossary word or a Legal entry, and a proposal needs the word and its meaning, or the code and the statement. How does Approve tell them apart and fill them in?

## The decision, in plain words

Approve reads the finding's fix for the word it names in quotes, or the Legal code it names, and files the fix's own words as the proposal for the owner to read. A finding that names neither goes to the knowledge helper instead.

## The intro, for fun

The finding said add this word, and left the robot to guess which word.

## The punchline, for fun

So it only files the ones that point at their word; the vague ones go to the helper.

## The options, in plain words

A. Read the word or the code from the fix, and file nothing when it names neither (built).
B. Give a finding explicit fields for its glossary word or Legal code, filled in by the rewind.
C. Ask the member for the word and its meaning, or the code and its statement, on Approve.

## What I had to decide

Pick A to keep reading the fix, B to give a finding explicit fields for the word and its meaning (or the code and statement) that the rewind fills in, or C to ask the member for them on Approve.

## What I did meanwhile

A knowledge finding whose fix names a Legal code (L-GDPR) files a Legal proposal under that code, its statement the fix cut to 400 characters, its source the rewind of the PRD and the evidence links; one whose fix says glossary and names a term in backticks or quotes files a glossary proposal, its meaning the fix cut to 400 characters. Both go through the product's own proposal function as the member, on the repository's product, for the kind's owner to decide. Any other knowledge finding queues /omni:knowledge-add.

## What it costs to change later

B is a new optional field in the finding's shape: the table, omni rewind push, the rewind skill and this plan change together, no data to move. C adds a small form to the card, which the voice objection asked to avoid.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The fix's words are the meaning or the statement as the rewind wrote them, the agent's closing line left out; the owner may find them wordier than a glossary meaning should be.
- (author) A Legal entry's source is meant to be the law it comes from; the rewind names none, so the source holds the PRD and the evidence links instead.
- (author) A glossary word that already exists makes the database refuse the proposal; the card then says it was not filed and to propose it on the Knowledge tab.

```

<!-- /omni-outbox-settled: s7-03-glossary-or-legal-read-from-the-fix -->

<!-- omni-outbox-settled: s7-04-kit-issue-without-evidence-links -->

## s7-04-kit-issue-without-evidence-links — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s7
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-04-kit-issue-without-evidence-links
prd: 2410
slice: s7
rank: medium
bears-on: none
raised: 2026-10-23
wave: 5
---

## The question, in plain words

The spec says an approved setup finding opens an issue on the kit's public repository holding exactly the card's text, but the card also shows links into the workspace's own repository. What should leave the workspace?

## The decision, in plain words

The issue holds the card's words (the check, where it started, what happened and the fix) but not its links, and a finding whose words name the workspace's repository is refused before it is approved, so a member can only reject it.

## The intro, for fun

The finding wanted to post its receipts in public, and the receipts had the company's address on them.

## The punchline, for fun

The story goes out, the receipts stay home.

## The options, in plain words

A. Send the card's words without its links, and refuse a finding that names the repository (built).
B. Send the card's text with its evidence links.
C. Let the member edit the text before the issue opens.

## What I had to decide

Pick A to keep the links at home and refuse a finding that names the repository, B to send the links too, or C to let the member edit the text before it leaves.

## What I did meanwhile

Approve on an Omni-setup finding opens one issue on the kit's repository as the Omni app, titled Rewind: and the first line of what happened, its body the check, Started in: The Omni setup, what happened and the fix with the agent's closing line. When what happened or the fix names the workspace's repository (owner/name) or links GitHub under its owner, the approve route answers 422 and nothing is decided; in the kit's own repository nothing is refused, since the issue opens at home.

## What it costs to change later

B is one line of the issue's body; C adds an edit box to the card and a check that the edited text still names no repository.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The check catches the repository's full name and its GitHub links only: a code name, a customer or a person named in plain words would still leave; the rewind skill is asked not to write them in a setup finding.
- (author) A refused finding can only be rejected, and the same finding is never proposed again, so the setup problem is then raised by hand or not at all.

```

<!-- /omni-outbox-settled: s7-04-kit-issue-without-evidence-links -->

<!-- omni-outbox-settled: s7-06-reject-asks-its-reason-beside-it -->

## s7-06-reject-asks-its-reason-beside-it — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s7
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-06-reject-asks-its-reason-beside-it
prd: 2410
slice: s7
rank: medium
bears-on: none
raised: 2026-10-23
wave: 5
---

## The question, in plain words

The page's drawing shows each finding with only Approve and Reject, and the spec lets a rejection carry an optional reason. Where does the member type it?

## The decision, in plain words

Reject first opens a small optional field beside it, then a second Reject sends the rejection with or without a reason; Approve stays one click, and only the first open finding's Approve is the page's main button.

## The intro, for fun

Saying no is easy; saying why takes one more box.

## The punchline, for fun

The box only shows up when you are already saying no.

## The options, in plain words

A. Open an optional reason field when Reject is clicked, then reject (built).
B. Reject in one click, with no reason.
C. Show the optional reason field on every card at rest.

## What I had to decide

Pick A to keep the field that opens on Reject, B to reject in one click with no reason, or C to show the reason field on every card at rest.

## What I did meanwhile

A proposed finding shows Approve and Reject, as the before/after page draws them. Reject opens a field (Why, if you like) with Reject and Cancel; Enter or Reject sends it. The first proposed finding's Approve carries the page's primary look, the others the quiet one, as the drawing shows.

## What it costs to change later

B or C is a few lines of the card's component; no data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Rejecting takes two clicks, where the voice's answer promised one click per proposal; approving keeps one.

```

<!-- /omni-outbox-settled: s7-06-reject-asks-its-reason-beside-it -->

<!-- omni-outbox-settled: s1-01-watch-per-lane -->

## s1-01-watch-per-lane — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-23T08:17:56Z
- Channel: feature pull request #2414
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2414#issuecomment-6360616792
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-10-22
- Slice: s1
- Wave: 1
- Stays here: a choice of this PRD's tables, written in its migration and spec; it states no lasting rule about the product

### The answer, as it was given

```text
A. A. One watch per PRD and lane: the PRD's own repository and number, and the repository it merged into (built).
```

### The item, as it was raised

```text
---
id: s1-01-watch-per-lane
prd: 2410
slice: s1
rank: high
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

When one PRD lands in several repositories, how should its watch on main be kept: one per repository it landed in, still tied to the PRD it came from?

## The decision, in plain words

Each PRD keeps one watch for every repository it landed in, and each watch still names the PRD's own home and number. The rewind's findings belong to the PRD as a whole.

## The intro, for fun

One PRD, three repositories, one question: who is watching which main?

## The punchline, for fun

Everyone watches their own main, and the PRD still knows they are all family.

## The options, in plain words

A. A. One watch per PRD and lane: the PRD's own repository and number, and the repository it merged into (built).
B. B. One watch per repository merged into and PRD number, as the page drew it: a plan repository's PRD can then share its number with a target's own PRD.
C. C. One watch per PRD, its lanes kept as a list inside the one row.

## What I had to decide

Whether `prd_main_watch` is keyed by the PRD's repository, its number and a `lane` (the repository merged into), as `prd_milestones` is (built), instead of the before/after page's `repository` and `prd` alone. Breaks carry the lane; `rewind_findings` carry the PRD's repository and number, with no lane and no foreign key to a watch. Decided by: Jev (hardToRevert 0.54) · agent said true

## What I did meanwhile

Built as option A in supabase/migrations/20261230090000_main_watch.sql: the key is (workspace_id, repository, prd, lane), and a one-lane PRD has its own repository as its lane. s2, s3 and s4 read and write it so.

## What it costs to change later

Changing the key once rows exist in production is a migration that rewrites them; before the feature PR merges it is an edit of this one migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the page drew `repository` and `prd` only; whether it meant the target repository there is not said, and a plan repository's PRD number would then collide with the target's own PRD of the same number
- (author) a finding has no foreign key to a watch, so the table does not itself refuse a finding for a PRD that has none: that is left to s5's endpoint

```

<!-- /omni-outbox-settled: s1-01-watch-per-lane -->

<!-- omni-outbox-settled: s1-02-watch-tables-beyond-the-page -->

## s1-02-watch-tables-beyond-the-page — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-23T08:17:56Z
- Channel: feature pull request #2414
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2414#issuecomment-6360616792
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-10-22
- Slice: s1
- Wave: 1
- Stays here: what the main watch's tables hold is this PRD's design, kept in its migration; no rule beyond it

### The answer, as it was given

```text
A. A. Keep the additions as built: a break's name and its parent's result, the decisions' log, the database refusing a repeated finding, the caps.
```

### The item, as it was raised

```text
---
id: s1-02-watch-tables-beyond-the-page
prd: 2410
slice: s1
rank: high
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

Should the database hold a little more than the before and after page drew, so the next slices have what they show and the database refuses what must never happen?

## The decision, in plain words

Each break keeps its name and whether the commit before it was green, and each decision on a finding goes into a log of its own. The database itself refuses the same finding twice, oversized findings, and a finding stored as already decided.

## The intro, for fun

The drawing had three boxes; the database grew a fourth while nobody was looking.

## The punchline, for fun

It only keeps receipts, and it never accepts the same receipt twice.

## The options, in plain words

A. A. Keep the additions as built: a break's name and its parent's result, the decisions' log, the database refusing a repeated finding, the caps.
B. B. Only what the page drew: the next slices read a break's name and parent from GitHub, a decision lives on the finding alone, and only the kit refuses a repeated finding.

## What I had to decide

Whether `supabase/migrations/20261230090000_main_watch.sql` keeps its additions to the drawn shape: `prd_main_breaks.title` and `parent` (green, red or unknown, a ci-red only); a fourth table, `rewind_finding_events`, the decision's event the plan asks for; `rewind_findings_once`, a unique index on the check, origin and evidence of a PRD; caps (20 https links of 500 characters, 4000 characters of text, a one-line reason of 500); and the App inserting only a finding's content, never its state. Decided by: Jev (hardToRevert 0.48) · agent said false

## What I did meanwhile

Built as option A and proven by supabase/checks/main_watch.sql; s2 writes the title and parent, s3 shows them, s5 maps a refused repeat to its own refusal.

## What it costs to change later

Each addition is dropped by a follow-up migration; the caps are constants of the migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the caps (20 links, 500 and 4000 characters) are not measured against real rewinds
- (author) the event log holds decisions only, not the proposal itself, whose time is on the finding

```

<!-- /omni-outbox-settled: s1-02-watch-tables-beyond-the-page -->

<!-- omni-outbox-settled: s2-05-main-watch-setting-in-the-rule-proof -->

## s2-05-main-watch-setting-in-the-rule-proof — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-23T08:17:56Z
- Channel: feature pull request #2414
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2414#issuecomment-6360616792
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-23
- Raised: 2026-10-22
- Slice: s2
- Wave: 2
- Stays here: where one setting's test sits; BR-PRODUCT-23's own tests are unchanged, and the testing form already says where tests live

### The answer, as it was given

```text
A. Test the new setting in that file, beside the rule's tests, and add it to the file's list of settings (built).
```

### The item, as it was raised

```text
---
id: s2-05-main-watch-setting-in-the-rule-proof
prd: 2410
slice: s2
rank: high
bears-on: BR-PRODUCT-23
raised: 2026-10-22
wave: 2
---

## The question, in plain words

May the new on and off setting for the watch be tested in the file that proves the rule about the signature's name and email?

## The decision, in plain words

Yes: the new setting is tested in that file, beside the rule's tests, as the last few settings were, and the file's list of every setting now names it. The rule's own tests are unchanged.

## The intro, for fun

The rule's proof keeps a list of every setting, and a new setting cannot hide from a list.

## The punchline, for fun

The rule's own tests did not move; the new neighbour just signed the guest book.

## The options, in plain words

A. Test the new setting in that file, beside the rule's tests, and add it to the file's list of settings (built).
B. Move the new setting's test to a file of its own; the list of settings in the rule's file still has to name it.

## What I had to decide

Whether s2 adds its `mainWatch.enabled` test to `kit/lib/config.test.ts`, which proves BR-PRODUCT-23, beside the retro guards' test (PRD 2338), and adds `mainWatch` to the test that lists every key `parseConfig` returns; BR-PRODUCT-23's own tests are left as they were. Decided by: Jev (hardToRevert 0.70) · agent said true

## What I did meanwhile

Built as option A: one new test and one word in the key list of `kit/lib/config.test.ts`; `omni check coverage` names the file as a law proof.

## What it costs to change later

Moving the new test to a file of its own is a cut and a paste; the key list has to name the setting wherever it lives.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the testing form asks that tests of other behaviour leave a proof's file untouched, while the plan gives this slice `kit/lib/config.test.ts` and the key list there must name every setting

```

<!-- /omni-outbox-settled: s2-05-main-watch-setting-in-the-rule-proof -->

<!-- omni-outbox-settled: s7-05-decision-first-then-the-work -->

## s7-05-decision-first-then-the-work — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-23T08:17:56Z
- Channel: feature pull request #2414
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2414#issuecomment-6360616792
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-12
- Raised: 2026-10-23
- Slice: s7
- Wave: 5
- Stays here: how Approve orders its two steps is this PRD's behaviour, written in its code and tests; no product rule beyond it

### The answer, as it was given

```text
A. Record the decision first, then send; a failed send is said on the card, never retried (built).
```

### The item, as it was raised

```text
---
id: s7-05-decision-first-then-the-work
prd: 2410
slice: s7
rank: high
bears-on: BR-PRODUCT-12
raised: 2026-10-23
wave: 5
---

## The question, in plain words

Approve both records a decision and sends work (a job, a proposal or an issue). Which comes first, and what happens when sending fails?

## The decision, in plain words

The decision is recorded first, so two members clicking at once send the work once. When the work then fails to go, the approval stays, the card says what was not sent and what to run instead, and nothing retries it.

## The intro, for fun

Two members clicked Approve in the same second, and the robot had to pick a winner.

## The punchline, for fun

First click wins the vote; the second one gets a polite already done.

## The options, in plain words

A. Record the decision first, then send; a failed send is said on the card, never retried (built).
B. Send first, then record the decision.
C. Keep whether the work went beside each approval, with a Send again button.

## What I had to decide

Pick A to keep the decision first, B to send first and record after, or C to keep a sent or failed mark beside each approval with a Send again button.

## What I did meanwhile

POST /api/rewind/findings/<id>/approve checks the finding is still proposed, records the decision through rewind_finding_approve, which locks the finding and refuses a second one, and only then queues the job, files the proposal or opens the issue. A follow-up that fails is logged and answered as Approved, but … with the line to run from a terminal or where to do it by hand; the decision is never rewritten (BR-PRODUCT-12).

## What it costs to change later

B risks the same job or issue sent twice when two members click at once. C is a new column on the findings table, a migration, and a retry route.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) What Approve sent is said on the card once, after the click; a reload shows who approved and when, not whether the job or the issue went.
- (author) A follow-up that failed is not recorded anywhere a later reader sees, except the server's log.

```

<!-- /omni-outbox-settled: s7-05-decision-first-then-the-work -->
