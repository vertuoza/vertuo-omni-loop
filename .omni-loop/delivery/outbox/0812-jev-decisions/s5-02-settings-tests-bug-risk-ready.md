---
id: s5-02-settings-tests-bug-risk-ready
prd: 812
slice: s5
rank: medium
bears-on: none
raised: 2026-09-30
wave: 4
---

## The question, in plain words

Once the bug risk decision exists, may this piece of work also update the settings page's checks that still expected it to be coming later?

## The decision, in plain words

Yes: two checks of the settings page now expect the bug risk row to be editable by the owner, like the other two, and nothing else on the page changed.

## The intro, for fun

The sign said coming soon, and then it came.

## The punchline, for fun

Someone had to take the sign down, and it was the one who arrived.

## The options, in plain words

A. Keep the two test changes in this slice, so the feature branch stays green.
B. Move the two test changes into a separate follow-up slice that owns the settings folder.

## What I had to decide

Registering bug-risk makes Settings › Jev offer its row to the owner, so two tests of the settings folder that pinned it as coming went red. That folder is outside this slice's territory. I changed only those two assertions: the decision is now read and saved like the others, and its row shows a Save button and no coming label.

## What I did meanwhile

The two tests now pin bug-risk as editable; the page's code, and its coming label for a decision without an entry, are unchanged.

## What it costs to change later

A constant: two test assertions, reverted in one commit; no stored data or page code changed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the plan row names only the registry and the skill, and says nothing of the settings tests (author).
