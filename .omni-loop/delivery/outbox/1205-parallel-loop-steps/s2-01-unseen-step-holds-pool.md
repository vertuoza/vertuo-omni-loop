---
id: s2-01-unseen-step-holds-pool
prd: 1205
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

When the loop has just started a step and GitHub does not show it running yet, may the loop start more steps in the same round?

## The decision, in plain words

No. While a step the loop started is not yet visible on GitHub, the loop starts nothing new, and it never starts a second step for a PRD it is already working on.

## The intro, for fun

A helper just left for work, and the board still shows the desk empty.

## The punchline, for fun

So the loop waits a minute before handing that desk to someone else.

## The options, in plain words

A. An unseen step of this session holds the pool until GitHub shows it or it returns (built).
B. Launch every entry of steps at once; only skip PRDs this session already runs.
C. Pass the session's own running steps to omni next so its collision check sees them.

## What I had to decide

omni next reads what runs from GitHub only: a live claim, or the in-progress label with a fresh status comment. A step agent launched a moment ago has neither yet (a yolo that plans first, a pr-care --once that sets no label), so the collision check cannot see its ground and the slot count misses it. Launching beside it could start two steps on one PRD or two steps on one path. So while a step agent of this session runs a step that running does not list, the tick launches nothing, and an entry of steps whose PRD already has a step agent of this session is never launched; the session never has more than limits.parallelSteps agents at once.

## What I did meanwhile

Both drive skills' step 3 Launch paragraph says so; the plugin test checks the launch wording.

## What it costs to change later

A constant: reword the Launch paragraph in kit/plugin/skills/drive/SKILL.md (mega-drive follows it). Nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How long a fresh step stays invisible on GitHub: a pr-care --once round may never show, so it holds the pool until it returns.
- (author) Whether the person would rather let steps of other PRDs start at once and accept a rare clash the merge-time territory check still catches.
