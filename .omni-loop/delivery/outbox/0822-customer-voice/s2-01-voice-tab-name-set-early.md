---
id: s2-01-voice-tab-name-set-early
prd: 822
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Adding the voice record to the PRD page's list of documents forced the page to know its tab name and empty line before the tab itself is built. Should this step set them now?

## The decision, in plain words

It set the tab name to User voice and the empty line to the spec's own words, and shows no tab yet. The next step builds the tab itself and can change both.

## The intro, for fun

The page wanted a name for a tab that does not exist yet.

## The punchline, for fun

So it got a name tag before it got a room.

## The options, in plain words

A. Set both strings now, outside this slice's territory, taken from the spec's words (built).
B. Keep the page untouched and leave the type check red until the tab slice lands.
C. Keep voice out of the page's artifact kinds with a second list of stored kinds, merged later by the tab slice.

## What I had to decide

Whether the tab's name and empty line may be set by the step that adds the record, ahead of the step that builds the tab.

## What I did meanwhile

The label 'User voice' and the empty line from the spec sit in the page's two lookup tables (DossierPage.tsx EMPTY, view.ts TAB_LABELS); no tab lists voice yet, so nothing changes on screen.

## What it costs to change later

Two strings; the tab slice s3 may reword or move them for the price of a constant.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the words are the spec's own (author).
