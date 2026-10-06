---
id: s5-01-guide-rows-wait-for-skills
prd: 1118
slice: s5
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

The page about working across several repositories should list the two new commands in its table, but its own check refuses to name a command that does not exist yet, and the two commands are only built in later steps. When should the table list them?

## The decision, in plain words

The drawing already shows both commands now. The two table rows are written and kept aside, to be added in the same step that builds the last of the two commands, so the page never names a command that is not there.

## The intro, for fun

The guide wanted to introduce two guests who had not arrived yet.

## The punchline, for fun

The doorman checked the list and said: not until they walk in.

## The options, in plain words

A. A. Draw both now; add the two table rows and the caption names in the step that builds the second command, once both exist
B. B. Move this whole step after both commands are built, in a later wave
C. C. Name both in the table now and let the guide check stay red until both commands exist

## What I had to decide

Whether the guide's table rows for the two new commands land with the last command's own step, or the build order changes so this step runs after both.

## What I did meanwhile

The diagram and its test are merged; the guide table does not list the two commands yet, so the guide check stays green for every later step.

## What it costs to change later

Adding two table rows and two names in one picture caption: a few lines, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan put this step in the first wave and said it shares nothing with the others, but the guide check ties it to the steps that create the two commands (author)
- The rows are written and kept in the slice's hand-off; whoever builds the last command must add them, or they are lost (author)
