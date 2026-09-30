---
id: s4-01-proof-link-lifetime
prd: 798
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

How long should a clip on the Proof tab stay playable before the page needs a reload?

## The decision, in plain words

Each clip and script link lasts one hour; after that, reloading the page gives fresh ones. The script's text is read by the server and shown in the fold, so nobody has to download it.

## The intro, for fun

Every video ticket on the Proof tab has an expiry time printed on it.

## The punchline, for fun

One hour felt long enough for popcorn, short enough to stay private.

## The options, in plain words

A. One hour, reload for fresh links: what was built: long enough to watch every clip, short enough that a copied link soon stops working.
B. Five minutes, like the GIF link: tighter, but a reviewer who pauses to read the spec comes back to dead players.
C. A day: never breaks during a review, but a copied clip link keeps working far longer.

## What I had to decide

Whether one hour is the right lifetime for the signed links the Proof tab hands to a viewer.

## What I did meanwhile

Links are signed for one hour, for the shown run only, and only on the Proof tab; script text is fetched server-side (3 s timeout, 64 KiB cap) and falls back to an Open it link.

## What it costs to change later

A constant in the page's proof read; changing it is one line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the links are signed for the viewer but names no lifetime (author).
