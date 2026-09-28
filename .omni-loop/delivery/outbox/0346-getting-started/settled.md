# Settled outbox items — PRD 346

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-knowledge-bar-test-outside-territory -->

## s1-01-knowledge-bar-test-outside-territory — adopted

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
id: s1-01-knowledge-bar-test-outside-territory
prd: 346
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Every top bar now carries Release notes, so the knowledge map page test, which lists its bar buttons, had to learn the new one even though this slice was not meant to touch it. Was updating that test the right call?

## The decision, in plain words

We updated that one test so it expects Release notes between the star chart link and the theme switch, and changed nothing else in it.

## The intro, for fun

A new button walked into the knowledge map's top bar and its test noticed at once.

## The punchline, for fun

We introduced them properly, with one line changed and no hard feelings.

## The options, in plain words

A. Update the test in this slice: What was built: the knowledge page's bar test lists Release notes, one line changed.
B. Widen the plan's territory instead: Add the knowledge page's test to the slice's territory in the plan, so the change is inside bounds; the test line stays the same.
C. Move the bar check out of that test: Drop the knowledge page's own list of bar buttons and let the shared header test cover it alone.

## What I had to decide

Whether a slice may update a neighbouring test that its own change turns red, when the plan did not list that test's file.

## What I did meanwhile

The knowledge map's test expects Release notes in its bar, and the whole suite is green apart from a date-format test that fails on the base branch too.

## What it costs to change later

Cheap to change: one line in one test file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the spec asks that every bar show Release notes, which settles the test's new line; only the territory was unsaid (author)

```

<!-- /omni-outbox-settled: s1-01-knowledge-bar-test-outside-territory -->

<!-- omni-outbox-settled: s2-01-home-link-guard-allows-docs -->

## s2-01-home-link-guard-allows-docs — adopted

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
id: s2-01-home-link-guard-allows-docs
prd: 346
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

The home page checks that it links only to the game and the release notes, so the new Getting Started button to the docs needed that check widened. Is it fine to allow the docs link there?

## The decision, in plain words

The check now allows three links from the home page: the game, the release notes and the docs. Everything else it guards stays as it was.

## The intro, for fun

The home page had a strict guest list, and the docs just showed up at the door.

## The punchline, for fun

We added one name to the list and kept the bouncer on duty.

## The options, in plain words

A. Allow the docs link in the home page's link check (built).
B. Keep the check to the game and release notes, and drop the Getting Started button from the home page.

## What I had to decide

Whether the home page's link check may name the docs page beside the game and the release notes.

## What I did meanwhile

The home page links to the docs, and its check accepts exactly the game, the release notes and the docs.

## What it costs to change later

Undoing it is one line in the check, plus removing the button.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the spec asks for the button; only the existing link check outside this slice had to follow it.

```

<!-- /omni-outbox-settled: s2-01-home-link-guard-allows-docs -->
