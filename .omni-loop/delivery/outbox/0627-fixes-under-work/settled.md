# Settled outbox items — PRD 627

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-rounds-kept-once-by-content -->

## s1-01-rounds-kept-once-by-content — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-rounds-kept-once-by-content
prd: 627
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When a visual fix is sent to the Omni page again, how does the page know which rounds of looks it already holds?

## The decision, in plain words

A round is kept once: sending the same round again adds nothing, and a new round is added after the others. A round whose content changed after it was shown would be added as a new round.

## The intro, for fun

Five looks, three rounds, one page that must not count them twice.

## The punchline, for fun

Déjà vu is skipped; only new looks get a seat.

## The options, in plain words

A. Recognise a round by its content: an identical round adds nothing, anything else is a new round (built).
B. Store the round number with each version, so round k is always round k and an edited round adds a version of it.
C. Send only the rounds added since the last push, and keep the version rule as it is for every kind.

## What I had to decide

Whether a round is recognised by its content (built) or by its round number.

## What I did meanwhile

Every push sends every round, oldest first; the database adds only the rounds it has never seen, so their order on the page is the order they were first sent.

## What it costs to change later

Changing it means one more column (the round number) and a rewrite of the version rule for rounds; no page changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says each round is one variations version in round order, but not how a second push of the same rounds is told apart from new ones.
- (author) A round edited after it was committed shows up as an extra round rather than a new version of the same round.

```

<!-- /omni-outbox-settled: s1-01-rounds-kept-once-by-content -->

<!-- omni-outbox-settled: s1-02-push-cap-kept-at-two-mib -->

## s1-02-push-cap-kept-at-two-mib — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-push-cap-kept-at-two-mib
prd: 627
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

A visual fix now sends its before and after page and every round of looks at once. Should one send be allowed to carry more than it does today?

## The decision, in plain words

The limit on one send stays as it is today, about four big pages. A visual fix whose page and rounds together go past it is refused as a whole and the terminal says so; nothing else changes.

## The intro, for fun

Every round of looks rides in one envelope to the Omni page.

## The punchline, for fun

The envelope did not grow; most looks travel light anyway.

## The options, in plain words

A. Keep one send at 2 MiB for every kind (built).
B. Raise the limit to about 4 MiB, what the hosting accepts for one call.
C. Keep the limit and have the kit send a large fix's rounds in several sends.

## What I had to decide

Whether to raise the limit on one send for fixes (up to what the hosting takes, about 4 MiB), or split a large fix into several sends.

## What I did meanwhile

A send over the limit is refused with 'refused (413)' in the terminal and the fix's page is not updated; each page stays under its own 512 KiB limit as before.

## What it costs to change later

Raising it is one constant in the page's server and one in its tests; splitting sends is a small change in the kit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) No real visual fix has sent more than one round yet, so how large rounds get in practice is not known.

```

<!-- /omni-outbox-settled: s1-02-push-cap-kept-at-two-mib -->

<!-- omni-outbox-settled: s2-01-two-shared-files-touched-outside-the-slice -->

## s2-01-two-shared-files-touched-outside-the-slice — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-two-shared-files-touched-outside-the-slice
prd: 627
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

Building the fix pages meant changing two places the plan did not give this piece of work: the shared description of a stored version, and two checks that pin the menu.

## The decision, in plain words

A stored version may now be any of the five kinds, and the two menu checks now expect Bug Fixes and Visual Updates after PRDs. Nothing else in those places changed.

## The intro, for fun

The plan drew a fence; the menu grew two entries right on the line.

## The punchline, for fun

Two gates opened, the rest of the fence still stands.

## The options, in plain words

A. A. Keep both changes here: the version kind widened, the two menu checks updated (built).
B. B. Keep the shared description as it was and give the fix pages a type of their own.
C. C. Also make the dossier's kind required everywhere, updating every test row that builds one.

## What I had to decide

Whether the change to the shared description of a stored version and to the two menu checks may stay in this piece of work.

## What I did meanwhile

Widened the kind of a stored version to the five kinds the database already accepts, and added the two new menu entries to the two checks that list the menu. A dossier read without a kind is still read as a PRD, so older rows and test data keep working.

## What it costs to change later

A constant: reverting is two lines in the shared description and two in the checks, and the fix pages would then need their own version type.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says the sidebar's tests are only touched by this slice, but names only the two in the menu folder; two more checks elsewhere pin the same menu.
- (author) The earlier slice left the dossier's own kind optional; it stays optional, because making it required would change test data in folders no slice of this plan owns.

```

<!-- /omni-outbox-settled: s2-01-two-shared-files-touched-outside-the-slice -->

<!-- omni-outbox-settled: s2-02-mine-means-fixes-you-pushed -->

## s2-02-mine-means-fixes-you-pushed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-mine-means-fixes-you-pushed
prd: 627
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

On the Visual Updates and Bug Fixes lists, which fixes count as Mine?

## The decision, in plain words

Mine is the fixes you sent to the page yourself, as it is for PRDs. A fix the page read from a repository on its own shows only under All.

## The intro, for fun

Everyone asks whose fix it is; the list answers: whoever pressed send.

## The punchline, for fun

Finders keepers, pushers listers.

## The options, in plain words

A. A. Mine is the fixes you sent to the page (built).
B. B. Mine is the fixes whose issue you opened, once a later slice reads who asked.
C. C. Mine is every fix you sent, asked for or reviewed.

## What I had to decide

Whether Mine should mean the fixes you sent, the fixes you asked for, or the fixes you reviewed.

## What I did meanwhile

Mine keeps the fixes whose page was opened by the viewer's push, exactly as the PRD list does; All shows every fix of the workspace.

## What it costs to change later

A constant in the list's filter; who asked for a fix is read from GitHub by a later slice, and Mine could switch to it then.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists Mine and All among the filters without saying whose fixes Mine holds; who asked is only read from GitHub in a later slice.

```

<!-- /omni-outbox-settled: s2-02-mine-means-fixes-you-pushed -->

<!-- omni-outbox-settled: s2-03-fix-page-does-not-refresh-on-new-rounds -->

## s2-03-fix-page-does-not-refresh-on-new-rounds — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-fix-page-does-not-refresh-on-new-rounds
prd: 627
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

A PRD's page refreshes itself when a new version arrives. Should a fix's page do the same when a new round of looks or a new bug record arrives?

## The decision, in plain words

Not yet: a fix's page shows what was there when it was opened, and a reload shows anything newer. A PRD's page refreshes itself exactly as before.

## The intro, for fun

Round three landed, but the page is still admiring round two.

## The punchline, for fun

A reload is the fastest time machine we ship today.

## The options, in plain words

A. A. A fix's page refreshes when its page of today and the pick changes, and only then; a new round or record needs a reload (built).
B. B. Count rounds and records in the pulse too, so a fix's page refreshes on every new version.

## What I had to decide

Whether a fix's page should refresh itself when a new round or record is pushed while someone reads it.

## What I did meanwhile

The page's change check counts only a PRD's spec, plan and page of today beside the pick, as the database's pulse does; a fix whose page of today and the pick changes still refreshes, a new round or record does not.

## What it costs to change later

Small: the pulse the database gives would count the two new kinds too, and the page's check would compare them; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether a fix's page refreshes itself, and the pulse lives in a shared file no slice of this plan owns.

```

<!-- /omni-outbox-settled: s2-03-fix-page-does-not-refresh-on-new-rounds -->

<!-- omni-outbox-settled: s3-01-fix-title-read-once -->

## s3-01-fix-title-read-once — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-fix-title-read-once
prd: 627
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

When the Omni page makes a page for a fix it found in a repository, what name does it give it, and does the name follow later changes to the request?

## The decision, in plain words

The page is named after the request's title, without its Visual or Bug prefix, read once when the page is made; if the request cannot be read, it is named after the fix's folder. A later rename of the request is not followed.

## The intro, for fun

Three fixes walk in with a folder name and a request title.

## The punchline, for fun

The title wins the first handshake, and keeps it.

## The options, in plain words

A. Read the title once, when the page is made (built).
B. Read it on every run and rename the page when it changed.
C. Name every page after its folder, and let only the kit's push give the request's title.

## What I had to decide

Whether the background sync reads a fix's request title on every run to follow renames, or once when it opens the fix's page.

## What I did meanwhile

The sync reads the title only when it opens a fix's page, so a run with nothing new asks GitHub nothing more; a failed read falls back to the folder name and is logged.

## What it costs to change later

A constant: reading the title on every run and renaming when it differs is a few lines in the sync, no stored change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the title (the request's, without its prefix) but not whether the background sync must follow a later rename.
- (author) A page the kit pushed first keeps the kit's title; the sync never renames a fix's page.

```

<!-- /omni-outbox-settled: s3-01-fix-title-read-once -->

<!-- omni-outbox-settled: s3-02-sync-summary-counts-prds-only -->

## s3-02-sync-summary-counts-prds-only — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-sync-summary-counts-prds-only
prd: 627
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The background sync ends with one line of totals. Should those totals count the fix pages it made, beside the PRD pages?

## The decision, in plain words

Each repository's own line now names its fix folders, the fix pages made and the fix versions added, but the closing totals line still counts PRD pages only, because it lives outside this piece of work.

## The intro, for fun

The sync's last line can count to PRDs, and stops there.

## The punchline, for fun

The fixes are in the per-repository lines, waving.

## The options, in plain words

A. Leave the closing totals counting PRD pages only (built).
B. Add the fix pages and fix versions to the closing totals.

## What I had to decide

Whether to change the sync command's closing totals, which sit outside this slice's territory, to add the fixes.

## What I did meanwhile

Left the closing totals as they are; the per-repository lines and the report each repository returns carry the fixes in full.

## What it costs to change later

A constant: adding the fix counts to the closing line is two lines in the sync command.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives this slice the fallback's folder only, and the closing line lives in the command that runs it.

```

<!-- /omni-outbox-settled: s3-02-sync-summary-counts-prds-only -->

<!-- omni-outbox-settled: s4-01-push-skill-takes-a-kind -->

## s4-01-push-skill-takes-a-kind — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-push-skill-takes-a-kind
prd: 627
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The two fix skills now send their record to the Omni page through the small skill that sends a PRD's files, which sat outside this piece of work: should it have been changed here?

## The decision, in plain words

Yes: the small sending skill now also takes a fix's kind, the fix skills use it, and the checks that list who uses it and what a visual fix folder may hold were updated to match.

## The intro, for fun

Two fix skills knocked on the door of a skill built for PRDs only.

## The punchline, for fun

It learned one new word, kind, and let them both in.

## The options, in plain words

A. A. Teach the shared sending skill the fix kinds, and have both fix skills follow it (built).
B. B. Leave the sending skill for PRDs only, and have both fix skills run the send command themselves, with the same rules.
C. C. Make a separate small sending skill for fixes.

## What I had to decide

Whether the shared sending skill should learn the fix kinds here, or whether the fix skills should run the send command on their own.

## What I did meanwhile

The sending skill takes an optional kind and says what it sends for a fix; the fix skills follow it with their kind after they push. The skills pages of the docs now list both fix skills among those that run it, the old visual fix check that used a stray notes file now uses a round page, and the note on where the bug fix skill came from gained one line.

## What it costs to change later

Text only: undoing it is rewriting a few lines of two skills and three tests, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gave this piece the two fix skills and the help text, but not the shared sending skill, the docs page tests, the visual check's command test, or the plugin test, all of which had to change for the fix skills to push with a kind.

```

<!-- /omni-outbox-settled: s4-01-push-skill-takes-a-kind -->
