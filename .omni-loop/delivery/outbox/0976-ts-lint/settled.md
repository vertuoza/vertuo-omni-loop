# Settled outbox items — PRD 976

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-hook-test-outside-areas -->

## s2-01-hook-test-outside-areas — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-hook-test-outside-areas
prd: 976
slice: s2
rank: medium
bears-on: none
raised: 2026-10-02
wave: 2
---

## The question, in plain words

One test of a local commit check sits outside every area the plan splits the clean-up into, and the linter found two unused names in it. Who clears them?

## The decision, in plain words

The slice that brings the linter in cleared both itself, the same way and with the same result, so no area has to carry a finding it does not own.

## The intro, for fun

Seventeen areas, one map, and a single test file standing in the gap between them.

## The punchline, for fun

It got tidied on the spot rather than given a country of its own.

## The options, in plain words

A. A. The linter's slice clears the two findings in that test itself, three lines, same behaviour.
B. B. Add the folder to an area's ceiling file and let that area's slice clear it.
C. C. Configure the unused-name rule to ignore names dropped while copying the rest of an object.

## What I had to decide

Whether a file outside every area is cleared by the slice that lands the linter, or given an area of its own.

## What I did meanwhile

The test keeps the same environment for the check it runs; only how it drops two settings changed.

## What it costs to change later

A constant: undo the three-line change and add the folder to an area's ceiling file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names no area for the local hooks folder, and says a finding outside every area must fail (author)

```

<!-- /omni-outbox-settled: s2-01-hook-test-outside-areas -->

<!-- omni-outbox-settled: s10-01-retro-ceiling -->

## s10-01-retro-ceiling — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s10
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s10-01-retro-ceiling
prd: 976
slice: s10
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

Giving the App's test helpers their real types also removed fourteen lint findings from the retro's own tests, which belong to a later slice. The retro's counter fails unless its number goes down to match, and that counter sits outside this slice's own files: may the slice lower it?

## The decision, in plain words

The slice lowered the retro's count of lint findings by fourteen, from 438 to 424, so the counter stays exact and the full lint check passes. No retro file was changed.

## The intro, for fun

Tidying the toolbox fixed fourteen squeaks in the neighbour's workshop.

## The punchline, for fun

The neighbour's to-do list just got shorter, and nobody had to knock on the door.

## The options, in plain words

A. A. Lower the retro's ceiling to 424 in this slice, as built.
B. B. Leave the ceiling at 438 for the wave check to lower once this slice merges.
C. C. Keep the helpers loosely typed so the retro's count stays at 438, leaving those findings for the retro's slice.

## What I had to decide

Whether a lint slice may lower another area's ceiling when typing its own shared test helpers removes findings there, or must leave that area's file to its own slice.

## What I did meanwhile

The retro's ceiling reads 424. The retro's own slice, in the next wave, starts from that number and takes it to zero.

## What it costs to change later

One number in one file: putting 438 back costs nothing, but the helpers would have to lose their types again for the count to match.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives each slice one ceiling file and is silent on a slice whose shared test helpers clear findings in another area's files.

```

<!-- /omni-outbox-settled: s10-01-retro-ceiling -->

<!-- omni-outbox-settled: s11-01-arcade-cast-ceiling -->

## s11-01-arcade-cast-ceiling — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s11
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s11-01-arcade-cast-ceiling
prd: 976
slice: s11
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

Clearing the arcade's lint findings also removed two type casts, and the older cast counter fails unless its number for the arcade app goes down to match. That counter sits outside this slice's own files: may the slice lower it?

## The decision, in plain words

The slice lowered the arcade app's cast count by two, from 153 to 151, so the older counter stays exact and the test suite passes.

## The intro, for fun

Two casts walked out of the arcade, and the bouncer at the door insists on updating the head count.

## The punchline, for fun

The tally now matches the room, and nobody had to sneak back in to keep the numbers tidy.

## The options, in plain words

A. A. Lower the arcade app's cast count to 151 in this slice, as built.
B. B. Keep both casts and leave the count at 153: the linter would then still report the needless one, so the arcade could not reach zero.
C. C. Leave the count to the wave check, which lowers it once after every arcade slice has merged.

## What I had to decide

Whether a lint slice may lower the shared cast count of the app it clears when a fix removes a cast, or must keep the cast to stay inside its own files.

## What I did meanwhile

The arcade app's cast count reads 151. Other arcade slices of this wave that remove casts lower the same number; the wave merges them one at a time, each conflict on that one line settled by taking the lower count.

## What it costs to change later

One number in one file: putting 153 back costs nothing, but the two casts would have to come back with it, and one of them is a finding the linter refuses.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names one lint ceiling file per area and is silent on the older cast counter from PRD 942, which counts by app, not by area. (author)

```

<!-- /omni-outbox-settled: s11-01-arcade-cast-ceiling -->

<!-- omni-outbox-settled: s12-01-arcade-cast-ceiling -->

## s12-01-arcade-cast-ceiling — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s12
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s12-01-arcade-cast-ceiling
prd: 976
slice: s12
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

Clearing the PRD page's findings removed two type escapes the earlier clean-up had counted, and that count lives in a shared file outside this slice's ground. Who lowers it?

## The decision, in plain words

This slice lowered the arcade's count of type escapes by the two it removed, so the existing check stays exact and green.

## The intro, for fun

Two escape hatches were sealed, and the ledger that counts them sits on someone else's desk.

## The punchline, for fun

The slice wrote the new number down itself rather than leave the ledger wrong.

## The options, in plain words

A. This slice lowers the arcade's type-escape count by the two escapes it removed.
B. Keep the two removed escapes as they were, leaving two lint findings in this area.
C. Leave the count as it was and let the wave's merge lower it once for every slice.

## What I had to decide

Whether a slice may lower the arcade's shared count of type escapes when its own fixes remove some, though that file is outside its ground.

## What I did meanwhile

The arcade's count in the type-escape ceiling file went from 153 to 151; nothing else in that file changed.

## What it costs to change later

A constant: one number in one file. Sibling slices of the same wave that remove escapes lower the same line, so merging them one by one may need that number recomputed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives each slice its own lint ceiling file, but names no owner for the older type-escape ceiling file, which fails below its count as well as above (author)

```

<!-- /omni-outbox-settled: s12-01-arcade-cast-ceiling -->

<!-- omni-outbox-settled: s13-01-data-nav-ceiling -->

## s13-01-data-nav-ceiling — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s13
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s13-01-data-nav-ceiling
prd: 976
slice: s13
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

Fixing the sign-up test helper this slice owns also cleared nine warnings in the sign-in tests of another slice's area, whose count lives in that slice's file. Who writes the new count?

## The decision, in plain words

This slice lowered the other area's count by the nine warnings its fix cleared, so the shared check stays exact and green; the sibling slice clearing that area will set it to zero anyway.

## The intro, for fun

One fix in our yard tidied nine weeds in the neighbour's garden.

## The punchline, for fun

We wrote the neighbour's new weed count on their gate, in pencil.

## The options, in plain words

A. A. This slice lowers the data and navigation count by the nine warnings its fix cleared.
B. B. Keep the sign-up test helper as it was, leaving those nine warnings for the sibling slice to clear from outside its own ground.
C. C. Leave the count as it was and let the wave's merge set it once for every slice.

## What I had to decide

Whether a slice may lower a sibling area's lint count when its own fix, inside its own ground, clears findings there.

## What I did meanwhile

The data and navigation area's ceiling went from 436 to 427; nothing else in that file changed.

## What it costs to change later

A constant: one number in one file. The sibling slice clearing that area edits the same line, so the merge may need it recomputed (to 0 once that slice lands).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives each slice its own ceiling file and says nothing of a fix in one area clearing findings in another (author)

```

<!-- /omni-outbox-settled: s13-01-data-nav-ceiling -->

<!-- omni-outbox-settled: s14-01-arcade-cast-ceiling -->

## s14-01-arcade-cast-ceiling — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s14
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s14-01-arcade-cast-ceiling
prd: 976
slice: s14
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

Clearing the business settings page's findings removed ten type escapes the earlier clean-up had counted, and that count lives in a shared file outside this slice's ground. Who lowers it?

## The decision, in plain words

This slice lowered the arcade's count of type escapes by the ten it removed, so the existing check stays exact and green.

## The intro, for fun

Ten escape hatches were sealed, and the ledger that counts them sits on someone else's desk.

## The punchline, for fun

The slice wrote the new number down itself rather than leave the ledger wrong.

## The options, in plain words

A. This slice lowers the arcade's type-escape count by the ten escapes it removed.
B. Keep the ten removed escapes as they were, leaving ten lint findings in this area.
C. Leave the count as it was and let the wave's merge lower it once for every slice.

## What I had to decide

Whether a slice may lower the arcade's shared count of type escapes when its own fixes remove some, though that file is outside its ground.

## What I did meanwhile

The arcade's count in the type-escape ceiling file went from 149 to 139; nothing else in that file changed.

## What it costs to change later

A constant: one number in one file. Sibling slices of the same wave that remove escapes lower the same line, so merging them one by one may need that number recomputed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives each slice its own lint ceiling file, but names no owner for the older type-escape ceiling file, which fails below its count as well as above (author)

```

<!-- /omni-outbox-settled: s14-01-arcade-cast-ceiling -->

<!-- omni-outbox-settled: s15-01-arcade-cast-ceiling -->

## s15-01-arcade-cast-ceiling — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s15
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s15-01-arcade-cast-ceiling
prd: 976
slice: s15
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

Clearing the dashboard's and Jev's findings removed five type escapes the earlier clean-up had counted, and that count lives in a shared file outside this slice's ground. Who lowers it?

## The decision, in plain words

This slice lowered the arcade's count of type escapes by the five it removed, so the existing check stays exact and green.

## The intro, for fun

Five escape hatches were sealed, and the ledger that counts them sits on someone else's desk.

## The punchline, for fun

The slice wrote the new number down itself rather than leave the ledger wrong.

## The options, in plain words

A. This slice lowers the arcade's type-escape count by the five escapes it removed.
B. Keep the five removed escapes as they were, leaving lint findings in this area.
C. Leave the count as it was and let the wave's merge lower it once for every slice.

## What I had to decide

Whether a slice may lower the arcade's shared count of type escapes when its own fixes remove some, though that file is outside its ground.

## What I did meanwhile

The arcade's count in the type-escape ceiling file went down by five, from 149 to 144, and to 134 once the siblings merged before it were merged in; nothing else in that file changed.

## What it costs to change later

A constant: one number in one file. Sibling slices of the same wave that remove escapes lower the same line, so merging them one by one may need that number recomputed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives each slice its own lint ceiling file, but names no owner for the older type-escape ceiling file, which fails below its count as well as above (author)

```

<!-- /omni-outbox-settled: s15-01-arcade-cast-ceiling -->

<!-- omni-outbox-settled: s16-01-arcade-cast-ceiling -->

## s16-01-arcade-cast-ceiling — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s16
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s16-01-arcade-cast-ceiling
prd: 976
slice: s16
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

Clearing the data and navigation findings removed two type escapes the earlier clean-up had counted, and that count lives in a shared file outside this slice's ground. Who lowers it?

## The decision, in plain words

This slice lowered the arcade's count of type escapes by the two it removed, so the existing check stays exact and green.

## The intro, for fun

Two more escape hatches were sealed, and their ledger still sits on someone else's desk.

## The punchline, for fun

The slice wrote the new number down itself rather than leave the ledger wrong.

## The options, in plain words

A. This slice lowers the arcade's type-escape count by the two escapes it removed.
B. Keep the two removed escapes as they were, leaving two lint findings in this area.
C. Leave the count as it was and let the wave's merge lower it once for every slice.

## What I had to decide

Whether a slice may lower the arcade's shared count of type escapes when its own fixes remove some, though that file is outside its ground.

## What I did meanwhile

The arcade's count in the type-escape ceiling file went from 134 to 132 (149 to 147 before the wave's earlier merges); nothing else in that file changed.

## What it costs to change later

A constant: one number in one file. Sibling slices of the same wave that remove escapes lower the same line, so merging them one by one may need that number recomputed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives each slice its own lint ceiling file, but names no owner for the older type-escape ceiling file, which fails below its count as well as above (author)

```

<!-- /omni-outbox-settled: s16-01-arcade-cast-ceiling -->

<!-- omni-outbox-settled: s16-02-unparsed-answers -->

## s16-02-unparsed-answers — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s16
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s16-02-unparsed-answers
prd: 976
slice: s16
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

The database's answers are trusted by their declared shape, so the linter calls the arcade's safety checks on them useless. Should those checks go, or stay?

## The decision, in plain words

The checks stay. Each answer is read through three small helpers that take it as it really comes, possibly empty or of any kind, so every check keeps doing its job and nothing the arcade shows changes.

## The intro, for fun

The linter swore the database always tells the truth, and the arcade kept its seatbelt on anyway.

## The punchline, for fun

Three tiny helpers now say out loud what the arcade always quietly assumed.

## The options, in plain words

A. Read each unparsed answer through small helpers that widen it, keeping every check.
B. Parse every answer with a schema per table, which is more code and new failure messages.
C. Delete the checks the declared shape says are useless, which the spec forbids.

## What I had to decide

How to clear the linter's 'this check can never fail' findings on answers read from the database without parsing them, when the rules forbid deleting a check on the type's word alone.

## What I did meanwhile

A new data helper module reads a list that may be missing, a number and a text from an unparsed answer; the reads in the data, home and stages folders go through it, and a few rows are widened where they are read.

## What it costs to change later

A constant: the helpers are three one-line functions; a schema per table could replace them later, call by call.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the database's answers should instead be parsed by a schema at each read is not settled by the spec, which allows either widening or parsing (author)

```

<!-- /omni-outbox-settled: s16-02-unparsed-answers -->

<!-- omni-outbox-settled: s16-03-fake-people-list -->

## s16-03-fake-people-list — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s16
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s16-03-fake-people-list
prd: 976
slice: s16
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

The test stand-in for the database takes a list of people that it never reads, and the linter flags it. Remove it, though tests in other slices' ground still pass it?

## The decision, in plain words

The list stays accepted but is plainly documented as read by nothing, so no test outside this slice had to change and nothing a test checks moved.

## The intro, for fun

A guest list was handed to the doorman at every test, and he never once looked at it.

## The punchline, for fun

He still takes it politely, and now the sign says he does not read it.

## The options, in plain words

A. Keep the list accepted and documented as unread, editing no test outside this slice.
B. Remove the list and edit every test that passes it, across other slices' ground.
C. Make the stand-in refuse anyone not on the list, which changes what the tests check.

## What I had to decide

Whether to remove the unused people list from the test stand-in for the database, which would mean editing tests in other slices' ground.

## What I did meanwhile

The stand-in's signature keeps an optional people list as part of its declared type only; its body takes just the seed tables.

## What it costs to change later

A constant: dropping the list later means deleting one argument from about twenty test calls, in one change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the list was meant to be used, for instance to refuse a client for someone it does not name, is not written anywhere (author)

```

<!-- /omni-outbox-settled: s16-03-fake-people-list -->

<!-- omni-outbox-settled: s17-01-sidebar-name -->

## s17-01-sidebar-name — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s17
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s17-01-sidebar-name
prd: 976
slice: s17
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

When a page of the guide is named by something other than plain text, should its link in the guide's side menu keep showing the odd placeholder it showed before, or show no name?

## The decision, in plain words

Such a name now shows as empty, the way the tool already reads any value that is not text. Every page of the guide today is named by plain text, so nothing a reader sees changes.

## The intro, for fun

A page of the guide could, in theory, be named by a picture instead of a word.

## The punchline, for fun

The side menu now leaves that link blank rather than printing the picture's packaging.

## The options, in plain words

A. Show a page name that is not text as empty, as the tool reads any value that is not text.
B. Keep writing such a name out as before, through a helper that stringifies whatever it is given.
C. Render such a name as the React node it is, so the side menu could show a styled name.

## What I had to decide

How `sidebarItems` in apps/galaxy/src/docs/tree.ts writes a page's name, where `String(node.name)` would write a page tree name that is not text (fumadocs types it as any React node) out as `[object Object]`, and the linter refuses that stringification.

## What I did meanwhile

`sidebarItems` reads the name through `plainText` (kit/lib/outbox/plain-text.ts, the helper item s4-01-outside-text settled on): text as it is, a number written out, anything else as ''. The guide's names all come from its pages' titles, which are text, so every link reads exactly as before.

## What it costs to change later

One line in apps/galaxy/src/docs/tree.ts: writing a non-text name out again, or rendering it as a React node, is a change to that line alone.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a fix changes no output; it does not say what a page name that is not text should show as, the one case where the output moves, and no page of the guide has such a name today.

```

<!-- /omni-outbox-settled: s17-01-sidebar-name -->

<!-- omni-outbox-settled: s17-02-arcade-cast-ceiling -->

## s17-02-arcade-cast-ceiling — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s17
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s17-02-arcade-cast-ceiling
prd: 976
slice: s17
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

Clearing the findings in engineering, agent connect, the outbox, the knowledge map, repositories, the waiting list and the guide removed fourteen type escapes the earlier clean-up had counted, and that count lives in a shared file outside this slice's ground. Who lowers it?

## The decision, in plain words

This slice lowered the arcade's count of type escapes by the fourteen it removed, so the existing check stays exact and green.

## The intro, for fun

Fourteen escape hatches were sealed, and the ledger that counts them sits on someone else's desk.

## The punchline, for fun

The slice wrote the new number down itself rather than leave the ledger wrong.

## The options, in plain words

A. This slice lowers the arcade's type-escape count by the fourteen escapes it removed.
B. Keep the fourteen removed escapes as they were, leaving lint findings in this area.
C. Leave the count as it was and let the wave's merge lower it once for every slice.

## What I had to decide

Whether a slice may lower the arcade's shared count of type escapes in scripts/typescript-ceilings.json when its own fixes remove some, though that file is outside its ground.

## What I did meanwhile

The arcade's count in scripts/typescript-ceilings.json went down by fourteen, from 134 to 120, and to 113 once the feature branch, with seven fewer from its sibling slices, was merged in; nothing else in that file changed.

## What it costs to change later

A constant: one number in one file. Sibling slices of the same wave that remove escapes lower the same line, so merging them one by one may need that number recomputed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives each slice its own lint ceiling file, but names no owner for the older type-escape ceiling file, which fails below its count as well as above.

```

<!-- /omni-outbox-settled: s17-02-arcade-cast-ceiling -->

<!-- omni-outbox-settled: s18-01-arcade-cast-ceiling -->

## s18-01-arcade-cast-ceiling — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s18
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s18-01-arcade-cast-ceiling
prd: 976
slice: s18
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

Clearing the rest of the arcade's findings removed five type escapes the earlier clean-up had counted, and that count lives in a shared file outside this slice's ground. Who lowers it?

## The decision, in plain words

This slice lowered the arcade's count of type escapes by the five it removed, so the existing check stays exact and green.

## The intro, for fun

Five more escape hatches were sealed, and their ledger still sits on someone else's desk.

## The punchline, for fun

The slice wrote the new number down itself rather than leave the ledger wrong.

## The options, in plain words

A. This slice lowers the arcade's type-escape count by the five escapes it removed.
B. Keep the five removed escapes as they were, leaving lint findings in this area.
C. Leave the count as it was and let the wave's merge lower it once for every slice.

## What I had to decide

Whether a slice may lower the arcade's shared count of type escapes when its own fixes remove some, though that file is outside its ground.

## What I did meanwhile

The arcade's count in the type-escape ceiling file went from 132 to 127; nothing else in that file changed. The five came from the sign-in callback, the dock's invaders game, the release sync and the release weeks and rows.

## What it costs to change later

A constant: one number in one file. Sibling slices of the same wave that remove escapes lower the same line, so merging them one by one may need that number recomputed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives each slice its own lint ceiling file, but names no owner for the older type-escape ceiling file, which fails below its count as well as above (author)

```

<!-- /omni-outbox-settled: s18-01-arcade-cast-ceiling -->

<!-- omni-outbox-settled: s3-01-kit-cast-ceiling -->

## s3-01-kit-cast-ceiling — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-kit-cast-ceiling
prd: 976
slice: s3
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

Clearing the command line tool's findings removed seven type escapes the earlier clean-up had counted, and that count lives in a shared file outside this slice's ground. Who lowers it?

## The decision, in plain words

This slice lowered the tool's count of type escapes by the seven it removed, so the existing check stays exact and green.

## The intro, for fun

Seven escape hatches were sealed, and the ledger that counts them sits on someone else's desk.

## The punchline, for fun

The slice wrote the new number down itself rather than leave the ledger wrong.

## The options, in plain words

A. A. This slice lowers the tool's type-escape count by the seven escapes it removed.
B. B. Keep the seven removed escapes as they were, leaving seven lint findings in this area.
C. C. Leave the count as it was and let the wave's merge lower it once for every slice.

## What I had to decide

Whether a slice may lower the tool's shared count of type escapes when its own fixes remove some, though that file is outside its ground.

## What I did meanwhile

The tool's count in the type-escape ceiling file went from 38 to 31; nothing else in that file changed.

## What it costs to change later

A constant: one number in one file. Sibling slices of the same wave that remove escapes in the same area lower the same line, so merging them one by one may need that number recomputed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives each slice its own lint ceiling file, but names no owner for the older type-escape ceiling file, which fails below its count as well as above.

```

<!-- /omni-outbox-settled: s3-01-kit-cast-ceiling -->

<!-- omni-outbox-settled: s4-01-outside-text -->

## s4-01-outside-text — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-outside-text
prd: 976
slice: s4
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

When a reply, an answer or a path reaches the tool as something other than plain text, should the tool keep writing it out as the odd placeholder it produced before, or treat it as empty?

## The decision, in plain words

Such a value is now read as empty, so the tool refuses or ignores it instead of writing a meaningless placeholder into a reply, an account or a check.

## The intro, for fun

Somebody handed the tool a box where it expected a word.

## The punchline, for fun

It now says the box is empty instead of reading the label on the lid.

## The options, in plain words

A. Read a value that is not text, a number or a boolean as empty, so it is refused or ignored.
B. Keep writing such a value out as before, through a helper that stringifies whatever it is given.
C. Refuse such a value with a named error wherever it reaches the tool.

## What I had to decide

How kit/lib/outbox and kit/lib/policy read a value handed in from outside as text, where `String(value ?? '')` wrote an object out as `[object Object]` and the linter refuses that stringification.

## What I did meanwhile

`plainText` in `kit/lib/outbox/plain-text.ts` reads a string as it is, a number or a boolean written out, and anything else as ''. It replaces `String(value ?? '')` in `cleanLine`, `parseReplyLines`, `interpretAnswer`, phase-0's `normalize`, `beforeAfterHandoff` and the account renderer's id or where. Text, numbers and nothing read exactly as before.

## What it costs to change later

One function, `plainText` in `kit/lib/outbox/plain-text.ts`: making it write an object out again changes every caller at once.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a value from outside is widened or parsed, and that a fix changes no output; it does not say what a value that is neither text, a number nor nothing should read as, the one case where the output moves.

```

<!-- /omni-outbox-settled: s4-01-outside-text -->

<!-- omni-outbox-settled: s5-01-kit-cast-ceiling -->

## s5-01-kit-cast-ceiling — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-kit-cast-ceiling
prd: 976
slice: s5
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

Clearing the rest of the tool's library removed twelve type escapes the earlier clean-up had counted, and that count lives in a shared file outside this slice's ground. Who lowers it?

## The decision, in plain words

This slice lowered the tool's count of type escapes by the twelve it removed, so the existing check stays exact and green, as the first slice of this wave did.

## The intro, for fun

Twelve more escape hatches were sealed, and the ledger that counts them still sits on someone else's desk.

## The punchline, for fun

The slice wrote the new number down itself, the same way its sibling did.

## The options, in plain words

A. This slice lowers the tool's type-escape count by the twelve escapes it removed.
B. Keep the twelve removed escapes as they were, leaving twelve lint findings in this area.
C. Leave the count as it was and let the wave's merge lower it once for every slice.

## What I had to decide

Whether a slice may lower the tool's shared count of type escapes when its own fixes remove some, though that file is outside its ground.

## What I did meanwhile

The tool's count in the type-escape ceiling file went from 31 to 19; nothing else in that file changed.

## What it costs to change later

A constant: one number in one file. A sibling slice of the same wave that removes escapes in the same area lowers the same line, so merging them one by one may need that number recomputed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives each slice its own lint ceiling file, but names no owner for the older type-escape ceiling file, which fails below its count as well as above.

```

<!-- /omni-outbox-settled: s5-01-kit-cast-ceiling -->

<!-- omni-outbox-settled: s6-01-design-uses-kit-narrow -->

## s6-01-design-uses-kit-narrow — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-design-uses-kit-narrow
prd: 976
slice: s6
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

The drawing library behind the arcade's sprites and logo had to stop assuming a colour or a shape is always there. Should it borrow the toolkit's existing checks for that, or carry its own copy?

## The decision, in plain words

The drawing library now uses the toolkit's own checks, so a missing colour or shape stops with a clear message naming it, the same way everywhere else.

## The intro, for fun

The paint box asked to borrow the toolkit's ruler.

## The punchline, for fun

It said yes, and now both measure the same way.

## The options, in plain words

A. The drawing library borrows the toolkit's two checks directly.
B. The drawing library names the toolkit as a dependency first, then borrows the checks by name, as the galaxy map does.
C. The drawing library keeps its own copy of the two checks and never depends on the toolkit.

## What I had to decide

packages/design imported nothing from the kit before; clearing its `!` assertions in source needed `defined` and `at`, which the spec places in kit/lib/narrow.ts, while packages/design declares no dependency on the root package.

## What I did meanwhile

packages/design/src (draw, forge, sprites, heroes, logo, personas, fonts) imports `at` and `defined` from `../../../kit/lib/narrow.ts` by relative path, the way scripts/ already imports kit/lib. The arcade already compiles that file (it imports it as `vertuo-omni-plan/kit/lib/narrow.ts`); its typecheck, the tests and `pnpm lint` are green.

## What it costs to change later

A constant: seven import lines, which can point at a copy of the two helpers inside packages/design instead, or at the root package by name once packages/design declares it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The architecture playbook names no rule on what packages/ may depend on; I read the spec's `defined` and `at` in kit/lib/narrow.ts as binding on every source folder.

```

<!-- /omni-outbox-settled: s6-01-design-uses-kit-narrow -->

<!-- omni-outbox-settled: s6-02-galaxy-contract-checks-nothing -->

## s6-02-galaxy-contract-checks-nothing — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-galaxy-contract-checks-nothing
prd: 976
slice: s6
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

The check meant to keep the galaxy map's published description in step with the code behind it turns out to compare the code with itself. Should this work repair it, or leave it for a change of its own?

## The decision, in plain words

It is left as it was, and reported here. Repairing it shows the description and the code already disagree on three experience functions, which is a change of its own.

## The intro, for fun

A guard was set to watch the door, and turned to watch a mirror instead.

## The punchline, for fun

It has reported no stranger since the day it was hired.

## The options, in plain words

A. Leave the check as it is and report it; repair it in a change of its own.
B. Repair it here, and make the published description of the three experience functions match the code.
C. Drop the hand-written description and its check, and publish the code's own description instead.

## What I had to decide

Clearing the lint parse error on packages/galaxy/src/index.d.ts showed why the project service missed it: TypeScript drops a .d.ts that sits beside its .ts, and `import type * as Contract from './index.d.ts'` in contract.test.ts resolves to index.ts. A declaration changed on purpose (levelFor taking a string) still typechecks, so the contract test proves nothing. Renamed to contract.d.ts it becomes real, and `pnpm typecheck` then fails: experience, playerXp and borrowedXp are declared over LedgerEvent (type: string) while the sources take the game's GameEvent.

## What I did meanwhile

index.d.ts and contract.test.ts are unchanged. eslint.config.ts reads index.d.ts with the root tsconfig's options (allowDefaultProject), so `pnpm lint` parses it and finds nothing. The drift is not fixed: no output changes either way, but the fix touches the arcade's contract (a settled PRD 725 item) and its callers in apps/galaxy/src/data, another slice's ground.

## What it costs to change later

A constant to undo here. The repair is a small typed change: rename the declaration file, then declare the three functions over the game's event type, or have them take LedgerEvent through one marked cast as buildGalaxy does.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Settled item s24 of PRD 725 chose index.d.ts as the arcade's contract; it does not say what the three experience functions should accept.

```

<!-- /omni-outbox-settled: s6-02-galaxy-contract-checks-nothing -->

<!-- omni-outbox-settled: s6-03-two-edits-outside-territory -->

## s6-03-two-edits-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-03-two-edits-outside-territory
prd: 976
slice: s6
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

Clearing this slice's folders needed two small edits in files other slices own. Should they go in here, or wait for those slices?

## The decision, in plain words

Both went in here, each kept to a few lines, so the folders reach zero without waiting.

## The intro, for fun

Tidying one room meant moving a chair in the hallway.

## The punchline, for fun

The chair stands where it stood, only facing the right way.

## The options, in plain words

A. Make both edits here, kept minimal, and say so.
B. Leave the fake server loosely typed and the unreadable file counted, for the owning slices to clear.
C. Reopen the owning slices to make the edits there.

## What I had to decide

Typing the fake ask server's bodies as unknown broke kit/bin/business.test.ts (s3's area), whose handler type accepted a `(repo: string)` function only because `Json` was `any`. And packages/galaxy/src/index.d.ts could not be parsed by the linter's project service, which only eslint.config.ts (s2's file) can change.

## What I did meanwhile

kit/bin/business.test.ts's Checkout type names what each handler receives (`business` the repository, `cite` and `claim` the body) and drops the Json import. eslint.config.ts gives the project service `allowDefaultProject: ['packages/galaxy/src/index.d.ts']` with `defaultProject: 'tsconfig.json'`. Both areas still lint at zero.

## What it costs to change later

A constant: two lines in business.test.ts and five in eslint.config.ts, each revertable on its own.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives each slice its territory and says a change outside it is a decision; it does not say whether one is welcome once the owning slice has merged.

```

<!-- /omni-outbox-settled: s6-03-two-edits-outside-territory -->

<!-- omni-outbox-settled: s6-04-supabase-hint-not-text -->

## s6-04-supabase-hint-not-text — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-04-supabase-hint-not-text
prd: 976
slice: s6
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

When the database refuses an import of personas, the tool repeats the database's hint. If that hint ever came back as something other than text, should the tool print a meaningless placeholder, or leave the hint out?

## The decision, in plain words

It leaves such a hint out. A hint that is text, as every hint the database sends today is, prints exactly as before.

## The intro, for fun

The database left a note, folded into a paper plane.

## The punchline, for fun

The tool now reads notes, not paper planes.

## The options, in plain words

A. Read a hint that is not text as no hint, as item s4-01 does for the outbox.
B. Print it written out in full, so a hint of another shape is still shown.
C. Keep printing it as before, placeholder included.

## What I had to decide

scripts/personas-import.ts wrote the refusal's hint with `String(body.hint)`, which prints an object as `[object Object]`, and the linter refuses that (no-base-to-string). Any fix moves that one output.

## What I did meanwhile

The hint is read through `plainText` (kit/lib/outbox/plain-text.ts, from item s4-01): a truthy text, number or boolean prints as before, and anything else reads as no hint.

## What it costs to change later

A constant: one line in scripts/personas-import.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Supabase documents its hint as text or null; nothing says what a hint of another shape should print.

```

<!-- /omni-outbox-settled: s6-04-supabase-hint-not-text -->

<!-- omni-outbox-settled: s9-01-app-cast-ceiling -->

## s9-01-app-cast-ceiling — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s9
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-01-app-cast-ceiling
prd: 976
slice: s9
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

Clearing the App's lint findings also removed two type escape hatches from a test helper, and the older counter of those escape hatches fails unless its number for the App goes down to match. That counter sits outside this slice's own files: may the slice lower it?

## The decision, in plain words

The slice lowered the App's count of escape hatches by two, from 26 to 24, so the older counter stays exact and the test suite passes.

## The intro, for fun

Two escape hatches were bricked up in the App, and the building inspector wants the floor plan redrawn.

## The punchline, for fun

The plan now shows two fewer doors, and nobody has to reopen one to keep the drawing honest.

## The options, in plain words

A. Lower the App's count to 24 in this slice, as built.
B. Keep both escape hatches and leave the count at 26: the linter would then still report them, so the App's area could not reach zero.
C. Leave the count to the wave check, which lowers it once after every App slice has merged.

## What I had to decide

Whether a lint slice may lower the shared escape-hatch count of the App it clears when a fix removes one, or must keep it to stay inside its own files.

## What I did meanwhile

The App's count reads 24. Other App slices that remove escape hatches lower the same number; the wave merges them one at a time, each conflict on that one line settled by taking the lower count.

## What it costs to change later

One number in one file: putting 26 back costs nothing, but the two escape hatches would have to come back with it, and both are findings the linter refuses.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names one lint ceiling file per area and is silent on the older escape-hatch counter from PRD 942, which counts by app, not by area. (author)

```

<!-- /omni-outbox-settled: s9-01-app-cast-ceiling -->
