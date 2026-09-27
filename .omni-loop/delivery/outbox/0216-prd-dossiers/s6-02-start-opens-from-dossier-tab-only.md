---
id: s6-02-start-opens-from-dossier-tab-only
prd: 216
slice: s6
rank: medium
bears-on: none
raised: 2026-09-27
wave: 5
---

## The question, in plain words

On the planet screen the start button used to go back to the map. It now opens the PRD's page from the dossier tab: what should it do on the other tabs, or on a planet with no dossier?

## The decision, in plain words

It opens the page only on the dossier tab, when there is a page to open, and goes back to the map everywhere else, as before; clicking a tab no longer takes the keyboard away from the start key.

## The intro, for fun

One button, two jobs, and a player who pressed it out of habit.

## The punchline, for fun

It only opens the page where the page is promised.

## The options, in plain words

A. Open the page from the dossier tab only, and go back to the map everywhere else
B. Open the page from any tab of a planet that has a dossier
C. Open the page from the dossier tab, and do nothing on the other tabs

## What I had to decide

Make the start button open the page from any tab of a planet with a dossier, or only from the dossier tab, keeping its old job elsewhere.

## What I did meanwhile

The button opens the page from the dossier tab when a page exists, and goes back to the map in every other case. The tab buttons no longer take the keyboard's focus when clicked, as the key hints already do not.

## What it costs to change later

A few lines in the arcade's key handling, and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether players rely on the start button to leave a planet is not known (author).
