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

<!-- omni-outbox-settled: s5-01-status-pages-which-prds -->

## s5-01-status-pages-which-prds — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-status-pages-which-prds
prd: 413
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The status overview lists many PRDs. Which of them should also get their page's link printed under it?

## The decision, in plain words

Only your own PRDs that are still waiting or being built get a link, one line each, and a PRD someone asked about gets one first. Finished PRDs get none, so a long history does not mean dozens of lookups.

## The intro, for fun

The overview lists every PRD you ever finished, and each one could have its link.

## The punchline, for fun

We kept the links for the ones still moving.

## The options, in plain words

A. A. Links for your PRDs still in progress, and for one asked about (built).
B. B. A link for every PRD of yours, shipped ones included.
C. C. No links in the overview; only a PRD someone asks about gets one.

## What I had to decide

Which PRDs of the status overview get a page link printed under it.

## What I did meanwhile

Links for your PRDs still in the inbox or the outbox, plus the one asked about; none for shipped ones; each link is printed outside the overview block.

## What it costs to change later

Changing which PRDs get a line is a sentence in one skill; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the status summary of a PRD prints its link, but the overview has no view of one PRD, so which rows count is not written down.

```

<!-- /omni-outbox-settled: s5-01-status-pages-which-prds -->

<!-- omni-outbox-settled: s5-02-tests-outside-territory -->

## s5-02-tests-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-tests-outside-territory
prd: 413
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Teaching two commands about the new link changed what two existing tests expect. Should this part of the work update those tests itself, though they sit outside its planned ground?

## The decision, in plain words

Yes. It updated the status skill's test to allow the link lookup, and added the link to the built-in help with its test, as the earlier adopted decision asked, and changed nothing else there.

## The intro, for fun

Two old tests noticed the new link and raised a hand.

## The punchline, for fun

We answered them in the same breath.

## The options, in plain words

A. A. This slice updates the help text and the test its change breaks (built).
B. B. Leave them for a follow-up slice that owns those files.

## What I had to decide

Whether this slice may change the help text and the status skill's test, which belong to no slice of this PRD.

## What I did meanwhile

The help lists the link verb, the status skill's test allows it, and the full run is green apart from the one failure that already exists on the default branch.

## What it costs to change later

Reverting is two small edits; no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names the help skill and the skills folder, not the help text file or the plugin's shared test, so whether they were meant to be covered is not written down.

```

<!-- /omni-outbox-settled: s5-02-tests-outside-territory -->
