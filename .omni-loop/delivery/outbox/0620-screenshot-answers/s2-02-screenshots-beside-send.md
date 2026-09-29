---
id: s2-02-screenshots-beside-send
prd: 620
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The answer form and the code that sends an answer are separate pieces, and the send step today only takes the typed answers. How should the screenshots reach the send step?

## The decision, in plain words

The answer form puts its screenshots aside for its question round, and the send step picks them up from there, so the two pages that send answers did not have to change. The demo page sends the text only.

## The intro, for fun

The answer and its pictures took different doors into the same room.

## The punchline, for fun

They meet at the send button, which is all that matters.

## The options, in plain words

A. A per-round holding place the send step reads (built).
B. Pass the screenshots as a new part of every send call, changing both answering pages and the demo.

## What I had to decide

Whether screenshots travel to the send step through a per-round holding place or as a new part of every send call.

## What I did meanwhile

The form keeps each round's screenshots in a holding place the send step reads; uploads that already went through are remembered there, so Send again only uploads the rest. On the demo page, screenshots show but only "(see screenshots)" is sent.

## What it costs to change later

A small rework of the send call and the two pages that call it; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The slice's territory leaves out the two pages that call Send, so passing screenshots through them would have reached outside it.
