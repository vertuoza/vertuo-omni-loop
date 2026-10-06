# Settled outbox items — PRD 1108

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-pitch-look-alias-answers-preset -->

## s1-01-pitch-look-alias-answers-preset — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-pitch-look-alias-answers-preset
prd: 1108
slice: s1
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

The old address that tells the terminal which look a product uses stays as an alias. Should it keep answering just the look's name, or the full new look with colours and fonts?

## The decision, in plain words

It keeps answering just the name, Arcade or Keynote, taken from the preset the product's look was filled from, so terminals already installed elsewhere keep working unchanged.

## The intro, for fun

An old doorbell, a brand new house: who answers when it rings?

## The punchline, for fun

The old visitors get the same short greeting; the new ones ring the new bell.

## The options, in plain words

A. A. Answer the preset name, as released kits read it (built).
B. B. Answer the whole look (colours, fonts, logo, theme), breaking released kits until they update.
C. C. Answer both: the name under the old key and the whole look under a new one.

## What I had to decide

The spec says the old read stays as an alias that answers the look alone, while released kits read that answer as one of two names. I kept the answer's shape and filled it with the preset the look came from; the full look is on the new read.

## What I did meanwhile

The alias answers the preset name, Arcade for a product with no settings; the new settings read answers everything.

## What it costs to change later

A constant change in one route: answer the look object instead, once no released kit reads the old shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether any kit outside this repository still calls the old read was not measured.

```

<!-- /omni-outbox-settled: s1-01-pitch-look-alias-answers-preset -->

<!-- omni-outbox-settled: s1-02-pitch-settings-defaults -->

## s1-02-pitch-settings-defaults — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-pitch-settings-defaults
prd: 1108
slice: s1
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

What should a product that never set its Pitch settings start with?

## The decision, in plain words

It starts on the Arcade look, as products did before, a Confident and warm voice with no instructions, the eyebrow New, the call to action Available now with credits, no music, and a length of 20 to 40 seconds.

## The intro, for fun

A blank settings page still has to look like something on day one.

## The punchline, for fun

So it looks like yesterday, only quieter: no music until someone picks some.

## The options, in plain words

A. A. Arcade look, no music, eyebrow New, Available now with credits (built).
B. B. Keynote look, as the spec's example and its fallback suggest.
C. C. Free upbeat music by default instead of none.

## What I had to decide

The spec names the voice and length defaults but not the starting look, eyebrow, call to action or music. Products already default to Arcade, so a product with no settings keeps it; music defaults to none because it needs no network and is the fallback the spec names.

## What I did meanwhile

Every unset field reads from these defaults on the page and in the terminal; a product's choices override them field by field.

## What it costs to change later

A constant each: change a default in one place and every product that never set the field follows.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's later step says the terminal falls back to Keynote when it cannot read the settings, which differs from Arcade as the default for a product that has none.

```

<!-- /omni-outbox-settled: s1-02-pitch-settings-defaults -->

<!-- omni-outbox-settled: s1-03-pitch-settings-stored-partial -->

## s1-03-pitch-settings-stored-partial — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-pitch-settings-stored-partial
prd: 1108
slice: s1
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

How much of a product's Pitch settings should be stored, and what happens to the old look choice?

## The decision, in plain words

A product may store only part of its settings, the rest read from its look's preset and the defaults, while the old look choice is kept in step with that preset. Logos, fonts and music go to a private folder per product that any member of the workspace may change.

## The intro, for fun

Half a recipe card is fine as long as the cookbook fills in the rest.

## The punchline, for fun

And the old card stays in the drawer, still telling the truth.

## The options, in plain words

A. A. Store partial settings filled on read, keep the old choice in step, any member changes the files (built).
B. B. Store every product's settings whole, written out by the change.
C. C. Only workspace owners may change the settings and the files.

## What I had to decide

The spec asks that each product's old look reads as the matching preset after the change, and that the old column is kept. Storing just the preset name for existing products, and filling the rest when read, does that with no copy of the presets in the database.

## What I did meanwhile

Existing products store their preset name only; the database refuses a value the terminal could never read; both choices stay in step.

## What it costs to change later

Moving to fully stored settings later is one update that writes each product's filled value; the reads already fill them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Who counts as an editor is any member of the workspace today, as for the rest of the business settings; the spec's line about another member who cannot upload reads as a member of another workspace.

```

<!-- /omni-outbox-settled: s1-03-pitch-settings-stored-partial -->

<!-- omni-outbox-settled: s3-01-check-word-limits -->

## s3-01-check-word-limits — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-check-word-limits
prd: 1108
slice: s3
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

How many words may each piece of a pitch video hold, and how fast do viewers read, before the check warns?

## The decision, in plain words

The check warns past 9 words for a title, 16 for a statement, 6 for a bullet, 5 for a step or a call to action, 4 for an eyebrow, a tag or a label, and 12 for a closing line, and when a scene's words need more than one second per three words. These are warnings only: nothing is refused for them.

## The intro, for fun

Every launch video wants to say everything at once.

## The punchline, for fun

The check counts the words so viewers do not have to.

## The options, in plain words

A. Keep these limits and three words a second, as warnings only.
B. Tighten them (for example 7 words for a title, two and a half words a second).
C. Let each product set its own limits in its Pitch settings.

## What I had to decide

Whether these limits and this reading speed are right for our audiences, or should be tighter or looser.

## What I did meanwhile

Storyboards with longer words still render; the check only prints a warning and records it with the pitch.

## What it costs to change later

Changing a limit or the reading speed is one constant in the check and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names only the 9-word title limit; the other limits and the reading speed of three words a second are the author's choice, not measured with viewers (author).

```

<!-- /omni-outbox-settled: s3-01-check-word-limits -->

<!-- omni-outbox-settled: s5-01-freepd-from-the-archive -->

## s5-01-freepd-from-the-archive — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s5
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-freepd-from-the-archive
prd: 1108
slice: s5
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

FreePD's own website closed in 2025, so where should the free music for a pitch be downloaded from?

## The decision, in plain words

The music comes from the Internet Archive's full copy of FreePD's public domain catalogue, in FreePD's own mood folders. The tracks and their licence are the same; only the address changed.

## The intro, for fun

The record shop we picked closed its doors, but someone kept every record in the basement.

## The punchline, for fun

Same songs, same free licence, new street address.

## The options, in plain words

A. A. Download FreePD's tracks from the Internet Archive's copy of its catalogue.
B. B. Ship a handful of public domain tracks inside the kit, so no download is needed.
C. C. Use another free public domain music catalogue that is still online.

## What I had to decide

Whether the archive's copy of FreePD is a fair source for free pitch music, or whether music should come from another free catalogue.

## What I did meanwhile

Pitches with FreePD music download from the archive; when the archive does not answer, the pitch is silent and says so in one line.

## What it costs to change later

Changing the source later is one address and a short list of tracks in one file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The archive's servers answered an error to some downloads while this was built; each download is tried three times before the pitch goes silent (author).

```

<!-- /omni-outbox-settled: s5-01-freepd-from-the-archive -->

<!-- omni-outbox-settled: s5-02-music-moods -->

## s5-02-music-moods — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s5
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-music-moods
prd: 1108
slice: s5
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

Which moods can a product pick for its free pitch music?

## The decision, in plain words

Five moods: upbeat, calm, epic, playful and electronic, each with three or four tracks picked by hand. The same mood and length always give the same track.

## The intro, for fun

Five moods walk into a launch video, and only one gets to play.

## The punchline, for fun

Sombre was not invited: it is a launch, not a farewell.

## The options, in plain words

A. A. Five moods: upbeat, calm, epic, playful and electronic.
B. B. Only upbeat and calm, the two moods most launches need.
C. C. Every mood folder FreePD had, horror and world music included.

## What I had to decide

Whether these five moods are the right choice for the Pitch settings' music list, and which tracks each one holds.

## What I did meanwhile

The music provider knows these five moods; a mood it does not know makes the pitch silent with one line.

## What it costs to change later

A mood is one entry in a short list: adding, renaming or removing one is a few lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The Pitch settings page is built in another slice, which picks the moods it offers; both must name the same five (author).

```

<!-- /omni-outbox-settled: s5-02-music-moods -->

<!-- omni-outbox-settled: s5-03-provider-name-guard -->

## s5-03-provider-name-guard — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s5
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-provider-name-guard
prd: 1108
slice: s5
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

What exactly counts as a provider's name appearing where it should not?

## The decision, in plain words

No code may load a provider directly except the list of providers, and inside the providers' own folder no file but its own, its test and that list may write its name. A product's settings may still name a provider, since that is a choice the product makes, and an unknown one falls back with one line.

## The intro, for fun

We wanted a provider's name to be a secret, then remembered the settings page has to say it out loud.

## The punchline, for fun

So the secret is kept from the code, not from the people choosing.

## The options, in plain words

A. A. Forbid loading a provider directly anywhere, and writing its name inside the providers' folder.
B. B. Also forbid writing a provider's name anywhere in the kit, settings included.
C. C. Only forbid loading a provider directly.

## What I had to decide

Whether the check should also forbid a provider's name everywhere else in the kit, which would make the settings take their default choices from the list of providers.

## What I did meanwhile

The check stops any code that loads a provider directly, and any provider file that names another one.

## What it costs to change later

Widening the check later is a few lines in one test, plus moving the settings' default choices behind the list of providers.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The settings slice is built at the same time and writes default provider names as data; the narrower check leaves it free to do so (author).

```

<!-- /omni-outbox-settled: s5-03-provider-name-guard -->
