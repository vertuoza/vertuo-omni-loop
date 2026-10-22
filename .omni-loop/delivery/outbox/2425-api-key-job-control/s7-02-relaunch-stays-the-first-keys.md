---
id: s7-02-relaunch-stays-the-first-keys
prd: 2425
slice: s7
rank: medium
bears-on: none
raised: 2026-10-22
wave: 4
---

## The question, in plain words

When a key relaunches a job that another key sent, whose job is the new one, and whom does it say the key acts for: whom the relaunching call named, or whom the first job was for?

## The decision, in plain words

The new job is sent by the first job's key and by the person who made that key, whichever key relaunched it; whom it acts for is what the relaunching call says, and nothing is carried over from the first job.

## The intro, for fun

A second program presses Send again on the first one's job.

## The punchline, for fun

The job stays with its first owner; the second one is only named.

## The options, in plain words

A. The new job is the first key's, and whom it acts for is what the relaunching call says, null when it says nothing.
B. The new job is the first key's and copies whom the first job acted for, ignoring what the relaunching call says.

## What I had to decide

The spec says the new job continues the first, is sent by the same key and keeps its notify_url; it does not say whom the new job acts for. Following s1-02 (a resume keeps sent_by and sent_by_key), relaunchByKey queues the new job as the first job's maker with the first job's key. acting_for belongs to one call, as cancelled_for and closed_for do, so the new job stores what the relaunching call names, null when it names none, and does not copy the first job's. The new job is queued as the maker, as the page's Resume does: a maker who left the workspace or no longer plays in the fleet is refused with 403.

## What I did meanwhile

Built relaunchByKey on the same queue rules as the page's Send again and Resume, with the first job's key and maker, its notify_url and the relaunching call's acting_for, and held it with tests for another key relaunching, a maker who left and a maker who moved fleet.

## What it costs to change later

Changing it later means changing the few fields relaunchByKey passes to the queue; the relaunched jobs already stored keep the acting_for they were given.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the first job's acting_for should carry over when the relaunching call names none: the spec says only that the new job's key and notify_url stay.
