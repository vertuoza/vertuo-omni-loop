# Settled outbox items — PRD 1049

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-ids-stop-at-safe-integers -->

## s1-01-ids-stop-at-safe-integers — adopted

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
id: s1-01-ids-stop-at-safe-integers
prd: 1049
slice: s1
rank: medium
bears-on: none
raised: 2026-10-03
wave: 1
---

## The question, in plain words

Today the tool accepts any string of digits as a number, even one so long the computer can no longer hold it exactly. Should the new identifier checks accept those too?

## The decision, in plain words

The new checks refuse numbers too large to be held exactly, beyond about nine quadrillion. Every real issue, pull request or comment number is far below that.

## The intro, for fun

The spec said every number the old reader takes, and the old reader takes infinity.

## The punchline, for fun

We drew the line a little before infinity.

## The options, in plain words

A. A. Refuse numbers beyond the largest exact whole number, as zod 4's integer check does (built).
B. B. Accept them, matching the old argument reader exactly, including ones that read as infinity.
C. C. Refuse them, and make the old argument reader refuse them too when s5 replaces it.

## What I had to decide

Whether an identifier larger than the largest exact whole number is refused, as built, or accepted as the old argument reader does.

## What I did meanwhile

A number of more than sixteen digits given as an identifier is refused with an error naming it; every realistic identifier reads as before.

## What it costs to change later

Accepting them instead is a one-line change in kit/lib/ids.ts (drop the integer bound zod 4 applies), no data or migration involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec asks the numeric parsers to accept every digit string positiveInt accepts; positiveInt also accepts digit strings beyond Number.MAX_SAFE_INTEGER, even ones that read as Infinity, which zod 4's .int() refuses. The tests check digit strings up to Number.MAX_SAFE_INTEGER. (author)

```

<!-- /omni-outbox-settled: s1-01-ids-stop-at-safe-integers -->

<!-- omni-outbox-settled: s2-01-malformed-ids-read-as-absent -->

## s2-01-malformed-ids-read-as-absent — adopted

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
id: s2-01-malformed-ids-read-as-absent
prd: 1049
slice: s2
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

When the GitHub App reads an identifier that is not a real one, such as pull request number zero or a slice branch whose name holds no slice, should it keep passing that value along or treat it as missing?

## The decision, in plain words

The App now treats such a value as missing: an event naming no real pull request is ignored, a link line naming PRD zero names no PRD, and a branch with no real slice in its name counts as no slice in the retro.

## The intro, for fun

Somebody somewhere might one day open pull request number zero.

## The punchline, for fun

The App now politely pretends it never heard of it.

## The options, in plain words

A. Read a malformed identifier as absent where it enters the App (built).
B. Fail loudly on it, so the run errors and names the value.
C. Keep passing it along unchecked, as before, until a later slice tightens the readers.

## What I had to decide

Whether a malformed identifier reaching the GitHub App (a pull request number of zero or a fraction in a webhook delivery, a link line naming #0, a slice branch whose slice part is not s<n>) is refused where it enters and read as absent, or still passed along as before.

## What I did meanwhile

Each one is read as absent where it enters: the delivery sends no event, the stage event carries no PRD, the canon marker is ignored, and the retro groups that pull request by its number instead of by a slice. GitHub never sends such numbers, and every slice branch the loop cuts is named s<n>, so nothing real changes.

## What it costs to change later

Reading them as before is a few lines in the webhook schema, the stage reader and the two slice readers of the retro; no stored data or migration is involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says runtime behaviour does not change and that a value a schema now refuses fails loudly where it is read; it does not say whether the App's lenient readers (the webhook router, the stage forward, the retro) fail or skip. They always skipped what they could not read, so they skip here too.

```

<!-- /omni-outbox-settled: s2-01-malformed-ids-read-as-absent -->

<!-- omni-outbox-settled: s3-01-fix-dossiers-keep-the-prd-type -->

## s3-01-fix-dossiers-keep-the-prd-type — adopted

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
id: s3-01-fix-dossiers-keep-the-prd-type
prd: 1049
slice: s3
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

A visual or bug fix has a page keyed by its issue's number, kept in the same place a PRD's number is. Should the arcade read that number as a PRD number or as an issue number?

## The decision, in plain words

The arcade reads every page's number as a PRD number, since a PRD number is also an issue number. Only where a fix is looked up on GitHub is it handed over as an issue number.

## The intro, for fun

A fix's page keeps its issue number in the drawer labelled PRD.

## The punchline, for fun

The label stays; the drawer now says what fits in it.

## The options, in plain words

A. Read every dossier's number as a PRD number; a fix's lookup takes it as an issue number (built).
B. Split the dossier row type by kind, a PRD's number for a PRD, an issue number for a fix.

## What I had to decide

The stored dossier row has one number column, `prd`. For a PRD it is the PRD's number; for a visual or bug fix (PRD 627) it is the fix's issue number. The brands ask which kind to read it as.

## What I did meanwhile

Dossier rows are read as `PrdNumber | null`. A push (the dossier API and `DossierPush`) and the lookup `numbered()` take `PrdNumber | IssueNumber`, with the reason beside the type. `FixRef.prd` is an `IssueNumber`; a dossier's `PrdNumber` fits there, since a PRD number is an issue number.

## What it costs to change later

A type change in apps/galaxy only: reading fix rows as `IssueNumber` instead would need a row type per kind (a discriminated union on `kind`), with no stored data or migration touched.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s5's kit-side `dossier push` (`PrdNumber | IssueNumber`) wants the arcade's row type split by kind as well (author).

```

<!-- /omni-outbox-settled: s3-01-fix-dossiers-keep-the-prd-type -->

<!-- omni-outbox-settled: s3-02-slice-named-fields-hold-no-slice-id -->

## s3-02-slice-named-fields-hold-no-slice-id — adopted

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
id: s3-02-slice-named-fields-hold-no-slice-id
prd: 1049
slice: s3
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

Two pieces of information in the arcade are named after a slice but are not a slice's short code: one is the pattern of a slice's branch name, the other a slice's code followed by its title. What should become of them?

## The decision, in plain words

Both stay plain text with their names, since neither holds a slice's code alone. The check the last step of this work adds will notice them, and that step decides whether to rename them.

## The intro, for fun

Two fields answer to the name slice and neither is one.

## The punchline, for fun

They keep their name tags until the bouncer arrives in the last step.

## The options, in plain words

A. Leave both as plain text for s6's guard to settle (built).
B. Rename them now in the arcade after what they hold (a branch pattern, a slice label), leaving the kit's own names to its own step.

## What I had to decide

s6's guard refuses a property named `slice` declared as a bare `string`. In apps/galaxy two such fields hold no `SliceId`: `SyncConfig.branches.slice` (src/stages/sync/core.ts), the `branches.slice` branch shape read from a repository's config, and the `slice` field of Jev's outbox-risk state (src/jev/decisions/outbox-risk.ts), which the decide command writes as `"s3: its title"`. Branch names are out of the PRD's scope, and the state file's shape is the kit's.

## What I did meanwhile

Both left as strings, unchanged. A third false match, `pr` in the business rival suggestions (the product's id), was renamed `product` inside its module, since nothing outside it reads that name.

## What it costs to change later

A rename inside apps/galaxy (and, for the state file, the kit's decide command and its readers): no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s6's guard should exempt a branch shape (the kit's own config schema names `branches.slice` too), or s5/s6 rename the fields (author).

```

<!-- /omni-outbox-settled: s3-02-slice-named-fields-hold-no-slice-id -->

<!-- omni-outbox-settled: s3-03-an-impossible-prd-number-reads-as-none -->

## s3-03-an-impossible-prd-number-reads-as-none — adopted

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
id: s3-03-an-impossible-prd-number-reads-as-none
prd: 1049
slice: s3
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

When a number that no real PRD can have reaches the arcade from a source it reads leniently (a rule's source line, a planet's link, the waiting list), should the arcade fail, or treat it as naming no PRD?

## The decision, in plain words

Those lenient readers treat such a number as naming no PRD, as they already did for text that names none. Stored rows and incoming requests still fail loudly on one, as the plan asks.

## The intro, for fun

Somewhere, a rule claims to come from PRD zero.

## The punchline, for fun

The knowledge map politely pretends it never said that.

## The options, in plain words

A. Lenient readers treat an impossible PRD number as none; strict entry points refuse it (built).
B. Every reader refuses it, so one bad source line hides the whole knowledge map.

## What I had to decide

Some reads were lenient before the brands: the knowledge map's `PRD #<n>` source lines (read bare by the kit), a planet's link `#planet-<n>`, the history filter `?prd=`, and the waiting list's outbox items read in the browser. A branded parse of a number like 0 throws; throwing there would blank the whole knowledge map or break the page for one bad line.

## What I did meanwhile

Those four readers use the schema's safe parse: a number that is not a PRD number reads as none (the map entry shows no PRD, the link opens the map, the filter is dropped, the item is skipped). Rows from Supabase, GitHub payloads, the proof, dossier and stage-event APIs and the short address parse strictly, as the database's own checks (`prd > 0`) already hold.

## What it costs to change later

One line per reader: swapping the safe parse for the throwing one.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s5, when the kit's knowledge reader returns a branded number, keeps the lenient reading (author).

```

<!-- /omni-outbox-settled: s3-03-an-impossible-prd-number-reads-as-none -->

<!-- omni-outbox-settled: s4-01-the-game-borrows-the-kit-id-checks -->

## s4-01-the-game-borrows-the-kit-id-checks — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-the-game-borrows-the-kit-id-checks
prd: 1049
slice: s4
rank: medium
bears-on: none
raised: 2026-10-03
wave: 3
---

## The question, in plain words

The game was written never to borrow code from the delivery tool, so that either can be removed alone. Should it now borrow the tool's new identifier checks, or keep its own copy?

## The decision, in plain words

The game borrows the tool's identifier checks and nothing else of it. Removing the game still leaves the delivery tool untouched, but the game now needs those checks to run.

## The intro, for fun

The game swore it would never borrow a thing from the toolbox next door.

## The punchline, for fun

It now borrows one ruler, and has written that down on the fridge.

## The options, in plain words

A. A. The game imports the kit's ID brands, and only them (built).
B. B. The game keeps a mirrored copy of the brands, as it mirrors the folder name rule.
C. C. The brands move to a shared package both the kit and the game import.

## What I had to decide

Whether the game imports the kit's identifier brands (one small module that depends on zod only), against its own rule that it never imports the kit, or keeps a mirrored copy of them.

## What I did meanwhile

game/ imports kit/lib/ids.ts, as the plan and the spec ask of every package; the two headers that stated the rule (game/sources/parsers.ts, game/dossiers/folders.ts) now say it holds but for the ID brands. Deleting game/ still leaves the delivery layer untouched.

## What it costs to change later

A copy of the brands inside game/ instead: one small file and changed imports in about ten game files, no stored data and no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says ids.ts is importable by every package as narrow.ts is, and the plan gives game/ to s4; it does not say whether the game's own rule (never import the kit, so game/ can be deleted alone) gives way. The rule's direction (deleting game/ touches nothing else) still holds.

```

<!-- /omni-outbox-settled: s4-01-the-game-borrows-the-kit-id-checks -->

<!-- omni-outbox-settled: s4-02-the-game-skips-what-is-no-prd-number -->

## s4-02-the-game-skips-what-is-no-prd-number — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-the-game-skips-what-is-no-prd-number
prd: 1049
slice: s4
rank: medium
bears-on: none
raised: 2026-10-03
wave: 3
---

## The question, in plain words

When the game reads a number that no real PRD can have, such as PRD zero in a spec's list of blockers or in a pull request's link line, should it stop or carry on without it?

## The decision, in plain words

The game carries on without it, as the arcade already does: a blocker or a link that names no real PRD is left out. What GitHub itself answers is still checked strictly.

## The intro, for fun

Somewhere a spec claims to wait for PRD zero.

## The punchline, for fun

The game stopped waiting for it.

## The options, in plain words

A. A. Lenient readers leave out a number that is no PRD number; GitHub's answers parse strictly (built).
B. B. Every reader fails on such a number, so one bad spec line stops the poll.

## What I had to decide

Whether the game's lenient readers (a spec's `blocked-by` list, a merged pull request's `Refs #n` or `Closes #n` link, a delivery folder's number) drop a value that is no PRD number, or fail.

## What I did meanwhile

They drop it, as item s3-03 settled for the arcade: `blocked-by: [0, #985]` reads as [985] (it used to keep 0 and negatives), and `Closes #0` marks no PRD stage (it used to credit PRD 0). The lists GitHub answers (issues, pull requests, bugs) are parsed strictly; GitHub never sends a zero.

## What it costs to change later

One line per reader: the safe parse swapped for the throwing one.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a value a schema now refuses fails loudly where it reads; the game's readers have always skipped what they cannot read (the game's spec, section 8), so they skip here too, following s3-03.

```

<!-- /omni-outbox-settled: s4-02-the-game-skips-what-is-no-prd-number -->

<!-- omni-outbox-settled: s4-03-a-ledger-event-keeps-a-plain-planet -->

## s4-03-a-ledger-event-keeps-a-plain-planet — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-a-ledger-event-keeps-a-plain-planet
prd: 1049
slice: s4
rank: medium
bears-on: none
raised: 2026-10-03
wave: 3
---

## The question, in plain words

Every event in the game's permanent history names its planet by its PRD number, under the name planet. Should that number carry the new PRD type too?

## The decision, in plain words

Not yet: an event's planet stays a plain number, since the arcade builds events itself. The galaxy turns it into a PRD number where it makes a planet of it.

## The intro, for fun

Every planet in the history book is filed under a plain number.

## The punchline, for fun

The librarian checks its badge only at the door of the galaxy.

## The options, in plain words

A. A. Leave planet plain; the galaxy parses it where a planet is made (built).
B. B. Brand the event's planet now, and have s5 or s6 update the arcade's event builder.

## What I had to decide

Whether a ledger event's `planet`, a credit's `planet` and a contributions row's `number` (a PRD or a pull request) take a brand, though s6's guard does not police those names.

## What I did meanwhile

They stay plain numbers. packages/galaxy parses the event's planet into a PrdNumber where it derives a planet (buildGalaxy), so the galaxy view's Planet.prd is branded; the arcade's ledger reader (apps/galaxy load-galaxy.ts) builds events with a plain planet and is outside this slice.

## What it costs to change later

Branding them later is a type change in game/events.ts and packages/galaxy/src/types.ts plus the arcade's event builder; the stored ledger is unchanged, since the schema already refuses anything but a positive whole number.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan brands ID-named fields and GitHub's `number`; it does not say whether a field holding an ID under another name (`planet`) is in scope.

```

<!-- /omni-outbox-settled: s4-03-a-ledger-event-keeps-a-plain-planet -->

<!-- omni-outbox-settled: s5-01-reworks-are-slices-too -->

## s5-01-reworks-are-slices-too — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-reworks-are-slices-too
prd: 1049
slice: s5
rank: medium
bears-on: none
raised: 2026-10-03
wave: 4
---

## The question, in plain words

The plan names its pieces of work s1, s2 and so on, but a rework of a decision and the settling of answers are pieces of work too, with names like fix-s1-01-something or settle. Should the strict s1 shape also cover those?

## The decision, in plain words

We added a second, wider kind for any piece of work: a plan's own s1 always fits it, and so do the names reworks and settling use. Plan tables, decision files and their accounts take that wider kind; the strict s1 kind stays as it was.

## The intro, for fun

The plan said every slice is s-and-a-number, then a rework walked in wearing a longer name.

## The punchline, for fun

We gave the longer names a seat of their own, one row behind the s1s.

## The options, in plain words

A. A wider WorkSliceId for any piece of work, which the strict SliceId fits, and an item id that may carry a rework's name (built).
B. Keep the strict SliceId everywhere and give reworks and settling a reader and a brand of their own.
C. Widen SliceId itself to admit rework and settle names, with no second kind.

## What I had to decide

Whether the slice and item ids the kit reads (plan tables, outbox front matter, accounts, the settled ledger, item new --slice) take the strict SliceId (s1) or a wider kind that also admits a rework (fix-s1-01-…, from branches.rework) and settle.

## What I did meanwhile

kit/lib/ids.ts gained WorkSliceId (lower-case words joined by hyphens) with parseWorkSliceId; SliceId carries both brands so it fits where a WorkSliceId is expected. OutboxItemId admits a rework's name before s<n>-<nn>-<slug> (fix-s1-01-zod-01-crew), as shipped/0100-workspaces' ledger already holds. parsePlanSlices, the item and account front matter and the board give WorkSliceIds, because renderReworkPlan's table is read back through parsePlanSlices and settle accounts are named settle.md. A malformed id (S1, a blank) is still refused where it is read.

## What it costs to change later

Narrowing back to SliceId is a type change in kit/lib/types.ts, kit/lib/inbox/territory.ts and kit/lib/schema/front-matter.ts, plus a separate reader for rework plans; no data changes, since every id on disk already matches both shapes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says parsePlanSlices gives SliceIds and outbox front matter gives an OutboxItemId shaped s<n>-<nn>-<slug>, but the kit already writes rework slices (fix-<item id>), rework items (fix-s1-01-…-01-…) and settle accounts, and a test reads a rework plan back through parsePlanSlices; the spec does not say how those fit.

```

<!-- /omni-outbox-settled: s5-01-reworks-are-slices-too -->

<!-- omni-outbox-settled: s5-02-malformed-ids-fail-where-read -->

## s5-02-malformed-ids-fail-where-read — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-malformed-ids-fail-where-read
prd: 1049
slice: s5
rank: medium
bears-on: none
raised: 2026-10-03
wave: 4
---

## The question, in plain words

Now that the tool knows the exact shape of each kind of identifier, what should it do when a file or a command gives one in the wrong shape?

## The decision, in plain words

Where a person or an agent wrote the value (a plan table, a decision file, a command's argument), the tool now refuses it and names it. Where the tool reads back what it wrote itself (the answers ledger, its own hidden numbering, a folder named 0000), a wrong value is skipped as if absent.

## The intro, for fun

An identifier spelled S1 used to sneak through and fail three rooms later.

## The punchline, for fun

Now it is stopped at the door, politely, with its name read out loud.

## The options, in plain words

A. Refuse what a person or an agent wrote, by name; skip what the kit reads back of its own (built).
B. Refuse every malformed value everywhere, the ledger and the hidden numbering included.
C. Skip every malformed value everywhere, refusing nothing.

## What I had to decide

How each entry parser treats a value its brand refuses: throw (or a usage error) naming it, or read it as absent.

## What I did meanwhile

Refused by name: a plan table id or blocker that is no slice id (parsePlanSlices throws), an outbox item or account whose id or slice is malformed (front matter error), omni item new --slice that is no slice or gives no item id (usage error), a branches.rework template that names no lower-case slice (reworkSliceId throws). Read as absent: a settled.md entry whose id is no item id, a numbering-marker entry whose id is no item id, a PRD folder or knowledge source naming PRD 0, a release note whose prd is 0, a slice branch whose {slice} is no slice id (the status line shows no slice). Every id in this repository's own delivery folder reads as before; the command tests pass unchanged but for how they build values.

## What it costs to change later

Turning any refusal into a skip, or the reverse, is a safeParse versus parse swap at the one reader concerned; nothing is stored differently.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a malformed slice or item id fails where it is read, but not whether reading back the kit's own ledger and hidden markers should stop on one; skipping there keeps old ledgers and comments readable.

```

<!-- /omni-outbox-settled: s5-02-malformed-ids-fail-where-read -->

<!-- omni-outbox-settled: s5-03-id-names-holding-other-things -->

## s5-03-id-names-holding-other-things — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-id-names-holding-other-things
prd: 1049
slice: s5
rank: medium
bears-on: none
raised: 2026-10-03
wave: 4
---

## The question, in plain words

A few places in the tool use an identifier's name for something that is not that identifier: a slot named slice that holds a branch name pattern, and one named prd that holds the name of a label. Should they be renamed, or keep their names and be typed by what they really hold?

## The decision, in plain words

They keep their names and stay plain text, as the earlier pieces of this work did for the same case. The upcoming check that forbids plain identifiers will see them, so it needs to know they are not identifiers.

## The intro, for fun

A field called slice turned out to be a pattern for branch names, not a slice at all.

## The punchline, for fun

We let it keep its name tag and wrote down who it really is.

## The options, in plain words

A. Keep the names, typed by what they hold, and leave them for s6 to settle (built).
B. Rename them now, to names off the guarded list, so no guard ever sees them.
C. Brand them anyway, with a brand for branch templates and one for labels.

## What I had to decide

How to type the kit's fields whose name is on s6's list but whose value is no ID of that kind.

## What I did meanwhile

Left typed as string, by what they hold: the branch templates named slice in kit/lib/ask/context.ts (prdOfBranch's branches), kit/lib/ask/heartbeat.ts (Branches) and kit/lib/board.ts (BoardConfig.branches), following s3-02's precedent for Config['branches'].slice; and CreditLabels.prd in kit/lib/credits/classify.ts, the name of the PRD label. fixVerdict's issue parameter became number (an issue's or a concept's), since omni concept grades through it. Fields named number that hold a question's position, not an ID, stay number.

## What it costs to change later

Renaming any of them is a local rename with no data or output change; teaching s6's guard about templates is a rule in scripts/.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's guard polices names, not what they hold, and says nothing of a name on its list that holds a branch template or a label; s6 has to decide between renaming these and an exception.

```

<!-- /omni-outbox-settled: s5-03-id-names-holding-other-things -->
