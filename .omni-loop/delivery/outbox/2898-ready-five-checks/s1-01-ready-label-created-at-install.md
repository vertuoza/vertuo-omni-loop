---
id: s1-01-ready-label-created-at-install
prd: 2898
slice: s1
rank: medium
bears-on: none
raised: 2026-11-15
wave: 1
excuses: [kit/lib/init/labels.ts, kit/lib/init/labels.test.ts]
---

## The question, in plain words

The new label that starts the full checks on a draft has to exist before a skill can put it on a pull request. Should the install create it with the other loop labels?

## The decision, in plain words

Yes. The install now creates it with its own colour and description, like every other loop label, so a repository that turns the gate on already has it.

## The intro, for fun

A label nobody created is a sticker with no glue.

## The punchline, for fun

So the install hands it out with the others.

## The options, in plain words

A. Create the label at install, with the other loop labels: what was built.
B. Leave the label optional and uncreated, for a person to make in each repository.

## What I had to decide

The slice adds `labels.readyCheck` (default `omni:ready-check`). `kit/lib/init/labels.test.ts` requires every label the schema names to have a style in `LABEL_STYLES` (`kit/lib/init/labels.ts`), and `omni init` creates only styled labels; neither file is in s1's territory. Leaving the key optional (as PRD 2175 did for `labels.released`) would keep it out of `omni config` and out of the install, and `gh pr edit --add-label` fails on a label that does not exist.

## What I did meanwhile

Added a `readyCheck` style to `LABEL_STYLES` (colour `0052cc`, its own description) and the label to the list `kit/lib/init/labels.test.ts` expects. The two files sit outside s1's territory; this item names them in its excuses field.

## What it costs to change later

Two lines. Reverting means removing the style and making the key optional with a reader, as `releasedLabel()` does.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a person would rather create the label by hand, as for the released label
