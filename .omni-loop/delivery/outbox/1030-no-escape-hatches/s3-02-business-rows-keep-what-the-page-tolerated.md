---
id: s3-02-business-rows-keep-what-the-page-tolerated
prd: 1030
slice: s3
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

How strict should the business page be about rows that carry more than it reads, or a value the page already knew how to soften?

## The decision, in plain words

A row with extra columns is read for the columns the page uses, since the saving calls answer whole rows. A persona's stance outside the three known ones still shows as neutral, and an empty description may still come back blank, as the page did before.

## The intro, for fun

Strict is easy; strict without breaking a single page is the craft.

## The punchline, for fun

The page keeps its manners and loses its blind trust.

## The options, in plain words

A. A. Drop unknown columns and keep the page's own softening of a persona: the option built.
B. B. Refuse any column a select does not name, with a second schema for each whole row a saving call answers.
C. C. Hold the persona's stance and descriptions to the database's rules, so an odd row fails the page's personas instead of showing as neutral.

## What I had to decide

Whether the business schemas refuse a row with columns they do not name, and whether a persona's stance and descriptions are held to the database's own rules or to what the page already accepted.

## What I did meanwhile

Each schema refuses a missing column, a wrong type, a value outside a column's allowed list (a claim's kind, state and source, a receipt's kind, a draft's state) and a null the column forbids, but drops columns it does not name. A persona's stance is read as text and shown as neutral when unknown, and its two descriptions may be null, as before. One store test's sample answer was filled in to a whole draft row; what the test expects did not change.

## What it costs to change later

One line per schema to refuse extra columns or tighten a persona field, once the saving calls are known to answer only the columns read.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the database never stores a null description or an unknown stance today, so the looser reading changes nothing a person sees
- the plan asks that existing tests keep what they expect; their sample rows had to name a claim's kind and state as the allowed values, a change of the sample's type only
