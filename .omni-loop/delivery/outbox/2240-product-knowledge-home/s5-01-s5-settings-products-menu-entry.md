---
id: s5-01-s5-settings-products-menu-entry
prd: 2240
slice: s5
rank: medium
bears-on: none
raised: 2026-10-20
wave: 3
---

## The question, in plain words

Taking the Products tab out of Settings left the Settings menu in the left sidebar still listing a Products page that now only redirects. Should that menu entry go too?

## The decision, in plain words

I removed the Products entry from the Settings menu and updated the tests of the other Settings pages that listed the tab, even though the plan names only the tab row. A link to a page that just forwards you elsewhere would be a leftover.

## The intro, for fun

A signpost kept pointing at a door that had been bricked up.

## The punchline, for fun

We took the signpost down too, and left a forwarding address.

## The options, in plain words

A. A. Remove the Products entry from the Settings menu (as built).
B. B. Keep it, pointing at the products list.

## What I had to decide

Decide whether the Settings menu should keep a Products entry (it would land on the products list through the redirect).

## What I did meanwhile

The entry is gone; old bookmarks still land on the right page through the redirects.

## What it costs to change later

Putting the entry back is one line in the sidebar file and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether people use the Settings menu entry to reach products is unknown (author).
