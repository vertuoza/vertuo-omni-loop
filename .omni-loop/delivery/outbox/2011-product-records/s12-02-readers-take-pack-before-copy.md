---
id: s12-02-readers-take-pack-before-copy
prd: 2011
slice: s12
rank: medium
bears-on: none
raised: 2026-10-16
wave: 3
---

## The question, in plain words

When the planning commands read a target repository's flow, should a fetched pack replace the old copy in the plan repository entirely, or only come first?

## The decision, in plain words

A fetched pack is read first and the old copy is still read when no pack was fetched, so repositories born in git keep working until the last reader of the old copies is removed.

## The intro, for fun

The new filing cabinet is in, but the old one has not left yet.

## The punchline, for fun

For now the kit looks in the new drawer first and the old one second.

## The options, in plain words

A. A. Pack first, copy as the fallback until s13 (built).
B. B. Pack only: a target with no fetched pack has no flow, and the old copies stop being read at once.
C. C. Copy first, pack as the fallback, so git-born plan repositories behave exactly as before.

## What I had to decide

Whether the copy fallback should be removed now (the spec says the readers never read a copy) or kept until slice s13 removes the remaining readers.

## What I did meanwhile

Both `omni flow show --repo` and `omni plan check` read the pack and fall back to the copy; the mega-invade skill writes no copy for a product run.

## What it costs to change later

Removing the fallback later is a few lines in the flow reader and its tests; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which product commands name a repository by its short name only: `omni kb pack get back` takes the owner of this repository's slug when no plan target matches (author).
- Where a product checkout with no plan section finds the read_at of a link: it takes `--read-at`, and without it checks no age (author).
