---
id: s2-01-server-timing-mechanism
prd: 3215
slice: s2
rank: medium
bears-on: none
raised: 2026-11-24
wave: 2
---

## The question, in plain words

How does a settings page say where its time went, given the App Router cannot set a response header once a page has begun to stream?

## The decision, in plain words

Reuse the way /prd already does it: a hidden template in the document holding the Server-Timing value, with shell, data and render entries.

## The intro, for fun

The clock needs somewhere to be read from.

## The punchline, for fun

It rides at the end of the page, like the last guest.

## The options, in plain words

A. A. A hidden template holding the value, as /prd does (planned).
B. B. A response header set by the proxy, which times only the whole request.

## What I had to decide

The spec leaves the mechanism to planning. PRD 2401 settled it for /prd (src/dossier/page/timing.ts) and it reaches the three phases the spec names; a proxy header could time only the whole request.

## What I did meanwhile

Nothing is built yet; slice s2 follows the plan and the ratchet proves it adds no read.

## What it costs to change later

Switching to a real header later changes the helper and whatever reads it back, not any screen.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not name the mechanism (author)
