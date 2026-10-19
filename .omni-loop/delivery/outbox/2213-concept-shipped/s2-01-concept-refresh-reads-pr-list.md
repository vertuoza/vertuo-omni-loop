---
id: s2-01-concept-refresh-reads-pr-list
prd: 2213
slice: s2
rank: medium
bears-on: none
raised: 2026-10-19
wave: 1
---

## The question, in plain words

A merged concept's issue is now read on every sync, but the lookup that does it still asks GitHub for the concept's pull request too, and throws that answer away. Should the lookup skip the pull request request?

## The decision, in plain words

The sync and the touch keep the stored merged pull request and ignore what the second request says, so the page is right but each merged concept costs one extra GitHub request per run.

## The intro, for fun

A merged concept still gets asked about a pull request it already finished.

## The punchline, for fun

We kept the answer we had and politely ignored the new one.

## The options, in plain words

A. A. Keep the stored merged pull request and accept the extra read (as built).
B. B. Add a skip-the-pull-request option to the reader in a later slice.

## What I had to decide

Skipping the request needs a change to the shared GitHub reader (apps/galaxy/src/dossier/github/reader.ts), which is outside this slice's territory, so the merge keeps the stored merged pull request instead. Answer A keeps this; B asks a later slice to add an option to the reader.

## What I did meanwhile

Nothing breaks: the stored pull request is kept and the issue state is stored each run.

## What it costs to change later

One extra cheap GitHub read per merged concept per sync run (ETag-cached).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the extra read matters at the workspace size is unmeasured (author)
