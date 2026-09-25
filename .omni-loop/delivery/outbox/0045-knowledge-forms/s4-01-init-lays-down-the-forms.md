---
id: s4-01-init-lays-down-the-forms
prd: 45
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

Should the one-line install also create the empty knowledge forms, and end by telling people how to fill them?

## The decision, in plain words

Yes. Installing now creates the empty forms, and its last message points to the skill that fills them.

## The options, in plain words

A. The install writes the blank forms after the config and the bin, and its closing steps name the terraform skill.
B. The install stays as shipped. Its closing steps only tell the person to run the forms command, then the terraform skill.
C. The install stays as shipped, and the terraform skill writes the blank forms itself when it runs.

## What I had to decide

PRD 39's `omni init` merged after this spec was first written. The spec had left the installer out of scope, with `omni kb init` as a separate command. Now that `omni init` ships, a repository can be installed without any forms, so the spec has to say whether the install lays them down. This is spec decision 13, added while re-planning and never put to the PRD author.

## What I did meanwhile

The spec (decision 13) and the plan (s4) have `omni init` run the forms writer after the config and the bin, and add a closing step naming `/omni:terraform`. Nothing is built yet: s4 is in wave 4.

## What it costs to change later

Before s4 merges: drop s4's forms step and the closing line from the plan, a few minutes. After it merges: revert s4's commit. Repositories installed in between keep their blank forms, which are harmless.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether `omni init` should stay as small as PRD 39 shipped it: config, bin and labels (author).
