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

<!-- omni-outbox-settled: s2-01-pitch-section-replaces-look-view -->

## s2-01-pitch-section-replaces-look-view — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-pitch-section-replaces-look-view
prd: 1108
slice: s2
rank: medium
bears-on: none
raised: 2026-10-06
wave: 2
---

## The question, in plain words

The product's page used to draw its single look dropdown from the shared products list file. Should the new Pitch section live there too, or on the product's own page?

## The decision, in plain words

The Pitch section lives on the product's own page, and the old look dropdown was removed from the shared list file, which now only draws the list of products.

## The intro, for fun

A one-shelf cupboard just got a whole kitchen to hold.

## The punchline, for fun

So the kitchen got its own room, and the cupboard went back to holding cups.

## The options, in plain words

A. A. Draw the section on the product's own page and remove the old dropdown from the shared file (built).
B. B. Keep drawing the product's page from the shared file, with the new section in it.
C. C. Keep the old dropdown beside the new section.

## What I had to decide

Whether removing the old look dropdown from the shared products list file, outside this slice's planned files, is fine, or the section should have been drawn from that file instead.

## What I did meanwhile

The product's page draws its name and the Pitch section itself; the list of products is unchanged and still shows each product's look.

## What it costs to change later

Moving the section back into the shared file is a move of one component, with no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names the product page and a new form file for this slice but not the shared list file, where the old dropdown lived and had to go.

```

<!-- /omni-outbox-settled: s2-01-pitch-section-replaces-look-view -->

<!-- omni-outbox-settled: s2-02-preset-keeps-logo-uploads-wait-for-save -->

## s2-02-preset-keeps-logo-uploads-wait-for-save — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-preset-keeps-logo-uploads-wait-for-save
prd: 1108
slice: s2
rank: medium
bears-on: none
raised: 2026-10-06
wave: 2
---

## The question, in plain words

When someone picks Arcade or Keynote, should it also wipe the logo they uploaded, and should an uploaded file count before they press Save?

## The decision, in plain words

Picking a preset fills every colour, font and the theme but keeps the product's own logo. An uploaded file goes into the product's private folder at once, and the settings only point at it once Save is pressed.

## The intro, for fun

Switching outfits should not mean losing your name tag.

## The punchline, for fun

The new outfit goes on, the name tag stays, and nothing is final until you say yes.

## The options, in plain words

A. A. Keep the logo on a preset; an upload waits for Save (built).
B. B. Clear the logo on a preset too.
C. C. Save the settings right after each upload.

## What I had to decide

Whether a preset should keep or clear the uploaded logo, and whether an upload should save the settings by itself.

## What I did meanwhile

A preset keeps the logo; after an upload the page says to save, and Discard changes forgets the upload while the file stays in the folder.

## What it costs to change later

Each is a line in the page's state: clear the logo on a preset, or save right after an upload.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a preset fills the whole section as a starting point, and does not say whether the product's own logo counts as part of it.

```

<!-- /omni-outbox-settled: s2-02-preset-keeps-logo-uploads-wait-for-save -->

<!-- omni-outbox-settled: s2-03-one-name-for-the-look -->

## s2-03-one-name-for-the-look — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-one-name-for-the-look
prd: 1108
slice: s2
rank: medium
bears-on: none
raised: 2026-10-06
wave: 2
---

## The question, in plain words

Two parts of the product now call two different things a look, the page's choice between Arcade and Keynote and the settings' whole set of colours and fonts, and the repository's tidiness check refuses that. Which one keeps the name?

## The decision, in plain words

The page's choice keeps the name, as it had it first; the shared settings file keeps its whole look under that name only inside itself, so nothing outside it can mix them up.

## The intro, for fun

Two cousins named Look showed up at the same family dinner.

## The punchline, for fun

The older one keeps the name tag; the younger one answers to it only at home.

## The options, in plain words

A. A. Keep the name for the page's choice, and keep the settings' whole look private to its file (built).
B. B. Rename the page's choice and let the settings offer the name.
C. C. Rename both.

## What I had to decide

Whether a one-word change in the shared settings file, planned for another slice, is the right fix, or the page's older name should give way instead.

## What I did meanwhile

The shared settings file still describes the whole look the same way; only its name is no longer offered to other files.

## What it costs to change later

Offering the name again is one word, once the page's older name is renamed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The clash came with the settings slice already merged; this slice's planned files could not fix it alone.

```

<!-- /omni-outbox-settled: s2-03-one-name-for-the-look -->

<!-- omni-outbox-settled: s4-01-engine-page-contract -->

## s4-01-engine-page-contract — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-engine-page-contract
prd: 1108
slice: s4
rank: medium
bears-on: none
raised: 2026-10-06
wave: 2
---

## The question, in plain words

How should the tool that films a pitch tell the animation page what to draw, and learn how long the video is?

## The decision, in plain words

The page reads one input file holding the storyboard, the look, the fonts, the logo and the credits, draws any frame on request once everything has loaded, and answers the video's length and each scene's best still image. A player mode with keyboard keys and an automatic reload is built in for the preview.

## The intro, for fun

Every film set needs one script that everybody reads from.

## The punchline, for fun

Ours fits in a single file, and the camera can ask for any frame it likes.

## The options, in plain words

A. A. One input file beside the run, a call to draw a frame and one to read the video's length and stills, a built-in player mode (built).
B. B. The page reads the storyboard and the look from fixed file names in the run's folder, and the render works out the length itself.
C. C. The render injects everything into the page through calls, with no input file at all.

## What I had to decide

Whether one input file and two page calls are the right way for the render and the preview to drive the animation page, before the render is built on it.

## What I did meanwhile

The render and the preview, built next, write the input file beside the run and ask the page for frames, its length and its stills through these calls.

## What it costs to change later

A few lines in the page and in the render: the file's name, a field, or a call can be renamed while only these two use them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the call that draws a frame but not how the page learns its storyboard, nor how the render learns the video's length; both are this slice's choice.
- (author) The preview's keys and its reload follow the spec's line on the studio; the studio itself is built in a later slice, which may want them otherwise.

```

<!-- /omni-outbox-settled: s4-01-engine-page-contract -->

<!-- omni-outbox-settled: s4-02-render-tests-need-a-browser -->

## s4-02-render-tests-need-a-browser — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-render-tests-need-a-browser
prd: 1108
slice: s4
rank: medium
bears-on: none
raised: 2026-10-06
wave: 2
---

## The question, in plain words

The tests that compare the video's frames with reference images need a browser. Should the automatic checks on pull requests install one so they always run?

## The decision, in plain words

These tests run wherever the browser is installed, as on a developer's computer, and are skipped where it is not, as on the automatic checks today, like the older pitch slide tests already are.

## The intro, for fun

A screen test is hard to pass when nobody brought a screen.

## The punchline, for fun

So the test waits politely for a machine that has one.

## The options, in plain words

A. A. Run them where the browser is installed and skip them elsewhere, as the older slide tests do (built).
B. B. Install the browser in the automatic checks so they always run.
C. C. Make them fail where no browser is installed.

## What I had to decide

Whether the automatic checks should install the browser so the frame comparisons run on every pull request, at the price of a slower check.

## What I did meanwhile

The frame comparisons and the two-looks colour test run on any computer with the browser installed, and the automatic checks skip them while still running the engine's other tests.

## What it costs to change later

One install step in the checks' workflow, a minute or so on each run; no code changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the checks' machines draw text close enough to a developer's computer to stay within the tolerance was not measured: the tests load their own fonts to keep that gap small.

```

<!-- /omni-outbox-settled: s4-02-render-tests-need-a-browser -->

<!-- omni-outbox-settled: s4-04-dead-code-check-entry -->

## s4-04-dead-code-check-entry — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-04-dead-code-check-entry
prd: 1108
slice: s4
rank: medium
bears-on: none
raised: 2026-10-06
wave: 2
---

## The question, in plain words

The animation page is reached only by the build, never by other code, so the unused-code check thought all of it was unused. Was it right to teach that check about it, a file outside this slice's agreed area?

## The decision, in plain words

One line in the unused-code check's settings names the page's starting file as a place the code starts from, the same way the build script and the command line are already named there.

## The intro, for fun

The guard did not recognise the new building because it has no front door on the street.

## The punchline, for fun

We gave it an address card, like the neighbours already have.

## The options, in plain words

A. A. Name the page's starting file in the check's settings, as the build is (built).
B. B. Leave the settings alone and accept the check's warning on every change.
C. C. Move the page's starting file somewhere the check already looks.

## What I had to decide

Whether that one settings line outside the slice's area is acceptable, or the page should be wired some other way.

## What I did meanwhile

The unused-code check sees the whole animation page as used, and still reports anything inside it that nothing uses.

## What it costs to change later

One line to remove or move in one settings file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The slice's agreed area does not list the check's settings file; nothing else could tell the check where the page starts.

```

<!-- /omni-outbox-settled: s4-04-dead-code-check-entry -->

<!-- omni-outbox-settled: s6-01-engine-page-travels-in-the-bundle -->

## s6-01-engine-page-travels-in-the-bundle — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-engine-page-travels-in-the-bundle
prd: 1108
slice: s6
rank: medium
bears-on: none
raised: 2026-10-06
wave: 3
---

## The question, in plain words

A team that installed the kit holds a single copy of the command-line tool and nothing else. How does that copy reach the animation page it needs to film a pitch?

## The decision, in plain words

The tool carries the animation page inside itself, as text, and hands it out from a small local server while it films or previews. Nothing extra is installed or copied into the team's folder; the tool grows by about seven hundred kilobytes.

## The intro, for fun

One suitcase allowed on the plane, and the costume does not fit in the carry-on.

## The punchline, for fun

So we folded the costume into the suitcase lining.

## The options, in plain words

A. A. The tool carries the animation page inside itself and hands it out while it works (built).
B. B. The page ships as its own folder beside the tool, copied in when the kit is installed or updated.
C. C. The tool downloads the page from the kit's home the first time it needs it.

## What I had to decide

How the render and the studio reach the engine page in a repository that only carries the bundle.

## What I did meanwhile

kit/build.ts builds the engine first and defines __OMNI_PITCH_ENGINE__ with its two files' text; kit/lib/pitch/render-page.ts reads it (or kit/dist/pitch-engine/ from source) and render-server.ts serves it from memory. package.json files and kit/test/dist.test.ts are unchanged. A test runs omni pitch studio from a lone copy of the bundle and gets the page byte for byte.

## What it costs to change later

A few lines: the build's define and the page loader. Shipping the folder instead means adding it to package.json files, to the install that copies the bundle, and to kit/test/dist.test.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The bundle grows from 1.9 MB to 2.7 MB, in every repository that carries it; nobody stated a size limit.
- (author) kit/build.ts lies outside this slice's territory; the build had to change for the bundle to carry the page.

```

<!-- /omni-outbox-settled: s6-01-engine-page-travels-in-the-bundle -->

<!-- omni-outbox-settled: s6-02-slide-images-are-the-intro-still -->

## s6-02-slide-images-are-the-intro-still — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-slide-images-are-the-intro-still
prd: 1108
slice: s6
rank: medium
bears-on: none
raised: 2026-10-06
wave: 3
---

## The question, in plain words

The Pitch tab still expects two pictures, a wide one and a square one, beside the videos. The old still slide that made them is gone, so where do they come from now?

## The decision, in plain words

Both pictures are the opening scene of the new video, taken once it has settled: the wide one at full size and the square one drawn for a square screen. The Pitch tab and the upload stay exactly as they were.

## The intro, for fun

The poster printer retired, but the cinema still has an empty frame by the door.

## The punchline, for fun

We hang the film's own opening shot in it.

## The options, in plain words

A. A. Both images are the intro scene's settled still, wide and square (built).
B. B. Both images are the contact sheet of every scene.
C. C. The push stops asking for the two images, and the Pitch tab shows a frame of the video instead.

## What I had to decide

What slide.png and slide-square.png hold now that PRD 859's still slide is removed, given that omni pitch push still requires the five files.

## What I did meanwhile

render captures the intro scene's still frame at 1920×1080 as slide.png and at 1080×1080 as slide-square.png, and records the five files in pitch.json under files, as before.

## What it costs to change later

One frame number and one name in the render; the push and the Pitch tab do not change either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec removes the still slide and keeps the push unchanged, but does not say what the two images the push requires should show.

```

<!-- /omni-outbox-settled: s6-02-slide-images-are-the-intro-still -->

<!-- omni-outbox-settled: s6-03-music-key-moment -->

## s6-03-music-key-moment — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-03-music-key-moment
prd: 1108
slice: s6
rank: medium
bears-on: none
raised: 2026-10-06
wave: 3
---

## The question, in plain words

The storyboard names the moment the music should hit, but a free track carries no marker saying where its own big moment is. How is the track lined up with the video?

## The decision, in plain words

Every track's big moment is taken to be eight seconds in, where free tracks have usually left their opening bars, and the track starts early enough for that moment to land on the storyboard's. Without a marked moment, the track starts at its beginning.

## The intro, for fun

The drummer counts in, but nobody wrote down which bar has the cymbal crash.

## The punchline, for fun

We bet on bar eight, like most free songs.

## The options, in plain words

A. A. A track's key moment is taken as eight seconds in (built).
B. B. Each pinned free track records its own key moment, measured once by a person.
C. C. The render finds the first strong beat of the track itself before lining it up.

## What I had to decide

How the music's sync point is placed when a provider gives a track with no beat or key-moment information.

## What I did meanwhile

The render starts the track at (8 s minus the sync point's time in the video), never before its start, and the encode normalises it, fades it in and out and cuts it to the video.

## What it costs to change later

One constant in the music step; a real beat finder or a per-track key moment replaces it without touching anything else.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec asks for the sync point to land on the storyboard's key moment but no provider says where a track's own key moment is; eight seconds is a guess at where pinned FreePD tracks leave their intro.

```

<!-- /omni-outbox-settled: s6-03-music-key-moment -->

<!-- omni-outbox-settled: s6-04-changes-beyond-the-slice -->

## s6-04-changes-beyond-the-slice — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-04-changes-beyond-the-slice
prd: 1108
slice: s6
rank: medium
bears-on: none
raised: 2026-10-06
wave: 3
---

## The question, in plain words

Finishing this slice needed a few changes in files planned for other slices: removing the old generated music and the old video recipe, and fixing how the tool finds the browser it films with. Is it fine that this slice made them?

## The decision, in plain words

Yes: the old generated music and the old recipe that stitched a still slide to a clip are deleted, as the spec asks, and the browser lookup now works with the way the browser package is published. Nothing else in those files changed.

## The intro, for fun

Moving into the new flat meant taking out the neighbour's old sofa too.

## The punchline, for fun

We asked the sofa; it did not object.

## The options, in plain words

A. A. This slice removes the dead parts and fixes the browser lookup (built).
B. B. The dead parts stay until a later clean-up, and the browser fix goes in its own fix.

## What I had to decide

Whether this slice may change kit/lib/pitch/music.ts, kit/lib/pitch/ffmpeg.ts and the playwright capture provider, which sit outside its territory.

## What I did meanwhile

music.ts keeps only silenceWav (the none provider's), ffmpeg.ts keeps only framesArgs (the encode provider's), their tests lose the parts that tested what was removed, and the playwright capture provider reads chromium from the default export when the package resolves to its CommonJS entry (without that no frame could be captured in this repository).

## What it costs to change later

Nothing to undo: the removed code had no caller left, and the fix is two lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says the music and ffmpeg modules are used only through the registry, not changed, by this slice; the spec asks for the procedural music and the stitching to go away.

```

<!-- /omni-outbox-settled: s6-04-changes-beyond-the-slice -->

<!-- omni-outbox-settled: s6-05-run-folder-holds-settings-and-assets -->

## s6-05-run-folder-holds-settings-and-assets — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-05-run-folder-holds-settings-and-assets
prd: 1108
slice: s6
rank: medium
bears-on: none
raised: 2026-10-06
wave: 3
---

## The question, in plain words

To film a pitch, the tool needs the product's Pitch settings and its uploaded logo and music on this computer. Where in the pitch's folder should it find them?

## The decision, in plain words

The settings sit in the pitch's folder as one settings file, and uploaded files sit in an assets folder beside it. A pitch with no settings file uses the look it was started with, and a missing logo is simply left out, said in one line.

## The intro, for fun

The film crew arrives on set and asks where the costumes are kept.

## The punchline, for fun

One wardrobe, one rack, both right by the door.

## The options, in plain words

A. A. One settings file and an assets folder inside the pitch's folder (built).
B. B. The settings inside the pitch's record file, and the uploads fetched while the video is made.
C. C. The settings read from the Omni page every time, with no copy in the folder.

## What I had to decide

The file names the render and the studio read the run's Pitch settings and uploaded files from, before the next slice writes them.

## What I did meanwhile

render and studio read settings.json (filled from its preset; out of shape stops the render, naming each field) and resolve asset:<name> to assets/<name>; without settings.json they read the preset pitch.json names. Fonts a product uploaded are not resolved yet: a font set to its uploaded file falls back to the system font with one line.

## What it costs to change later

Two names in one small module; the next slice writes whatever names are chosen.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan has the next slice write the settings into the run's folder but names no file; the settings' schema gives a font no uploaded-file field, so an uploaded font cannot be found yet.

```

<!-- /omni-outbox-settled: s6-05-run-folder-holds-settings-and-assets -->

<!-- omni-outbox-settled: s7-01-start-falls-back-to-arcade -->

## s7-01-start-falls-back-to-arcade — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s7
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-start-falls-back-to-arcade
prd: 1108
slice: s7
rank: medium
bears-on: none
raised: 2026-10-06
wave: 4
---

## The question, in plain words

When the terminal cannot read a product's Pitch settings, which look should the video use? The plan says Keynote, but products with no settings already start on Arcade.

## The decision, in plain words

It uses the same defaults a product with no settings has: the Arcade look, a confident and warm voice, no music, and a length of 20 to 40 seconds, with one line saying why.

## The intro, for fun

The wardrobe is locked, so which outfit does the presenter wear tonight?

## The punchline, for fun

The one every new product already wears, so nobody gets two different first days.

## The options, in plain words

A. Fall back to the default settings, Arcade, as a product with no settings reads (built).
B. Fall back to the Keynote preset, as the plan's sentence says.
C. Refuse to start when the settings cannot be read.

## What I had to decide

Whether an unreadable product falls back to the Arcade defaults settled earlier, or to Keynote as the plan's sentence says.

## What I did meanwhile

omni pitch start writes the default settings (Arcade) into the run when the Omni page cannot answer or answers settings out of shape, and prints one line naming the reason.

## What it costs to change later

One constant: the fallback reads the default preset, so changing that default, or naming Keynote here, is a one-line change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's done-when names Keynote as the fallback, written before the first slice settled Arcade as the default; nothing says which should win.

```

<!-- /omni-outbox-settled: s7-01-start-falls-back-to-arcade -->

<!-- omni-outbox-settled: s7-02-walk-through-is-filmed-by-the-kit -->

## s7-02-walk-through-is-filmed-by-the-kit — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s7
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-02-walk-through-is-filmed-by-the-kit
prd: 1108
slice: s7
rank: medium
bears-on: none
raised: 2026-10-06
wave: 4
---

## The question, in plain words

Who films the walk-through on the live product, and how does the video know where each button is?

## The decision, in plain words

The assistant writes the walk-through as a short list of steps, and the terminal plays and films it, noting where each element sits. It refuses any click on a button that saves, sends, deletes or submits.

## The intro, for fun

A camera crew on a live set, and nobody may touch the props.

## The punchline, for fun

So the camera holds the script, and it slaps away any hand that reaches for Save.

## The options, in plain words

A. The kit plays a list of steps, films it, guards every click and writes the moments (built).
B. The skill writes its own browser script and computes the moments itself, with no guard in the kit.
C. The kit plays the steps and also blocks every request that is not a read, at the network.

## What I had to decide

Whether the walk-through stays a script the skill writes and runs, or a list of steps the kit plays, films and guards.

## What I did meanwhile

A new verb, omni pitch film, plays walk.json in the repository's Chromium, refuses a click on a submit button or on words that save, send, delete or change anything (English and French), and writes walk.webm and moments.json with each element's box and the camera that shows it. The clip is a VP8 WebM with a keyframe every half second, not an MP4: the Chromium Playwright ships plays no H.264, and the render draws the clip in it.

## What it costs to change later

One verb and one module: the skill could go back to writing its own script by changing one step, with no stored data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the walk-through writes moments.json but not who plays it; the word list the guard refuses is a best guess for English and French screens.

```

<!-- /omni-outbox-settled: s7-02-walk-through-is-filmed-by-the-kit -->

<!-- omni-outbox-settled: s7-03-uploaded-files-are-not-fetched -->

## s7-03-uploaded-files-are-not-fetched — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s7
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-03-uploaded-files-are-not-fetched
prd: 1108
slice: s7
rank: medium
bears-on: none
raised: 2026-10-06
wave: 4
---

## The question, in plain words

A product's logo, fonts and music uploaded on the Omni page are private files. How do they reach the computer that makes the video?

## The decision, in plain words

They do not yet: nothing lets the terminal download them. When the settings point at one, the terminal says so in one line, and a person may copy the file into the pitch's folder; otherwise the video goes without it.

## The intro, for fun

The costumes are in the studio's locked wardrobe, and the film crew has no key.

## The punchline, for fun

So the crew says which costume is missing, and someone may bring it over by hand.

## The options, in plain words

A. Name each missing file in one line and let a person copy it into the run (built).
B. Add a route on the Omni page answering signed links for a product's files, and download them at start.
C. Refuse to start a pitch whose settings point at a file the run cannot fetch.

## What I had to decide

Whether a later change adds a way for the terminal to download a product's uploaded files, or whether copying them by hand stays the way.

## What I did meanwhile

omni pitch start names each file the settings point at (asset:<name>) in one line; render and studio read it from the run's assets/ folder, and without it the logo is left out, a font falls back to the system's and the music to none, each in one line. An uploaded font (stored as the family asset:<file>) is asked of the fonts provider by its file.

## What it costs to change later

An Omni page route that answers signed links for a product's files, and a few lines in start that download them into assets/; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The Omni page has no route answering a product's uploaded files to the terminal, and this slice's ground does not include the page.

```

<!-- /omni-outbox-settled: s7-03-uploaded-files-are-not-fetched -->

<!-- omni-outbox-settled: s7-04-changes-beyond-the-slice -->

## s7-04-changes-beyond-the-slice — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s7
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-04-changes-beyond-the-slice
prd: 1108
slice: s7
rank: medium
bears-on: none
raised: 2026-10-06
wave: 4
---

## The question, in plain words

Making the video from the settings needed small changes in a few files outside this slice's ground. Were they right to make?

## The decision, in plain words

Yes: the terminal's call to the Omni page gained the new settings address and lost the old look-only one nothing used any more, the step that loads fonts now finds an uploaded font, and the skill's tests follow the rewritten skill.

## The intro, for fun

A few small screws turned outside the cupboard the carpenter was hired to build.

## The punchline, for fun

Without them the cupboard's door would not close.

## The options, in plain words

A. Keep these edits in this slice (built).
B. Move them to a slice of their own, leaving this one unable to read the settings or draw an uploaded font.

## What I had to decide

Whether these edits stay, or move to slices of their own.

## What I did meanwhile

kit/lib/ask/client.ts gains readPitchSettings (GET /api/pitch-settings) and drops readPitchLook, now unused; kit/lib/pitch/render-input.ts asks each font through fontRequestOf so a family asset:<file> is drawn from the run's file; kit/test/plugin.test.ts's pitch block tests the rewritten skill, including the never-invent rule. The providers' network type is renamed ProviderFetch (kit/lib/pitch/providers/types.ts and the seven files that use it), so it no longer shares its name with the Omni page client's Fetch, which the dead-code audit against main reported. The render's local server (kit/lib/pitch/render-server.ts) now answers a byte range of a run's file: without it the browser could seek a clip only as far as it had downloaded, and a filmed walk-through's frame often showed the clip's first, blank frame, in the stills and the videos alike.

## What it costs to change later

Each is a few lines; reverting one means the old look-only read, no uploaded fonts, or the old skill's tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for this slice names neither the Omni page client, the render's input nor the plugin's test file, though the slice cannot be done without them.

```

<!-- /omni-outbox-settled: s7-04-changes-beyond-the-slice -->

<!-- omni-outbox-settled: s4-03-engine-zone-browser-packages -->

## s4-03-engine-zone-browser-packages — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-06T16:26:48Z
- Channel: feature pull request #1109
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1109#issuecomment-6020708196
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: ADR-0058
- Raised: 2026-10-06
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
A. A. React, React DOM and the kit's checking library, nothing written for servers (built).
```

### The item, as it was raised

```text
---
id: s4-03-engine-zone-browser-packages
prd: 1108
slice: s4
rank: high
bears-on: ADR-0058
raised: 2026-10-06
wave: 2
---

## The question, in plain words

The new animation code runs in a browser. Which outside libraries may it use besides React?

## The decision, in plain words

Besides the kit's shared code, it may use React and the checking library the kit already uses for every input, and nothing written for servers. Its tests are free of that limit.

## The intro, for fun

A browser is a small kitchen: not every appliance fits.

## The punchline, for fun

React and the input checker got a counter; the server tools stay in the garage.

## The options, in plain words

A. A. React, React DOM and the kit's checking library, nothing written for servers (built).
B. B. React and React DOM only, the page trusting its input unchecked.
C. C. Any library at all, like the other parts of the repository.

## What I had to decide

Whether the animation code may also use the kit's checking library, or React alone as first said, which would leave the page unable to check what it is given.

## What I did meanwhile

The import check refuses any other library and anything written for servers in the animation code, naming the line; the page checks its input with the same rules the kit uses everywhere.

## What it costs to change later

A name in one list of the import check and a line of the decision record; dropping the checking library would also mean checking the input elsewhere.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The slice's brief says React and the kit's shared code only; the checking library is one the kit's shared code already uses, so the page carries it either way.

```

- Became: ADR-0058

<!-- /omni-outbox-settled: s4-03-engine-zone-browser-packages -->
