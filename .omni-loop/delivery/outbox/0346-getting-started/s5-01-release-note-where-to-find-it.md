---
id: s5-01-release-note-where-to-find-it
prd: 346
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The design said a person would see their feature's release note under Release notes in the app, but that page still lists only Omni Loop's own releases. What should the first-feature page tell them?

## The decision, in plain words

The page says the note is a file written beside the feature's spec, reviewed with the finished change, and that the app's Release notes page will show a repository's own notes in a later version.

## The intro, for fun

The release note was ready for its close-up, but the stage belonged to someone else.

## The punchline, for fun

So we told it where its dressing room is, and promised a stage later.

## The options, in plain words

A. Point at the file, and say the app shows it later: What was built: the page names the release note file in the shipped folder and says the app's Release notes page will show it in a later version.
B. Say it appears under Release notes: Follow the spec's user flow word for word, even though a first run will not find it there today.
C. Leave the release note out of the page: End the walk-through at the merge, and add the release note step when the app shows it.

## What I had to decide

Where the Your first PRD page sends the reader to find their PRD's release note, since the app's Release notes page does not show an invaded repository's notes yet (the spec's own Decisions keep them the loop's own for now).

## What I did meanwhile

The last step of the page names release.md in the shipped folder, says it is written only when release notes are switched on, and says the app lists Omni Loop's releases for now.

## What it costs to change later

Cheap to change: a few sentences in one page of the guide.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's user flow and its Decisions disagree on where the note is seen; which one the reader should be told was not settled (author)
