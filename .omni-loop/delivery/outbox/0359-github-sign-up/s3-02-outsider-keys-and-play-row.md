---
id: s3-02-outsider-keys-and-play-row
prd: 359
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

Someone signed in who belongs to no workspace sees a screen sending them to sign up. Which buttons should it offer, and what should the menu offer someone signed in who has not picked a team yet?

## The decision, in plain words

On that screen the main button goes to sign-up and the back button signs out. In the menu, someone without a team still sees a Play row, which now leads straight to picking a team.

## The intro, for fun

A visitor with no workspace walks up to the cabinet and presses every button.

## The punchline, for fun

One says sign up, the other says goodbye; both are honest.

## The options, in plain words

A. A: the main button goes to sign-up, the back button signs out, and the menu keeps a Play row for someone without a team (built)
B. B: the main button goes to sign-up, the back button returns to the title, and signing out stays in the menu only
C. C: drop the Play row, so the start screen is the only way to pick a team

## What I had to decide

The outsider screen's keys, and what replaces the menu row that used to lead to the link step.

## What I did meanwhile

OutsiderOverlay (src/arcade/scenes/join.tsx) shows NO WORKSPACE YET, the account as @login (or the email when there is none), and a link to /signup; A (or START) goes to /signup, B signs out (it used to be A sign out, B back to the title). The menu's PLAY row, shown to a signed-in account with no fleet, is kept with the id 'play' and opens afterGate (the intro, or the fleets) instead of the link screen.

## What it costs to change later

A constant: the keys in ArcadeApp's outsider case and the row in menuItems.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec asks only that the outsider screen point at /signup; it does not name the keys or the menu row (author)
