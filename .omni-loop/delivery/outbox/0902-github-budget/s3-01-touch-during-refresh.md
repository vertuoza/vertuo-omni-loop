---
id: s3-01-touch-during-refresh
prd: 902
slice: s3
rank: medium
bears-on: none
raised: 2026-10-05
wave: 3
---

## The question, in plain words

When GitHub says something changed while a page is already being refreshed, how do we make sure that change is not forgotten once the refresh ends?

## The decision, in plain words

A change that arrives during a refresh pushes the page's 'out of date' time forward, so the refresh cannot clear it, and the refresh a change started reads GitHub once more at its end.

## The intro, for fun

Ten pull requests merged while the page was still reading the first one.

## The punchline, for fun

So the page reads again once, instead of ten times, or zero.

## The options, in plain words

A. A. Re-stamp the mark in the touched route with the store's existing methods, and follow up once from the touch's own refresh.
B. B. Move the re-stamp into the snapshot store's own stale mark, as one atomic update, so every caller gets it.
C. C. Have every refresh, page-started included, follow up once when still stale at its end.

## What I had to decide

The snapshot store marks a dossier stale only when it is not stale already, and a refresh clears every mark set before it started. A touch landing during a refresh found the earlier mark, kept it, and the refresh's end cleared it: the touch was lost until the next sync. In the touched route (`apps/galaxy/src/touched/touched.ts`), a touch on a snapshot whose lease is held first clears the old mark (`store.current(id, now)`), then marks it stale at now through `staleSnapshot`, so the mark is later than the refresh's start and survives it. The refresh a touch starts (`refreshAfterTouch`) then reads once more when the snapshot is still stale; a refresh started by a page view does not follow up, and the open page's poll sees `read_at` move and renders again, which refreshes a stale snapshot.

## What I did meanwhile

Built it as described, with only the snapshot store's existing methods (no change to `apps/galaxy/src/dossier/snapshot/`, which is s2's territory). Tested with a stubbed clock: three touches during one read lead to exactly one follow-up read.

## What it costs to change later

A constant change: the re-stamp is two lines in `markTouched`; moving it into the store's `markStale` (an atomic update setting `stale_since` to now while `refreshing_until` is in the future) is a small change to one store method and its fake, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says touches during a refresh leave stale_since set, but the store s2 built keeps the first mark; it does not say whether the fix belongs in the store or in the route.
- (author) The two-step re-stamp is not atomic: a refresh ending between its two steps is harmless (the mark is set after), and two concurrent touches each clearing and setting it still leave it set.
