---
id: s2-02-target-comment-refused-and-scope
prd: 1130
slice: s2
rank: medium
bears-on: none
raised: 2026-10-06
wave: 2
---

## The question, in plain words

If the app may read a target repository but not write in it, should the retro fail, and should the comment list every finding about that repository or only the ones kept as lessons?

## The decision, in plain words

A refused comment is noted and the retro carries on, and the comment lists every finding about that repository, with its issue when one was opened.

## The intro, for fun

The app knocked on a target's door with a note, and sometimes the door only opens for reading.

## The punchline, for fun

It leaves the note on the mat, writes down that it tried, and goes home.

## The options, in plain words

A. Save a refused write and go on; list every finding of the repository, as built.
B. Fail the run on a refused write, so the failure comment names it.
C. List only the findings the judge kept, those with an issue.

## What I had to decide

Whether a 401, 403 or 404 on the target comment fails the run, and whether the comment lists all of the repository's findings or only those the judge kept.

## What I did meanwhile

A refused write is saved as refused with its status and the next target is commented; any other failure retries the step. The comment lists all the repository's findings on the fact sheet, each with its issue link when one exists.

## What it costs to change later

One branch in target-comment.ts: throw instead of saving the refusal, or filter the findings by the judge's keep marks.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a target not read is never a failure, but says nothing of a target read and not writable; it says that repository's findings without saying kept or not.
