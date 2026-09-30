# Settled outbox items — PRD 733

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-settings-redirect-beyond-territory -->

## s1-01-settings-redirect-beyond-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-settings-redirect-beyond-territory
prd: 733
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Moving Settings to one entry at the foot of the menu broke four existing checks and a page rule outside the part of the app this step was allowed to touch. Was it right to update them here?

## The decision, in plain words

Yes: the four checks now describe the new menu, and the Settings address got the small loading screen every app page must have. Nothing a person sees changes beyond what the design asked for.

## The intro, for fun

The menu got tidier, and four old checks noticed the furniture had moved.

## The punchline, for fun

We told them where the sofa went instead of putting it back.

## The options, in plain words

A. Update the checks and add the loading screen in this step, as built.
B. Make the Settings address a server redirect with no page, so no loading screen is needed, and still update the checks.
C. Move the check updates into a separate step that follows this one.

## What I had to decide

Whether updating the checks and adding the loading screen outside the step's declared ground is acceptable, or should be split into its own step.

## What I did meanwhile

The step ships with the four checks updated and the loading screen added, and every check passes.

## What it costs to change later

Undoing it means moving five small file changes to another step; no data or address changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan did not list the headers, sections and fleets checks, nor the settings loading screen, although the menu change forces them.

```

<!-- /omni-outbox-settled: s1-01-settings-redirect-beyond-territory -->

<!-- omni-outbox-settled: s3-01-questions-tabs-on-own-terminal -->

## s3-01-questions-tabs-on-own-terminal — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-questions-tabs-on-own-terminal
prd: 733
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

The design puts the question tabs on the three Questions pages. Picking one of your terminals opens its own address: should the tabs stay there too?

## The decision, in plain words

The tabs stay when you pick one of your own terminals, with Open questions marked, so they do not vanish as you click. A teammate's terminal and a single shared question show no tabs.

## The intro, for fun

You click a terminal, and the tabs above it quietly pack their bags.

## The punchline, for fun

We asked them to stay for dinner instead.

## The options, in plain words

A. Show the row on the person's own terminals too, Open questions marked (built).
B. Show it only on the three named addresses; picking a terminal hides it.

## What I had to decide

Whether the tab row also shows when the person opens one of their own terminals, or only on the three named pages.

## What I did meanwhile

The row shows on the person's own terminals with Open questions marked; not on a teammate's terminal or a single question.

## What it costs to change later

One line in the ask route: wrap the own-terminal view in the tab row or not.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names only the three addresses; whether a terminal's own address counts as Open questions was not asked (author).

```

<!-- /omni-outbox-settled: s3-01-questions-tabs-on-own-terminal -->

<!-- omni-outbox-settled: s4-01-rail-dot-colour -->

## s4-01-rail-dot-colour — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-rail-dot-colour
prd: 733
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

The folded menu shows a dot where something waits. Should the dot take the colour of the number badge it replaces, or always be yellow?

## The decision, in plain words

The dot takes the badge's own signal colour, which is yellow in the Omni theme and the theme's highlight colour in light and dark, so the dot and the badge always match.

## The intro, for fun

A number shrank into a dot and now wonders what colour to wear.

## The punchline, for fun

It kept its old outfit, just a much smaller size.

## The options, in plain words

A. The badge's colour in every theme (built): Yellow in Omni, the theme's highlight elsewhere; matches the open menu's badge.
B. Always yellow: In Omni the theme's yellow token is magenta, so this would need a colour of its own.

## What I had to decide

The colour of the waiting dot in the folded menu, in the light and dark themes.

## What I did meanwhile

The dot uses the same colour as the waiting badge in every theme.

## What it costs to change later

One colour name in one style rule.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The design page draws the dot yellow; in the light and dark themes the badge colour is not yellow (author)

```

<!-- /omni-outbox-settled: s4-01-rail-dot-colour -->

<!-- omni-outbox-settled: s4-02-rail-tests-outside-territory -->

## s4-02-rail-tests-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-rail-tests-outside-territory
prd: 733
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

The new fold buttons and the hover names on menu entries change what three older page checks expected to see. May the slice update those checks, although they sit outside the files it was given?

## The decision, in plain words

Yes: the slice updated the three checks so they expect the two fold buttons, the hover names and the thin line between the two menu groups in the rail. Nothing else in them changed.

## The intro, for fun

Three old checks counted the menu's buttons and found two newcomers at the door.

## The punchline, for fun

They were told the guests are expected, and the count now agrees.

## The options, in plain words

A. Update the three checks to expect the new menu (built): the page-header check, the PRD page check and the outline check each take a one-line change.
B. Leave the checks alone and hand them to a separate slice: The feature branch would stay red until that slice lands.

## What I had to decide

Whether a slice may adjust checks outside its files when the change it was asked for makes them out of date.

## What I did meanwhile

The three checks expect the new menu; every check is green.

## What it costs to change later

Undoing it means reverting three one-line changes in the checks, no data or screen affected.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No written rule says whether a wave slice may adjust checks outside its files (author)

```

<!-- /omni-outbox-settled: s4-02-rail-tests-outside-territory -->
