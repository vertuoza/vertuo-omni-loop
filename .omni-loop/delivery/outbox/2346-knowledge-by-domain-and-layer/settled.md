# Settled outbox items — PRD 2346

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-guide-page-tests -->

## s1-01-guide-page-tests — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-21
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-21
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-guide-page-tests
prd: 2346
slice: s1
rank: medium
bears-on: none
raised: 2026-10-21
wave: 1
---

## The question, in plain words

Adding the Knowledge map page to the guide changed the page count that two docs tests of the site hold. Should the slice have updated them?

## The decision, in plain words

The slice updated the page lists and counts in the two docs tests of the site so they include the new page, instead of leaving them red.

## The intro, for fun

A new page walks into the guide and every counter has to shuffle along.

## The punchline, for fun

Somebody had to move the chairs.

## The options, in plain words

A. A. Update the two docs test files to hold the new page (built).
B. B. Leave the test files alone and let the next slice that owns them update them, with the checks red meanwhile.

## What I had to decide

Edit the page list, titles, next links and counts in the two docs test files, nothing else.

## What I did meanwhile

The tests list the new page after Repository flow, its Next link pointing at Design craft.

## What it costs to change later

Moving the page, or renaming it, is one line in the guide's meta file and the same lines in the tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the page belongs after Repository flow or elsewhere in the guide order (author).

```

<!-- /omni-outbox-settled: s1-01-guide-page-tests -->

<!-- omni-outbox-settled: s5-01-outside-territory-role-fixtures -->

## s5-01-outside-territory-role-fixtures — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-21
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-21
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-outside-territory-role-fixtures
prd: 2346
slice: s5
rank: medium
bears-on: none
raised: 2026-10-21
wave: 2
---

## The question, in plain words

Two test files outside this slice's list held old role words that the new rule refuses, so they were updated to the new words. Are you fine with that?

## The decision, in plain words

The database check for repository links and the test for the targets command used old role words such as back-end. Once only the nine new roles are accepted, they would fail, so they now use new words and gained a case for an old word.

## The intro, for fun

The old role names were still on the guest list after the door policy changed.

## The punchline, for fun

The tests have been given new badges.

## The options, in plain words

A. A. Update the two files in this slice (built).
B. B. Leave them and let a later slice or person fix them, with the checks red meanwhile.

## What I had to decide

Updated supabase/checks/product_repositories.sql and kit/bin/commands/targets.test.ts to canonical roles, and added a case for a refused new role, an accepted null and a kept old role.

## What I did meanwhile

Every other test and check is untouched; the two files only changed role words and gained cases for the new rule.

## What it costs to change later

Reverting means putting the old role words back in both files, which also reverts the rule they test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The supabase checks could not be run here: no local database was available, so the new SQL check cases are unproven until CI runs them.

```

<!-- /omni-outbox-settled: s5-01-outside-territory-role-fixtures -->
