---
id: s3-01-missing-file-reads-too-large
prd: 1272
slice: s3
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

When one of a concept's files is not on the page, how can the page tell whether it was too large to send or simply never existed?

## The decision, in plain words

It cannot tell, so any file of a concept that is not on the page reads "not sent: too large" on its tab, as the spec asks, never as missing.

## The intro, for fun

A parcel never arrived, and the post office only remembers that it did not come.

## The punchline, for fun

So the note on the door blames the size of the box, every time.

## The options, in plain words

A. A. Every absent file of a concept reads "not sent: too large", as built.
B. B. The push tells the server which files it held back, and only those read "not sent: too large"; any other absent file reads as not recorded.
C. C. An absent file reads "not sent: too large, or not recorded".

## What I had to decide

Whether a tab with no version reads "not sent: too large" for every absent file, or whether the push should also tell the server which files it held back, so the page can say "too large" only when that is true.

## What I did meanwhile

ConceptPage.view.ts marks a tab "not sent: too large" (badge and pane) whenever the concept dossier holds no version of its kind: concept-record for Overview and Areas, vision, board, debate. omni dossier push --kind concept names a file over 512 KiB on stderr and sends nothing about it, and a folder with no vision.html sends the rest (s1), so the server never learns why a file is absent.

## What it costs to change later

To say it only when true: the push sends the names of the files it held back, the migration stores them per dossier, and the page reads them. A follow-up migration plus a change in the kit and the page; nothing to undo here but one condition.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a file too large "never shows as missing" but the push from s1 does not tell the server which files were too large.
