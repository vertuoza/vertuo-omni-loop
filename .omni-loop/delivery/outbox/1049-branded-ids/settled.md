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
