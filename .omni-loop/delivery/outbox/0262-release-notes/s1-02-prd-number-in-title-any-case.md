---
id: s1-02-prd-number-in-title-any-case
prd: 262
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

A release note's title may not name a PRD number. Should the check also refuse one written in lowercase, or with no space before its digits?

## The decision, in plain words

Yes: the check refuses a PRD number however it is written, since the page already shows the number beside every title.

## The intro, for fun

A rule against numbers in titles soon meets a title that whispers its number in lowercase.

## The punchline, for fun

The check hears whispers too, so the number stays out of the headline.

## The options, in plain words

A. Refuse a PRD number in any case, with or without a space: the option built.
B. Refuse only the capitalised form with a space, exactly as the spec writes it.

## What I had to decide

How strictly rule 4 reads "does not match `PRD <digits>`": the spec writes the form in capitals with a space, and does not say whether `prd 7` or `PRD12` count.

## What I did meanwhile

The title rule matches `PRD` in any case, then optional whitespace, then digits, at a word boundary (`/\bPRD\s*\d+/i` in `kit/lib/releases/note.mjs`). Tests pin `PRD 12`, `prd 7` and `PRD12` as refused and `PRDs` as fine.

## What it costs to change later

One regular expression and its test lines; no stored data. A note that passes today still passes under the narrower reading.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a product name could legitimately read as PRD followed by a number in a title; none is known here.
