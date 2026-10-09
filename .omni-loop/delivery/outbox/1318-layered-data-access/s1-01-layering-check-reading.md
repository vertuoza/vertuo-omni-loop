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
