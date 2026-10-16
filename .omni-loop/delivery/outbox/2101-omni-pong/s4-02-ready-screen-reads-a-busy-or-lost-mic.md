---
id: s4-02-ready-screen-reads-a-busy-or-lost-mic
prd: 2101
slice: s4
rank: medium
bears-on: none
raised: 2026-10-16
wave: 2
---

## The question, in plain words

The spec names two reasons a microphone is refused, blocked or not found, and says nothing of a microphone busy in another app, or one unplugged before the match starts. What should the ready screen say then?

## The decision, in plain words

A microphone busy in another app reads NO MIC FOUND, and one unplugged on the ready screen sends the player back to A · TURN ON MIC; MIC LOST stays for a match in play.

## The intro, for fun

A microphone can be busy, borrowed or simply pulled out at the worst moment.

## The punchline, for fun

The ready screen keeps two excuses and asks politely again.

## The options, in plain words

A. A. A busy microphone reads NO MIC FOUND, and one unplugged on the ready screen turns back to A · TURN ON MIC, as built
B. B. A busy microphone gets its own line, such as MIC IN USE ELSEWHERE, and one unplugged on the ready screen reads MIC LOST

## What I had to decide

Keep the two readings as built (A), or give a busy microphone its own line (B).

## What I did meanwhile

A busy microphone reads NO MIC FOUND, and A asks again once the other app lets it go.

## What it costs to change later

Each reading is one line of the microphone's error mapping and of the ready screen's words.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No player has seen a busy microphone's line yet; how often it happens on a laptop is not known (author).
