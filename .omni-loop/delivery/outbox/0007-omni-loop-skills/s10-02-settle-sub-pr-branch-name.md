---
id: s10-02-settle-sub-pr-branch-name
prd: 7
slice: s10
rank: medium
bears-on: none
raised: 2026-09-25
wave: 6
---

## The question, in plain words

The answers a person gives on the feature pull request are recorded through a small separate pull request. What should its branch be called?

## The decision, in plain words

It is named like a slice branch, with the word settle in place of a slice number, so it sits beside the other slice branches of the same feature.

## The options, in plain words

A. Name it like a slice branch, with settle as the slice.
B. Add its own branch template to the configuration.

## What I had to decide

The branch name of /omni:yolo-fix's settle sub-PR: `branches.slice` with `{slice}` = `settle`, or a dedicated `branches.settle` template in config.

## What I did meanwhile

kit/plugin/skills/yolo-fix/SKILL.md step 3 cuts `branches.slice` filled with the topic and `settle`; the branch is deleted on merge, so a later run reuses the same name.

## What it costs to change later

One sentence in kit/plugin/skills/yolo-fix/SKILL.md, or a new `branches.settle` key in the config schema plus that sentence.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a plan could ever name a slice `settle` and collide was not checked (author).
