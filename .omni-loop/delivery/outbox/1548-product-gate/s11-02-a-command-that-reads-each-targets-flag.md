---
id: s11-02-a-command-that-reads-each-targets-flag
prd: 1548
slice: s11
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Before a product PRD is designed further, every repository it touches must take its approval on the Omni page. How does the brainstorm learn that for each repository, and what does the product question print once a product is remembered?

## The decision, in plain words

A new terminal command reads each repository's setting and prints one line per repository, refusing by name any that still takes a review pull request. Asking which product a checkout is in now names the remembered product first, then the ones the server lists.

## The intro, for fun

The brainstorm needed to ask each repository how it likes to be approved.

## The punchline, for fun

So it now knocks on every door and writes down who still wants paperwork.

## The options, in plain words

A. Keep omni product phase0 and the remembered line first in omni product which (built).
B. Read each repository's setting through the existing approval command, given the repository, instead.
C. Give omni product which a --remembered flag and leave its default output as before.

## What I had to decide

Confirm the two shapes the skill reads: omni product phase0 <owner/name>... (one line per repository: `<repo> is phase0: server`, acceptance 10's refusal line on pr, or `<repo>: its phase0 could not be read: <why>`, exit 0 only when all are on server), and omni product which printing `remembered: <key>` as its first line when the checkout remembers a product, then the server's products as before.

## What I did meanwhile

kit/bin/commands/product-checkout.ts adds use and phase0 beside import and which; phase0 reads each flag through readFlag (GET /api/repositories/phase0?repo=), the route omni approval flag already calls for one repository. A flag that cannot be read holds the run instead of reading as pr, as flag.ts's fallback would. which keeps its output unchanged when nothing is remembered, so every existing test of it passes as before.

## What it costs to change later

Each shape is a line in one command and its tests. Moving phase0 under omni approval flag --repo instead is a rename in the skill text and one command.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names the refusal and the remembered product but no command to read another repository's flag; omni approval flag reads only the checkout's own.
