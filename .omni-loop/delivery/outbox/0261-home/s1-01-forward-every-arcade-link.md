---
id: s1-01-forward-every-arcade-link
prd: 261
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The spec names five old game links that the new front page sends on to the game, but the app still points at three more (the star chart, the game menu and the game room): should those go on to the game as well?

## The decision, in plain words

Yes: every link that names a game screen is sent on to the game, the five from the spec and the three the app still uses, so the knowledge page's star chart link and the app's Game mode button keep landing in the game.

## The intro, for fun

Three old signposts still point at the front door, though the game moved out back.

## The punchline, for fun

So the front door now forwards their mail too.

## The options, in plain words

A. Forward every arcade screen link, from the arcade's own list: What is built: no link to a game screen ever lands on HOME.
B. Forward only the five links the spec names: The star chart and Game mode links land on HOME until those two files are changed to /play.
C. Forward every link, and also rewrite the app's own links to /play: A later slice touches the knowledge page and the app switch so they no longer rely on the forwarding.

## What I had to decide

Whether the front page forwards only the five links the spec names, or every link that names a game screen.

## What I did meanwhile

HOME forwards #map, #chart, #fleets, #heroes, #games, #briefing, #menu and #planet-<n> to /play, reading the list from the arcade's own deep-link table (src/arcade/deep-link.ts DEEP_LINKS), so a new arcade screen is forwarded without touching HOME.

## What it costs to change later

Narrowing it back to five is a one-line change in apps/galaxy/src/home/forward.ts plus its test, but then the knowledge page's 'Open the star chart' link (/#chart) and the app's Game mode button (GAME_HOME = '/#menu') would land on HOME instead of the game, unless those two are changed to /play too.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the app's own links (/#chart in src/knowledge/KnowledgeScreen.tsx, /#menu in src/switch/switch.ts) should instead be rewritten to /play#… directly; both files are outside this slice's territory (author)
