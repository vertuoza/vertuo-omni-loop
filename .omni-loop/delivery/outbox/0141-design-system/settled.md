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

<!-- omni-outbox-settled: s5-01-crest-final-pixels -->

## s5-01-crest-final-pixels — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-crest-final-pixels
prd: 141
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

The approved sketch of the logo was marked as a rough draft. What should the final pixels look like?

## The decision, in plain words

The logo was redrawn by fixed rules close to the sketch: a round loop arrow whose tip points up at the top right, square blocky letters, lit from the top left, a dark blue outline and a purple shadow. The big letter O in the stacked version is the same O drawn twice as large.

## The intro, for fun

The sketch said it was only a sketch, so somebody had to place the final pixels.

## The punchline, for fun

Each pixel was placed by hand, and none of them was left alone on the edge.

## The options, in plain words

A. Keep the crest as drawn, the option built.
B. A person redraws the O or the letters by hand, and the grids take their pixels.
C. Make the lockup's big O a drawing of its own instead of the O doubled.

## What I had to decide

Whether the drawn crest (the loop-arrow O at 16 by 14, the 5 by 7 face at 2x, the lockup's O doubled) is the logo, or needs another pass by a person.

## What I did meanwhile

The crest as drawn in the logo module; its shape lives in a few string grids, so a redraw changes pixels, not code.

## What it costs to change later

Redrawing is editing the grids in the logo module; the tests check the rules, not the exact pixels.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No designer has seen the final pixels at poster scale; the check was the arcade's own screenshots (author)

```

<!-- /omni-outbox-settled: s5-01-crest-final-pixels -->

<!-- omni-outbox-settled: s5-02-boot-draws-the-o-title-draws-the-word -->

## s5-02-boot-draws-the-o-title-draws-the-word — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-boot-draws-the-o-title-draws-the-word
prd: 141
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

Which version of the logo goes on the opening screen and which on the title screen, and does a customer's workspace see it on the title too?

## The decision, in plain words

The opening screen shows the looped O on its own, in the place the Vertuoza V used to sit, with the words OMNI LOOP PRESENTS under it. The title screen shows the full OMNI LOOP logo for everyone, customers included, because the game itself is called Omni Loop.

## The intro, for fun

The opening screen already says OMNI LOOP in words. Writing it twice seemed a lot.

## The punchline, for fun

So the O introduces itself first, and the whole name turns up on the title screen.

## The options, in plain words

A. Mark on the boot, full logo on the title for every brand, the option built.
B. Full logo on the boot as well, and the words under it read only PRESENTS.
C. Under a workspace's brand, the title goes back to the words OMNI LOOP instead of the crest.

## What I had to decide

Whether the boot draws the mark or the full form, and whether the title's crest is shown under a workspace's brand as well.

## What I did meanwhile

The boot draws the mark at 4x under the house brand, and a workspace still draws its letter; the title draws the full form at 3x (2x on the phone) under every brand.

## What it costs to change later

A constant in the boot's drawing and one condition in the title.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No person has looked at it yet; the check was the arcade's own screenshots (author)

```

<!-- /omni-outbox-settled: s5-02-boot-draws-the-o-title-draws-the-word -->

<!-- omni-outbox-settled: s5-03-house-letter-in-the-intro -->

## s5-03-house-letter-in-the-intro — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-house-letter-in-the-intro
prd: 141
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

When a new player with no workspace watches the joining story, its first seconds used to flash the Vertuoza V. What should they flash now?

## The decision, in plain words

They flash an O made of the same striped bars, because Omni Loop now starts with an O. The new logo is only drawn on the opening and title screens, as the plan asks.

## The intro, for fun

The joining story still flashes a letter in its first second, and the V has left the house.

## The punchline, for fun

An O stepped in. It is round, it is striped, and it did not audition.

## The options, in plain words

A. The striped O, the option built.
B. The crest's looped O, as on the opening screen.
C. Keep the Vertuoza V there, as before.

## What I had to decide

Whether the intro's opening bars, under the house brand, show the striped O (the letter of Omni Loop) or the crest's mark.

## What I did meanwhile

The striped O, drawn by the letter mark the way any brand's first letter is.

## What it costs to change later

Drawing the crest there instead is one condition in the intro scene, beside the boot's.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the intro should carry the brand at all once the home page exists (author)

```

<!-- /omni-outbox-settled: s5-03-house-letter-in-the-intro -->

<!-- omni-outbox-settled: s5-04-boot-learns-the-crest-outside-its-ground -->

## s5-04-boot-learns-the-crest-outside-its-ground — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-04-boot-learns-the-crest-outside-its-ground
prd: 141
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

To draw the new logo on the opening screen, this slice changed a little of the game's main screen code, which sits outside the part it was given. Was that right?

## The decision, in plain words

Yes, with the smallest change possible: the main screen now passes along whether the logo should be drawn, and nothing else changes. No other slice was working on those files at the time.

## The intro, for fun

The opening screen had to know whose logo to draw, and nobody had told it.

## The punchline, for fun

One small note was passed through a door this slice was not meant to open.

## The options, in plain words

A. Carry the crest in the frame state, the option built.
B. Draw the boot's crest in the page layer above the canvas instead, inside the slice's own files, and leave the canvas black under the house brand.

## What I had to decide

Whether carrying the house brand's crest through the frame state, in the arcade's shared scene types and the arcade app, is acceptable outside the slice's territory.

## What I did meanwhile

An optional logo field on the frame state, set from the brand's look; every scene but the boot ignores it.

## What it costs to change later

Three lines in the arcade app and one field in the shared scene types; removing them puts the letter mark back on the boot.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the other slices of this wave or the next expected those files untouched (author)

```

<!-- /omni-outbox-settled: s5-04-boot-learns-the-crest-outside-its-ground -->

<!-- omni-outbox-settled: s6-01-design-page-shows-the-built-in-fleets -->

## s6-01-design-page-shows-the-built-in-fleets — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s6
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-design-page-shows-the-built-in-fleets
prd: 141
slice: s6
rank: medium
bears-on: none
raised: 2026-09-26
wave: 5
---

## The question, in plain words

The design page is public, so whose fleets should it dress the heroes in: the ones the game ships with, or a real team's own fleets?

## The decision, in plain words

It shows the fleets the game ships with, the same six as the demo galaxy, so a visitor with no account never sees a customer's teams.

## The intro, for fun

Six fleets walk into a style guide, and only the house ones get a mirror.

## The punchline, for fun

A customer's crew stays backstage until they sign in.

## The options, in plain words

A. Show the built-in fleets from the demo galaxy, the option built.
B. Show only the fleets that are not retired.
C. Show a signed-in member their own workspace's fleets, and the built-in ones to everyone else.

## What I had to decide

Which fleets the public /design page shows the heroes in.

## What I did meanwhile

The six built-in fleets from the demo galaxy, which the seed migration also creates: beaver, octopod, picsou, cia, pirates and the retired invincible team.

## What it costs to change later

One import in the page's catalogue; showing a workspace's own fleets would also need the page to read the database and a signed-in viewer.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the retired invincible fleet belongs on a style guide at all (author)

```

<!-- /omni-outbox-settled: s6-01-design-page-shows-the-built-in-fleets -->

<!-- omni-outbox-settled: s6-02-design-page-screenshots-described-not-attached -->

## s6-02-design-page-screenshots-described-not-attached — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s6
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-design-page-screenshots-described-not-attached
prd: 141
slice: s6
rank: medium
bears-on: none
raised: 2026-09-26
wave: 5
---

## The question, in plain words

The plan asks for pictures of the design page on a phone and on a desktop in the review. The agent cannot attach an image to a review, so how should they be recorded?

## The decision, in plain words

The agent took the pictures, checked them, and wrote down in the review what each one shows; a person can attach the images, or retake them, when reviewing the whole feature.

## The intro, for fun

A picture is worth a thousand words, so here are the words.

## The punchline, for fun

The pictures exist; they just could not get past the door.

## The options, in plain words

A. Describe the screenshots in the sub-PR body, the option built.
B. Commit the screenshots beside the page so the review can show them.
C. A person attaches the screenshots to the feature pull request with the galaxy shots comparison.

## What I had to decide

How the phone and desktop screenshots of /design reach the reviewer.

## What I did meanwhile

Screenshots taken at 393 px and 1280 px wide against a production build, checked by eye, and described in the sub-PR body with the measured page width; the images are not committed.

## What it costs to change later

Nothing to undo: attaching the images later only edits a pull request's text.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- no image hosting reachable from the agent without committing binaries (author)

```

<!-- /omni-outbox-settled: s6-02-design-page-screenshots-described-not-attached -->

<!-- omni-outbox-settled: s7-01-logo-minimum-sizes-and-grounds -->

## s7-01-logo-minimum-sizes-and-grounds — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s7
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-logo-minimum-sizes-and-grounds
prd: 141
slice: s7
rank: medium
bears-on: none
raised: 2026-09-26
wave: 5
---

## The question, in plain words

How small may the Omni Loop logo be drawn, and which version of it goes where?

## The decision, in plain words

Each version is never drawn smaller than its own pixel size, and below that the tab icon or the written name takes over. The full logo is the default and goes on dark backgrounds, while the single dark ink version is for light ones.

## The intro, for fun

The logo got a rulebook. Somebody had to say how tiny is too tiny.

## The punchline, for fun

Below sixteen pixels, even a loop arrow gives up and just writes its name.

## The options, in plain words

A. Never below 1x, the favicon below the mark, text below 16 pixels, as documented (the option built).
B. A larger floor for the wordmarks, 2x for full and lockup, so the 5x7 letters stay legible on high-density screens.
C. Enforce the floor in code: the logo module refuses a scale below a per-form minimum.

## What I had to decide

The minimum size of each logo form and which form and variant goes on which ground, which the spec asks the package's documentation to state but does not settle.

## What I did meanwhile

The package's documentation sets the minimum at 1x for every form (full 122x18, lockup 140x32, mark 20x18, favicon 16x16 and its whole multiples), sends anything smaller than the mark to the favicon and anything under 16 pixels to the name written in the pixel face, and assigns full as the default, lockup to posters and ads, mark to square spots, favicon to tabs; the full-colour crest on dark grounds, the one-colour variant on light grounds or single ink.

## What it costs to change later

Documentation only: changing a minimum or a placement rule is an edit to the package's documentation. No code enforces these sizes, so nothing else moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names 'the minimum sizes' among the brand rules but gives no numbers; no knowledge entry or ADR sets them.

```

<!-- /omni-outbox-settled: s7-01-logo-minimum-sizes-and-grounds -->
