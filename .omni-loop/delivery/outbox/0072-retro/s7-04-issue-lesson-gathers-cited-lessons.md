---
id: s7-04-issue-lesson-gathers-cited-lessons
prd: 72
slice: s7
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The model may propose a lesson for one finding, and apart from it a few lessons that each point at several findings. Which should a finding's issue show?

## The decision, in plain words

Both: the finding's own lesson first, then every shared lesson that points at it. With no lesson at all, the issue says none was proposed, and adds that the retro has facts only when it has.

## The intro, for fun

A lesson that points at three findings has three front doors to knock on.

## The punchline, for fun

It knocks on all three, so no issue has to guess the lesson was meant for it.

## The options, in plain words

A. Show the finding's own lesson, then the shared lessons pointing at it, the option built.
B. Show only the finding's own lesson, and leave the shared ones to the retro file.
C. Show only the shared lessons, so one lesson reads the same wherever it appears.

## What I had to decide

The spec's issue body has one `## Proposed lesson` section, and the model's reply carries a per-finding `lesson` (optional) and a `lessons` list, each citing finding ids. The spec does not say which of them the issue shows.

## What I did meanwhile

`renderIssue` writes the finding's own `lesson` (or the line naming why it was dropped), then each `lessons` entry citing the finding as a bullet; with neither, `None proposed.`, or `None proposed: facts only.` without prose. `issues.golden/issue-prose.md` pins it.

## What it costs to change later

A constant: which lessons one function gathers.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether `/omni:retro-apply` will want the finding's own lesson apart from the shared ones; the YAML block carries neither today, as the spec shows it.
