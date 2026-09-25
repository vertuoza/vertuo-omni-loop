---
id: s3-01-installed-not-terraformed
prd: 50
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

Should the guide the agent follows to build a slice stop saying a repository is terraformed, since that word also belongs to the game and the guide must name none?

## The decision, in plain words

That guide now says the kit is not installed in this repository, in place of saying the repository is not terraformed. The other guides, and the kit's own error message, still use the old word.

## The options, in plain words

A. Reword only this guide's line, so it holds no word from the game, the option built.
B. Keep the old word here, as the kit's own name for a repository with the loop installed.
C. Reword it in every guide and in the kit's error message too, as a follow-up.

## What I had to decide

Whether to reword the one Step 0 line of `kit/plugin/skills/do-work/SKILL.md` that said "the repository is not terraformed". The plan's done-when for s3 asks that this SKILL.md name no game word, and the wave's brief lists "terraform" among the game words. Yet the kit uses "terraformed" as its own word for a repository the loop is installed in: PRD 3's spec (§3, "The footprint in a terraformed repository"), the missing-config error in `kit/lib/config.mjs`, and the same Step 0 line in `/omni:plan` and `/omni:brainstorm`, both outside this slice's territory. PRD 45 (knowledge forms, on its own feature branch) goes further and adds an `/omni:terraform` skill and a `branches.terraform` key.

## What I did meanwhile

Step 0 of `/omni:do-work` now reads "the Omni Loop kit is not installed in this repository", the wording `omni init` uses for itself. Nothing else changed: `/omni:plan` and `/omni:brainstorm` still say "not terraformed", so the three Step 0 lines no longer match. Recorded in `kit/porting/plugin--do-work.md`.

## What it costs to change later

Putting the word back is a one-line revert of prose; no stored shape, no test. Rewording the other two skills and the config error instead is a small follow-up across three files plus any test asserting that message. PRD 45 also changes `kit/plugin/skills/do-work/`, and naming `/omni:terraform` there would bring the word back, so whichever PRD ships second settles it when it merges `main`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the kit's own word for an installed repository counts as a word from the game, since PRD 3 names the principle but lists no words
- whether PRD 45's new skill name makes the word part of the kit's vocabulary rather than the game's
