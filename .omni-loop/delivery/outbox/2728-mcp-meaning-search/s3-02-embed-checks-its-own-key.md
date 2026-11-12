---
id: s3-02-embed-checks-its-own-key
prd: 2728
slice: s3
rank: medium
bears-on: none
raised: 2026-11-12
wave: 2
---

## The question, in plain words

The spec had Supabase's gateway check every caller's token, but the newer server keys are not tokens of that kind, so every call would be refused. Should the embed function check the caller's key itself instead?

## The decision, in plain words

Yes: the gateway check is off, and the function lets a caller in only when it presents one of the project's own server keys, old or new style, compared so that timing reveals nothing. The job and the search call it as before, with no change on their side.

## The intro, for fun

The doorman only reads one kind of badge, and the staff just got new badges.

## The punchline, for fun

So the function now checks badges itself, both kinds, at the same door.

## The options, in plain words

A. A. The function checks the caller's server key itself, old or new style, with the gateway check off (built).
B. B. The gateway checks tokens as the spec wrote, and every caller must hold the old-style service key.
C. C. Both: the gateway check on, and the function also compares the key, which still refuses the new keys.

## What I had to decide

Keep the function's own key check with the gateway check off (A), or turn the gateway check back on and require the old-style key everywhere (B).

## What I did meanwhile

The function answers the old-style service key and every new-style secret key the project holds, and refuses everyone else before reading anything.

## What it costs to change later

Going back is one setting and a few lines in the function; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which kind of server key production holds today is not known here; the function accepts both, so either works (author).
