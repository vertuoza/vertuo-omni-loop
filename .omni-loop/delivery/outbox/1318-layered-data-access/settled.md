# Settled outbox items — PRD 1318

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-layering-check-reading -->

## s1-01-layering-check-reading — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-layering-check-reading
prd: 1318
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The spec names one database module and says the check reads every file of the galaxy app. Which files should it read, and which modules count as reaching the database?

## The decision, in plain words

The check reads every app file except tests and test fakes, counts the old cookie builder as a database module beside the new one, treats any file named as a client as a browser file, and counts a storage bucket only when it is called.

## The intro, for fun

A rule is only as good as the files it reads.

## The punchline, for fun

The fakes pretend to be the database, so they get a pass for good acting.

## The options, in plain words

A. As built: the check skips tests and fakes, counts both the old and the new database builders, and treats every client-named file as a browser file.
B. Keep to the spec's words: read the fakes too and count only the new database module, so more fakes and fewer pages sit on the list.
C. As built, but read the fakes as well, so they sit on the list until each area moves.

## What I had to decide

Whether the layering check skips test fakes, counts supabase-server.ts as a database module, treats every *.client.ts as a browser file, and flags .storage only through .storage.from(.

## What I did meanwhile

The baseline holds 150 lines with these choices; any other reading only changes the guard's constants and regenerates the baseline.

## What it costs to change later

Changing it is a constant in scripts/layering-guard.test.ts and a regenerated layering/baseline.json: no migration, no product change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says 'every tracked TypeScript file under apps/galaxy'; leaving out *.fake.ts is my reading, since a fake stands for the database in tests and would otherwise sit on the baseline forever.
- (author) Counting supabase-server.ts as a database module is beyond the spec's one module: without it a controller could import the cookie builder and pass the client on unflagged.

```

<!-- /omni-outbox-settled: s1-01-layering-check-reading -->

<!-- omni-outbox-settled: s1-03-db-module-test-outside-territory -->

## s1-03-db-module-test-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-db-module-test-outside-territory
prd: 1318
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The new database module had no test in the plan, and the repository's dead-code and complexity gate refuses a module nothing uses or covers. Should the slice add a test beside it, outside the ground the plan gave it?

## The decision, in plain words

The slice adds one test file beside the new database module, the only file it writes outside its planned ground, so the module is covered and the gate passes without any suppression.

## The intro, for fun

A new module walked in with nobody to vouch for it.

## The punchline, for fun

So it brought its own test, one step past the fence.

## The options, in plain words

A. As built: one test file beside the new database module, reported as spillover.
B. Drop the test and leave the module unused until the next slice, which needs a suppression the rules forbid.

## What I had to decide

Whether apps/galaxy/src/data/db.test.ts may land with slice s1, outside its declared territory.

## What I did meanwhile

The test sits beside the module; the wave's territory check reports it as one breach, which is never fatal.

## What it costs to change later

Moving or deleting one test file; nothing else depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory names db.ts alone, so its test was not declared; the commit gate refuses an unused, uncovered file and the briefing forbids a suppression.

```

<!-- /omni-outbox-settled: s1-03-db-module-test-outside-territory -->

<!-- omni-outbox-settled: s2-03-session-poll-reads-every-round -->

## s2-03-session-poll-reads-every-round — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-session-poll-reads-every-round
prd: 1318
slice: s2
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

An open ask page used to fetch only the questions that changed since its last read, but the server now remembers nothing between reads: should each read fetch the whole session again?

## The decision, in plain words

Each read of a session fetches the session and all its rounds again, every 2 seconds as before, in two database queries instead of two or three, with larger answers.

## The intro, for fun

The server has the memory of a goldfish, by design.

## The punchline, for fun

So it reads the whole menu every time, instead of only the specials.

## The options, in plain words

A. A. As built: each poll reads the session and all its rounds.
B. B. The client sends the rounds it holds with their status, and the server returns only the new or moved ones.
C. C. Read all rounds, but let the server answer 'nothing changed' when the session's newest change is the one the client holds.

## What I had to decide

Whether GET /api/ask/sessions/:id (askReadService.session) keeps the browser's old incremental poll (read round heads, refetch only new or moved rounds) by having the client send what it knows, or reads every round on each poll. The old sessionReader and its incremental tests are removed; the tab list keeps its once-per-round header cache only for the readers that live on (the bell's tabsReader).
Decided by: Jev (hardToRevert 0.40) · agent said false

## What I did meanwhile

Each session poll is two queries (the session, its rounds); the payload grows with the number of rounds in a session, which stays small in practice.

## What it costs to change later

Adding the incremental read later is a query parameter on the route and a filter in the service: no stored change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec keeps the poll's pace and says the database sees the same reads; it does not say whether a read may carry more rows than before.

```

<!-- /omni-outbox-settled: s2-03-session-poll-reads-every-round -->

<!-- omni-outbox-settled: s3-02-way-back-reads-through-a-route -->

## s3-02-way-back-reads-through-a-route — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-way-back-reads-through-a-route
prd: 1318
slice: s3
rank: medium
bears-on: none
raised: 2026-10-09
wave: 3
---

## The question, in plain words

After someone answers a question opened from a PRD page, the page goes back to the next open question there, which it read straight from the database. With the database gone from the page, where should that read go?

## The decision, in plain words

The page reads which of the PRD's questions are still open through a new read of its own on the server, which hands back only whether each is open and when it was asked.

## The intro, for fun

The way home needed a map, and the map was kept in the database.

## The punchline, for fun

Now the server reads it out, one street name at a time.

## The options, in plain words

A. As built: a read of its own that hands back only which questions are open and when each was asked.
B. Fold it into the question's own read, which then carries the PRD's open questions when the page was opened from one.
C. Drop the read: after an answer the page goes back to the PRD's questions without jumping to the next open one.

## What I had to decide

GET /api/ask/dossiers/:id/rounds → {rounds: [{round_id, status, created_at}]}, a new route the plan does not list, in ask.controller.ts (401 signed-out first, 422 for an id that is no dossier's, 500 database), through askWayBack in ask.service.ts and wayBackRepository in ask.repository.ts, which calls the dossier area's dossier_rounds() reader. It replaces the browser client src/ask/page/back.ts used.
Decided by: Jev (hardToRevert 0.42) · agent said false

## What I did meanwhile

The question page reads it once after its answer, as before; the demo still goes to the Questions tab alone.

## What it costs to change later

Folding it into GET /api/ask/rounds/:id later is a query parameter and a field in the contract: no stored change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan lists the ask pages' three reads and their writes; the way back's dossier read is neither, and the page could not keep its browser client.

```

<!-- /omni-outbox-settled: s3-02-way-back-reads-through-a-route -->

<!-- omni-outbox-settled: s3-04-screenshot-route-and-page-delete -->

## s3-04-screenshot-route-and-page-delete — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-04-screenshot-route-and-page-delete
prd: 1318
slice: s3
rank: medium
bears-on: none
raised: 2026-10-09
wave: 3
---

## The question, in plain words

Screenshots now go to the server one at a time before the answer, and deleting a session from the page now goes through the terminal's delete. At which address do screenshots go, and what does that delete do with them?

## The decision, in plain words

Each screenshot is sent to its own address under its question, and a dropped one is deleted there. Deleting a session from the page now removes its screenshots too, as the terminal's delete always did, and fails rather than leaving them behind when they cannot be listed.

## The intro, for fun

Every screenshot now gets its own little envelope.

## The punchline, for fun

And throwing the folder away finally empties it too.

## The options, in plain words

A. As built: one address per screenshot under its question, and the page's delete removes the screenshots too.
B. One upload address per question that takes the screenshot's number in the body, the delete as built.
C. The addresses as built, and the page's delete leaves the screenshots as it did before.

## What I had to decide

The upload route: POST /api/ask/rounds/:id/attachments/:name (one screenshot per request, its body the file, its type the content-type, at most 4 MB, 413 {error: "too-large"}, 409 when the file is already there, 403 when the bucket's rules refuse) and DELETE on the same path. The page's delete now calls DELETE /api/ask/sessions/:id (src/ask/api.ts deleteSession), which removes the session's screenshots before its rows; before s3 the page deleted the rows only.

## What I did meanwhile

src/ask/ask.client.ts's bucket() serves src/ask/page/attachments.ts's uploads unchanged: same numbering, same retry, same clean-up when the round was taken.

## What it costs to change later

Moving the route is a rename of one route folder and one client path; the delete change is api.ts's existing behaviour, with no stored change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says one screenshot per POST through the controller, not its address, and does not mention the page's delete.

```

<!-- /omni-outbox-settled: s3-04-screenshot-route-and-page-delete -->

<!-- omni-outbox-settled: s4-01-bell-poll-reads-everything-again -->

## s4-01-bell-poll-reads-everything-again — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-bell-poll-reads-everything-again
prd: 1318
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 4
---

## The question, in plain words

The bell used to remember, between two reads, the text of each waiting question and who shared it. Its reads now run on the server, which remembers nothing between two reads: should each read fetch all of it again?

## The decision, in plain words

Each read of the bell fetches every waiting question's text, and who shared it with their face, again, every 5 seconds as before, so a read sends a few more queries than the browser did.

## The intro, for fun

The bell moved into the server, and the server has a goldfish's memory.

## The punchline, for fun

So it reads the whole list each time, instead of only what is new.

## The options, in plain words

A. As built: every bell read on the server reads it all again, every 5 seconds as before.
B. The browser sends the rounds whose text it already holds, and the server reads only the new ones.
C. The server keeps a short memory per person between reads.

## What I had to decide

Whether waiting.service.ts keeps the browser's old once-per-reader memory (each waiting round's first question, each workspace's members and people directory, each newest round's header) across polls, or reads them all on every GET /api/waiting/questions. A reader now lives for one request, so the maps in questionsReader only spare repeats within that request.

## What I did meanwhile

Each poll reads the tab list, the shared rounds, the waiting rounds' questions and, when a round was shared, its workspace's members and people: a handful of small queries every 5 s visible and 15 s hidden, as the pace was before.

## What it costs to change later

Sending the round ids the bell already holds is a query parameter on the route and a filter in the service: no stored change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec keeps the poll's pace and says the database sees the same reads; it does not say whether one read may send more queries than before.
- (author) A medium item of the ask pages' slice (s2-03) settled the same trade for the ask pages' session poll.

```

<!-- /omni-outbox-settled: s4-01-bell-poll-reads-everything-again -->

<!-- omni-outbox-settled: s4-02-signed-out-bell-goes-quiet -->

## s4-02-signed-out-bell-goes-quiet — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-signed-out-bell-goes-quiet
prd: 1318
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 4
---

## The question, in plain words

The spec says a signed-out bell stops asking and shows the sign-in card. The bell has no card of its own: what should it show once it hears the person is signed out?

## The decision, in plain words

A bell whose sign-in expired stops reading and goes quiet, keeping what it last showed; the page around it shows its own sign-in card, as the ask pages do, and the bell adds none.

## The intro, for fun

The bell heard the door close behind its owner.

## The punchline, for fun

It stopped ringing, and left the welcome mat to the page.

## The options, in plain words

A. As built: the bell goes quiet, and the page shows its own sign-in card as it does today.
B. The bell also shows a sign-in line in its panel once it hears the person is signed out.

## What I had to decide

Whether the waiting provider, on a 401 from GET /api/waiting/questions or GET /api/waiting/documents, only stops both polls (as built), or also tells the bell's panel to show a sign-in line, which would change src/nav/Bell.tsx, outside this slice's ground.
Decided by: Jev (hardToRevert 0.48) · agent said false

## What I did meanwhile

Both polls stop at their next tick and ask nothing more until a reload; the bell keeps its last items and the page shows whatever it shows a signed-out person today.

## What it costs to change later

A signed-out flag in the provider's context and one line in the bell's panel: no stored change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's acceptance criterion names the sign-in card for the bell and the ask page together; the plan's done-when for this slice only asks that both polls stop.

```

<!-- /omni-outbox-settled: s4-02-signed-out-bell-goes-quiet -->
