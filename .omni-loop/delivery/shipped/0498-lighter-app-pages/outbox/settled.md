# Settled outbox items — PRD 498

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-preview-question-width -->

## s1-01-preview-question-width — adopted

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
id: s1-01-preview-question-width
prd: 498
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

A question that shows a picture beside it used to stretch wider than the other questions. Now that every question already uses the full width, should it still get special treatment?

## The decision, in plain words

It no longer gets special treatment: it uses the same full width as every other question, with its picture beside the text as before.

## The intro, for fun

The wide question used to be the only one allowed to stretch its legs.

## The punchline, for fun

Now everyone gets the whole room, so it stopped showing off.

## The options, in plain words

A. Same full width as every question: the preview question fills the column.
B. Cap it at 1120 px, centred in the full-width page.
C. Cap it at 1120 px, aligned left with the rest of the content.

## What I had to decide

Whether a question with a preview should keep a separate width rule now that the column is full width.

## What I did meanwhile

A question with a preview fills the page's width like the others; its text and preview still split the space in two from 720 px.

## What it costs to change later

A few lines of stylesheet to bring back a width cap and centring for that one kind of question.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No browser pass yet of a question with a preview at 1920 px (author).

```

<!-- /omni-outbox-settled: s1-01-preview-question-width -->

<!-- omni-outbox-settled: s1-02-superseded-width-and-bar-tests -->

## s1-02-superseded-width-and-bar-tests — adopted

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
id: s1-02-superseded-width-and-bar-tests
prd: 498
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Two older checks still insisted on a faint top bar edge and a capped home page, rules this change deliberately replaces. Should they be updated here, though they sit outside the files this piece of work was given?

## The decision, in plain words

Yes: both checks were updated to the new rules in this same piece of work, so the checks stay green and still guard everything else they covered.

## The intro, for fun

Two old guards were still standing at posts that had been moved.

## The punchline, for fun

They got new orders instead of being sent home.

## The options, in plain words

A. Update both checks in this slice, as the spec replaces their rules.
B. Leave them failing and add a follow-up slice to update them.
C. Widen the plan's territory for s1 and keep the edits.

## What I had to decide

Whether a slice may edit tests outside its territory when the spec replaces the rule those tests guard.

## What I did meanwhile

The outline check no longer counts the top bar as a faint divider, and the home page check asks for full width with no cap.

## What it costs to change later

Reverting two small test edits and moving them into another slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s1 did not list these two test files (author).

```

<!-- /omni-outbox-settled: s1-02-superseded-width-and-bar-tests -->

<!-- omni-outbox-settled: s2-01-header-bleed-by-negative-margin -->

## s2-01-header-bleed-by-negative-margin — adopted

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
id: s2-01-header-bleed-by-negative-margin
prd: 498
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

The plan says the PRD header has no margin, yet it sits inside the page's padding. How should it reach the top bar and both edges?

## The decision, in plain words

The header is pulled out by exactly the page's padding, so it touches the top bar, the sidebar and the right edge, while its title and tabs stay lined up with the content below.

## The intro, for fun

A header wanted to touch every wall of the room without moving the walls.

## The punchline, for fun

So it leaned out by exactly the width of the padding.

## The options, in plain words

A. Negative margins against the page padding: the gutter at the sides, 28 px at the top (built).
B. Drop the page's padding on the PRD page only, and pad the content under the header instead.
C. Declare the top padding as a shared setting too, and read it here.

## What I had to decide

Whether pulling the header out against the page padding is the right way, or the page padding should step aside on this page instead.

## What I did meanwhile

The header uses negative margins equal to the page gutter at the sides and 28 px at the top.

## What it costs to change later

A constant: if the page's top padding changes, the header's 28 px pull must follow it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The 28 px top pull copies .ask-main's top padding by hand; nothing ties the two together (author).
- No browser pass was run in this slice; the pinning and the absence of a sideways scroll at 390 px are unchecked (author).

```

<!-- /omni-outbox-settled: s2-01-header-bleed-by-negative-margin -->

<!-- omni-outbox-settled: s2-02-old-header-outline-test-updated -->

## s2-02-old-header-outline-test-updated — adopted

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
id: s2-02-old-header-outline-test-updated
prd: 498
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

An older check still demanded the outlined box around the PRD header that this PRD removes. Should this slice update that check, even though the file belongs to a later slice?

## The decision, in plain words

The one line of that check now asks for the strong bottom rule instead of a full outline. Nothing else in the file changed.

## The intro, for fun

The old guard still stood at the door of a box that no longer exists.

## The punchline, for fun

So it was told to watch the floor line instead.

## The options, in plain words

A. Update the one line in this slice so the whole test suite stays green (built).
B. Leave the check failing and let the later questions slice fix it.

## What I had to decide

Whether a slice may adjust an older check that its own change makes wrong when the file sits in another slice's area.

## What I did meanwhile

The check reads the header's bottom rule; the later questions slice builds on top of it.

## What it costs to change later

One line of a test; undoing it means restoring the old wording.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan did not list this test in the slice's area, though the spec's change makes it fail (author).

```

<!-- /omni-outbox-settled: s2-02-old-header-outline-test-updated -->
