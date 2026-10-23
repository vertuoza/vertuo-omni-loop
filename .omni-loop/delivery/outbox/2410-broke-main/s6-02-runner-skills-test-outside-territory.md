---
id: s6-02-runner-skills-test-outside-territory
prd: 2410
slice: s6
rank: medium
bears-on: none
raised: 2026-10-23
wave: 4
---

## The question, in plain words

Adding the two skills to the runner lists turned red a test outside this slice's files: the one that compares the database's fixed skill list with the app's. Was it right to widen that test here, instead of adding the two names to the database?

## The decision, in plain words

I widened that test so it allows the two new skills to be missing from the database's list, as it already allowed one earlier skill. The database is unchanged: the app and the runner still refuse a repository skill that borrows one of these names.

## The intro, for fun

Two new names joined the guest list, and the bouncer's old copy did not have them.

## The punchline, for fun

We told the bouncer they were late additions, not gate-crashers.

## The options, in plain words

A. A. Widen the test to the names added after its migration, as built
B. B. Add the later names to the database's fixed list in a new migration, and narrow the test back

## What I had to decide

Pick A to keep it, or B to add the three later names to the database's list in a new migration and narrow the test back.

## What I did meanwhile

The test excludes retro-apply, rewind and knowledge-add from the comparison; the database's list holds the twelve older names.

## What it costs to change later

B is one small migration and one line of the test, in a later slice or PRD.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A repository owner could still allow a repository skill named rewind or knowledge-add in the database; the app and the runner refuse its line, so it never runs. (author)
