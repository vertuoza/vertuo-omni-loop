# Settled outbox items — PRD 3107

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-types-and-ci-step-outside-territory -->

## s1-01-types-and-ci-step-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-types-and-ci-step-outside-territory
prd: 3107
slice: s1
rank: medium
bears-on: none
raised: 2026-11-20
wave: 1
---

## The question, in plain words

The plan gave this slice its new table but not the two files every new table also needs: the generated list of the database's shapes and the line that runs its check on each pull request. Should the slice carry them?

## The decision, in plain words

The slice carries both: the regenerated list of shapes, exactly as the generator writes it, and one more step in the database workflow that runs the new check.

## The intro, for fun

The plan packed the table and forgot its passport and its boarding pass.

## The punchline, for fun

The slice brought both, so customs waves it through.

## The options, in plain words

A. A. As built: the slice carries the regenerated database types and the workflow step for its check.
B. B. The slice carries neither; the wave regenerates the types and adds the step after merging.
C. C. The slice carries the workflow step only; the types wait for the wave.

## What I had to decide

A keeps the database's shapes and its check in step with the table they describe, as ADR-0169 and the conventions form (a new database check runs in CI) already ask; B leaves both to the wave, which then regenerates and adds the step after merging. Sources: vertuo-omni-loop/ADR-0169, conventions form › A new database check runs in CI.

## What I did meanwhile

The sub-PR carries supabase/database.types.ts regenerated from main's migrations plus this slice's, and a new step in .github/workflows/supabase.yml running supabase/checks/commander_messages.sql.

## What it costs to change later

Undoing it is deleting one workflow step and regenerating one file: minutes, no data touched.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The local database was brought up to the branch's migrations with supabase migration up, not restarted fresh: the generated file adds only this slice's table and functions to main's, which the workflow's type check confirms on the feature pull request. (author)

```

<!-- /omni-outbox-settled: s1-01-types-and-ci-step-outside-territory -->

<!-- omni-outbox-settled: s1-02-reply-written-by-the-app-alone -->

## s1-02-reply-written-by-the-app-alone — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-reply-written-by-the-app-alone
prd: 3107
slice: s1
rank: medium
bears-on: none
raised: 2026-11-20
wave: 1
---

## The question, in plain words

The spec says who may read the Commander's thread but not who writes its replies. Should a reply be saved by the app alone, or by the member who asked, under their own sign-in?

## The decision, in plain words

A member's question is saved under their own sign-in, signed with their name; the Commander's reply is saved by the app alone, so no member can ever write words the Commander signs.

## The intro, for fun

Anyone could sign the Commander's name, if the pen were left on the desk.

## The punchline, for fun

The pen now stays in the app's pocket.

## The options, in plain words

A. A. As built: the question under the member's sign-in, the reply by the app alone.
B. B. Both under the member's sign-in, through a function that accepts one reply per question from its asker.

## What I had to decide

A keeps the Commander's signature trustworthy: only the app, after its model call and its link filter, writes a reply, and the database refuses a reply from anyone signed in. B writes the reply under the asker's own sign-in, as the Ask classifier writes its guessed category (BR-PRODUCT-40), which needs no service key but lets a member write a reply by hand. Sources: L-AIACT-1, never#10, vertuo-omni-loop/BR-PRODUCT-40, the missions' events, written by the service role alone.

## What I did meanwhile

Replies are written with the service role key the missions already use; a deployment without it answers that the Commander is not available there.

## What it costs to change later

Switching to B is one database function and one line of the app's wiring; no stored reply changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A reply's links are also held by the database to the app's own pages and GitHub, whoever writes it. (author)

```

<!-- /omni-outbox-settled: s1-02-reply-written-by-the-app-alone -->

<!-- omni-outbox-settled: s1-03-record-reads-waiting-and-ended-missions -->

## s1-03-record-reads-waiting-and-ended-missions — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-record-reads-waiting-and-ended-missions
prd: 3107
slice: s1
rank: medium
bears-on: none
raised: 2026-11-20
wave: 1
---

## The question, in plain words

The spec has the Commander read the last events of each running mission. A mission waiting on a person, paused, or one that ended overnight is not running: should the Commander read its events too?

## The decision, in plain words

It reads the last 50 events of every mission that runs, waits or is paused, and of every mission that ended in the last 24 hours, with the jobs of all of them; the cap on one message's input still holds.

## The intro, for fun

A mission waiting on you is the one you most want to ask about.

## The punchline, for fun

Skipping it because it is not running would be like ignoring the patient in the waiting room.

## The options, in plain words

A. A. As built: missions that run, wait or are paused, and those that ended in the last 24 hours.
B. B. Running missions only, as the spec words it.
C. C. Running, waiting and paused missions, none that ended.

## What I had to decide

A answers what members ask most (what waits on me, what happened overnight, why did it stop), which a waiting, paused or just-ended mission holds; B reads running missions only, as the spec words it, and the Commander then answers that it found nothing about them.

## What I did meanwhile

The record holds every mission that runs, waits or is paused and those that ended in the last 24 hours, at most 50 events each, trimmed first when one message's input would pass 40,000 tokens.

## What it costs to change later

Narrowing it is one line of the rules; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's own example, PRD 2817 waiting on a review, is a mission that waits rather than runs. (author)

```

<!-- /omni-outbox-settled: s1-03-record-reads-waiting-and-ended-missions -->

<!-- omni-outbox-settled: s1-04-tab-words-not-in-the-spec -->

## s1-04-tab-words-not-in-the-spec — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-tab-words-not-in-the-spec
prd: 3107
slice: s1
rank: medium
bears-on: none
raised: 2026-11-20
wave: 1
---

## The question, in plain words

Three small things on the Commander tab the screens do not show: what the status line says when the fleet has no daily token limit, what a suggested question does when clicked, and how a source's own line is shown.

## The decision, in plain words

With no daily limit the status line says no daily token cap; clicking a suggested question asks it at once; and a source shows its record's own line when the pointer rests on it.

## The intro, for fun

Forty-one percent of no limit at all is a hard number to draw.

## The punchline, for fun

So the line just says there is no cap.

## The options, in plain words

A. A. As built: no daily token cap, a suggestion asks at once, the record line on hover.
B. B. The status line hides the tokens when there is no cap, and a suggestion only fills the box.
C. C. As A, with the record line also shown on tap, in a small popover.

## What I had to decide

A keeps each to the smallest change: words for a state the screens do not draw, one click for a first question, and the browser's own hover text; B and C name the other ways a person might prefer.

## What I did meanwhile

The tab shows these three as built; the rail, the Message fleet mode and the Notebooks button come with the later slices.

## What it costs to change later

Each is a line or two of the tab; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Design review: a source's record line shows on hover only, not on a tap on a phone; a tap opens the record itself. (author)
- Design review: the screens were judged from the source and the component renders, as the demo world has no Virtual Fleet and no preview of this slice is deployed. (author)

```

<!-- /omni-outbox-settled: s1-04-tab-words-not-in-the-spec -->

<!-- omni-outbox-settled: s1-05-model-id-allowed-in-agent-words-guard -->

## s1-05-model-id-allowed-in-agent-words-guard — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-05-model-id-allowed-in-agent-words-guard
prd: 3107
slice: s1
rank: medium
bears-on: none
raised: 2026-11-20
wave: 1
---

## The question, in plain words

A test keeps the agent's brand name out of what a person reads, with a short list of places allowed to name it. Should the place that names the Commander's model join that list?

## The decision, in plain words

The Commander's model file joins the list, beside the business-law judge that calls the same model, with its reason: the model it calls, by its id. Nothing a person reads names it.

## The intro, for fun

The model has a name, and the guard at the door checks every name.

## The punchline, for fun

This one is on the guest list, with a note saying why.

## The options, in plain words

A. A. As built: the Commander's model file joins the guard's list, with its reason.
B. B. The Commander reuses the business-law judge's model constant, so no new place names the model.

## What I had to decide

A follows how the classifier, the suggestion and the business-law judge already name their models; B would hide the id from the guard, which only makes the check mean less (never#3).

## What I did meanwhile

The guard's list gains one line, outside the slice's planned territory, for the file that names the Commander's model.

## What it costs to change later

Removing the line is one edit, and the guard then fails until the model is named another way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The model's id is a constant in the code and never reaches a screen. (author)

```

<!-- /omni-outbox-settled: s1-05-model-id-allowed-in-agent-words-guard -->

<!-- omni-outbox-settled: s2-02-tab-count-not-drawn -->

## s2-02-tab-count-not-drawn — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-20
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-tab-count-not-drawn
prd: 3107
slice: s2
rank: medium
bears-on: none
raised: 2026-11-20
wave: 2
---

## The question, in plain words

The spec says the Commander tab's name carries the count of questions waiting on a person, but the tabs live in a part of the app this slice may not change. Who draws that count?

## The decision, in plain words

This slice shows the count at the top of the rail, as Waiting on you followed by the number, and leaves the tab's name as it is, so a later slice or the wave adds the count to the tab.

## The intro, for fun

The rail knows the number, but the tab is in another room.

## The punchline, for fun

The number waits by the door until someone with the key comes along.

## The options, in plain words

A. A. As built: the count shows in the rail's heading only, for now.
B. B. The wave adds the count to the tab's name after merging, reading the rail's cards with the fleet page.
C. C. Leave the count out of the tab for good: the rail's heading is enough.

## What I had to decide

Whether the wave adds the count to the tab's name, or a later slice does.

## What I did meanwhile

The rail's heading says how many questions wait, so a member who opens the tab sees the count at once.

## What it costs to change later

Small: the fleet page reads the open count with the tab and adds it to the label; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Reading the count on the Fleet page means one more read on every Virtual Fleet's page load, not only on the Commander tab (author)

```

<!-- /omni-outbox-settled: s2-02-tab-count-not-drawn -->

<!-- omni-outbox-settled: s2-03-answered-cards-stay-a-day -->

## s2-03-answered-cards-stay-a-day — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-20
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-answered-cards-stay-a-day
prd: 3107
slice: s2
rank: medium
bears-on: none
raised: 2026-11-20
wave: 2
---

## The question, in plain words

Once a question is answered, how long does its card stay in the rail reading who answered it? And should Confirm be the screen's main button, as the drawing shows?

## The decision, in plain words

An answered card stays one day, then leaves the rail. Confirm is drawn as an ordinary button, since the Ask button already is the screen's one main button.

## The intro, for fun

An answered question likes to linger a little, to say who answered it.

## The punchline, for fun

One day is long enough to be seen and short enough not to crowd the rail.

## The options, in plain words

A. A. As built: answered cards stay one day; Confirm is an ordinary button.
B. B. Answered cards stay until the member leaves the tab, and Confirm is the main button while it shows.
C. C. Answered cards stay a week; Confirm is an ordinary button.

## What I had to decide

Whether one day is the right stay for an answered card, and whether Confirm may be a main button beside Ask.

## What I did meanwhile

A member who comes back within a day sees who answered what; the design rule of one main button per screen holds.

## What it costs to change later

Each is a single constant or a single attribute to change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The screen library's drawing marks Confirm as the main button while Ask is one too; the design system says one main button per screen (author)

```

<!-- /omni-outbox-settled: s2-03-answered-cards-stay-a-day -->

<!-- omni-outbox-settled: s3-01-runner-hands-messages-to-the-session -->

## s3-01-runner-hands-messages-to-the-session — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-20
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-runner-hands-messages-to-the-session
prd: 3107
slice: s3
rank: medium
bears-on: none
raised: 2026-11-20
wave: 3
---

## The question, in plain words

A job's claim now carries the fleet's messages, but the runner program that starts each job lies outside this slice. Who should hand the messages to the job's session?

## The decision, in plain words

The session prints the messages from a small file in the job's workspace folder, and the runner will write that file once a later change lets it read the new field of the claim.

## The intro, for fun

The post office now sorts the letters, but nobody has told the courier to carry them.

## The punchline, for fun

Until the courier is briefed, the letters wait in the tray.

## The options, in plain words

A. A. The runner writes a file in the job's worktree, which omni session start reads (as built on the reading side).
B. B. The runner sets an environment variable with the messages, which needs a new entry in the kit's environment module.
C. C. omni session start fetches the messages from the app itself, with the job's id.

## What I had to decide

Add the claim's messages to the runner's job reading (kit/lib/runner/api.ts) and have the runner write them to .omni-loop/local/from-your-people.json in the job's worktree before the agent starts (kit/lib/runner/runner.ts).

## What I did meanwhile

The app side is done and tested: the claim carries the messages, they are marked read, and omni session start prints them from the file. Until the runner writes the file, a job prints no block and the message keeps reading as read by that job.

## What it costs to change later

Small: one field in the runner's job schema and one file write per job, with a test; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for this slice holds kit/bin/commands/session.ts but not kit/lib/runner/, so the runner side could not be built here

```

<!-- /omni-outbox-settled: s3-01-runner-hands-messages-to-the-session -->

<!-- omni-outbox-settled: s3-02-message-box-needs-no-model -->

## s3-02-message-box-needs-no-model — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-20
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-message-box-needs-no-model
prd: 3107
slice: s3
rank: medium
bears-on: none
raised: 2026-11-20
wave: 3
---

## The question, in plain words

Messaging the fleet needs no model, yet the screen draws no box when the Commander is off and a notice in its place when tokens are used up. Should a member still be able to message the fleet then?

## The decision, in plain words

The box stays as the screen draws it: off or out of tokens, there is no box, so no message can be sent from the tab then.

## The intro, for fun

The mail slot sits behind the same door as the oracle.

## The punchline, for fun

When the oracle sleeps, the door is shut for the postman too.

## The options, in plain words

A. A. As built: no box when the Commander is off or out of tokens.
B. B. Keep the box in those states with Message fleet alone, since it needs no model.
C. C. Keep the whole box and let Ask say why it cannot answer.

## What I had to decide

Keep the box hidden in the off and tokens-used-up states, as the drawn screens 2.C and 2.D show; the send route itself works in those states.

## What I did meanwhile

A member can still message through the route, and the Commander being off blocks only the tab's box.

## What it costs to change later

Small: show the Message fleet mode alone in those two states, one component and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The screen library draws the notice in place of the box and says nothing of Message fleet there

```

<!-- /omni-outbox-settled: s3-02-message-box-needs-no-model -->

<!-- omni-outbox-settled: s4-01-notebook-job-wired-outside-territory -->

## s4-01-notebook-job-wired-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-20
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-notebook-job-wired-outside-territory
prd: 3107
slice: s4
rank: medium
bears-on: none
raised: 2026-11-20
wave: 4
---

## The question, in plain words

The notebook job has to run on its own every day, but the place where background jobs are listed was not part of this piece of work. Should it be switched on here?

## The decision, in plain words

I switched it on: the daily job is listed with the others, and the database checks for the notebooks and for the fleet messages now run on every pull request.

## The intro, for fun

A job that nobody schedules is a very well written diary nobody opens.

## The punchline, for fun

So the diary got a daily alarm clock, and the checks got a seat on the bus.

## The options, in plain words

A. Switch it on here: the schedule line, the worker line and both database checks in CI, as built.
B. Leave the job built but off, and switch it on in a follow-up change.
C. Switch the job on, but leave the s3 check out of CI and add it in its own change.

## What I had to decide

Added the commander-notebook kind to the App's schedules (daily, 3 tries) and its handler to the worker in apps/omni-app/src/jobs/, with the schedule test updated; added two steps to the supabase workflow, commander_notes.sql and commander_messaged.sql (the s3 check was in no step, so CI never ran it).

## What I did meanwhile

The job is built and tested as its own module; the wiring is three lines and the workflow two steps.

## What it costs to change later

Low: removing the schedule line and the handler line turns the job off; the workflow steps are independent.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory names apps/omni-app/src/missions/notebook only; the schedule and the worker live in apps/omni-app/src/jobs/, and the workflow in .github/workflows/

```

<!-- /omni-outbox-settled: s4-01-notebook-job-wired-outside-territory -->

<!-- omni-outbox-settled: s4-02-undo-holds-the-delete -->

## s4-02-undo-holds-the-delete — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-20
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-undo-holds-the-delete
prd: 3107
slice: s4
rank: medium
bears-on: none
raised: 2026-11-20
wave: 4
---

## The question, in plain words

When a member deletes a notebook line, they can undo it for 5 seconds. Should the line be deleted at once and brought back on undo, or only deleted once the 5 seconds have passed?

## The decision, in plain words

The page waits 5 seconds before it deletes the line; undo simply cancels the wait. A line, once deleted, is never brought back, so the record of who deleted it is never erased.

## The intro, for fun

Every eraser comes with five seconds of second thoughts.

## The punchline, for fun

After that, the ink is gone and the name of the eraser stays.

## The options, in plain words

A. Hold the deletion 5 seconds on the page, then send it; the database never restores a line.
B. Delete at once, and let undo restore the line within 5 seconds, erasing the deletion record.
C. Delete at once, and let undo add a new restore record beside the deletion.

## What I had to decide

The drawer shows Deleted by <login> · <time> with Undo for 5 seconds, then calls commander_note_delete(); leaving the tab sends what waits at once. The database has no restore: a deletion is recorded once, never undone.

## What I did meanwhile

Deletion is one database call; undo is a timer on the page.

## What it costs to change later

Low: a restore function and an undo call can be added later without changing the stored lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says Delete with Undo for 5 seconds and that the deletion is recorded with who and when; it does not say whether undo restores a recorded deletion
- (author) A browser closed within the 5 seconds may not send the deletion

```

<!-- /omni-outbox-settled: s4-02-undo-holds-the-delete -->

<!-- omni-outbox-settled: s4-03-notebook-job-daily-and-strict -->

## s4-03-notebook-job-daily-and-strict — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-20
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-notebook-job-daily-and-strict
prd: 3107
slice: s4
rank: medium
bears-on: none
raised: 2026-11-20
wave: 4
---

## The question, in plain words

How often should the notebook job write, which model should it use, and how strict should it be about lines that sound like orders?

## The decision, in plain words

It runs once a day, writing each running mission's lines for the day before and the fleet lines of a mission that ended in the last three days, with the same model as the Commander. Any line with words like should or must, or speaking to someone, is dropped, even when it might have been a useful lesson.

## The intro, for fun

The fleet keeps a diary, but only writes in it after the day is done.

## The punchline, for fun

And it writes like a witness, never like a boss.

## The options, in plain words

A. Daily, the previous day's lines, fleet lines within 3 days, strict screen, tokens not counted, as built.
B. Hourly, so fleet lines arrive within the hour of a mission's end.
C. As built, and count the notebook's model calls against the fleet's daily tokens.

## What I had to decide

Daily schedule at midnight UTC for the previous UTC day; fleet lines for missions delivered or stopped in the last 3 days; at most 5 lines a batch and 6 batches a run, then it carries on a minute later; model anthropic/claude-sonnet-5.5 through the App's OPENROUTER_API_KEY; a fleet over its daily tokens is skipped, but the notebook's own model calls are not counted against those tokens; the instruction screen drops any line with an obligation word, an imperative first word, a second person, or saying all is well.

## What I did meanwhile

Every rule is a constant in apps/omni-app/src/missions/notebook.ts or notebook-run.ts.

## What it costs to change later

Low: each is a constant or a schedule line; counting the notebook's tokens would need a column.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says at most once a day per running mission and when a mission is delivered or stopped, without a time of day or a delay
- (author) The spec does not say whether the notebook's model calls spend the fleet's daily tokens

```

<!-- /omni-outbox-settled: s4-03-notebook-job-daily-and-strict -->

<!-- omni-outbox-settled: s5-01-eval-checks-and-typecheck-wiring -->

## s5-01-eval-checks-and-typecheck-wiring — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-20
- Slice: s5
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-eval-checks-and-typecheck-wiring
prd: 3107
slice: s5
rank: medium
bears-on: none
raised: 2026-11-20
wave: 5
---

## The question, in plain words

How should the Commander's evals check that a claim is backed by its record, and where should the eval script be type-checked?

## The decision, in plain words

A claim counts as backed when its numbers and half its words appear in the record it cites, and a sample is printed for a person to check. The script is checked for errors with the arcade project instead of the root one.

## The intro, for fun

The oracle's homework needs marking, and the marker is a small robot with a word list.

## The punchline, for fun

A person still spot-checks the ten answers it printed.

## The options, in plain words

A. A. As built: a word-and-number overlap check, the script type-checked with the arcade's project.
B. B. Ask the model itself to grade each claim, which spends more tokens and trusts the model to mark its own work.
C. C. Leave support to the person's sample alone, with no automatic rate.

## What I had to decide

Claims supported is a word-overlap proxy, not a judgement of meaning, because the spec asks for a sample checked by a person on top of the 95% bar. The script imports the arcade's extensionless sources, so the root typecheck cannot follow them: its folder is excluded from tsconfig.json, gets its own tsconfig that extends the arcade's, and is included in apps/galaxy/tsconfig.json, two config files outside the slice's territory. The command bundles the script with esbuild before running it, for the same reason.

## What I did meanwhile

Nothing is lost: the evals, their fake-model tests and the typecheck all run, the real model is never called here, and each check is one function that can be tightened later.

## What it costs to change later

Low: a stricter support check is one function in the script, and the two config lines move back with it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say how a claim's support is judged by a program, only that a person checks a sample.

```

<!-- /omni-outbox-settled: s5-01-eval-checks-and-typecheck-wiring -->
