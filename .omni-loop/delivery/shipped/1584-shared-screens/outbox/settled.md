# Settled outbox items — PRD 1584

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s3-01-pixel-perfect-line-placement -->

## s3-01-pixel-perfect-line-placement — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-pixel-perfect-line-placement
prd: 1584
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Where should the feature pull request show which screens to look at closely, and where does that list come from?

## The decision, in plain words

The line sits right under the link to the PRD, and lists the screens the comparison page names in its pixel-perfect part, or says none.

## The intro, for fun

Every reviewer wants a map before the walk.

## The punchline, for fun

We put the map at the top, where eyes land first.

## The options, in plain words

A. A. Right after the link line, read from the screens the comparison page names (built)
B. B. Inside the reviewer focus section, further down the body
C. C. Read from the screens the merged slices touched instead of the comparison page

## What I had to decide

Keep the line at the top of the feature pull request, read from the comparison page, or move it to the reviewer focus section further down.

## What I did meanwhile

The skill writes the line right after the link line, with design on only.

## What it costs to change later

Moving it later is one sentence of skill text.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the line but not where it sits in the body nor what it is read from (author).

```

<!-- /omni-outbox-settled: s3-01-pixel-perfect-line-placement -->

<!-- omni-outbox-settled: s2-01-running-text-needs-a-word -->

## s2-01-running-text-needs-a-word — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-running-text-needs-a-word
prd: 1584
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

When does a line of a mockup count as a running sentence, so that the small styled pieces inside it are read as part of it? Only when it has real words of its own, or also when it only has a separator such as a dot or a dash?

## The decision, in plain words

A line counts as a running sentence only when it holds at least one letter or digit of its own. Pieces separated only by a dot or a dash stay separate strings.

## The intro, for fun

A lonely middle dot walks between two labels and asks to be called a sentence.

## The punchline, for fun

The word check says no: a sentence needs at least one word.

## The options, in plain words

A. A. Own text must hold a letter or a digit (built).
B. B. Any non-blank own text, a separator included, makes running text.

## What I had to decide

What counts as a parent's own text when the word pass decides whether phrasing elements run on.

## What I did meanwhile

A parent's text of its own must hold a letter or a digit; a separator alone (·, —, |) keeps its sibling spans as separate strings, as PRD 1550 made them.

## What it costs to change later

One constant in kit/lib/design/words/pass.ts (the test used by hasRunningText); no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says 'a parent that holds text of its own beside them' without saying whether punctuation alone counts (author).

```

<!-- /omni-outbox-settled: s2-01-running-text-needs-a-word -->

<!-- omni-outbox-settled: s2-02-content-mark-wired-in-the-command -->

## s2-02-content-mark-wired-in-the-command — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-content-mark-wired-in-the-command
prd: 1584
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

The new setting that says which part of a mockup is content had to reach the command that runs the word check, and that command sits outside this slice's planned files. Is a one-line change there fine?

## The decision, in plain words

The command now passes the content setting to the word check, with its default when unset. Without it, the setting would be read but never used.

## The intro, for fun

The plan drew the fence one file too short for the new setting.

## The punchline, for fun

So the setting hopped over it, carrying exactly one line.

## The options, in plain words

A. Keep the two-line change in the design command, as built
B. Move where the word check's settings are gathered into the word check itself, in a later change

## What I had to decide

Whether the one-line change to the design command, outside s2's territory, may stay.

## What I did meanwhile

The design command builds the word pass's rules with the content selector read through wordsContent, so design.words.content and its [data-content] default take effect.

## What it costs to change later

Reverting is removing two lines (an import and one field); nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s2 did not list kit/bin/commands/design.ts, where the rules are built (author).

```

<!-- /omni-outbox-settled: s2-02-content-mark-wired-in-the-command -->

<!-- omni-outbox-settled: s4-01-section-layouts-in-reads -->

## s4-01-section-layouts-in-reads — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-section-layouts-in-reads
prd: 1584
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

Each part of the app has a small wrapper file that puts the sidebar and top bar around its pages and loads that page's styles. Should a change to it hold the shared frame, the page, or neither?

## The decision, in plain words

Neither: the wrapper is listed as background on both the shared frame and the page, so changing it never holds either one.

## The intro, for fun

Every app page sits in a frame, and every frame has a little hook on the wall.

## The punchline, for fun

We decided the hook belongs to nobody, which is very fair to the hook.

## The options, in plain words

A. A. In reads on both the shared frame and the page: a layout change holds nothing.
B. B. In what the shared frame implements: a layout change holds the frame's owner.
C. C. In what each page implements: a layout change holds that page's owner.

## What I had to decide

Whether each section's layout file belongs to the app-shell screen, to the page screen it wraps, or to neither.

## What I did meanwhile

The layouts are in reads on app-shell and on dashboard and prd-dossier; nothing is locked, so nothing waits either way.

## What it costs to change later

A constant: moving the paths from reads to implements in two or three screen files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The rule's four lines do not name a file that is both wiring for shared structure and a page's own stylesheet import (author).

```

<!-- /omni-outbox-settled: s4-01-section-layouts-in-reads -->
