---
id: s2-04-fixtures-brought-to-the-real-row
prd: 1030
slice: s2
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The new checks refuse a row with a column too many or too few, and some test stand-ins answered rows a real database never sends: should the checks or the stand-ins change?

## The decision, in plain words

The stand-ins changed: they now answer the rows the real database sends, and no test expects anything different. The checks stay strict, so a row with a column nobody asked for is refused.

## The intro, for fun

A strict doorman will not wave in a rehearsal guest wearing a costume from another play.

## The punchline, for fun

So the rehearsal guests got the real costumes.

## The options, in plain words

A. A. Strict schemas, the stand-ins brought to the real answers: the option built.
B. B. Schemas that drop unknown columns, the stand-ins left as they were, so a renamed column in a select goes unnoticed.
C. C. Strict schemas with the old stand-ins, the tests' expectations changed, which the plan rules out.

## What I had to decide

Whether the schemas refuse an unknown column (strict) and the test stand-ins are brought to the real answers, or the schemas drop unknown columns quietly and the stand-ins stay as they were.

## What I did meanwhile

Four test files changed what they hand in, never what they expect: the season cache's stand-in now answers only the selected columns, the board's dossier list rows carry every column, and the saved constituent and repository rows carry the workspace and dates the database functions answer.

## What it costs to change later

A select that reads a column the schema does not list fails the read instead of passing it on; loosening one schema later is one word.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether production holds rows the local database does not (a hero stored with its version as text, which the database's own check allows) is only known after the production check runs once before ready
