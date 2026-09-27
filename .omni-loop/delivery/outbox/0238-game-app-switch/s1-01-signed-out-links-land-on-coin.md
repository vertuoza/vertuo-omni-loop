---
id: s1-01-signed-out-links-land-on-coin
prd: 238
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

Someone who is not signed in opens a link to one screen of the arcade, such as its menu or its map. Should they go straight to the sign-in screen, on the live site too?

## The decision, in plain words

Yes: every such link now goes straight to the sign-in screen when nobody is signed in. Before, the live site started these links from the game's intro, and only the demo went straight to sign-in.

## The intro, for fun

A visitor knocked on the menu's door without a coin, and the door pointed at the coin slot.

## The punchline, for fun

No coin, no menu, and no intro to sit through before hearing so.

## The options, in plain words

A. Every link goes straight to sign-in when nobody is signed in, the option built.
B. Only the menu's link does; the older links start with the intro, as before.

## What I had to decide

Where a deep link to one of the arcade's screens lands for someone signed out, when the page holds no galaxy for them (the live and the closed builds).

## What I did meanwhile

In src/arcade/deep-link.ts, every scene link (#menu and the six that were there before: #map, #chart, #fleets, #heroes, #games, #briefing) goes through the one door (onboarding's allowed) whether the page holds a galaxy or not, so signed out it lands on INSERT COIN. Before, the live build ignored every link for a signed-out visitor, because the page holds no galaxy for them, and started at the boot. A planet's link still needs the galaxy, and starts at the boot without it.

## What it costs to change later

One condition in landing(); nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a signed-out /#menu lands on INSERT COIN "through the one door every deep link goes through", as if the older links already did; on the live build they started at the boot. It does not say whether the older links should change with it.
