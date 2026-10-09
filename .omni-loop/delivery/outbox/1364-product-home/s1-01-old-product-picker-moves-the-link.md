---
id: s1-01-old-product-picker-moves-the-link
prd: 1364
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

Until the old one-product setting is removed, what should happen when someone changes a repository's product the old way?

## The decision, in plain words

Changing it the old way moves the repository's link to the new product and keeps its other links, so the app in use today keeps working and the two never disagree.

## The intro, for fun

Two maps of the same town, and only one of them gets redrawn.

## The punchline, for fun

So every time the old map changes, the new one quietly follows.

## The options, in plain words

A. Mirror every old-style change into the links, and keep the old setting open to every member until landing 3, the option built.
B. Mirror the changes, but make the old setting owner-only now, like the new links.
C. Do not mirror: the old setting changes only the old column, and the links drift until landing 3.

## What I had to decide

How the old single-product setting and the new links stay in step during the expand landing.

## What I did meanwhile

A database trigger copies every change of the old setting into the links: the link to the product it left goes, the one to the new product is added by a person, and a link already there keeps its fields. Any workspace member can still use the old setting, as today, until landing 3 removes it.

## What it costs to change later

One trigger, dropped with the old column in landing 3.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a member, not only an owner, should keep changing a repository's product through the old screen until landing 3 (author)
