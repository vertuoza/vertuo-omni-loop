---
id: s1-02-sync-does-not-decide
prd: 2270
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

Should the background check that runs every 15 minutes also start the fix once the answers are in, or only a new comment or change on GitHub?

## The decision, in plain words

Only a new comment or change on GitHub starts the fix for now. The spec names the 15-minute check as a second chance, but that check lives in a part of the code this slice was not given.

## The intro, for fun

The spec promised a backup alarm clock; the clock sits in another room this slice may not enter.

## The punchline, for fun

Every answer is itself a comment, so the main alarm rings almost every time anyway.

## The options, in plain words

A. Only a new comment or change on GitHub starts the fix (built).
B. The 15-minute check starts it too, added as a follow-up in its own part of the code.

## What I had to decide

Whether the 15-minute check should also start the fix, as a follow-up in its own part of the code.

## What I did meanwhile

The fix starts after the comment that completes the answers. If that one read fails, the next comment on the pull request starts it.

## What it costs to change later

A small follow-up hands the same decision to the 15-minute check after it reads each PRD; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How often the read after the last answer fails in practice (author)
