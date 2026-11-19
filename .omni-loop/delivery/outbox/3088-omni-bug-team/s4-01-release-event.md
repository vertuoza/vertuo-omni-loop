---
id: s4-01-release-event
prd: 3088
slice: s4
rank: high
bears-on: P-PRODUCT-52
raised: 2026-11-19
wave: 2
---

## The question, in plain words

To know a fix is released, the App has to hear about a published release, which it does not subscribe to today. Should it subscribe, or only look at releases when it sweeps?

## The decision, in plain words

The App's manifest now subscribes to the release event, and the App reads a published release at once. The hourly sweep reads the releases too, so a release the App missed is still caught within the hour.

## The intro, for fun

A bug is only fixed for people once it ships.

## The punchline, for fun

So the App now listens for the ship's horn, and checks the harbour every hour in case it slept through it.

## The options, in plain words

A. Subscribe to the release event and sweep hourly as the backup (built).
B. Do not subscribe: the hourly sweep alone reads the releases, so a fix reads fixed up to an hour late.
C. Read the release from the push of the version commit to the default branch, which the App already hears.

## What I had to decide

Whether to touch the App manifest (apps/omni-app/app.yml, outside this slice's territory) to add one event, or to leave it alone and accept a delay of up to an hour.

## What I did meanwhile

Added release to the manifest's events and to the webhook's handled events, and updated the manifest's test. Someone with the registered App's settings has to tick the release event; until then, only the sweep sees a release.

## What it costs to change later

Removing the event is one line in the manifest and one in the webhook; the sweep keeps working alone.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a bug turns fixed when the release is published but not whether the manifest may change in this slice.
- (author) The release event needs no new permission: the App already holds contents: write, and the event is ticked by hand in the registered App's settings, as the manifest's header says of every added event.
