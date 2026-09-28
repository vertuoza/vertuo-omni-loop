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
