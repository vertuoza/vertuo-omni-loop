---
id: s2-01-fix-page-staleness
prd: 902
slice: s2
rank: medium
bears-on: none
raised: 2026-10-05
wave: 2
---

## The question, in plain words

A fix's page now shows what was last stored about it instead of asking GitHub every time. Nothing records when that stored copy goes out of date, so when should the page ask GitHub again?

## The decision, in plain words

The page shows the stored copy at once and quietly asks GitHub again after it has loaded, as long as the fix has not shipped yet. A shipped fix never changes, so it is never asked again.

## The intro, for fun

A fix page used to phone GitHub every single time someone glanced at it.

## The punchline, for fun

Now it only calls back while the fix is still on its way out the door.

## The options, in plain words

A. A. Refresh after every visit while the fix has no release (built)
B. B. Refresh only when the stored facts are older than a set age
C. C. Refresh only when a webhook or the sync says GitHub moved, adding a stale mark to the stored fix facts

## What I had to decide

Whether a fix page's stored facts are out of date until the fix ships (built), or only after a set age, or only when something says GitHub moved.

## What I did meanwhile

Every visit to an unshipped fix's page costs one background read after the page is shown; the reader's one-minute sharing caps it, and a low budget refuses it first.

## What it costs to change later

A constant: the rule is one line in the fix page's facts module, and the stored fix facts need no new column for options A and C.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The stored fix facts keep no stale mark like the PRD snapshot does, so option C needs the webhooks of a later slice to set one (author).
