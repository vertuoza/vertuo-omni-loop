---
id: s3-03-credits-heading-when-signing-off
prd: 99
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

In a repository that switched signing off, whose name should head the record of the loop's work?

## The decision, in plain words

The record is headed with the name of the loop itself, because signing off leaves no signer's name to show. The count still covers every labelled pull request, and the line about signing says it is off.

## The intro, for fun

A report with signing off still needs a name at the top.

## The punchline, for fun

When the hero takes the day off, the team takes the credit.

## The options, in plain words

A. A. Head it with the loop's own name, the option built.
B. B. Head it with the kit's default signer's name, as if signing were on.
C. C. Leave the name out, and start the heading with the organisation.

## What I had to decide

The first word of the `omni credits` report when the config says `signature: null`. The spec's example heading is the signature's name, then the organisation, then the period (`omni credits`, What it prints), and it says that with `signature: null` the pull requests still count and the signature line reads `signing is off in this repository`. With signing off there is no configured name to print.

## What I did meanwhile

`kit/lib/credits/report.mjs` (`creditsReport`) prints `Omni Loop · <scope> · <period>` when the name is null, and the signature line reads `signing is off in this repository`. Tested in `kit/lib/credits/report.test.mjs` and `kit/bin/credits.test.mjs` (the signature null cases).

## What it costs to change later

One string in `kit/lib/credits/report.mjs` and its two tests. Nothing reads the heading back.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say what heads the report when signing is off.
