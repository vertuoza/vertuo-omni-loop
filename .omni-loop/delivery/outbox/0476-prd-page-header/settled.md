# Settled outbox items — PRD 476

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-faded-text-replaced -->

## s1-01-faded-text-replaced — adopted

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
id: s1-01-faded-text-replaced
prd: 476
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Two places outside the PRD page faded their text to show a state: a category button while it saves, and a retired fleet's card. How should they show that state now that no text may be faded?

## The decision, in plain words

The saving category button now shows its label in the quieter grey text colour, and a retired fleet's card shows its name in that same grey. The rest of the retired card looks like an active one.

## The intro, for fun

Fading text was the easy way to say 'not now'. It was also the way to make it hard to read.

## The punchline, for fun

Grey text says it just as well, and people can still read it.

## The options, in plain words

A. Grey text only: the saving button's label and the retired card's name go grey.
B. Grey text plus a dashed outline on the retired card, so it stands apart at a glance.
C. Keep a faded look but stop fading the text, by fading only the card's picture and edge.

## What I had to decide

Whether grey text is enough to set these two states apart, or whether they need a stronger mark.

## What I did meanwhile

Both states use the grey text colour, which is readable in every theme.

## What it costs to change later

A one-line stylesheet change each.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No browser pass was made on the fleets page to see how a retired card reads next to an active one (author).

```

<!-- /omni-outbox-settled: s1-01-faded-text-replaced -->

<!-- omni-outbox-settled: s1-02-which-borders-stay-quiet -->

## s1-02-which-borders-stay-quiet — adopted

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
id: s1-02-which-borders-stay-quiet
prd: 476
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Outlines that mark something to find got a stronger colour, and borders that only separate content kept the quiet one. Which way should the borders that sit between the two go?

## The decision, in plain words

Code blocks, the search results box, the menu under your avatar and the hover edges of tabs and sidebar items got the stronger colour. The sidebar's edge, the lines under headings, quotes, the docs table of contents and the release timeline stay quiet.

## The intro, for fun

Every border on the page had to pick a side: shout a little, or keep whispering.

## The punchline, for fun

The sidebar's edge chose to keep whispering.

## The options, in plain words

A. As built: boxes, code blocks, menus and hover edges strong; the sidebar edge and lines inside long texts quiet.
B. Also make the sidebar's edge strong, so the sidebar reads as its own panel.
C. Keep code blocks and the docs search results quiet too, so the docs page stays as light as before.

## What I had to decide

Whether any of these borderline borders should move to the other side.

## What I did meanwhile

Boxes and controls use the stronger outline; the sidebar edge and the lines inside long texts stay quiet.

## What it costs to change later

Moving one border is a one-word stylesheet change and one line in the outline test's list of dividers.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No browser pass was made across the docs, knowledge and releases pages to check none of them looks heavier (author).

```

<!-- /omni-outbox-settled: s1-02-which-borders-stay-quiet -->
