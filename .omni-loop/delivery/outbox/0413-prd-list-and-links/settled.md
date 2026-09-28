# Settled outbox items — PRD 413

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-s1-tests-outside-territory -->

## s1-01-s1-tests-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-s1-tests-outside-territory
prd: 413
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Adding PRDs to the menu changed what two other pages' tests expect to see in the top bar. Should this slice update those tests itself, even though they belong to other parts of the app?

## The decision, in plain words

Yes. This slice updated the two tests so they expect PRDs in the menu, and no longer the old All PRDs link, and changed nothing else in those parts of the app.

## The intro, for fun

One new menu item, and two pages' tests noticed the new neighbour.

## The punchline, for fun

We told them it was invited.

## The options, in plain words

A. The menu slice updates every test the menu change breaks, wherever it lives (built).
B. Leave those tests red and let the slices that own those files fix them.
C. Widen the plan's territory for the menu slice to name those test files.

## What I had to decide

Whether the menu slice may fix the tests of the pages that show the menu, or whether each owner should.

## What I did meanwhile

The two tests expect PRDs in the menu and no All PRDs link; the full test run is green apart from one failure that already exists on the default branch.

## What it costs to change later

Undoing it is reverting two test lines; if another slice edits the same test file, the merge may need a small hand fix.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan meant territory to cover the tests a change breaks elsewhere is not written down (author).

```

<!-- /omni-outbox-settled: s1-01-s1-tests-outside-territory -->

<!-- omni-outbox-settled: s2-01-empty-mine-under-filters -->

## s2-01-empty-mine-under-filters — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-empty-mine-under-filters
prd: 413
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When a person looks at their own PRDs with a filter set, and nothing of theirs matches, what should the page say?

## The decision, in plain words

It says that no PRD matches, as it does today, and adds a link to the same search across every PRD of the workspace. The message saying they have not opened any PRD shows only when no filter is set.

## The intro, for fun

Nothing of yours matches, but maybe you have opened PRDs after all.

## The punchline, for fun

So the page stays honest and still points you to everyone else's.

## The options, in plain words

A. No match, plus a link to All with the same filters. Honest when the person has PRDs that the filter hides.
B. Always say the person has not opened a PRD yet, one message that is untrue when a filter hides their PRDs.

## What I had to decide

Which message an empty list of your own PRDs shows when a filter is also set.

## What I did meanwhile

No match plus a link to All with the same filters; the 'You have not opened a PRD yet.' card only when no filter is set.

## What it costs to change later

Swapping the message is one condition in the list page and one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the empty-Mine message but not the case where other filters are also set (author).

```

<!-- /omni-outbox-settled: s2-01-empty-mine-under-filters -->

<!-- omni-outbox-settled: s4-01-help-entry-lacks-link -->

## s4-01-help-entry-lacks-link — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-help-entry-lacks-link
prd: 413
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

The built-in help for the dossier command still lists only open, push and status. Should it also describe the new way to print a PRD's link?

## The decision, in plain words

The new command works and its own error message names it, but the built-in help text was left as it was, because that file belongs to no slice of this PRD.

## The intro, for fun

A new trick was taught, but nobody updated the manual yet.

## The punchline, for fun

The command knows its name; the help page will catch up once someone says so.

## The options, in plain words

A. Leave the built-in help as it is for now (what was built).
B. Add link to the dossier command's built-in help in this feature, in a small follow-up slice.

## What I had to decide

Whether a follow-up slice adds link to the dossier command's built-in help entry.

## What I did meanwhile

People find the command through the usage line it prints and through the skills that name it.

## What it costs to change later

One line added to the help entry and its test; no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names /omni:help for s5 but not the kit's own help entries file, so whether it was meant to be covered is unclear.

```

<!-- /omni-outbox-settled: s4-01-help-entry-lacks-link -->
