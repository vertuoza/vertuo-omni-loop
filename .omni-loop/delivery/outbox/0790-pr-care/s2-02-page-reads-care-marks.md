---
id: s2-02-page-reads-care-marks
prd: 790
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

The page and the terminal command both need to recognise the hidden mark a care reply carries, and the time written in the watch line. Should the page share the terminal's reader, or keep its own copy?

## The decision, in plain words

The page keeps its own small reader of the mark and of the watch line for now, because the terminal's reader is being built at the same time. It expects the watch line's times written in the standard date-and-time form.

## The intro, for fun

Two readers for one hidden mark: twins built in separate rooms on the same day.

## The punchline, for fun

They agree today; a later tidy-up can make them one.

## The options, in plain words

A. keep a separate reader on the page, standard times expected (built)
B. share the terminal's reader once it is merged, in a follow-up slice
C. fix the care line's time format in the spec and have both sides test against one fixture

## What I had to decide

s1 builds the kit's marker reader and state parser in `kit/lib/care/` in the same wave, so galaxy cannot import it yet. The spec also does not fix the time format of the status comment's `PR care: watching since <time> · last round <time>` line.

## What I did meanwhile

`apps/galaxy/src/dossier/github/care.ts` has its own `careVerdictOf` (the `<!-- omni-care: fixed|pushed-back|asked -->` marker) and reads the care line's two times with `Date.parse`, so ISO 8601 times are expected; a time it cannot parse reads as no watch.

## What it costs to change later

Swapping the local reader for an import from `kit/lib/care/` once s1 is merged is a small refactor with the same tests. If s5 writes the times in another form, only the care-line parser changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s1 and s5 write exactly this marker and ISO times is not known from this slice (author)
