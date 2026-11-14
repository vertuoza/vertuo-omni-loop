---
id: s6-01-s6-hero-edit-outside-territory
prd: 2842
slice: s6
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

Adding or removing a hero from the Heroes tab needs a small database step and a route that the plan did not list for this slice. Is it fine that this slice carries them?

## The decision, in plain words

The slice adds two database functions that let only an owner of the workspace add or remove a hero, a check of them, and one route the tab calls. Nobody could change a hero before, so the tab's Add a hero and Remove had nothing to call.

## The intro, for fun

A tab with an Add button and nothing behind it is only a very polite sign.

## The punchline, for fun

So the slice built the door, not only the sign.

## The options, in plain words

A. A. Keep the database step, its check and the route in this slice (built).
B. B. Move them to a slice of their own and ship the Heroes tab read-only until then.

## What I had to decide

Option A kept the work in this slice: migration 20270122095000_virtual_hero_edit.sql (add_virtual_hero and remove_virtual_hero, owner only, one hero per role, never the last hero), its cases appended to supabase/checks/virtual_fleets.sql, and the route apps/galaxy/app/api/virtual-fleets/heroes/route.ts, all outside the slice's territory. Option B moves them to s1's territory or a new slice. Undoing A costs a revert of those three files.

## What I did meanwhile

Nothing waits on it: the Heroes tab reads and shows heroes either way.

## What it costs to change later

small

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says an owner adds a hero; it does not say whether a plain member may remove one (author).
