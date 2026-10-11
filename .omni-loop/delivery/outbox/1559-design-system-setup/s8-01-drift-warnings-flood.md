---
id: s8-01-drift-warnings-flood
prd: 1559
slice: s8
rank: medium
bears-on: none
raised: 2026-10-11
wave: 4
---

## The question, in plain words

With our own design system file in place, the design check now prints over two hundred warnings, one per screen file that no listed part or screen claims. Should the check stay this loud, or should it count fewer files?

## The decision, in plain words

I left the check and our settings as they are: it stays green and only warns, and the warnings are counted in the dogfood report.

## The intro, for fun

We wrote down our design system, and the check answered with two hundred and eighteen notes.

## The punchline, for fun

Nobody reads note number one hundred and twelve.

## The options, in plain words

A. A. Keep the check as it is: every unclaimed screen file is a warning until a part or a screen claims it.
B. B. Our settings ignore the route folders, so only shared component folders are counted.
C. C. The check counts only files used by two pages or more, and says how many it skipped in one line.
D. D. The check prints one summary line with the count, and the full list only when asked.

## What I had to decide

`omni check design` on omni-loop with DESIGN.md prints 218 `is a component file no part names and no screen implements` warnings: design.paths covers apps/galaxy/src/, apps/galaxy/app/ and apps/omni-app/src/, and omni-loop's .tsx files are mostly pages and page sections, by area, not parts. A part is what the code holds as a component (init.md), so listing them all as parts would invent a library; claiming them all from screens needs a screen per page. The check never turns red, so nothing blocks.

## What I did meanwhile

No config change (.omni-loop/config.yml is outside this slice's territory) and no kit change. DESIGN.md lists 13 parts read from the code; the 218 warnings stay, counted in dogfood.md.

## What it costs to change later

A constant: a design.ignore list in the config, or one rule in kit/lib/design/check-design.ts with its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How many of the 218 files a person would call parts rather than page sections (author).
