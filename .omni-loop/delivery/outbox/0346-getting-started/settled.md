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

<!-- omni-outbox-settled: s4-01-install-sets-the-app-address -->

## s4-01-install-sets-the-app-address — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-install-sets-the-app-address
prd: 346
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

Signing in needs the address of the Omni Loop app, but installing the kit leaves it empty. How should a newcomer get it?

## The decision, in plain words

The Install page asks the person to paste a few lines into the loop's settings file before committing it: the app's address, and the switch that turns PRD dossiers on.

## The intro, for fun

The sign-in door was there all along; nobody had written down the street.

## The punchline, for fun

Now the page gives the address before sending anyone to knock.

## The options, in plain words

A. Keep the hand-edited step on the Install page, with the app's address and dossiers on.
B. Change the installer to write the app's address and turn dossiers on, and drop the step from the page.
C. Keep the step but set only the address, leaving dossiers off until a person turns them on.

## What I had to decide

Whether a hand-edited step in the install is acceptable, or the installer should write the app's address itself.

## What I did meanwhile

The Install page carries the lines, with the production address of the app.

## What it costs to change later

Low: a few lines of a page. Having the installer write the address instead is a small kit change plus removing the step from the page.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec lists signing in right after the GitHub App and does not say the address must be set first; reading the kit shows the sign-in stops with a one-line refusal when it is missing (author)
- Whether dossiers should be on by default for a newcomer's repository is not settled anywhere (author)

```

<!-- /omni-outbox-settled: s4-01-install-sets-the-app-address -->

<!-- omni-outbox-settled: s4-02-docs-write-the-command-as-omni -->

## s4-02-docs-write-the-command-as-omni — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-docs-write-the-command-as-omni
prd: 346
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The kit's command is a file run with Node, so a newcomer cannot type it by its short name. How should the pages write it?

## The decision, in plain words

The pages write the short name, and the Install page gives a one-line shortcut that makes the short name work in the terminal, with the long form to type when the shortcut is not set.

## The intro, for fun

Every page says the short name, and the terminal had never heard of it.

## The punchline, for fun

One line of shortcut, and the terminal and the pages finally agree.

## The options, in plain words

A. Short name on every page, and a shortcut on the Install page.
B. The long form on every page, with no shortcut.
C. Have the kit install a real command by the short name, and drop the shortcut.

## What I had to decide

Whether the shortcut is the right answer for a newcomer, or the pages should spell out the long form everywhere.

## What I did meanwhile

Install explains the shortcut once; every other page uses the short name.

## What it costs to change later

Low: wording on two pages. Spelling out the long form everywhere is a find-and-replace, but the docs guard only checks the short form.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec writes the short name without saying how a person types it; the kit installs no command by that name on the laptop (author)

```

<!-- /omni-outbox-settled: s4-02-docs-write-the-command-as-omni -->

<!-- omni-outbox-settled: s4-03-docs-test-drawn-without-headings -->

## s4-03-docs-test-drawn-without-headings — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-docs-test-drawn-without-headings
prd: 346
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

A test of the docs pages relied on the Install page having no headings, which stopped being true once it was written in full. How should it be fixed?

## The decision, in plain words

The test now draws a made-up page with no headings instead of the real Install page. It is a file outside this slice's own ground, changed by one test only.

## The intro, for fun

The test was counting on the Install page staying blank forever.

## The punchline, for fun

It now brings its own blank page, and nobody has to stop writing.

## The options, in plain words

A. Draw a made-up page with no headings in the test.
B. Drop the check that a page with no headings has no table of contents.

## What I had to decide

Whether the fix to the test is right, or the check should be dropped.

## What I did meanwhile

The test draws its own page; every other docs test is unchanged.

## What it costs to change later

Low: one test. Reverting it would make the docs tests red again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives this test file to the slice that built the docs pages, not to this one (author)

```

<!-- /omni-outbox-settled: s4-03-docs-test-drawn-without-headings -->

<!-- omni-outbox-settled: s4-04-install-names-private-kit-access -->

## s4-04-install-names-private-kit-access — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-04-install-names-private-kit-access
prd: 346
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The kit's own repository is private while in beta, so a newcomer cannot fetch it without access. What should the Install page say?

## The decision, in plain words

The Install page says the person's GitHub account needs read access to the kit's repository, and to ask the Omni Loop team for it together with their invite.

## The intro, for fun

The front door was open, but the toolbox was locked in the back room.

## The punchline, for fun

The page now says whom to ask for the key, before anyone tries the handle.

## The options, in plain words

A. Ask the Omni Loop team for read access, as the page says.
B. Grant read access with the invite, and say so on the page.
C. Make the kit's repository public, and drop the paragraph.

## What I had to decide

Whether asking the team is the right path, or the invite should grant that access by itself.

## What I did meanwhile

The page asks the person to request access from the Omni Loop team.

## What it costs to change later

Low: one paragraph. Making the kit public, or granting access with the invite, removes it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether an invite already grants read access to the kit's repository is not written anywhere (author)

```

<!-- /omni-outbox-settled: s4-04-install-names-private-kit-access -->

<!-- omni-outbox-settled: s5-01-release-note-where-to-find-it -->

## s5-01-release-note-where-to-find-it — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-release-note-where-to-find-it
prd: 346
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The design said a person would see their feature's release note under Release notes in the app, but that page still lists only Omni Loop's own releases. What should the first-feature page tell them?

## The decision, in plain words

The page says the note is a file written beside the feature's spec, reviewed with the finished change, and that the app's Release notes page will show a repository's own notes in a later version.

## The intro, for fun

The release note was ready for its close-up, but the stage belonged to someone else.

## The punchline, for fun

So we told it where its dressing room is, and promised a stage later.

## The options, in plain words

A. Point at the file, and say the app shows it later: What was built: the page names the release note file in the shipped folder and says the app's Release notes page will show it in a later version.
B. Say it appears under Release notes: Follow the spec's user flow word for word, even though a first run will not find it there today.
C. Leave the release note out of the page: End the walk-through at the merge, and add the release note step when the app shows it.

## What I had to decide

Where the Your first PRD page sends the reader to find their PRD's release note, since the app's Release notes page does not show an invaded repository's notes yet (the spec's own Decisions keep them the loop's own for now).

## What I did meanwhile

The last step of the page names release.md in the shipped folder, says it is written only when release notes are switched on, and says the app lists Omni Loop's releases for now.

## What it costs to change later

Cheap to change: a few sentences in one page of the guide.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's user flow and its Decisions disagree on where the note is seen; which one the reader should be told was not settled (author)

```

<!-- /omni-outbox-settled: s5-01-release-note-where-to-find-it -->

<!-- omni-outbox-settled: s5-02-guide-recommends-switches -->

## s5-02-guide-recommends-switches — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-guide-recommends-switches
prd: 346
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

A fresh install leaves dossiers and release notes switched off, so a first run shows no follow-along link and writes no release note. Should the guide tell people how to switch them on?

## The decision, in plain words

The first-feature page ends with a short section giving the few settings that switch both on, and the troubleshooting page adds a handful of other errors a first run meets beyond the four the design named.

## The intro, for fun

Two good features were hiding behind switches nobody told the newcomer about.

## The punchline, for fun

We put up a small sign pointing at the switches, and left them for the newcomer to flip.

## The options, in plain words

A. Document the switches and the extra errors: What was built: a short section for the switches, and a few more errors on the troubleshooting page.
B. Only the four errors, no switches: Keep both pages to what the spec names, and leave the settings to the kit's own readme.
C. Move the switches to the Install page: Name them once where the kit is installed, and link to them from the first-feature page.

## What I had to decide

Whether the guide documents the config lines that turn dossiers and release notes on (ask.url, dossier.enabled, releaseNotes.enabled), which the spec does not mention, and whether When something goes wrong lists more than the four errors the spec names.

## What I did meanwhile

Your first PRD has a Two switches worth turning on section with the YAML; When something goes wrong has the four named errors, the ask.url and off lines beside the sign-in one, and an Other lines section (uncommitted changes, plugin missing, gh not signed in, needs-fix label).

## What it costs to change later

Cheap to change: one section in each of two pages of the guide.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the Install page, written by another slice at the same time, also covers the switches was not known when this was written (author)

```

<!-- /omni-outbox-settled: s5-02-guide-recommends-switches -->
