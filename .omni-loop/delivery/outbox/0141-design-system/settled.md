# Settled outbox items — PRD 141

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-pixel-palette-stays-in-its-file -->

## s2-01-pixel-palette-stays-in-its-file — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-pixel-palette-stays-in-its-file
prd: 141
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

Should the pixel colours move into the new colour module, or stay where the sprites already read them?

## The decision, in plain words

They stay where they were. The new colour module reads them from there and publishes them with everything else, so there is still one place to change a colour.

## The intro, for fun

Every colour now has one home. The pixel colours kept their old room in it.

## The punchline, for fun

Moving house mid-wave, while the sprite painters work next door, felt rude.

## The options, in plain words

A. Keep the palette file, read by the tokens module, the option built.
B. Move the palette and named colours into the tokens module, and point the sprite code at it once the sprite poses slice has merged.

## What I had to decide

Whether the pixel palette and the named colours live in the palette file or move into the tokens module the spec names.

## What I did meanwhile

The palette file keeps the pixel palette and the named colours, including the six new ones; the tokens module imports them, adds the arcade's own and Ask's colours, and writes the stylesheet. One place still defines each colour.

## What it costs to change later

Moving the two tables into the tokens module later is a file move and a few import lines in the package; nothing outside it changes, since everything is read through the package's index.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the spec's module table meant a physical file or a group of exports (author)

```

<!-- /omni-outbox-settled: s2-01-pixel-palette-stays-in-its-file -->

<!-- omni-outbox-settled: s2-02-vertuoza-mark-colours-stay-in-the-game -->

## s2-02-vertuoza-mark-colours-stay-in-the-game — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-vertuoza-mark-colours-stay-in-the-game
prd: 141
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

Should the colours of the Vertuoza letter mark move into the Omni Loop design library too?

## The decision, in plain words

No. The mark belongs to a customer, not to Omni Loop, so its gradient stays with the game's workspace theme; every other game colour now comes from the library.

## The intro, for fun

The library took every colour in the game but one gradient.

## The punchline, for fun

That one belongs to a customer, and the library is not a customer.

## The options, in plain words

A. Keep the mark's gradient in the game's theme, the option built.
B. Add the mark's gradient to the library as the default workspace mark colours, and read them from there.

## What I had to decide

Whether the default colours of the workspace letter mark's gradient are part of the design library or stay in the game's theme.

## What I did meanwhile

The theme's defaults for the arcade's colours and the heroes' stripes come from the library; the six gradient colours of the letter mark stay written in the game's theme, as before, unchanged on screen.

## What it costs to change later

Moving them later is six values added to the library and six lines changed in the game's theme.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the guard test of the last slice expects every theme default, the mark's included, to come from the library (author)

```

<!-- /omni-outbox-settled: s2-02-vertuoza-mark-colours-stay-in-the-game -->

<!-- omni-outbox-settled: s2-03-ask-colours-stay-out-of-the-shared-stylesheet -->

## s2-03-ask-colours-stay-out-of-the-shared-stylesheet — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-ask-colours-stay-out-of-the-shared-stylesheet
prd: 141
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

Should the reading page's light and dark colours be written into the library's shared stylesheet too?

## The decision, in plain words

Not yet. Their values and their contrast test now live in the library, but the page still turns them into styles itself, because its light and dark switch works that way.

## The intro, for fun

The reading page's colours moved into the library, and kept their own light switch.

## The punchline, for fun

Rewiring a light switch nobody asked about is how fuses blow.

## The options, in plain words

A. Keep the reading page's colours out of the shared stylesheet, the option built.
B. Generate them into the shared stylesheet under the page's light and dark selectors, and drop the page's own writer.

## What I had to decide

Whether the shared stylesheet the library generates carries the reading page's light and dark colours, or only the game's.

## What I did meanwhile

The shared stylesheet declares the game's colours and the named colours; the reading page's colours come from the library and are written as styles by the page, exactly as before.

## What it costs to change later

Adding them to the shared stylesheet later is a change to the generator and to the page's layout, with no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the spec wanted one stylesheet for every surface, or one source of values (author)

```

<!-- /omni-outbox-settled: s2-03-ask-colours-stay-out-of-the-shared-stylesheet -->

<!-- omni-outbox-settled: s4-01-pose-builds -->

## s4-01-pose-builds — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-pose-builds
prd: 141
slice: s4
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

The spec asks for three OmniMan poses that take a player's colours, including the cape, but OmniMan wears no cape and players pick a girl or boy build. How should a player's hero look in a pose?

## The decision, in plain words

Each pose is drawn twice, bare and with a cape, always on OmniMan's own build. A player's pose takes their colours and their cape, but not their girl or boy build.

## The intro, for fun

OmniMan learned to point, cheer and run, and now everyone wants to borrow his moves.

## The punchline, for fun

He lends the moves and the cape, but the mustache stays his.

## The options, in plain words

A. Keep OmniMan's build for every pose, bare or caped, in the player's colours
B. Draw the three poses for the girl and boy builds as well, so a player's pose keeps their build
C. Poses are OmniMan's alone: drop the caped builds and the player recolouring

## What I had to decide

Whether a player in a pose keeps OmniMan's build, or needs poses drawn for the girl and boy builds too.

## What I did meanwhile

Poses show OmniMan's build in the player's colours, caped when the player wears a cape. Nothing in the game draws a pose yet.

## What it costs to change later

Drawing girl and boy poses later adds sprites beside these; nothing stored changes, and no screen uses the poses before the design page and the home page.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the home page will ever show a player's own hero in a pose is not settled by the spec (author).

```

<!-- /omni-outbox-settled: s4-01-pose-builds -->

<!-- omni-outbox-settled: s3-01-knowledge-page-fonts -->

## s3-01-knowledge-page-fonts — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-knowledge-page-fonts
prd: 141
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

The knowledge map page arrived after the plan was written and still fetched its fonts from Google. Should this slice move it too?

## The decision, in plain words

Yes. The knowledge map now loads its fonts from our own site like the arcade and Ask, so no page fetches fonts from Google any more.

## The intro, for fun

One page was still ordering its fonts from abroad.

## The punchline, for fun

It now shops locally, like everyone else on the street.

## The options, in plain words

A. Move the knowledge map onto the package's fonts in this slice, the option built.
B. Leave the knowledge map on Google Fonts, and let the guard slice decide whether it counts.

## What I had to decide

Whether the knowledge map's layout, outside this slice's territory, moves onto the package's fonts in this slice.

## What I did meanwhile

It does: its Google Fonts link is gone and it imports the package's fonts, the same two-line change as the Ask layout.

## What it costs to change later

Two lines in one layout; putting the Google link back undoes it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the plan left the knowledge map out on purpose, or only because it landed after the plan was written (author)

```

<!-- /omni-outbox-settled: s3-01-knowledge-page-fonts -->

<!-- omni-outbox-settled: s3-02-font-alphabets -->

## s3-02-font-alphabets — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-font-alphabets
prd: 141
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

Google used to send every alphabet a font has. Which alphabets should we now ship ourselves?

## The decision, in plain words

Western European and Central European letters only. Greek, Cyrillic and Vietnamese text, which two of the fonts used to cover, now shows in the reader's system font.

## The intro, for fun

Our fonts moved in, but only packed the Latin suitcases.

## The punchline, for fun

The Greek and Cyrillic luggage can follow if anyone writes home in it.

## The options, in plain words

A. Latin and latin-ext for every face, the option built.
B. Every subset each face has, as Google served them.
C. Latin only, the smallest set.

## What I had to decide

Which character subsets the package ships for each face.

## What I did meanwhile

The latin and latin-ext subsets of every face; Press Start 2P and JetBrains Mono also had cyrillic, greek and vietnamese subsets on Google, now left out.

## What it costs to change later

One line in the fonts module and the extra files, about 20 KB each.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether any question or knowledge entry today is written in Greek, Cyrillic or Vietnamese (author)

```

<!-- /omni-outbox-settled: s3-02-font-alphabets -->

<!-- omni-outbox-settled: s3-03-type-scale-values -->

## s3-03-type-scale-values — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-type-scale-values
prd: 141
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

The design names eleven text sizes but gives no numbers, and says they belong in the colour sheet. What sizes, and where do they live?

## The decision, in plain words

Headlines run from 96 down to 32, game text keeps the sizes the arcade already uses, and reading text centres on the 17 Ask already uses. They sit in the font sheet beside the fonts they name, not in the colour sheet.

## The intro, for fun

Eleven text sizes were named, and not one of them came with a number.

## The punchline, for fun

So we measured what the game already wears and tailored the rest to fit.

## The options, in plain words

A. The sizes above, in the font sheet beside the faces, the option built.
B. The same sizes, moved into the colour sheet.
C. Different sizes, chosen once the home page draws its first headline.

## What I had to decide

The size, line height and slant of each type-scale step, and whether the scale's custom properties go in fonts.css or tokens.css.

## What I did meanwhile

Display 96, 72, 48 and 32 leaning 12 degrees; pixel 16 and 8 in Press Start 2P and 20 in Jersey 10; body 20, 17 and 14; mono 15. All written by the fonts module into fonts.css, since tokens.css belongs to the colour slice.

## What it costs to change later

A constant per step, and one generator line to move the properties to tokens.css.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- no page uses the display steps yet, so their sizes are unchecked against a real layout (author)
- the spec says the scale lives in tokens.css; that file was outside this slice's territory (author)

```

<!-- /omni-outbox-settled: s3-03-type-scale-values -->
