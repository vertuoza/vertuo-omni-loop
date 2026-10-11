---
id: s10-03-unreadable-product-targets-stop-the-command
prd: 1548
slice: s10
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

When a planning repository takes its repositories from a product and they cannot be read at all, what should the board, the next-step, the care and the flow commands do?

## The decision, in plain words

They stop with one line saying why, as the listing of repositories already does, and use the last read with a note when the server is down. Commands that need no repository list never ask the server.

## The intro, for fun

The map is locked in a drawer and the drawer is on the server.

## The punchline, for fun

No map, no walk: we say so and stay home.

## The options, in plain words

A. Stop with the line, as built.
B. The next-step command waits instead, naming why, and the other three stop.
C. Every command carries on as if the plan repository had no targets.

## What I had to decide

What omni board, next, care (state, list) and flow (show/check with a short --repo) do when withProductTargets returns a line: they throw a usage error `omni <verb>: <line>` (exit 2). omni next otherwise turns a GitHub failure into a wait verdict; a loop calling it each tick now stops on this instead.

## What I did meanwhile

Built as a stop, with the last-read copy used when the server does not answer (its line on stderr), and care reply, flow verdict and flow show without a short --repo never calling the server.

## What it costs to change later

A constant: making next turn the line into a wait verdict is a few lines in next.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a loop that calls the next-step command every tick should rather keep waiting on a product it cannot read. (author)
