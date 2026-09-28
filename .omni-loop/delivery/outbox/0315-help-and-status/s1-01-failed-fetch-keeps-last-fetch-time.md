---
id: s1-01-failed-fetch-keeps-last-fetch-time
prd: 315
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When fetching fresh data fails, what should the overview say about how old the data it shows is?

## The decision, in plain words

It keeps saying when the last fetch that worked happened. When a fetch failed earlier, outside the overview, it says the data was never fetched.

## The intro, for fun

Git forgets when it last fetched the very moment a fetch fails.

## The punchline, for fun

The overview now remembers for it, and puts things back as they were.

## The options, in plain words

A. Put the record of the last fetch back after a failed fetch, and read an empty record as never fetched: the option built.
B. Leave the record git emptied as it is, and read its time: the header then says the data was just fetched right after a fetch failed.
C. Leave the record as it is, and give the header a third wording, last fetch failed, whenever the record is empty.

## What I had to decide

How the header reads the time of the last fetch when a fetch fails. The spec takes it from the checkout's `FETCH_HEAD`, but a failed `git fetch` empties `FETCH_HEAD` and stamps it with the failure's time. So a failed `omni status --fetch` would print `fetch failed: …; showing your last fetch` above a header saying `fetched just now`, and every later run would say the same.

## What I did meanwhile

`fetchRemote` in `kit/lib/status/facts.mjs` saves `FETCH_HEAD` (its bytes and times, or its absence) before `git fetch --prune`, and puts it back when the fetch fails, so the header still names the last fetch that worked. An empty `FETCH_HEAD`, which a failed fetch run outside `omni status` leaves, reads as `never fetched`. Pinned by three cases in `kit/bin/status.test.mjs`.

## What it costs to change later

Two small functions in `kit/lib/status/facts.mjs` and their tests. No stored data: the only file touched is the checkout's own `FETCH_HEAD`, put back as it was.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec takes the header's time from `FETCH_HEAD` and does not say what a failed fetch does to it: git empties it (seen with git 2.43).
