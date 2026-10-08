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

<!-- omni-outbox-settled: s2-01-terminal-calls-in-the-shared-client -->

## s2-01-terminal-calls-in-the-shared-client — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-terminal-calls-in-the-shared-client
prd: 1246
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

The two new terminal commands need to talk to the Omni page. Should they use the one connection every other command shares, even though that file was not on this step's list?

## The decision, in plain words

Yes: the two calls were added to the shared connection, next to the dossier and roadmap calls, so they renew the sign-in the same safe way.

## The intro, for fun

Two new callers, one phone line already wired for everyone.

## The punchline, for fun

We plugged them in rather than run a second cable.

## The options, in plain words

A. Add the two calls to the shared client, beside the dossier and roadmap calls.
B. Write a separate client for ideas inside the slice's folder, repeating the sign-in renewal.

## What I had to decide

Whether the add and list calls join the shared client the other commands use, a file outside this slice's planned ground, or get a client of their own inside it.
Decided by: Jev (hardToRevert 0.40) · agent said false

## What I did meanwhile

Added two calls, addIdea and listIdeas, to the shared client in the kit's ask folder; no other line of that file changed. The command, its checks and its tests stay in the slice's own folders.

## What it costs to change later

Moving the two calls into their own module is a small refactor: two functions and one import.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for this slice lists the idea folders, the command table and help, but not the shared client every signed-in command calls through.

```

<!-- /omni-outbox-settled: s2-01-terminal-calls-in-the-shared-client -->

<!-- omni-outbox-settled: s2-02-who-the-terminal-lets-in -->

## s2-02-who-the-terminal-lets-in — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-who-the-terminal-lets-in
prd: 1246
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

Who may add an idea or list a board from the terminal: anyone whose workspace owns the GitHub organisation, or only a member of a workspace that has the repository in its list?

## The decision, in plain words

Only a member of a workspace that lists the repository. Anyone else, even on a public board, gets the same refusal: no workspace of theirs lists it.

## The intro, for fun

The guest list says members only, and the bouncer reads the list.

## The punchline, for fun

Fans can still cheer from the public page.

## The options, in plain words

A. Members of a workspace listing the repository only, for adding and for listing.
B. Members only to add; anyone signed in may list a public board.
C. The organisation-ownership gate dossiers use, through a new database function.

## What I had to decide

Which gate the two terminal calls use: the organisation-ownership rule dossiers use, or membership of a workspace that lists the repository, which an idea needs anyway to be stored.

## What I did meanwhile

Both calls read the repository rows the caller can see (a member sees only their own workspace's), and refuse with 403 when none lists the repository. The list refuses a non-member even when the board is public; the board's page is where everyone else reads it.

## What it costs to change later

Letting anyone list a public board is a one-line change in the list call; switching to the ownership rule needs a database function, so a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says both go through the workspace gate dossiers use, but an idea must belong to a repository row of a workspace, which that gate does not require, and it does not say whether a non-member may list a public board from the terminal.

```

<!-- /omni-outbox-settled: s2-02-who-the-terminal-lets-in -->

<!-- omni-outbox-settled: s3-01-voter-sign-in-joins-nothing -->

## s3-01-voter-sign-in-joins-nothing — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-voter-sign-in-joins-nothing
prd: 1246
slice: s3
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

When someone signs in with GitHub only to vote on a public ideas board, should that sign-in also try to add them to the workspaces of their GitHub organisations, as a member's sign-in does?

## The decision, in plain words

A sign-in to vote only signs the person in, counts their vote and brings them back to the board. It adds them to no workspace and makes no game player of them, since a voter needs neither.

## The intro, for fun

Someone came in to cast one vote, not to be handed a desk and a badge.

## The punchline, for fun

They vote, they leave, and the guest list stays exactly as it was.

## The options, in plain words

A. A voter's sign-in joins nothing and links no player: it signs in, counts the vote and returns to the board.
B. Run the same joining and linking steps a member's sign-in runs, best effort, before returning to the board.
C. Link the GitHub login to a player only, so a voter shows up in the game, and join no workspace.

## What I had to decide

Whether a voter's sign-in, which asks GitHub for no organisation access, also runs the member sign-in's joining steps (join workspaces by GitHub organisation, finish pending sign-ups, link the GitHub login to a player) or skips them.

## What I did meanwhile

The callback's voter branch exchanges the code, counts the vote and redirects to the board; it never calls the joining steps or link_github(). A person already a member keeps their membership; the next member sign-in joins as before.

## What it costs to change later

Calling the existing settle step from the voter branch of the auth callback: a few lines in one route, no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a voter needs no workspace and their sign-in skips read:org and /signup, but does not say whether the joining and player-linking steps run.
- (author) Without read:org, joining by organisation would only see public memberships, so running it could join some voters and not others.

```

<!-- /omni-outbox-settled: s3-01-voter-sign-in-joins-nothing -->

<!-- omni-outbox-settled: s3-02-off-board-return-goes-to-play -->

## s3-02-off-board-return-goes-to-play — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-off-board-return-goes-to-play
prd: 1246
slice: s3
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

When a sign-in to vote comes back asking to return to an address that is not an ideas board, where should the person land?

## The decision, in plain words

The address is refused: nothing is signed in or voted, and the person lands on the game's start page, as other sign-ins that go wrong already do.

## The intro, for fun

A return ticket with a scribbled-over destination does not get you a free ride.

## The punchline, for fun

It gets you the station's main hall, where every lost traveller already waits.

## The options, in plain words

A. Refuse it and land on /play, with nothing signed in and nothing voted.
B. Refuse it and land on the home page at /.
C. Still sign the person in, and land on /play with a line saying the board address was not recognised.

## What I had to decide

What the auth callback does with a voter's return whose board is not an owner/name pair: refuse it, and send the person to which page.

## What I did meanwhile

Off the allowlist, the callback exchanges no code, counts no vote and redirects to /play. Only /ideas/<owner>/<repo>, read with the board route's own rule, is ever a landing.

## What it costs to change later

One constant in the voter callback; the allowlist itself stays.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan asks that the callback refuse a return path off the allowlist, but does not say where the refused person goes.

```

<!-- /omni-outbox-settled: s3-02-off-board-return-goes-to-play -->

<!-- omni-outbox-settled: s4-01-brainstorm-line-for-everyone -->

## s4-01-brainstorm-line-for-everyone — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-brainstorm-line-for-everyone
prd: 1246
slice: s4
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

Should the line that turns an idea into a design session show on every card for every visitor, or only for members of the team?

## The decision, in plain words

Every visitor sees it with a copy button, as the acceptance criteria say every card shows it. It only repeats the idea's title and pitch, which the board already shows.

## The intro, for fun

A recipe card pinned on the shop window.

## The punchline, for fun

Anyone can read it; only the kitchen can cook it.

## The options, in plain words

A. Show the line on every card, to every visitor, as built.
B. Show it only to members of the workspace.
C. Show it to anyone signed in, members or voters.

## What I had to decide

Whether the Brainstorm this line shows to everyone or only to members: the spec's Members paragraph places it there, while its acceptance criteria say every card shows it.

## What I did meanwhile

BrainstormLine renders on every card in Board.tsx, member or not; Board.test.ts asserts both views.

## What it costs to change later

One condition in apps/galaxy/src/ideas/Board.tsx (wrap BrainstormLine in member ?) and one test line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists the line under Members, yet its acceptance criterion and the plan's done-when say every card shows it.

```

<!-- /omni-outbox-settled: s4-01-brainstorm-line-for-everyone -->

<!-- omni-outbox-settled: s4-02-which-board-work-ideas-opens -->

## s4-02-which-board-work-ideas-opens — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-which-board-work-ideas-opens
prd: 1246
slice: s4
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

A team can have several repositories, each with its own ideas board. Which board should the Ideas entry in the menu open?

## The decision, in plain words

It opens the board that is public, and when none is, the first repository the team added. A team with no repository yet lands on the settings page where boards are switched on.

## The intro, for fun

One door, several rooms behind it.

## The punchline, for fun

We open the room with the lights on first.

## The options, in plain words

A. Open the public board first, else the first repository's, else Settings › Repositories, as built.
B. Open a small page listing every board of the workspace to choose from.
C. Always open Settings › Repositories, where each row links its board.

## What I had to decide

Which repository's board Work › Ideas opens when the workspace lists several, and where it goes when it lists none.

## What I did meanwhile

The viewer reads one repository per page load (public_ideas first, then added_at) through workspaceBoard() in apps/galaxy/src/ideas/members/store.ts; the sidebar links its board, else /app/settings/repositories.

## What it costs to change later

The ordering of one query in apps/galaxy/src/ideas/members/store.ts, or a small board picker page later.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the entry opens the workspace's board, but a workspace holds a board per repository and the spec does not say which one.

```

<!-- /omni-outbox-settled: s4-02-which-board-work-ideas-opens -->

<!-- omni-outbox-settled: s4-03-ideas-menu-icon-borrowed -->

## s4-03-ideas-menu-icon-borrowed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-ideas-menu-icon-borrowed
prd: 1246
slice: s4
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

The Ideas entry in the menu needs a small pixel icon like the others. Should it get one drawn for it?

## The decision, in plain words

It borrows the game's question block icon for now, since drawing a new one is outside this part of the work. When the menu is folded, the entry still shows that icon.

## The intro, for fun

Every menu line wears a tiny pixel hat.

## The punchline, for fun

Ideas borrowed one from the game's wardrobe.

## The options, in plain words

A. Keep the borrowed question block icon, as built.
B. Draw a menu-ideas sprite of its own, such as a light bulb, in a follow-up.
C. Show the entry with no icon, and only its name.

## What I had to decide

Which 16 px sprite the Ideas entry shows: every Dashboard and Work entry has its own menu-* sprite in packages/design, outside this slice's territory.

## What I did meanwhile

The entry uses the existing tile-block sprite (the ? block); the folded rail shows it like every other entry.

## What it costs to change later

A new menu-ideas sprite in packages/design/src/sprites.ts with its fingerprint in sprites.test.ts, then one word in apps/galaxy/src/nav/sidebar.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) packages/design is not in the slice's territory, and the spec says nothing of the entry's icon.

```

<!-- /omni-outbox-settled: s4-03-ideas-menu-icon-borrowed -->

<!-- omni-outbox-settled: s4-04-guide-tests-outside-territory -->

## s4-04-guide-tests-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-04-guide-tests-outside-territory
prd: 1246
slice: s4
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

Adding the new help page meant updating the two automatic checks that list every help page, which sit outside this part's agreed area. Is that fine?

## The decision, in plain words

Yes: the new page sits after Roadmaps, and both checks now expect it. Without that, the help page could not be added at all.

## The intro, for fun

A new book on the shelf means a new line in the catalogue.

## The punchline, for fun

The librarian's list was in another room.

## The options, in plain words

A. Keep the page after Roadmaps, the two tests updated here, as built.
B. Also point Roadmaps' Next link at the ideas page, so a reader reaches it in order.
C. Move the page elsewhere in the guide's order.

## What I had to decide

Whether to change apps/galaxy/src/docs/guide.test.ts and docs.test.ts, outside the slice's territory, so that docs/guide/ideas.md and its meta.json entry pass the docs guard.

## What I did meanwhile

Both tests list Ideas board after Roadmaps, with its Next link to Landings; no other guide page changed, so no page links to it as its Next.

## What it costs to change later

A few lines in each of the two test files, and the page's place in docs/guide/meta.json.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives this slice docs/guide/ideas.md and meta.json but not the tests that pin the guide's page list.

```

<!-- /omni-outbox-settled: s4-04-guide-tests-outside-territory -->

<!-- omni-outbox-settled: s4-05-menu-tests-outside-territory -->

## s4-05-menu-tests-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-05-menu-tests-outside-territory
prd: 1246
slice: s4
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

Adding Ideas to the menu meant updating two automatic checks that list every menu entry, which sit outside this part's agreed area. Is that fine?

## The decision, in plain words

Yes: both checks now expect Ideas after Roadmaps, and the check that every entry opens a real page follows the Ideas entry to the board, or to the repositories settings when there is none.

## The intro, for fun

A new door in the hallway means a new line on the fire plan.

## The punchline, for fun

The fire plan hung in the next corridor.

## The options, in plain words

A. Keep the two tests updated here, as built.
B. Give Ideas a fixed page of its own, /ideas, that sends a member on to their board, so the menu entry needs no special case.

## What I had to decide

Whether to change apps/galaxy/src/switch/switch.test.ts and headers.test.ts, outside the slice's territory, so the new Work › Ideas entry passes them.

## What I did meanwhile

headers.test.ts lists Ideas after Roadmaps; switch.test.ts checks the Ideas entry through hrefOf(), whose fallback is /app/settings/repositories, and that the board's route app/ideas/[owner]/[repo]/page.tsx exists.

## What it costs to change later

A few lines in each of the two test files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives this slice apps/galaxy/src/nav/ but not the tests in apps/galaxy/src/switch/ that pin the menu's entries.

```

<!-- /omni-outbox-settled: s4-05-menu-tests-outside-territory -->
