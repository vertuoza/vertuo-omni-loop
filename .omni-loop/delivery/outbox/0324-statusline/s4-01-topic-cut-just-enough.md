---
id: s4-01-topic-cut-just-enough
prd: 324
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

When the second line is too wide for the terminal, the PRD's short name is shortened first, down to eight characters. Should it be shortened only as much as the line needs, or always straight down to eight?

## The decision, in plain words

Only as much as the line needs, and never below eight characters with the ellipsis. A name that fits after a small cut keeps most of its words; a short name is never cut.

## The intro, for fun

The terminal ran out of room, and the PRD's name was first in line for a trim.

## The punchline, for fun

It gets a haircut, never a shave, unless the room is really tight.

## The options, in plain words

A. Shorten the name only as much as the line needs, never below eight characters: the option built.
B. Always shorten a name that does not fit straight to eight characters, even when a smaller cut would do.

## What I had to decide

Whether a line 2 too wide for `COLUMNS` cuts its topic only as far as the line needs (never below 8 characters, `…` included), or always straight to 8 characters. The spec says "a line too wide cuts its topic first, down to 8 characters ending in `…`"; the plan's done-when says "with `COLUMNS=40` the topic is cut to 8 characters ending in `…` before anything else".

## What I did meanwhile

`prdLine` in `kit/lib/statusline/render.mjs` cuts the topic by exactly the characters the line is over, never below 8 (7 characters and `…`); a line still too wide is then cut at its end, as s1 does. At 50 columns, `PRD 324 statusline-for-claude-code · s4 · outbox · 3 open items` reads `PRD 324 statusline-f… · s4 · outbox · 3 open items`; at 40 the topic reads `statusl…` and the line's end is cut too. A topic of 8 characters or fewer is never cut.

## What it costs to change later

One expression in `kit/lib/statusline/render.mjs` and the expected lines in `kit/lib/statusline/render.test.mjs` and `kit/bin/statusline.test.mjs`. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) "Down to 8 characters" reads either as a floor (cut as much as needed, no further) or as the length every cut topic takes; the spec and the plan only give cases where both readings agree.
