---
id: s2-01-board-load-test-outside-territory
prd: 652
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The workspace board's fleet ranking now carries each fleet's colour and mascot, and one existing check of that ranking sat outside this piece of work's agreed files. May it be updated here?

## The decision, in plain words

I updated that one check so it expects the colour and mascot too, since the spec names it as the check for this change, and changed nothing else outside the agreed files.

## The intro, for fun

One test was standing just outside the fence, waving a sign that said 'me too'.

## The punchline, for fun

We let it in, checked its shoes, and closed the gate behind it.

## The options, in plain words

A. Keep the test edit in this slice, as the spec's test seams ask (what was built).
B. Move the edit to its own follow-up; this test would fail until it lands.

## What I had to decide

Whether the board's loader test may be changed by this slice, as the spec's test seams ask, although the plan left it out of the slice's territory.

## What I did meanwhile

The test expects each ranked fleet's colour and mascot; every other file outside the territory is untouched.

## What it costs to change later

Reverting is one test edit: drop the colour and mascot from the expected ranking rows.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan does not say why the board's loader test was left out of this slice's territory while the spec names it (author).
