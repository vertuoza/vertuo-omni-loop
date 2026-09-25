---
id: s3-02-labels-gh-could-not-create-as-a-step
prd: 39
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

When the installer cannot create the loop's tags on GitHub itself, how should it tell the person to create them?

## The decision, in plain words

It lists them as one of the numbered steps the person takes by hand, with the link to the repository's tag page, and the summary at the top points to that step.

## The options, in plain words

A. Print them as a numbered human step with the repository's labels page, pointed to from the summary (built).
B. Keep the second slice's single summary line naming them, with no numbered step.
C. Print the exact label-creation commands for the person to paste.

## What I had to decide

How the labels `gh` could not create appear in the closing steps: s2 printed them on a `labels` summary line (`create by hand: ...`) as a placeholder for s3 to shape.

## What I did meanwhile

kit/lib/init/steps.mjs adds a numbered step `Create the labels gh could not create:` with `https://github.com/<slug>/labels` and the names, placed before the optional branch-protection step (which moves to step 4); the summary line reads `labels  gh could not create <names> — see step 3 below`. s2's two tests were updated to this shape.

## What it costs to change later

A few lines in one function and two test assertions; nothing stored depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's closing-step shape shows no labels step; where the names go and whether a link is printed was not settled.
