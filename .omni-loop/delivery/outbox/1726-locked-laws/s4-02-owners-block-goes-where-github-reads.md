---
id: s4-02-owners-block-goes-where-github-reads
prd: 1726
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

When a repository already keeps its owners file at the top level or in its docs folder, where should the owners command write?

## The decision, in plain words

Into the owners file GitHub already reads, and a new one only when there is none, so the team's own file is never hidden. The knowledge check asks for the owners list only once a law is locked or the list was written.

## The intro, for fun

Two owners files walk into a repository.

## The punchline, for fun

GitHub only listens to the first one it meets.

## The options, in plain words

A. A. Write into the owners file GitHub reads, and ask for the list only once a law is locked or the list exists.
B. B. Always write a new owners file in the hidden GitHub folder, even when that hides the team's own file.
C. C. Write as in A, but ask for the owners list in every repository that keeps knowledge, locked laws or not.

## What I had to decide

Which CODEOWNERS file omni kb owners writes, and when omni check knowledge asks for the block.

## What I did meanwhile

omni kb owners writes into the first of .github/CODEOWNERS, CODEOWNERS and docs/CODEOWNERS that exists (GitHub's order), and creates .github/CODEOWNERS only when none does. omni check knowledge reads the same file: it asks nothing while laws.owners is empty (the lock count already refuses a lock then), nor when nothing is locked and no block is written; it goes red when a law is locked and there is no block, when the block differs from what kb owners would write, or when its markers do not pair up. kb owners refuses an empty laws.owners and unpaired markers, writing nothing.

## What it costs to change later

Changing it later is one constant and one condition in one module; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names .github/CODEOWNERS; writing there when a root or docs/ CODEOWNERS exists would make GitHub ignore the older file, so the file GitHub reads was taken instead.
