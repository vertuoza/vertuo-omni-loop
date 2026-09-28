# Settled outbox items — PRD 384

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-version-picker-keeps-every-tab -->

## s1-01-version-picker-keeps-every-tab — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-version-picker-keeps-every-tab
prd: 384
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Once the PRD page opens on Questions, picking an older version of the before-and-after page sent the reader to Questions instead. Should the version choice always remember which tab it came from?

## The decision, in plain words

Yes: picking a version now always keeps the tab you were on, the before-and-after tab included, so the address gains a tab mention it did not carry before.

## The intro, for fun

The page grew a new front door, and the old side door started leading to the wrong room.

## The punchline, for fun

So now every door says which room it opens.

## The options, in plain words

A. Always carry the tab: what was built; the picker names its tab every time, so it can never land on the wrong one.
B. Carry it except on the default tab: a cleaner address, but the picker would need to know the page's default, which now depends on whether a question was asked.
C. Leave the picker as it was: no change outside the slice, but picking a version of the before-and-after page on a PRD with questions lands on Questions.

## What I had to decide

Whether the version picker, which sits outside this slice's declared files, may carry the tab on every tab.

## What I did meanwhile

The picker always names its tab; a version picked on the before-and-after tab stays there.

## What it costs to change later

One line in the version picker; undoing it is putting the old condition back.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The version picker file is not in slice s1's declared territory; no sibling slice declares it either (author).

```

<!-- /omni-outbox-settled: s1-01-version-picker-keeps-every-tab -->

<!-- omni-outbox-settled: s5-01-moved-round-refresh -->

## s5-01-moved-round-refresh — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s5
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-moved-round-refresh
prd: 384
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When a question moves to the terminal without an answer, should the open PRD page notice that change on its own?

## The decision, in plain words

The page watches only what the spec named: how many questions, how many answered, and the latest version of each document. A question moving to the terminal changes none of these, so the page shows it on the next other change or reload.

## The intro, for fun

A question slipped out the back door to the terminal, and nobody rang the bell.

## The punchline, for fun

The page will spot it the next time anything else happens, or on a reload.

## The options, in plain words

A. Watch only the three counts the spec named: questions asked, questions answered and the latest version of each document, with no database change. This is what is built.
B. Also count the questions moved to the terminal, which needs a small database change, so a move shows on an open page within two seconds.

## What I had to decide

Whether the change check should also count questions moved to the terminal.

## What I did meanwhile

A question that moves to the terminal still reads as open on a page left open, until the next question, answer, version or reload.

## What it costs to change later

Counting moved questions means adding one count to the database's list function, which is a migration; the page side is one field in the signature.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether people leave a PRD page open long enough, while questions time out, for a stale open question to matter (author)

```

<!-- /omni-outbox-settled: s5-01-moved-round-refresh -->

<!-- omni-outbox-settled: s2-01-answered-question-drops-repeat-lines -->

## s2-01-answered-question-drops-repeat-lines — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-answered-question-drops-repeat-lines
prd: 384
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Once a question shows only the option that was picked, should it still repeat the pick in a separate answer line, tag it as chosen, and say no answer under an open question?

## The decision, in plain words

No. The picked option itself is the answer, so the separate answer line only appears for a written answer that matches no option, the chosen tag is gone, and open or moved questions rely on the line saying who answered or what happened.

## The intro, for fun

A question that already shows its answer does not need to say it twice.

## The punchline, for fun

One answer, told once, reads faster than the same answer in three places.

## The options, in plain words

A. Show the chosen options only; an answer line only for text that matches no option; no chosen tag
B. Keep the old answer line under every answered question, as before
C. Keep the chosen tag on each shown option as well

## What I had to decide

Whether the Questions tab still repeats the answer beside the chosen option, and still tags it as chosen.

## What I did meanwhile

An answered question shows the chosen option cards and a written answer only when it matches no option; open questions show their options with no extra answer line.

## What it costs to change later

Putting the answer line or the chosen tag back is a few lines in the Questions pane and its test; no data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec lists what an answered question shows but does not say whether the old answer line and chosen tag stay (author)

```

<!-- /omni-outbox-settled: s2-01-answered-question-drops-repeat-lines -->

<!-- omni-outbox-settled: s3-01-no-anchor-on-the-list-yet -->

## s3-01-no-anchor-on-the-list-yet — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-no-anchor-on-the-list-yet
prd: 384
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

After answering, the person is sent to the PRD's questions with a marker naming the next open question, but the list gives its questions no marker to jump to yet. Should this slice add those markers?

## The decision, in plain words

Not in this slice: the way back already names the next open question, and the list that must carry the markers is left to the later slice that owns it, so for now the person lands at the top of the questions.

## The intro, for fun

The return ticket names a seat, but the seats have no numbers painted on them yet.

## The punchline, for fun

The next crew brings the paint.

## The options, in plain words

A. Leave the list to s4: what was built; the marker in the way back starts working the day the list carries it.
B. Add the markers now, outside this slice's files: the landing works at once, but s4 would meet a change it did not plan for.
C. Drop the marker from the way back: nothing half-done, but the spec asks for it.

## What I had to decide

Whether the list of questions, which this slice may not change, should carry a marker on each question now, so the way back lands on the next open one.

## What I did meanwhile

The way back ends with the next open question's marker; the list is unchanged, so the browser shows the top of the questions until a marker exists.

## What it costs to change later

One attribute on each question of the list; the later slice that owns the list can add it with no other change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The list of questions is not in this slice's declared files; slice s4 owns it in the next wave (author).

```

<!-- /omni-outbox-settled: s3-01-no-anchor-on-the-list-yet -->

<!-- omni-outbox-settled: s3-02-render-test-follows-the-new-link -->

## s3-02-render-test-follows-the-new-link — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-render-test-follows-the-new-link
prd: 384
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The link to each question now says which PRD it was opened from, and one page test outside this slice's listed files still expected the old link. May this slice update that one expectation?

## The decision, in plain words

Yes: one line of that page test now expects the new link, since the plan's shared-files note lists it for this slice even though the slice table leaves it out.

## The intro, for fun

The sign on the door changed, and one inspector still had the old sign in the checklist.

## The punchline, for fun

The checklist got a one-word update.

## The options, in plain words

A. Update the one expected link: what was built; the test keeps checking the link, now in its new form.
B. Leave the test red for another slice to fix: no file outside the table touched, but the whole run stays red.

## What I had to decide

Whether a page test the slice table does not list for this slice, but its shared-files note does, may change to follow the new link.

## What I did meanwhile

That test now expects the link carrying the PRD it came from; nothing else in it changed.

## What it costs to change later

One line; undoing it is putting the old expected link back.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's slice table and its shared-files note disagree on whether this page test belongs to s3 (author).

```

<!-- /omni-outbox-settled: s3-02-render-test-follows-the-new-link -->

<!-- omni-outbox-settled: s4-01-page-frame-hands-the-database-to-the-list -->

## s4-01-page-frame-hands-the-database-to-the-list — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-page-frame-hands-the-database-to-the-list
prd: 384
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 4
---

## The question, in plain words

The one-click buttons need to know where to send the answer, and the page frame that holds the question list is not among this slice's files. May this slice pass that along through the frame?

## The decision, in plain words

Yes: the page frame now hands the list the same connection it already gives the delete button, one added line, and nothing else in it changed.

## The intro, for fun

The buttons were ready to talk, but the phone line ran through a room they had no key to.

## The punchline, for fun

One extension cord later, the call goes through.

## The options, in plain words

A. A. Pass the connection through the page frame: what was built; one line, the list answers through the same connection as the delete button.
B. B. Carry the connection inside the page's computed view instead: no change to the frame, but settings would mix into what is meant to be plain page data.
C. C. Show no buttons until a later slice owns the frame: nothing outside the slice changes, but the one-click answer would not work.

## What I had to decide

Whether the page frame, which no slice of this wave declares for this work, may pass the database connection down to the question list.

## What I did meanwhile

The page frame passes its existing connection to the question list; with no database, as in the demo, the list shows no buttons.

## What it costs to change later

One line in the page frame; undoing it is removing the pass-through and finding another way to reach the list.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names the question list and the one-click piece for this slice, but not the page frame between them, which slice s5 declared in wave 1.

```

<!-- /omni-outbox-settled: s4-01-page-frame-hands-the-database-to-the-list -->

<!-- omni-outbox-settled: s4-02-buttons-off-without-script -->

## s4-02-buttons-off-without-script — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-buttons-off-without-script
prd: 384
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 4
---

## The question, in plain words

With scripts turned off, should a quick question still show its one-click buttons, even though a click cannot send anything?

## The decision, in plain words

The buttons still show but stay greyed out until the page's script is running; without a script, the link to the question's own page is the way to answer.

## The intro, for fun

A doorbell that is not wired yet still looks like a doorbell.

## The punchline, for fun

So it stays greyed out until the wiring arrives, and the side door is right there.

## The options, in plain words

A. A. Show the buttons greyed out until the script runs: what was built; the page does not jump when the buttons switch on.
B. B. Hide the buttons until the script runs, and show the plain option list instead: nothing on screen that cannot be clicked, but the round changes shape once loaded.

## What I had to decide

How a quick question looks before, or without, the page's script: the buttons hidden, shown but off, or shown and dead.

## What I did meanwhile

The buttons render greyed out on the server and switch on once the script runs; the link to the question's own page is always there.

## What it costs to change later

One condition in the one-click piece; hiding them instead is a small change to that piece and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a quick question with no script shows its link, but not whether the buttons should be hidden or shown greyed out.

```

<!-- /omni-outbox-settled: s4-02-buttons-off-without-script -->

<!-- omni-outbox-settled: s4-03-list-ignores-ask-mode-switched-off -->

## s4-03-list-ignores-ask-mode-switched-off — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-list-ignores-ask-mode-switched-off
prd: 384
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 4
---

## The question, in plain words

If ask mode is switched off while a quick question is still waiting, should the list keep offering the one-click buttons until the question's time is up?

## The decision, in plain words

Yes for now: the list reads only whether the question is open and has time left, so buttons stay until it moves to the terminal, while the question's own page already says the session is closed.

## The intro, for fun

The shop put the closed sign up, but the side window still takes orders for a few minutes.

## The punchline, for fun

Nobody is at the counter to read them, though.

## The options, in plain words

A. A. Offer buttons on open questions with time left, as built: no extra read, a rare answer may land in a closed session.
B. B. Also read each question's session on the server and hide buttons once it is closed: one more read per page view.
C. C. Add the session's state to the database's question list: exact, but a migration, which this PRD rules out.

## What I had to decide

Whether the list must also know whether the question's session was switched off, which the list's data does not carry today.

## What I did meanwhile

A quick question of a session switched off keeps its buttons until its time is up; an answer sent then is recorded but nobody in the terminal reads it.

## What it costs to change later

Knowing it means the list reading each session's state, one more small read on the server, or one more column from the database's question list, which is a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How often ask mode is switched off while a question still waits on a page someone has open (author).

```

<!-- /omni-outbox-settled: s4-03-list-ignores-ask-mode-switched-off -->
