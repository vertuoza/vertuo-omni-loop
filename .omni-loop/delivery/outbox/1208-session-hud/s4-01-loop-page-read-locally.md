---
id: s4-01-loop-page-read-locally
prd: 1208
slice: s4
rank: medium
bears-on: none
raised: 2026-10-08
wave: 4
---

## The question, in plain words

Should the loop's page link be kept by the background refresh, like the other links, or worked out on the spot from the loop this computer is running?

## The decision, in plain words

It is worked out on the spot: the loop already knows its own id and the Omni page's address, so the link needs no network and is always current.

## The intro, for fun

A loop knows where it lives, so nobody has to go and look it up.

## The punchline, for fun

One less errand for the background helper, which already has plenty.

## The options, in plain words

A. A. Work it out from the running loop's id and the configured address, no file (built).
B. B. Have the background refresh write a links file for the loop, keyed by its id.
C. C. Leave the loop page out until the app answers a loop's address itself.

## What I had to decide

Whether the loop page link is read straight from the running loop or kept in a refreshed links file like the others.

## What I did meanwhile

omni now shows the loop page from the loop kept in this checkout and the configured address, with no refresh and no file.

## What it costs to change later

Switching to a refreshed file later is a small change in one reader; nothing is stored that would need migrating.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan lists the loop page among what the refresh writes; the spec's table only says the Loop page's address. (author)
