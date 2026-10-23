---
id: s6-01-playbook-tab-nav
prd: 2417
slice: s6
rank: medium
bears-on: none
raised: 2026-10-23
wave: 3
---

## The question, in plain words

Where does the new Playbook page appear in the settings menu, since the menu's own files are outside this slice?

## The decision, in plain words

The Playbook page shows itself as one more tab after Jev on its own page, and the other settings pages and the side menu do not list it yet.

## The intro, for fun

A new room is built, but the hallway signs belong to another crew.

## The punchline, for fun

So the room hangs its own sign until someone updates the hallway.

## The options, in plain words

A. A. The page carries its own Playbook tab; the shared menus are untouched (built).
B. B. Add Playbook to the shared settings tabs and the side menu in a later change.
C. C. Leave the page unlisted, reached by address only.

## What I had to decide

Whether to add Playbook to the settings tabs of the other pages and to the side menu (src/nav/section-tabs.ts, src/nav/sidebar.ts), outside this slice's territory.

## What I did meanwhile

The page builds its tab row from the settings tabs plus its own entry (PLAYBOOK_TABS in PlaybookScreen.tsx); moving the entry into the shared list is one line there.

## What it costs to change later

Until then, a member reaches the page only by its address or from the page itself.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the side menu's Settings entry should list Playbook (author)
