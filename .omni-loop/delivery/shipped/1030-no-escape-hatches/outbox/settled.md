# Settled outbox items — PRD 1030

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-schemas-verify-ci-trigger -->

## s1-01-schemas-verify-ci-trigger — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-schemas-verify-ci-trigger
prd: 1030
slice: s1
rank: medium
bears-on: none
raised: 2026-10-03
wave: 1
---

## The question, in plain words

When should the database check that every stored row still matches what the code expects run on a pull request, and how much of the local database stack does it need?

## The decision, in plain words

It runs on every pull request that changes the source of the arcade or the App, not only the database folder, and the check now starts the database's web API as well as the database, because the reads go through that API exactly as they do in production.

## The intro, for fun

Every schema wants its day in front of a real database.

## The punchline, for fun

So the database check now shows up to a lot more parties.

## The options, in plain words

A. Run on every change to the arcade's and the App's source, starting the API too: the option built.
B. Run only when a boundary file, the script or the database folder changes, and ask each slice to keep its schemas in the boundary file, so the job runs less often.
C. Agree on a schema file name beside each module and trigger on that name, at the price of one more convention for the wave-2 slices.

## What I had to decide

Whether the supabase workflow's pull-request job should run on every change to the arcade's and the App's source (so a schema edited inside its module always meets the database), and start the API services rather than the database alone.

## What I did meanwhile

The trigger lists the two source folders, every boundary file and the verify script, and the job starts the database with PostgREST, Kong and Auth (all other services left out). Narrowing it later is one list in the workflow.

## What it costs to change later

A few more minutes of CI on pull requests that touch the arcade's or the App's source but no schema; the job's time limit went from 15 to 20 minutes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) not yet timed on a GitHub runner: the extra images and the install were only measured on a local machine
- the plan says the trigger holds every schema file, but schemas live inside their modules, so no narrower pattern names them

```

<!-- /omni-outbox-settled: s1-01-schemas-verify-ci-trigger -->

<!-- omni-outbox-settled: s1-02-fallow-knows-boundary-files -->

## s1-02-fallow-knows-boundary-files — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-fallow-knows-boundary-files
prd: 1030
slice: s1
rank: medium
bears-on: none
raised: 2026-10-03
wave: 1
---

## The question, in plain words

The dead-code audit cannot see files the database check loads by name, so it would call every one of them unused. Who teaches it about them?

## The decision, in plain words

This slice changed the audit's settings, a file outside its own list, so the audit counts every boundary file and the check's fixtures as loaded, and accepts that they all export the same name.

## The intro, for fun

The dead-code audit only believes in files someone imports.

## The punchline, for fun

The boundary files now have a signed note from the script.

## The options, in plain words

A. Change the audit's settings in this slice so every later boundary file passes: the option built.
B. Leave the settings alone and let each wave-2 slice record the audit's findings as items of its own.
C. Name every boundary file in a single registry that imports them all, which the plan set out to avoid.

## What I had to decide

Whether the first slice may change the dead-code audit's settings, which no slice of the plan lists, so the wave-2 slices can add boundary files without each failing the audit.

## What I did meanwhile

Three entries were added to the audit's settings: the verify script as an entry, every boundary file and fixture as loaded at run time, and their shared export name accepted. Removing them is three lines.

## What it costs to change later

Three lines in a shared settings file outside the slice's territory.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the plan's territory for this slice did not list the audit's settings, though its boundary convention needs them

```

<!-- /omni-outbox-settled: s1-02-fallow-knows-boundary-files -->

<!-- omni-outbox-settled: s1-03-boundary-reads-only-by-get -->

## s1-03-boundary-reads-only-by-get — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-boundary-reads-only-by-get
prd: 1030
slice: s1
rank: medium
bears-on: none
raised: 2026-10-03
wave: 1
---

## The question, in plain words

The production check must read real rows without ever changing one, even with the most powerful database key. How is that guaranteed?

## The decision, in plain words

The check's database client refuses every request that is not a plain read before it leaves, and the database runs plain reads in a read-only transaction, so a registered read that tried to write would fail instead. A read that calls a database function must ask for it as a plain read.

## The intro, for fun

Lending the master key to a script calls for a very short leash.

## The punchline, for fun

This one can look at every room and open no door.

## The options, in plain words

A. Refuse every request but a plain read in the check's client: the option built.
B. Trust each registered read to only read, and review them by eye.
C. Run the production check with a read-only database role made for it, which needs a migration this feature rules out.

## What I had to decide

How the registered reads are kept to reading against production, and what the wave-2 slices must write for it: a database function read through the check has to be called as a plain read.

## What I did meanwhile

The client sends only plain reads; anything else fails with a line naming the refused request. The shared read description lives with the arcade's parsing helper, and says whether a read answers rows or one row.

## What it costs to change later

A database function whose arguments cannot travel in a web address cannot be registered as it is called today.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) not yet tried against production, which runs once before the feature is marked ready
- the App's own reads would import this description from the arcade's folder, as no shared package holds it

```

<!-- /omni-outbox-settled: s1-03-boundary-reads-only-by-get -->

<!-- omni-outbox-settled: s1-04-phaser-helpers-from-the-module -->

## s1-04-phaser-helpers-from-the-module — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-phaser-helpers-from-the-module
prd: 1030
slice: s1
rank: medium
bears-on: none
raised: 2026-10-03
wave: 1
---

## The question, in plain words

The game engine is only downloaded when someone opens the platform game. How can the new checks on its objects exist without making every page download it?

## The decision, in plain words

The four checks are made from the engine the game has already loaded, instead of loading the engine themselves, so pages that never open the game still never download it.

## The intro, for fun

Checking an engine's work without inviting the engine over is a delicate dance.

## The punchline, for fun

The checks borrow the engine the game already brought.

## The options, in plain words

A. Make the four checks from the engine the scene loaded: the option built.
B. Import the engine in the checks' file and move that file under the platform game's folder, where the lazy loading guard allows it.
C. Check the objects by their shape rather than their class, which needs no engine at all but trusts a shape instead of the engine's own classes.

## What I had to decide

Whether the Phaser checks are standalone functions that import the engine, or are made from the engine module the scene already holds, as the spec writes them one argument each but the lazy loading guard forbids a static import of the engine.

## What I did meanwhile

A single maker takes the engine module and hands back the four checks, each taking the one argument the spec names. The arcade game's slice calls it once where the scene is made.

## What it costs to change later

One extra line in the scene to make the checks; nothing changes for a player.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the arcade game's slice has not yet called the checks from the scene, so the maker is proven on stand-ins only

```

<!-- /omni-outbox-settled: s1-04-phaser-helpers-from-the-module -->

<!-- omni-outbox-settled: s2-01-business-reader-takes-a-narrow-port -->

## s2-01-business-reader-takes-a-narrow-port — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-business-reader-takes-a-narrow-port
prd: 1030
slice: s2
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The agent link reads a business through the same reader as the web address agents call, but asks the database a different question. How does it hand the reader its own question without telling the compiler to trust it?

## The decision, in plain words

The business reader now asks only for something that can call a database function by name, which the real database connection and the agent link's stand-in both are. That shared reader sits in a folder no slice of this feature lists.

## The intro, for fun

One reader, two front doors, and a compiler that wanted proof of both.

## The punchline, for fun

Now the side door carries its own key.

## The options, in plain words

A. A. Narrow the reader's input to a one-method interface, outside this slice's folders: the option built.
B. B. Leave the reader alone and keep the cast in the agent link, which the last slice's guard will then refuse.
C. C. Copy the reader's answer check into the agent link, so the two can drift apart.

## What I had to decide

Whether this slice may change the business reader's input, in a folder outside its own list, so the agent link stops casting its stand-in to a full database client.

## What I did meanwhile

The reader takes a small interface with one method, and the agent link passes a function that calls the token-based database function and hands back its answer and error. Every other caller passes the real client unchanged.

## What it costs to change later

One interface in the business reader's file; undoing it is putting the old parameter type back and the cast with it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan gives no slice the business reader's folder, so no other slice will clear it if it holds a cast later

```

<!-- /omni-outbox-settled: s2-01-business-reader-takes-a-narrow-port -->

<!-- omni-outbox-settled: s2-02-dossier-list-not-checked-against-the-database -->

## s2-02-dossier-list-not-checked-against-the-database — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-dossier-list-not-checked-against-the-database
prd: 1030
slice: s2
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The arcade's list of a workspace's dossiers is now checked when it comes in. Can the database check run that same read against a real database before shipping?

## The decision, in plain words

No: only a signed-in member may ask the database for that list, and the check reads with the master key, which the database turns away. That read is checked by its tests alone; the other fourteen reads of this slice are checked against the database.

## The intro, for fun

The master key opens every room but one, and it is the room with the dossiers.

## The punchline, for fun

So that list keeps its tests and skips the dress rehearsal.

## The options, in plain words

A. A. Leave the read out of the check, its tests alone proving it: the option built.
B. B. Let the check's key run the function, which needs a migration this feature rules out.
C. C. Have the check sign in as a member to run it, which needs a member account and its secret in CI.

## What I had to decide

Whether to register the dossier list read for the database check although the check's key may not run it, or leave it out and say so.

## What I did meanwhile

It is left out of the check, with a line in the check's file saying why. Its schema has tests on a fixture of every column, its counts and versions read as numbers whether they come as numbers or as text.

## What it costs to change later

A change to that database function's answer is caught by the arcade when it reads it, not before the merge. Registering it later needs the database to let the check's key run it, which is a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) not run against a real database: only the tests parse its answer
- (author) whether a real dossier's latest versions ever name a kind outside the six the code knows was not checked on production

```

<!-- /omni-outbox-settled: s2-02-dossier-list-not-checked-against-the-database -->

<!-- omni-outbox-settled: s2-03-dossier-list-schema-beside-the-arcade -->

## s2-03-dossier-list-schema-beside-the-arcade — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-dossier-list-schema-beside-the-arcade
prd: 1030
slice: s2
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The arcade now checks the workspace's dossier list when it reads it, but the shape of a dossier in that list belongs to the dossier pages, which another part of this feature reworks at the same time. Where does the check live?

## The decision, in plain words

The check lives with the arcade's own read and is held to the dossier pages' description of a dossier, so the compiler says when the two disagree. The dossier pages may grow a check of their own for the same list, and the two could then be merged into one.

## The intro, for fun

Two teams describing one dossier at the same time is how twins get different names.

## The punchline, for fun

This twin at least carries the other's birth certificate.

## The options, in plain words

A. A. A schema beside the arcade's read, held to the dossier layer's type: the option built.
B. B. Wait for the dossier layer's schema and import it, which ties this slice to another one of the same wave.
C. C. Write the schema in the dossier layer's folder, which belongs to another slice.

## What I had to decide

Whether the arcade's read of the dossier list gets its own schema, held to the dossier layer's type, while the dossier layer's slice may write one for its own read of the same function in parallel.

## What I did meanwhile

The schema sits beside the arcade's read and is declared as producing the dossier layer's own row type, so a change on either side that the other does not follow fails the type check.

## What it costs to change later

Possibly two schemas for one database function until someone merges them; merging is moving one constant and an import.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the dossier layer's slice was being built at the same time, so whether it wrote its own schema is not known here

```

<!-- /omni-outbox-settled: s2-03-dossier-list-schema-beside-the-arcade -->

<!-- omni-outbox-settled: s2-04-fixtures-brought-to-the-real-row -->

## s2-04-fixtures-brought-to-the-real-row — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-04-fixtures-brought-to-the-real-row
prd: 1030
slice: s2
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The new checks refuse a row with a column too many or too few, and some test stand-ins answered rows a real database never sends: should the checks or the stand-ins change?

## The decision, in plain words

The stand-ins changed: they now answer the rows the real database sends, and no test expects anything different. The checks stay strict, so a row with a column nobody asked for is refused.

## The intro, for fun

A strict doorman will not wave in a rehearsal guest wearing a costume from another play.

## The punchline, for fun

So the rehearsal guests got the real costumes.

## The options, in plain words

A. A. Strict schemas, the stand-ins brought to the real answers: the option built.
B. B. Schemas that drop unknown columns, the stand-ins left as they were, so a renamed column in a select goes unnoticed.
C. C. Strict schemas with the old stand-ins, the tests' expectations changed, which the plan rules out.

## What I had to decide

Whether the schemas refuse an unknown column (strict) and the test stand-ins are brought to the real answers, or the schemas drop unknown columns quietly and the stand-ins stay as they were.

## What I did meanwhile

Four test files changed what they hand in, never what they expect: the season cache's stand-in now answers only the selected columns, the board's dossier list rows carry every column, and the saved constituent and repository rows carry the workspace and dates the database functions answer.

## What it costs to change later

A select that reads a column the schema does not list fails the read instead of passing it on; loosening one schema later is one word.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether production holds rows the local database does not (a hero stored with its version as text, which the database's own check allows) is only known after the production check runs once before ready

```

<!-- /omni-outbox-settled: s2-04-fixtures-brought-to-the-real-row -->

<!-- omni-outbox-settled: s2-05-schemas-apart-from-the-server-modules -->

## s2-05-schemas-apart-from-the-server-modules — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-05-schemas-apart-from-the-server-modules
prd: 1030
slice: s2
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The database check loads each schema outside the web app, which two of this slice's modules cannot do, and the sign-in answer is a large object of which the arcade reads two fields: how are these read?

## The decision, in plain words

The ledger's, the profile's and the sign-in session's schemas now sit in small files of their own, which the check and the modules both load. The sign-in session is checked on the two fields the arcade reads, its other fields let through as they come.

## The intro, for fun

Some modules will not leave the house without the whole web app in their pocket.

## The punchline, for fun

Their descriptions now travel light, in a file of their own.

## The options, in plain words

A. A. Schemas in their own small files, the session checked on the two fields read: the option built.
B. B. Teach the database check to load the web app's page cache, in the first slice's script.
C. C. Check the whole session strictly, against an answer the authentication service may grow at any release.

## What I had to decide

Where a schema lives when its module cannot load outside the web app, and how strictly the sign-in session, which the authentication service shapes, is checked.

## What I did meanwhile

Three new files hold the ledger row, the profile's rows and the session, each imported by its module. The session's check is not strict: it needs the user's id, and GitHub's token as text or nothing; anything else in it is left alone.

## What it costs to change later

Three small files more; a session missing its user now reads as no session, as an answer that carried none always did.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the database check itself could learn to load such modules, which is its own slice's folder

```

<!-- /omni-outbox-settled: s2-05-schemas-apart-from-the-server-modules -->

<!-- omni-outbox-settled: s3-01-business-reads-the-check-cannot-run -->

## s3-01-business-reads-the-check-cannot-run — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-business-reads-the-check-cannot-run
prd: 1030
slice: s3
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The database check may only read, but three of the business page's calls write or need a signed-in member. How are they checked against real rows?

## The decision, in plain words

Those three are left out of the check and named here. Every other business read is checked, and the rows the saving calls answer are checked by reading the same tables whole.

## The intro, for fun

Some calls cannot be watched without changing what they watch.

## The punchline, for fun

So they sit this one out, with a note from the teacher.

## The options, in plain words

A. A. Leave the three out and check the saving calls' answers through their tables: the option built.
B. B. Split the business opening into a read and a separate create, so the read can be checked, at the price of a migration this feature rules out.
C. C. Run the check as a signed-in test member too, so the members list can be read, which needs a member account in every database the check runs against.

## What I had to decide

Whether the business reads that cannot run as a plain read are left out of the database check, or reworked so they can be checked.

## What I did meanwhile

The opening of the business (it creates the business the first time), the members list (only a signed-in member may run it, never the service key) and the evidence proposal (it writes) are not registered. The answers of the saving calls (a claim, a product, a persona, a draft, a web page) are checked by reading each table whole with the same schema, since each call answers one whole row of it.

## What it costs to change later

One boundary line each, if a later change makes one of the three readable without writing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the members list is read the same way by the people directory, outside this slice, which will meet the same limit
- (author) a whole-table read proves the stored rows parse, not that a saving call answers exactly a stored row

```

<!-- /omni-outbox-settled: s3-01-business-reads-the-check-cannot-run -->

<!-- omni-outbox-settled: s3-02-business-rows-keep-what-the-page-tolerated -->

## s3-02-business-rows-keep-what-the-page-tolerated — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-business-rows-keep-what-the-page-tolerated
prd: 1030
slice: s3
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

How strict should the business page be about rows that carry more than it reads, or a value the page already knew how to soften?

## The decision, in plain words

A row with extra columns is read for the columns the page uses, since the saving calls answer whole rows. A persona's stance outside the three known ones still shows as neutral, and an empty description may still come back blank, as the page did before.

## The intro, for fun

Strict is easy; strict without breaking a single page is the craft.

## The punchline, for fun

The page keeps its manners and loses its blind trust.

## The options, in plain words

A. A. Drop unknown columns and keep the page's own softening of a persona: the option built.
B. B. Refuse any column a select does not name, with a second schema for each whole row a saving call answers.
C. C. Hold the persona's stance and descriptions to the database's rules, so an odd row fails the page's personas instead of showing as neutral.

## What I had to decide

Whether the business schemas refuse a row with columns they do not name, and whether a persona's stance and descriptions are held to the database's own rules or to what the page already accepted.

## What I did meanwhile

Each schema refuses a missing column, a wrong type, a value outside a column's allowed list (a claim's kind, state and source, a receipt's kind, a draft's state) and a null the column forbids, but drops columns it does not name. A persona's stance is read as text and shown as neutral when unknown, and its two descriptions may be null, as before. One store test's sample answer was filled in to a whole draft row; what the test expects did not change.

## What it costs to change later

One line per schema to refuse extra columns or tighten a persona field, once the saving calls are known to answer only the columns read.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the database never stores a null description or an unknown stance today, so the looser reading changes nothing a person sees
- the plan asks that existing tests keep what they expect; their sample rows had to name a claim's kind and state as the allowed values, a change of the sample's type only

```

<!-- /omni-outbox-settled: s3-02-business-rows-keep-what-the-page-tolerated -->

<!-- omni-outbox-settled: s3-03-members-and-fleets-read-twice -->

## s3-03-members-and-fleets-read-twice — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-members-and-fleets-read-twice
prd: 1030
slice: s3
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The business page's people panel reads the team's members and crews the same way the shared people directory does, but that directory sits outside this work. Who owns the rules for those rows?

## The decision, in plain words

The business page states its own copy of the members and crews rules, matching the people directory's word for word, rather than changing a part of the app no step of this plan covers.

## The intro, for fun

Two pages reading the same roster is fine until one of them learns a new name.

## The punchline, for fun

For now they read from twin copies of the same list.

## The options, in plain words

A. A. Keep a copy beside the business page: the option built.
B. B. Have the people directory share its rules, a change outside every step of this plan.
C. C. Read the people through the directory's own loader, which reads the members a second time for the page.

## What I had to decide

Whether the business page reuses the people directory's rules for a member and a crew, which that directory keeps to itself, or states its own.

## What I did meanwhile

A small file beside the business page holds the member, crew and owner rules, the same as the people directory's, and the compiler checks that what they read is what the directory takes.

## What it costs to change later

Deleting the copy and importing the directory's once it shares its rules: one import, in a later change to the people directory.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) no step of this plan names the people directory, so its rules cannot be shared from here
- a column added to the members list must be added in both places until then

```

<!-- /omni-outbox-settled: s3-03-members-and-fleets-read-twice -->

<!-- omni-outbox-settled: s4-01-people-directory-narrow-port -->

## s4-01-people-directory-narrow-port — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-people-directory-narrow-port
prd: 1030
slice: s4
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

Three pages load the workspace's people directory with a database connection that only has the two abilities the directory uses. Who changes the directory so it accepts that connection without being told to trust it?

## The decision, in plain words

The people directory now says it needs only those two abilities, so the three pages hand it their connection as it is. The directory's folder belongs to no slice of this plan, so this slice changed it.

## The intro, for fun

The people directory asked for the whole toolbox and only ever used two tools.

## The punchline, for fun

Now it asks for the two tools, and everyone stops pretending.

## The options, in plain words

A. A. Narrow the loader's parameter in this slice: the option built.
B. B. Keep the loader as it is and make the three callers take a full client, widening their own ports instead.
C. C. Leave the three casts in place for a later slice that owns the people directory.

## What I had to decide

Whether this slice may change the people directory's loader, which sits in a folder no slice of the plan lists, so that the dossier page, the ask pages and the waiting list stop casting their client to call it.

## What I did meanwhile

The loader's parameter became the narrow port it already used (the database client's table read and function call). Nothing it does changed, and every caller that passed a full client still passes one.

## What it costs to change later

One line in the people directory's loader; widening it back is the same line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan's territory for this slice did not list the people directory, though three of its casts could only go by changing it

```

<!-- /omni-outbox-settled: s4-01-people-directory-narrow-port -->

<!-- omni-outbox-settled: s4-02-schemas-ignore-extra-columns -->

## s4-02-schemas-ignore-extra-columns — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-schemas-ignore-extra-columns
prd: 1030
slice: s4
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

When a database answer or a page's answer carries a field the program does not read, should the check refuse the whole answer, or keep only the fields it reads?

## The decision, in plain words

The checks in this slice keep only the fields they read and refuse a missing field, a wrong type or an empty value where none is allowed. An extra field is set aside, not refused.

## The intro, for fun

An answer that says a little more than asked is not usually lying.

## The punchline, for fun

So the checks listen to what they asked for and politely ignore the rest.

## The options, in plain words

A. A. Strip unknown keys, refuse the rest: the option built.
B. B. Refuse unknown keys too, and make the test fakes answer only the selected columns.
C. C. Refuse unknown keys on route answers only, where the fixtures are exact, and strip them on database rows.

## What I had to decide

Whether the zod schemas of the waiting list, the waiting outbox, the voice cast, the dossier's GitHub reads and the Send answers refuse unknown keys, or strip them.

## What I did meanwhile

Every schema in this slice is a plain zod object: a missing column, a wrong type and a forbidden null fail; an extra column is dropped. The existing test fakes answer whole rows whatever the select names, and they pass unchanged.

## What it costs to change later

Switching to refusing extra keys is one word per schema, plus making the test fakes answer only the selected columns.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec's strict rule names a wrong type, a missing or renamed column and a forbidden null, and does not say whether an extra column fails
- (author) the sibling slices of this wave may have chosen the other way, so the wave may disagree with itself

```

<!-- /omni-outbox-settled: s4-02-schemas-ignore-extra-columns -->

<!-- omni-outbox-settled: s4-03-waiting-rounds-not-registered -->

## s4-03-waiting-rounds-not-registered — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-waiting-rounds-not-registered
prd: 1030
slice: s4
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The database check reads with the most powerful key, but that key may not read the asked questions at all: only the person signed in can. How is the waiting list's read of those questions checked against the database?

## The decision, in plain words

That one read keeps its check and its tests, but is not registered with the database check, because the check would always fail on it. The three other reads of this slice are registered and passed against a local database.

## The intro, for fun

Even the master key has a door it was never cut for.

## The punchline, for fun

So that room gets inspected from the hallway, with tests.

## The options, in plain words

A. A. Leave the read unregistered, its schema tested on fixtures: the option built.
B. B. Teach the database check to read some boundaries as a signed-in member of the seed.
C. C. Grant the service role a read of the questions table in a later feature.

## What I had to decide

Whether to register the waiting list's read of the asked questions with the database check, which reads with the service role, when that role has no grant on the questions table.

## What I did meanwhile

The read is parsed with its schema, tested on fixtures, and left out of the check's list with a line in its test saying why. The dossiers, the new documents and the voice cast are registered and parsed one real row each on a local stack.

## What it costs to change later

Registering it later needs the check to read as a signed-in person, or a read grant for the service role, which is a database change this feature rules out.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the local seed has no dossier, version or persona: the three registered reads will show as empty in CI until the seed holds one; they were proven here on rows inserted into a throwaway stack

```

<!-- /omni-outbox-settled: s4-03-waiting-rounds-not-registered -->

<!-- omni-outbox-settled: s5-01-design-drawing-takes-narrow-context -->

## s5-01-design-drawing-takes-narrow-context — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-design-drawing-takes-narrow-context
prd: 1030
slice: s5
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The home page draws the planet and the stars on the server with stand-ins for a drawing surface, which the shared drawing library only took with a forced type. Where should that be fixed?

## The decision, in plain words

The shared drawing library now asks only for the two or three drawing calls it really makes, so the home page's stand-ins fit without forcing anything. That library sits in another slice's area of the plan.

## The intro, for fun

A planet drawn on a server has to borrow a canvas that does not exist.

## The punchline, for fun

Now the library only asks for the brush it actually uses.

## The options, in plain words

A. A. Narrow the two parameters in the design package from this slice: the option built.
B. B. Leave the package alone and have the packages slice narrow them, keeping a cast on the poster until then.
C. C. Copy the planet and starfield drawing into the home page so it owns its own types, at the price of two copies of the same drawing.

## What I had to decide

Whether this slice may narrow the parameter types of drawPlanet and drawStarfield in the shared design package, a folder the plan gives to the packages slice, so the home poster's stand-ins need no cast.

## What I did meanwhile

drawPlanet now takes a context with only drawImage, and drawStarfield one with only fillStyle and fillRect. Every real canvas context still fits; nothing else in the package changed, and the file had no ts-allow line for the packages slice to clear.

## What it costs to change later

Two parameter types in one file; going back is two lines, plus the casts on the poster.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan's territory for this slice does not list the design package, and the packages slice may touch the same file in the same wave

```

<!-- /omni-outbox-settled: s5-01-design-drawing-takes-narrow-context -->

<!-- omni-outbox-settled: s5-02-jev-saved-decision-not-verified-live -->

## s5-02-jev-saved-decision-not-verified-live — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-jev-saved-decision-not-verified-live
prd: 1030
slice: s5
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The database check may only read, but saving one of Jev's decision settings answers the saved row, which cannot be checked without saving something. How is that answer covered?

## The decision, in plain words

The answer to saving a decision is checked against the same description as the stored decisions, which the database check does read, and its own call is left out of the check, because calling it would write.

## The intro, for fun

A read-only inspector cannot test a door by walking through it.

## The punchline, for fun

So it checks the room behind the door instead.

## The options, in plain words

A. A. Leave the saving call out of the check and verify the stored rows it answers: the option built.
B. B. Add a read-only database function that answers a decision row, for the check to call, which needs a migration this feature rules out.
C. C. Call the saving function in the local check only, against a throwaway workspace, which breaks the check's read-only rule.

## What I had to decide

Whether set_jev_decision(), an rpc that writes and answers the jev_decisions row it saved, is registered in jev/store.boundary.ts, given pnpm schemas:verify only sends reads.

## What I did meanwhile

It is not registered. Its answer is parsed with the jev_decisions row schema (extra columns allowed, as the function answers the whole row), and the jev_decisions select, parsed with the strict form of that schema, is registered instead. A failed parse of any Jev read throws the store's own JevStoreError.

## What it costs to change later

One registered read to add if a read-only way to call it appears; nothing for a player.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) not run against a local or production database: the demo seed leaves jev_decisions and jev_calls empty, so the local check would name both as empty

```

<!-- /omni-outbox-settled: s5-02-jev-saved-decision-not-verified-live -->

<!-- omni-outbox-settled: s6-01-retro-json-runs-fail-loudly -->

## s6-01-retro-json-runs-fail-loudly — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s6
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-retro-json-runs-fail-loudly
prd: 1030
slice: s6
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

When the retro reads back the record it saved two weeks earlier and finds it in an older shape, should it stop, or carry on and keep the old record as it is?

## The decision, in plain words

It stops, and leaves the comment that says the retro could not run, naming what changed. The record is never kept or rewritten without being read first.

## The intro, for fun

Two weeks is a long time for a note left on a desk.

## The punchline, for fun

Now the retro reads the note before it signs below it.

## The options, in plain words

A. A. Fail the run loudly, with the failure comment naming the field: the option built.
B. B. Keep a run of another shape as it was written, unread, and parse only the runs the retro writes now.
C. C. Drop a run of another shape from the record and write the new run alone.

## What I had to decide

Whether a run kept in the retro's saved record, or a step's saved value, that no longer matches today's shape fails the day-14 run, or is kept as it was and the run carries on.

## What I did meanwhile

Every value read back from a saved step, and every run read back from the saved record on the retro branch, is parsed; one of another shape fails the run, which retries and then posts the usual failure comment naming the step and the field. A saved record that is not the retro's JSON at all is still started again, as before.

## What it costs to change later

A deploy that changes the record's shape while a retro waits for its day-14 run makes that one run fail with a comment, until the shape is loosened in a one-line fix.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) No retro has yet waited across a deploy that changed its record, so how often this fires is not known.
- (author) The spec asks for strict parsing everywhere but does not say what the day-14 run should do with an older record.

```

<!-- /omni-outbox-settled: s6-01-retro-json-runs-fail-loudly -->

<!-- omni-outbox-settled: s6-02-kind-test-handles-in-a-test-folder -->

## s6-02-kind-test-handles-in-a-test-folder — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s6
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-kind-test-handles-in-a-test-folder
prd: 1030
slice: s6
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The small helper the retro's tests use to feed each kind of finding partial test data cast its inputs. Should it be rewritten to need no cast, or live with the other test helpers?

## The decision, in plain words

It moved into a test folder beside the kinds, where test code may cast its fixtures as every other test does; nothing the App runs imports it.

## The intro, for fun

A helper that only ever works in the rehearsal room was sitting on the stage.

## The punchline, for fun

It now sits backstage with the rest of the crew.

## The options, in plain words

A. A. Move it into a test folder beside the kinds: the option built.
B. B. Rewrite each kind's tests to build full scopes and contexts, so the handles need no cast.
C. C. Move it to the App's top test folder, outside this slice's territory.

## What I had to decide

Whether the kinds' test handles, test support that hands each kind partial fixtures, are rewritten without a cast or moved where the type guard counts them as tests.

## What I did meanwhile

The file moved from beside the kinds into a test folder inside the same place, its three casts unchanged and their exemption comments gone; the five kind tests import it from there.

## What it costs to change later

Moving it back, or rewriting it with a typed fixture per kind, is one file and five imports.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The guard's rule lets a test folder anywhere cast freely; whether a test folder inside the App's source is welcome is not written down.

```

<!-- /omni-outbox-settled: s6-02-kind-test-handles-in-a-test-folder -->

<!-- omni-outbox-settled: s6-03-app-boundaries-own-shape -->

## s6-03-app-boundaries-own-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s6
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-03-app-boundaries-own-shape
prd: 1030
slice: s6
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The App's database reads must be registered for the check that runs them against a real database, but the shape of that registration lives in the arcade, which the App may not import. Where does the App get it?

## The decision, in plain words

The App keeps its own small copy of the registration shape, and registers its three reads: the tracked repositories, and the business and product lines of this repository.

## The intro, for fun

The App wanted to join the database check without borrowing the arcade's form.

## The punchline, for fun

So it photocopied the form, which is allowed.

## The options, in plain words

A. A. A copy of the shape in the App, the reads asking about this repository: the option built.
B. B. Import the arcade's shape, against the plan's rule that the App imports nothing from the arcade.
C. C. Move the shape into a shared package both import, outside this slice's territory.

## What I had to decide

Whether the App's boundary files use a copy of the registration shape kept in the App, or import the arcade's, and which repository the business and product reads ask about.

## What I did meanwhile

A copy of the shape sits in the App, and the two business reads ask about this repository itself, whose business production holds; a database without it answers an empty business, which parses all the same.

## What it costs to change later

Two copies of a four-field shape to keep in step; a change to the check's shape is one more file to touch.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The local database check could not be run here: no local database stack on this machine. It runs in the database workflow on the pull request.
- (author) The empty seed holds no repository, so the local run reads only the empty business.

```

<!-- /omni-outbox-settled: s6-03-app-boundaries-own-shape -->

<!-- omni-outbox-settled: s7-01-kit-readers-refuse-malformed-answers -->

## s7-01-kit-readers-refuse-malformed-answers — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s7
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-kit-readers-refuse-malformed-answers
prd: 1030
slice: s7
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

When the loop's own tool reads an answer from GitHub, a sign-in, or the answers people left on a pull request, and a value has the wrong shape, should it stop with a clear error or carry on as before?

## The decision, in plain words

It now stops with an error naming the field, where before it carried on with the value missing. Every command prints exactly what it printed before on well-formed answers.

## The intro, for fun

The loop's tool used to take every answer on trust.

## The punchline, for fun

Now it reads the label before drinking.

## The options, in plain words

A. A. Strict schemas on every kit reader, failing loudly with the field named: the option built.
B. B. Keep the hand checks and read a missing field as before, typing the answers without parsing them.
C. C. Parse strictly but, on a failure, log it and fall back to the old reading.

## What I had to decide

Whether the kit's readers of the pull-request care query, the access token's claims and the reply rows (the comments and items `planReplies` reads, which the arcade's Outbox tab also calls) refuse a malformed value, as the spec's strict schemas ask, or keep reading a missing field as before.

## What I did meanwhile

Each is parsed with a zod schema: the care query's answer (required: the PR's number, url, state and branch names, a thread's id, a label's name), the token's claims (`exp` a number, the others optional strings), and the reply rows (an item's id, rank and the four sections read; a comment's id a number). A token whose claims do not parse is refused as not a Supabase session. Items keep every field they carry (loose objects), so what comes back is what went in. A plan repository with no slug now fails naming the missing slug, not with a TypeError. The board and the rework plan type a missing wave and a missing feature branch as null, keeping their output as it was.

## What it costs to change later

Loosening one field is a one-line schema change; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) only the PRD 1030 feature PR's live care answer and board were compared old bundle against new; a sign-in token was tested on fixtures only
- the arcade's Outbox tab calls the reply reader: a malformed item now fails that read instead of showing it, which s4 already made the rule for its own reads

```

<!-- /omni-outbox-settled: s7-01-kit-readers-refuse-malformed-answers -->

<!-- omni-outbox-settled: s8-01-linter-forgets-deleted-contract -->

## s8-01-linter-forgets-deleted-contract — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s8
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-01-linter-forgets-deleted-contract
prd: 1030
slice: s8
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The linter's settings still named the hand-written description of the galaxy map package after this work deleted it. Who removes that line, when the settings belong to no slice?

## The decision, in plain words

This slice removed the one line itself, since the file it pointed at no longer exists, and the linter reads every remaining file exactly as before.

## The intro, for fun

The linter kept a seat warm for a file that had already left.

## The punchline, for fun

The seat is gone now, and nobody noticed the chair.

## The options, in plain words

A. Remove the stale entry in this slice: the option built.
B. Leave the entry pointing at a missing file, and let the slice that removes the mechanism clean it.
C. Keep the entry and the comment, as a record of what the package used to publish.

## What I had to decide

Whether the slice that deletes packages/galaxy/src/index.d.ts may also drop its allowDefaultProject entry in eslint.config.ts, a file outside the slice's territory (packages/).

## What I did meanwhile

eslint.config.ts's projectService is now `true`: the allowDefaultProject entry for the deleted file and its defaultProject, which only served that entry, are gone, with the two comment lines that explained them. pnpm lint over packages/ and the config reads 0 findings.

## What it costs to change later

Two lines in a shared settings file; putting them back is a copy of the previous version.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan's territory for this slice lists packages/ only, though deleting the declaration file leaves the linter's settings naming it

```

<!-- /omni-outbox-settled: s8-01-linter-forgets-deleted-contract -->

<!-- omni-outbox-settled: s8-02-galaxy-reads-event-data-by-field -->

## s8-02-galaxy-reads-event-data-by-field — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s8
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-02-galaxy-reads-event-data-by-field
prd: 1030
slice: s8
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The galaxy map used to trust that every stored game event carried exactly the details it expects. Now that it checks them, what does it do with a detail of the wrong kind?

## The decision, in plain words

A detail of the wrong kind is read as missing, a damage mark of a kind the rules do not know is left off the map, and an event of a kind the game does not know still shows in the planet's log but earns no points. Nothing the game writes today is affected.

## The intro, for fun

The galaxy map used to believe every postcard the ledger sent it.

## The punchline, for fun

Now it reads the stamp before it reads the card.

## The options, in plain words

A. Read each field by its type and leave out what does not fit: the option built.
B. Parse every event's data with a strict schema per event type in the package, and throw when one fails, which blanks the whole map on one bad row.
C. Draw an unknown wound kind under a neutral label with no weight, so a new kind shows before the rules name it.

## What I had to decide

What buildGalaxy does with an event's data field of an unexpected type, a WOUND_OPENED of an unknown kind and a ledger row whose type is not one of EVENT_TYPES, once the `e.data as EventData` and `sorted as GameEvent[]` casts are gone; a strict zod parse would have no failure path here, as buildGalaxy has none today.

## What I did meanwhile

Each data field is read with textOf or a number reader, a wrong type reading as absent; a wound whose kind is not in WOUND_KINDS is not drawn (it had no threat weight or decay, so it drew NaN before); score() receives only the rows whose type is a game event type. A test covers each, red on the cast version.

## What it costs to change later

A constant: each reader is one line, and drawing an unknown wound kind again needs a fallback weight for it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec asks for strict zod schemas where outside data comes in; the arcade's ledger read is that boundary (s2's ground), so the package reads defensively rather than parsing twice

```

<!-- /omni-outbox-settled: s8-02-galaxy-reads-event-data-by-field -->

<!-- omni-outbox-settled: s9-01-architecture-form-still-names-the-ceilings -->

## s9-01-architecture-form-still-names-the-ceilings — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s9
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-01-architecture-form-still-names-the-ceilings
prd: 1030
slice: s9
rank: medium
bears-on: none
raised: 2026-10-03
wave: 3
---

## The question, in plain words

The architecture page of the playbook still says the repository's type guard keeps its ceilings, which this feature removed. Who should correct that line, and when?

## The decision, in plain words

This slice left that page as it is, since it is outside what this slice may change, and named the stale words here so the finish can fix them.

## The intro, for fun

The ceilings came down, but one page still points up at them.

## The punchline, for fun

A sign for a staircase that was taken out last week.

## The options, in plain words

A. A. Leave the line for the finish or a follow-up docs change to correct (what this slice did).
B. B. Correct it in this PRD's finish, before the feature PR is marked ready.
C. C. Correct it in a separate docs pull request after this PRD ships.

## What I had to decide

Whether the playbook's architecture form drops the words 'its ceilings' from its line about scripts/, in this PRD's finish or in a later docs change.

## What I did meanwhile

Left .omni-loop/knowledge/playbook/architecture.md untouched; it is outside s9's territory (scripts/typescript-guard.test.ts, scripts/typescript-ceilings.json, ADR 0054). git grep -n 'ts-allow' finds no other mention outside the guard's own fixtures and the delivery history; no README, CLAUDE.md or fallow config names ts-allow or the ceilings file.

## What it costs to change later

One line of prose: change '(its TypeScript guard, its ceilings)' to '(its TypeScript guard)' at any time. Nothing reads it as config.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person wants the playbook's forms corrected in the finish of a feature PR, or kept to docs-only pull requests (author).

```

<!-- /omni-outbox-settled: s9-01-architecture-form-still-names-the-ceilings -->
