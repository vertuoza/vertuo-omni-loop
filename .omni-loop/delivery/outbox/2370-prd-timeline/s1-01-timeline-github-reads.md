---
id: s1-01-timeline-github-reads
prd: 2370
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

To date every shipped PRD's timeline, the sync now reads each repository in full once, and asks GitHub one extra question per merged feature pull request to learn when it was marked ready. Is that cost acceptable?

## The decision, in plain words

I let the first sync after the merge read each repository in full once, and read when each merged feature pull request was first marked ready, so the shipped PRDs get their timelines too.

## The intro, for fun

Every timeline needs a history lesson, and history lives on GitHub.

## The punchline, for fun

One long read today, short reads every quarter hour after.

## The options, in plain words

A. Keep the one full read and read when each merged feature pull request was first marked ready.
B. Read only what changed, as before, and leave the shipped PRDs without a ready date.
C. Keep the full read, but take the ready date from the stored stages instead of asking GitHub.

## What I had to decide

Answer A to keep the one full read and the extra question per merged feature pull request. Answer B to read only what changed, leaving shipped PRDs without a ready date or a full timeline.

## What I did meanwhile

The sync reads a repository in full while it holds no milestone, then goes back to reading only what changed since the earlier of its stages' and its milestones' last sync. It asks for a feature pull request's events once it merged, not only while it is open and ready.

## What it costs to change later

A: one full read per repository after the merge (about 220 PRDs here, so about 220 extra event reads), then one extra read per feature pull request that merges or changes after it merged; all at background priority, which steps back when the budget runs low. B: a constant to change in the sync; the shipped PRDs' timelines stay partial.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A repository that holds PRDs but none GitHub can date is read in full each quarter hour, as one with no PRD issue already is for its stages. (author)
