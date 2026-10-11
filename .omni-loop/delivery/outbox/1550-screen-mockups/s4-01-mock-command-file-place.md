---
id: s4-01-mock-command-file-place
prd: 1550
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

The plan puts the instructions for drawing a screen's mockup in the design skill's folder of command pages, but an existing test that proves a product rule allows only the current pages there. Where should the mockup instructions live?

## The decision, in plain words

The mockup instructions sit beside the design skill's main page instead of in its folder of command pages, so the protected test stays untouched. Everything they say is what the spec asks for.

## The intro, for fun

A new page arrived, and the bookshelf had a strict guest list.

## The punchline, for fun

So it waits on the side table, fully readable, until someone updates the list.

## The options, in plain words

A. Keep the mockup instructions beside the design skill's main page, where they are now
B. Move them into the folder of command pages as the plan says, and add their name to the protected test's list in the same change
C. Move them into that folder and loosen the protected test so it accepts any extra command page

## What I had to decide

Whether the mockup command moves into the reference folder, which means a person updates the protected test's list of commands by one name.

## What I did meanwhile

The mock command lives at kit/plugin/skills/pixel-perfect/mock.md, linked from the skill's input and command tables; nothing else differs from the plan.

## What it costs to change later

Moving it later is one file move and three link changes, plus one name added to the command list in kit/test/plugin.test.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- kit/test/plugin.test.ts pins the reference folder to its exact list of commands and is a law's proof outside this slice's territory, so it was not edited.
- omni help pixel-perfect does not name mock yet: kit/lib/help/entries.ts is outside this slice's territory. (author)
