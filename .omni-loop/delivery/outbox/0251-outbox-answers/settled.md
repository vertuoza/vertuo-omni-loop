# Settled outbox items — PRD 251

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s7-01-terminal-post-takes-objections -->

## s7-01-terminal-post-takes-objections — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s7
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-terminal-post-takes-objections
prd: 251
slice: s7
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When someone answers in the terminal, may their reply also object to a decision that was already adopted?

## The decision, in plain words

Yes. The terminal only asks the blocking questions, but the reply it posts may also carry an objection to an adopted decision, exactly as a reply typed on the pull request can.

## The intro, for fun

The terminal asks only the urgent questions, but it still listens when you have more to say.

## The punchline, for fun

Nobody is asked about the settled ones, and nobody is stopped from reopening them.

## The options, in plain words

A. Accept an objection to an adopted decision in the terminal's reply, as the pull request does.
B. Refuse any number the terminal did not ask, so its reply answers only the blocking questions.

## What I had to decide

The spec says the terminal never asks the adopted, medium questions. It does not say whether the posting command must refuse an answer to one when the answers file carries it.

## What I did meanwhile

The posting command accepts every number the pull request comment lists that is still open or adopted, the same set the reply reader answers. The asking command still lists only the open human-action and high questions.

## What it costs to change later

One filter in the posting command: dropping the adopted questions from the set it accepts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The PRD and the spec do not settle this: whether a person at the terminal would ever want to object there, rather than on the page or the pull request.

```

<!-- /omni-outbox-settled: s7-01-terminal-post-takes-objections -->

<!-- omni-outbox-settled: s7-02-help-lists-answers -->

## s7-02-help-lists-answers — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s7
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-02-help-lists-answers
prd: 251
slice: s7
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

The new answering command must appear in the kit's built-in help, but the plan did not give this slice the help file. Should the slice add it anyway?

## The decision, in plain words

Yes. The help lists every command, and its own test fails when one is missing, so the slice added one short entry for the answering command and raised the count by one.

## The intro, for fun

A new command walked in, and the help desk refused to open until it signed the guest book.

## The punchline, for fun

One line in the guest book, and everybody is back to work.

## The options, in plain words

A. Add the help entry in this slice, listed as run by the skills.
B. Add the help entry in this slice, listed as a command a person types.
C. Leave the help to a later slice and keep this one inside its territory, with the suite red until then.

## What I had to decide

The slice's territory names the command table but not the help table, which a test holds to the command table entry for entry. Adding the command without the entry leaves the suite red.

## What I did meanwhile

Added one entry for the answering command to the help table (who runs it: the skills; its two verbs, a summary and a few sentences), and raised the command count its test expects from 29 to 30.

## What it costs to change later

Rewording one help entry, or moving it: a text change, nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the answering command should show under the commands you type yourself rather than under those the skills run: the spec only has /omni:yolo run it.

```

<!-- /omni-outbox-settled: s7-02-help-lists-answers -->

<!-- omni-outbox-settled: s9-01-signed-out-sees-sign-in -->

## s9-01-signed-out-sees-sign-in — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s9
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-01-signed-out-sees-sign-in
prd: 251
slice: s9
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Should a visitor who is not signed in, or who is not in the team, see the questions on the page, read-only, as the spec's table says?

## The decision, in plain words

For now such a visitor still sees the sign-in card, or a not-found page, exactly as today. The tab itself knows how to show the questions read-only with a line asking to sign in with GitHub, so opening the page to them later is a small change.

## The intro, for fun

The door has a window now, but the curtain is still drawn.

## The punchline, for fun

Anyone can peek once someone opens the curtain.

## The options, in plain words

A. Keep the route as it is: only members see the tab; the read-only state waits until someone opens the route.
B. Let signed-out visitors see the Outbox tab read-only, through the route, and keep non-members out.
C. Let anyone with the link see the questions read-only, members and non-members alike, with the rest of the dossier hidden.

## What I had to decide

The spec's table lists a state for a signed-out visitor or a non-member: the questions, read-only, with Sign in with GitHub to answer here. The page's route decides who sees a dossier at all: signed out it shows the sign-in card, and row-level security answers not found to anyone outside the workspace. The route is outside this slice's territory, and showing a dossier to a non-member means reading it past row-level security.

## What I did meanwhile

Built the read-only state into the tab (a viewer with no session gets the questions read-only, no toolbar, and the sign-in line), tested it, and left the route unchanged, so today nobody outside the workspace reaches it.

## What it costs to change later

A constant, then a route change: letting signed-out visitors through is a few lines in the route; letting non-members read a dossier needs a server read that bypasses row-level security for the outbox part only, and a decision on what else they may see.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the spec meant non-members to read a dossier at all: the rest of the page is workspace-only by design (PRD 216).
- (author) Whether the read-only view should show the brainstorm and the spec beside it, which are workspace-only today.

```

<!-- /omni-outbox-settled: s9-01-signed-out-sees-sign-in -->

<!-- omni-outbox-settled: s9-02-uncounted-answers-shown -->

## s9-02-uncounted-answers-shown — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s9
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-02-uncounted-answers-shown
prd: 251
slice: s9
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When someone GitHub does not list as a member of the repository answers a question, should the Outbox tab show that answer?

## The decision, in plain words

It shows it, marked as an answer the fix-up run will not read, unless a member answered the same question: then the member's answer is the one shown, even if the other came later.

## The intro, for fun

A stranger shouted an answer from the back of the room.

## The punchline, for fun

We wrote it down, in pencil.

## The options, in plain words

A. Show the member's answer when there is one, else the outsider's, marked as not read by the fix-up run.
B. Show only the answers the kit would read, and nothing from outsiders.
C. Show the latest answer whoever wrote it, marked when it will not be read, even over a member's earlier one.

## What I had to decide

The spec asks for each pending answer and whether its author counts, and says the latest reply per number wins. The kit's reply reader only reads replies from owners, members and collaborators, so an answer from anyone else never settles anything. The spec does not say which answer the tab shows when a counted one and a later uncounted one answer the same number.

## What I did meanwhile

The reader runs the kit's reply reader twice, once as the kit does and once as if every author counted. A number the kit would settle shows the kit's answer; a number only an uncounted author answered shows that answer, marked as one the fix-up run will not read.

## What it costs to change later

A constant: which of the two readings wins is one line in the reader; hiding uncounted answers altogether is dropping the second reading.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether showing an outsider's answer on the page could mislead a person into thinking the question is settled.

```

<!-- /omni-outbox-settled: s9-02-uncounted-answers-shown -->

<!-- omni-outbox-settled: s8-01-door-inside-release-step -->

## s8-01-door-inside-release-step — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s8
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-01-door-inside-release-step
prd: 251
slice: s8
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Where in the build's closing steps should the offer to answer the questions in the terminal sit, now that the last step is the hand-off another skill points to by number?

## The decision, in plain words

The offer sits at the end of the release step, so every step keeps its number and the fix-up skill's pointer to the hand-off stays right.

## The intro, for fun

Every step wanted to keep its house number, so the new guest moved into the back room.

## The punchline, for fun

Nobody had to reprint the street map.

## The options, in plain words

A. The door is the last part of step 6; every step keeps its number.
B. The door becomes step 7 and the hand-off step 8, with the yolo-fix skill's pointer and the tests renumbered in a follow-up.

## What I had to decide

The first build made the terminal door its own step 7 and pushed the report to step 8. Today the yolo's step 7 is a long hand-off that the yolo-fix skill names as `/omni:yolo` §7, and plugin tests pin it as step 7. Renumbering would need an edit to the yolo-fix skill, outside this slice's ground.

## What I did meanwhile

The door is a `### Answer here, when the gate ends red` part at the end of step 6 (Release), after the final status comment; the hand-off stays step 7, and the test pins the part inside step 6 and before step 7.

## What it costs to change later

A constant: moving the part to a step of its own is a heading change in the yolo skill, one line in the yolo-fix skill's pointer, and the test's heading.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person prefers the door as its own numbered step for readability (author).

```

<!-- /omni-outbox-settled: s8-01-door-inside-release-step -->

<!-- omni-outbox-settled: s10-01-list-counts-every-listed-prd -->

## s10-01-list-counts-every-listed-prd — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s10
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s10-01-list-counts-every-listed-prd
prd: 251
slice: s10
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

To show how many questions wait on each plan in the list of plans, how much should the list read from GitHub each time someone opens it?

## The decision, in plain words

The list asks GitHub about every numbered plan it is about to show, all at once, reusing what was read in the last minute. A plan GitHub could not answer for shows no count, and is left out when someone asks for the plans that need an answer.

## The intro, for fun

Counting everyone's homework before class starts takes a moment.

## The punchline, for fun

The teacher remembers the answers for a minute, which helps.

## The options, in plain words

A. Read every numbered plan the other filters let through, all at once, and treat a plan that could not be read as having nothing waiting.
B. Read at most the first twenty plans shown, and mark the rest as not counted.
C. Read the plans a few at a time, so a long list never sends many GitHub reads at once.
D. Show an unknown mark on a plan that could not be read, and keep it under Needs an answer.

## What I had to decide

The spec says the count comes from the same cached reader, and that a row not read in the last minute is read when the list is. It does not say how many rows to read, nor what Needs an answer does with a row that could not be read.

## What I did meanwhile

Only the numbered dossiers that pass the other filters (Mine or All, repository, draft or PRD, the search) are read, in parallel, through the one reader and its 60-second cache. A dossier whose summary or outbox could not be read gets no badge and is not kept by Needs an answer.

## What it costs to change later

One function in the history module: a cap on how many rows are read, a concurrency limit, or an unknown mark instead of nothing. No stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How many numbered dossiers a workspace lists in practice, and so how many GitHub reads a cold list costs against the App's rate limit.

```

<!-- /omni-outbox-settled: s10-01-list-counts-every-listed-prd -->

<!-- omni-outbox-settled: s10-02-list-badge-reuses-chip-look -->

## s10-02-list-badge-reuses-chip-look — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s10
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s10-02-list-badge-reuses-chip-look
prd: 251
slice: s10
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

How should the count of waiting questions and the Needs an answer choice look in the list of plans?

## The decision, in plain words

The count looks like the other small labels on a row and reads Outbox 2 open, the same words as the tab on the plan's page. Needs an answer is a plain tick box among the other filters, with no new styling.

## The intro, for fun

A new label walked into the list and borrowed a neighbour's jacket.

## The punchline, for fun

It fits well enough, though nobody tailored it.

## The options, in plain words

A. Reuse the existing chip look for the count, and a plain tick box for the filter.
B. Give the count its own accent colour so waiting questions stand out, and style the tick box like the Mine and All switch.
C. Make Needs an answer a third switch beside Mine and All instead of a tick box.

## What I had to decide

The spec asks for n open on each row and a Needs an answer filter, but gives no look. The page's stylesheet belongs to another slice, so this slice adds no style to it.

## What I did meanwhile

The count reuses the existing artifact chip look, reading Outbox then 2 open, placed after the artifact chips. The filter is a checkbox inside the same field layout as the other picks, under a hint reading Outbox.

## What it costs to change later

A few lines of markup and a small stylesheet change, in a later slice or a follow-up. Nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the count should stand out more than the artifact chips, for instance in the accent colour, so waiting questions catch the eye.

```

<!-- /omni-outbox-settled: s10-02-list-badge-reuses-chip-look -->

<!-- omni-outbox-settled: s10-03-page-line-needs-repo-name -->

## s10-03-page-line-needs-repo-name — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s10
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s10-03-page-line-needs-repo-name
prd: 251
slice: s10
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

When a repository's settings do not name the repository itself, should the question list on the pull request still point at the Omni page?

## The decision, in plain words

No: without the repository's name the short link cannot be written, so the list leaves the line out and people answer on the pull request as before.

## The intro, for fun

A link needs an address, and this one was missing a street name.

## The punchline, for fun

No address, no signpost; the old road still works.

## The options, in plain words

A. Leave the line out when the settings do not name the repository.
B. Have the GitHub helper pass the repository's name it already knows, so the line is always there.
C. Point at the plans list instead of the plan when the name is missing.

## What I had to decide

The spec says the list points at the Omni page when the answers switch is on and the page address is set. The short link also needs the repository's owner and name, which a repository's settings may leave out.

## What I did meanwhile

The line is written only when the switch is on, the page address is set, the settings name the repository and the plan's number is known; otherwise the comment reads exactly as before. Carried over from the first build, where the same decision was adopted.

## What it costs to change later

One condition in the kit's comment writer, and a rebuilt bundle. The helper could read the name from the pull request instead, which it knows.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How many installed repositories leave their own name out of their settings.

```

<!-- /omni-outbox-settled: s10-03-page-line-needs-repo-name -->

<!-- omni-outbox-settled: s11-01-send-wiring-crosses-two-tab-files -->

## s11-01-send-wiring-crosses-two-tab-files — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s11
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s11-01-send-wiring-crosses-two-tab-files
prd: 251
slice: s11
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

To make Send work, this slice had to touch two small pieces owned by the slice that built the Outbox tab. Is that acceptable?

## The decision, in plain words

Yes. The page's reader gained a way to forget what it remembers about one PRD, so a sent answer shows at once, and the tab's disabled Send button was swapped for the working one, with nothing else changed.

## The intro, for fun

The Send button lived in a room this slice had no key to.

## The punchline, for fun

It knocked, stepped in, swapped one button, and left the furniture where it was.

## The options, in plain words

A. A. Keep the two small changes outside the territory, as built.
B. B. Move the Send slot into the pane: the answers component takes a render prop, and the pane supplies the Send component.
C. C. Leave the cache alone and let a sent answer show within the minute the cache already allows.

## What I had to decide

The plan gives this slice the new Send component and the tab's pane, but the Send button sits in the answers component (s9's `outbox-answers.tsx`), and clearing the dossier's cached summary needs the reader (`apps/galaxy/src/dossier/github/reader.ts`), neither in the territory. Without them Send cannot be wired and the answer cannot show as pending at once.

## What I did meanwhile

Added `forget(dossierId)` to the reader (three lines, with a test in `reader.test.ts`) and replaced the disabled button in `outbox-answers.tsx` with `<OutboxSend>`, plus a `drop` helper that removes picks the send answered. The fresh read for a send is `forget` then `summary` on the server's one reader, so the reader's cache and token are reused.

## What it costs to change later

A constant: reverting is deleting `forget` and putting the disabled button back. No stored shape or contract changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan may have meant `OutboxPane` to pass a Send slot into the answers component; that would still have needed a change to the answers component's props.

```

<!-- /omni-outbox-settled: s11-01-send-wiring-crosses-two-tab-files -->
