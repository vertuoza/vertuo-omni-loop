---
id: s2-03-some-ask-callbacks-do-not-join
prd: 359
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

A few ask pages (a shared question, For me, the history, one ask session) have their own way back after signing in, and those do not join the person to their org's workspace. Should they?

## The decision, in plain words

They stay as they were: they sign the person in but join nothing. Signing in anywhere else, the game, the knowledge map, a PRD page, the ask home page or the terminal, joins them.

## The intro, for fun

Most doors of the house now hand out a room key on the way in.

## The punchline, for fun

Four side doors still just say hello and point at the front desk.

## The options, in plain words

A. A: leave the four callbacks as they were (built)
B. B: make them join and link too, in a rework slice
C. C: send every ask sign-in back through the ask home page's own way back

## What I had to decide

Whether the four ask callbacks outside s2's territory join by GitHub org at sign-in.

## What I did meanwhile

apps/galaxy/app/ask/[session]/callback, ask/q/[round]/callback, ask/for-me/callback and ask/history/callback only exchange the code, as before PRD 359 (they never joined by domain either). The page no longer joins on its own, since joining needs the GitHub token that only the callback holds.

## What it costs to change later

A constant: wrap each callback's exchange in settlingExchange(), one line per route.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names app/ask/callback in s2's territory but not the four other ask callbacks
