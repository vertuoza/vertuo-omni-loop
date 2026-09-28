---
id: s4-03-lessons-kept-in-the-retro-record
prd: 487
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The judge compares each retro with the lessons of earlier retros, but the retro record never stored its lessons. Where should they be kept so the next retro can read them?

## The decision, in plain words

Each run of a retro now also keeps, in its record file, the lessons that passed the checks and the verdict, and the next retro reads those lessons. Older records hold none, so the first retros compare only with the knowledge base.

## The intro, for fun

The judge was told to remember old lessons, but nobody had ever written them down.

## The punchline, for fun

So now the notebook comes with the lesson.

## The options, in plain words

A. Each run of the record keeps its accepted lessons and the verdict, and the next retro reads them from every run; the option built.
B. The record keeps one list of lessons for the whole retro at its top, rewritten by each run.
C. Only the lessons of findings the judge kept are stored, so the next judge compares with kept lessons alone.

## What I had to decide

The spec asks the judge for "every lessons[].text in the retro.json files", but retro.json has only ever held the fact sheet, the narration outcome and the issues: no retro wrote its lessons. The shape of where they live was not settled.

## What I did meanwhile

Each run record in retro.json gains two optional fields: `lessons` (the lessons `guard` accepted, text and cited finding ids, dropped ones left out) and `verdict` (as `guard` kept it). `gather-knowledge` reads `runs[].lessons[].text` from every `<shipped>/<prd>/retro.json` at the merge commit, oldest PRD first, each text once.

## What it costs to change later

A constant: the field name and where it sits in the record. Moving it to the top of the file is one line to write and one to read; no stored record holds lessons yet.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the field `lessons[].text` without saying whether it is per run or per file; per run keeps a day-14 run's lessons apart from the merge run's.
- (author) Whether lessons of findings the judge did not keep should be kept too: every accepted lesson is kept, so a later judge sees more, not less.
