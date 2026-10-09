---
id: s4-02-waiting-file
prd: 1322
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The spec says the waiting command keeps a small file the on-screen band reads, but not where or what it holds. Where does it live, and what is in it?

## The decision, in plain words

One file per PRD in the checkout's private folder, holding the current state, its line, the waiting line and when it was written. The command leaves its last state there when it ends, so the band can show it for ten seconds.

## The intro, for fun

The band wants to know what the terminal is waiting for.

## The punchline, for fun

Sticky notes on the fridge, one per PRD, never thrown away mid-sentence.

## The options, in plain words

A. A. One file per PRD under the private folder, left with its last state.
B. B. One single file for the checkout, the last wait to write winning.
C. C. One file per PRD, deleted when the wait ends, the band keeping the last line itself.

## What I had to decide

File: .omni-loop/local/approval-wait/<n>.json (the folder carries the existing .gitignore of .omni-loop/local). Content: {prd: number, state: 'waiting'|'approved'|'voided'|'held'|'signed-out'|'timeout'|'refused', line: the line just printed, waiting: the current waiting line or null before anyone is asked, at: ISO time it was written}. Written on every line printed after the request; left in place with the last state when the command exits. Not written when the command stops before asking (no ask.url, no sign-in, PRD not found). s5 reads it: show 'waiting' while state is waiting or held, and highlight 'approved' or 'voided' for 10 seconds from 'at', then fall back to 'waiting' after a void.

## What I did meanwhile

s5 builds the band against this file and shape.

## What it costs to change later

Moving or reshaping the file is a constant in the kit's wait module and in the band; it is never committed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec does not say whether two terminals may wait on two PRDs at once; one file per PRD lets them
