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

<!-- omni-outbox-settled: s3-01-docs-code-blocks-not-highlighted -->

## s3-01-docs-code-blocks-not-highlighted — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-docs-code-blocks-not-highlighted
prd: 346
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The docs tool colours code examples with its own theme by default, which would bring colours the app's design system does not own. Should the docs' code examples be coloured at all?

## The decision, in plain words

We switched the colouring off: code examples show as plain text on the app's own code background, in every theme.

## The intro, for fun

The docs tool arrived with its own box of crayons for code examples.

## The punchline, for fun

We kindly asked it to use ours, and ours only has the one colour for code.

## The options, in plain words

A. No colours in code examples: what was built, plain text on the app's code background.
B. Colour code with new design-system tokens: add a few code colours to the design system, per theme, and map the highlighter onto them.
C. Keep the docs tool's own code colours: accept a few colours the design system does not own, in code examples only.

## What I had to decide

Whether code examples get syntax colours, which the design system has no tokens for.

## What I did meanwhile

Code blocks are monochrome, drawn with the app's tokens; the commands in them read the same in the three themes.

## What it costs to change later

Cheap: one setting, plus a small set of colour tokens for code if we want colours later.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec asks for the app's own look and tokens only, but does not say whether code gets colours (author)

```

<!-- /omni-outbox-settled: s3-01-docs-code-blocks-not-highlighted -->

<!-- omni-outbox-settled: s3-02-docs-open-to-search-engines -->

## s3-02-docs-open-to-search-engines — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-docs-open-to-search-engines
prd: 346
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The docs pages are public. Should search engines be allowed to list them, like the release notes, or be kept out, like the app's own pages?

## The decision, in plain words

We let search engines list the docs, as the release notes page already does, so someone searching for how to install Omni Loop can find them.

## The intro, for fun

The docs had to pick a side: out in the open like the release notes, or behind the curtain like the app.

## The punchline, for fun

They chose the open road, with a Next link at every stop.

## The options, in plain words

A. Open to search engines: what was built, like the release notes.
B. Keep search engines out: like the app's own pages, while the loop is invite-only in beta.

## What I had to decide

Whether the public docs pages carry the rule that keeps search engines out, as the app's own pages do.

## What I did meanwhile

The docs pages carry no such rule: they can be indexed and previewed when a link is shared.

## What it costs to change later

Cheap: one line in the docs layout.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says public and no sign-in, but not whether search engines may index the pages (author)

```

<!-- /omni-outbox-settled: s3-02-docs-open-to-search-engines -->

<!-- omni-outbox-settled: s3-03-docs-item-outside-territory -->

## s3-03-docs-item-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-docs-item-outside-territory
prd: 346
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Adding Docs to the top bar turned two button-counting page tests red, and the docs build writes a generated folder git would pick up, all in files this slice was not given. Was touching them the right call?

## The decision, in plain words

We updated the two tests so they expect Docs after Release notes, added the docs page to the list of headers the shared test checks, and told git to ignore the generated folder. Nothing else in those files changed.

## The intro, for fun

One new button in the top bar, and two tests that count buttons noticed straight away.

## The punchline, for fun

We taught them to count to Docs, and asked git to look away from the build's scraps.

## The options, in plain words

A. Update them in this slice: what was built, the two tests expect Docs and the ignore list names the generated folder.
B. Widen the plan's territory instead: list those three files in the slice's row, so the same change sits inside bounds.
C. Leave the ignore list alone: generate the docs folder somewhere git already ignores, and keep only the test changes.

## What I had to decide

Whether a slice may update neighbouring tests its own change turns red, and the app's ignore list, when the plan did not name those files.

## What I did meanwhile

The header test, the knowledge map test and the app's ignore list carry the change; the whole suite is green apart from the release-date test that fails on this machine's git on main too.

## What it costs to change later

Cheap: a few lines in two tests and one line in an ignore list.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec asks that every bar show Docs and that the header test be updated, which settles the new lines; only the territory was unsaid (author)

```

<!-- /omni-outbox-settled: s3-03-docs-item-outside-territory -->
