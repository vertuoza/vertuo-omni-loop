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
