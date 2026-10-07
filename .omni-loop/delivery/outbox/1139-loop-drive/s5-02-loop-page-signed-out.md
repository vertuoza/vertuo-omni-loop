---
id: s5-02-loop-page-signed-out
prd: 1139
slice: s5
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

The plan says a signed-out visitor to the Loop page sees the demo, while the spec says the page loads like the Engineering page, which shows a sign-in card. Which should a signed-out visitor see?

## The decision, in plain words

A signed-out visitor sees the same sign-in card as on the Engineering page; the demo loops show only where every page shows its demo.

## The intro, for fun

The plan and the spec walked into the same room and pointed at different doors.

## The punchline, for fun

The page took the door every other board already uses.

## The options, in plain words

A. Signed out, the sign-in card, as on the Engineering page
B. Signed out, the demo loops, so a visitor sees what the page shows

## What I had to decide

Whether `/app/loop` signed out shows the sign-in card (as built) or the demo loops.

## What I did meanwhile

Signed out, `/app/loop` and `/app/loop/<id>` show the sign-in card through `MemberGate`; the demo shows in development or under `OMNI_LOOP_DEMO=1`.

## What it costs to change later

A constant: one branch of `viewOf` in `apps/galaxy/app/app/loop/page.tsx` and `[id]/page.tsx` decides it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan's 'signed out shows the demo' may have meant the demo session; nobody could be asked
