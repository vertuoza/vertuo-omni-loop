---
id: s4-02-signed-out-bell-goes-quiet
prd: 1318
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 4
---

## The question, in plain words

The spec says a signed-out bell stops asking and shows the sign-in card. The bell has no card of its own: what should it show once it hears the person is signed out?

## The decision, in plain words

A bell whose sign-in expired stops reading and goes quiet, keeping what it last showed; the page around it shows its own sign-in card, as the ask pages do, and the bell adds none.

## The intro, for fun

The bell heard the door close behind its owner.

## The punchline, for fun

It stopped ringing, and left the welcome mat to the page.

## The options, in plain words

A. As built: the bell goes quiet, and the page shows its own sign-in card as it does today.
B. The bell also shows a sign-in line in its panel once it hears the person is signed out.

## What I had to decide

Whether the waiting provider, on a 401 from GET /api/waiting/questions or GET /api/waiting/documents, only stops both polls (as built), or also tells the bell's panel to show a sign-in line, which would change src/nav/Bell.tsx, outside this slice's ground.
Decided by: Jev (hardToRevert 0.48) · agent said false

## What I did meanwhile

Both polls stop at their next tick and ask nothing more until a reload; the bell keeps its last items and the page shows whatever it shows a signed-out person today.

## What it costs to change later

A signed-out flag in the provider's context and one line in the bell's panel: no stored change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's acceptance criterion names the sign-in card for the bell and the ask page together; the plan's done-when for this slice only asks that both polls stop.
