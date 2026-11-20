---
id: s2-02-tab-count-not-drawn
prd: 3107
slice: s2
rank: medium
bears-on: none
raised: 2026-11-20
wave: 2
---

## The question, in plain words

The spec says the Commander tab's name carries the count of questions waiting on a person, but the tabs live in a part of the app this slice may not change. Who draws that count?

## The decision, in plain words

This slice shows the count at the top of the rail, as Waiting on you followed by the number, and leaves the tab's name as it is, so a later slice or the wave adds the count to the tab.

## The intro, for fun

The rail knows the number, but the tab is in another room.

## The punchline, for fun

The number waits by the door until someone with the key comes along.

## The options, in plain words

A. A. As built: the count shows in the rail's heading only, for now.
B. B. The wave adds the count to the tab's name after merging, reading the rail's cards with the fleet page.
C. C. Leave the count out of the tab for good: the rail's heading is enough.

## What I had to decide

Whether the wave adds the count to the tab's name, or a later slice does.

## What I did meanwhile

The rail's heading says how many questions wait, so a member who opens the tab sees the count at once.

## What it costs to change later

Small: the fleet page reads the open count with the tab and adds it to the label; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Reading the count on the Fleet page means one more read on every Virtual Fleet's page load, not only on the Commander tab (author)
