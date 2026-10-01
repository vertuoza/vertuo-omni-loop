---
id: s4-03-slide-rendering-and-fonts
prd: 859
slice: s4
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

The slide is drawn as a web page and photographed by a browser. Which browser does it, and where do the looks' typefaces come from?

## The decision, in plain words

The repository's own Playwright photographs each card, the same tool the proof videos already use, and the typefaces load from Google Fonts at that moment. Without a network the card falls back to a similar system typeface and still fits.

## The intro, for fun

The arcade poster wanted its favourite poster lettering for the photo.

## The punchline, for fun

It borrows it from the internet each time, and wears a lookalike when offline.

## The options, in plain words

A. The repository's Playwright draws each card; typefaces from Google Fonts, a system lookalike offline (built).
B. Ship the three typefaces inside the kit so every card looks the same with no network.
C. Draw the cards with ffmpeg alone, with no browser, and fewer effects.

## What I had to decide

Keep loading the typefaces from Google Fonts when a card is drawn, or ship the typeface files inside the kit so a card always looks the same offline.

## What I did meanwhile

omni pitch slide runs npx playwright screenshot on each card page; the pages link the Anton, Inter and Press Start 2P typefaces from Google Fonts. The slide checks run in a browser where one is installed, and are skipped where none is.

## What it costs to change later

Shipping the typefaces later is adding the files and changing one link per page; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the looks' typefaces but not where they come from; the kit ships as one file, with no room for typeface files today.
- (author) The test machines that check pull requests may have neither the browser nor ffmpeg, so the rendered slide and video checks may be skipped there.
