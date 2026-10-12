---
id: s5-02-raise-releasing-after-main
prd: 1679
slice: s5
rank: high
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

While this was being built, the main branch grew the page the releasing guide pulls in, so what agents read for releasing went from 133 KB to 145 KB. May its ceiling go up to 145 KB until the broken link that pulls in the whole page is fixed?

## The decision, in plain words

The releasing guide's ceiling was raised to its new size instead of trimming it, because trimming means fixing the link bug, which is its own fix.

## The intro, for fun

The releasing guide ate another 11 KB while nobody was looking.

## The punchline, for fun

This time a budget noticed, and it is asking you before letting it.

## The options, in plain words

A. A. Raise the releasing ceiling to 145 KB until the pointer bug is fixed.
B. B. Do not raise it: fix the releasing pointer first, then ship this PRD.

## What I had to decide

Budget raise: `form:releasing` to 148480 bytes

Merging origin/main into the feature branch brought a longer apps/galaxy/README.md; the releasing form's pointer [→ apps/galaxy/README.md#deploy-to-production] runs past its section to the end of that README, so form:releasing measures 148,031 bytes, over its 137,216 ceiling. Trimming it means fixing the pointer bug, which the spec keeps out of this PRD (D11). The ceiling goes to 145 KiB, today's size rounded up, as the spec rounds a first ceiling.

## What I did meanwhile

The ceiling is raised in .omni-loop/budgets/context.json; omni check context stays red until this item is answered.

## What it costs to change later

Undone by lowering one number in the ceilings file; the pointer fix lowers it for good.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the pointer bug fix should land before this PRD ships is not decided (author)
