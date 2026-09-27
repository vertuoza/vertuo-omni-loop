---
id: s6-03-planet-dossiers-read-one-by-one
prd: 216
slice: s6
rank: medium
bears-on: none
raised: 2026-09-27
wave: 5
---

## The question, in plain words

The arcade reads each planet's dossier when the galaxy loads. Should it ask the database once for every dossier, or once for each planet that has one?

## The decision, in plain words

Once for each planet that has one: it first finds which planets have a dossier, then reads each on its own. Asking for every dossier at once would also work out the questions of every other dossier in the workspace, on every page load.

## The intro, for fun

A galaxy of forty planets, and one librarian fetching folders.

## The punchline, for fun

She fetches only the folders that exist, a few at a time.

## The options, in plain words

A. Find the planets' dossiers first, then read each one on its own
B. Read every dossier of the workspace in one request and keep the planets'
C. Read a planet's dossier only when a player opens its dossier tab

## What I had to decide

Read every dossier of the workspace in one request, or read only the planets' dossiers, two small requests each.

## What I did meanwhile

Two small requests find the plan repository and its dossiers, then two requests for each planet with a dossier read its versions, its counts and its last answers, side by side, after the galaxy.

## What it costs to change later

One function in the arcade's data layer, and nothing stored: switching to a single request is a small change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How many planets will carry a dossier, and how much longer the arcade then takes to open, is not measured (author).
- Whether the database could narrow one request for every dossier to the plan repository before working out each one's questions was not tried (author).
