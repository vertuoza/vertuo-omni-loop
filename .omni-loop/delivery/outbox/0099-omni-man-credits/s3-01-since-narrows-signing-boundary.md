---
id: s3-01-since-narrows-signing-boundary
prd: 99
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

When someone asks for the record from a given month on, should the kit judge whether an unsigned pull request was missed only from what it read in that window, or look further back to find when signing really began?

## The decision, in plain words

The kit only reads from the chosen month on, so it judges an unsigned pull request against the first signed one it finds in that window. Asked for the whole history, which is the default, it judges against the real start of signing.

## The intro, for fun

A window onto the past only shows what is inside the frame.

## The punchline, for fun

Nobody can be late to a meeting the diary does not show.

## The options, in plain words

A. A. Narrow every search to the window, and judge against the first signed item inside it, the option built.
B. B. Narrow the label searches only, and read every signed item of the whole history to find the real start of signing.
C. C. Narrow every search, and add one small search per repository for its oldest signed item.

## What I had to decide

Whether `--since` narrows every query `omni credits` runs, or only some. The spec says `--since` narrows to items created from that month on, and that `--since` and `--repo` narrow the searches so they stay under GitHub's 1,000-result cap (Risks, Search limits). It also says an unsigned pull request is `before signing` or `missed` around its repository's first signed item (How each one is classified). When every search is narrowed, a repository's first signed item before the window is never read, so an unsigned pull request early in the window, created before any signed one inside it, reads as `before signing` although signing had begun.

## What I did meanwhile

`kit/lib/credits/reader.mjs` adds `--created >=<month>-01` to every pull request search and `--committer-date >=<month>-01` to the commit search, the signature ones included. `kit/lib/credits/classify.mjs` takes each repository's first signed item among the pull requests it counts, all inside the window. Without `--since` (the default) nothing is narrowed and the boundary is the real one. Tested in `kit/lib/credits/reader.test.mjs` (the queries block) and `kit/lib/credits/classify.test.mjs` (the since block).

## What it costs to change later

Two arguments in `kit/lib/credits/reader.mjs`: leaving `--created` off the body search and `--committer-date` off the commit search reads the signed items of the whole history, at the price of more search results against the cap and the rate limit. No stored data, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether `--since` should also narrow the searches that find signed items, or whether the signing boundary should be read from the whole history.
