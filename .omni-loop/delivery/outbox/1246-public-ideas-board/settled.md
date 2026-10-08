# Settled outbox items — PRD 1246

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-ideas-check-in-ci -->

## s1-01-ideas-check-in-ci — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-ideas-check-in-ci
prd: 1246
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

The database test that proves who may read and vote on an ideas board is written, but the automatic checks on every pull request do not run it yet. Should someone add it there?

## The decision, in plain words

The test is written and passes, but this part of the work may not touch the checks' own settings, so it is not run automatically yet. It needs one line added there, by a person or a later part of the work.

## The intro, for fun

A test nobody runs is a smoke alarm still in its box.

## The punchline, for fun

One line unpacks it, and the board's privacy is guarded on every change.

## The options, in plain words

A. A. Leave the automatic checks alone in this part; a person or the wave adds the one step before the feature merges.
B. B. Let this part of the work change the automatic checks too, and add the step here.
C. C. Add it when the whole feature is finished, with any other change to the automatic checks.

## What I had to decide

Whether to add the step that runs supabase/checks/ideas.sql to the supabase workflow's check job before the feature merges.

## What I did meanwhile

The check passes locally against every migration and the demo seed; CI does not run it, so a later change could break a policy unseen.

## What it costs to change later

One step in .github/workflows/supabase.yml, a few lines, copied from the other checks' steps.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The slice's territory does not include .github/workflows/supabase.yml, and the conventions ask that a new database check be run by CI in the same pull request (PRD 902, s1-02).

```

<!-- /omni-outbox-settled: s1-01-ideas-check-in-ci -->

<!-- omni-outbox-settled: s1-02-one-public-board-per-repository -->

## s1-02-one-public-board-per-repository — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-one-public-board-per-repository
prd: 1246
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

Two workspaces could both list the same repository. Which one's ideas board does the public address show?

## The decision, in plain words

Only one workspace at a time can make a given repository's board public. The second one is refused until the first turns its board private again.

## The intro, for fun

Two shops, one street address: the postman needs to pick a door.

## The punchline, for fun

First one to hang the sign gets the mail.

## The options, in plain words

A. A. One public board per repository name; a second workspace is refused while the first is public.
B. B. Put the workspace in the address, so each workspace can publish its own board for the same repository.
C. C. Let the oldest workspace's board win, silently, and hide the others.

## What I had to decide

Whether one public board per repository name is right, or the address should name the workspace too.

## What I did meanwhile

The database refuses a second workspace's attempt to make the same repository's board public; the page reads the one public board by its owner and name.

## What it costs to change later

Dropping the rule later is one small database change; adding the workspace to the address would change the page's links.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec gives the address as /ideas/<owner>/<repo> and never says what happens when two workspaces list one repository.

```

<!-- /omni-outbox-settled: s1-02-one-public-board-per-repository -->

<!-- omni-outbox-settled: s1-03-members-see-their-private-board -->

## s1-03-members-see-their-private-board — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-members-see-their-private-board
prd: 1246
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

When a board is still private, may the workspace's own members open it at its public address?

## The decision, in plain words

Yes: a member signed in sees their private board at the same address, with a line saying only members see it. Anyone else gets the same no public board here page as for a repository with no board.

## The intro, for fun

The shop is closed, but the staff still have keys.

## The punchline, for fun

Customers see the closed sign, the team sees the shelves.

## The options, in plain words

A. A. Members see their private board at its address, marked private; everyone else sees no public board here.
B. B. Everyone, members included, sees no public board here until the board is public.

## What I had to decide

Whether members should see a private board at its address, or get the same no public board page as everyone else until it is public.

## What I did meanwhile

Members read a private board at its address, marked private; signed-out visitors and non-members see the no public board page, which never tells a private board from a missing one.

## What it costs to change later

Hiding it from members too is a one-line change in the database function and the page.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a private board answers no public board here, and that members reach the board from the sidebar, but not what a member sees on a private board.

```

<!-- /omni-outbox-settled: s1-03-members-see-their-private-board -->
