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
