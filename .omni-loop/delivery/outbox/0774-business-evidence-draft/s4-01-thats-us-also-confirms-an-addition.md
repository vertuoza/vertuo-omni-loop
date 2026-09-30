---
id: s4-01-thats-us-also-confirms-an-addition
prd: 774
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 4
---

## The question, in plain words

When the weekly check finds a new region next to ones already confirmed, it waits at the top of the page. If someone presses That's us for other finds while it waits, should it be confirmed too?

## The decision, in plain words

Yes: That's us confirms every waiting find the database holds, the new region included, and the page shows it confirmed right away. Someone who disagrees can still mark it wrong in the list afterwards.

## The intro, for fun

Two buttons, one database, and a new region caught in the middle.

## The punchline, for fun

That's us means everyone, even the newcomer at the top.

## The options, in plain words

A. A. That's us confirms waiting additions too, as the database does today
B. B. That's us leaves additions alone; only their own buttons settle them (a follow-up migration)
C. C. Additions stay in the found list and are never shown on top after a member's own draft

## What I had to decide

Whether That's us should leave a waiting new value alone so it is only settled at the top of the page.

## What I did meanwhile

The top of the page shows new values beside confirmed ones as additions with their own buttons; That's us confirms them too, as the database already does, and the page says so by showing them confirmed.

## What it costs to change later

Passing the waiting additions to the database call as left alone needs a small follow-up migration of the confirm function; the page side is one filter.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says That's us confirms every proposed row not marked wrong, and that additions sit on top with their own buttons, without saying which wins when both wait at once.
