---
id: s5-01-gates-read-the-checkout
prd: 1299
slice: s5
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

A PRD approved on the page keeps its files on its own feature branch until it ships. When someone looks at the overview or the loop's next step from a copy of the project that does not hold those files, should the PRD still show up?

## The decision, in plain words

The overview, the PRD lookup and the loop's next step judge a page-approved PRD from the files the person's own copy holds. A copy without them, the main line for example, does not show that PRD until it ships.

## The intro, for fun

A PRD that lives on its own branch is a bit like a cat: you only see it in the room it chose.

## The punchline, for fun

So the overview counts it where its files are, and nowhere else, until it ships.

## The options, in plain words

A. A. Judge a page-approved PRD from the copy's own files; a copy without them does not show it (built).
B. B. Read its files from its feature branch on the remote, so every copy shows it, at the cost of reading files from git in the approval reader.
C. C. Show it from any copy as waiting, without judging its files, until the copy holds them.

## What I had to decide

Whether the overview and the loop's next step must find a page-approved PRD on its feature branch from any copy, or only where the copy holds its folder, as built. The approval reader judges the files on disk, so reading them from a branch would change that reader too.

## What I did meanwhile

`omni prd`, `omni status` and `omni next` read a ◆ PRD's stage through `prdState()` from the checkout's own inbox folder. `omni status` adds the ◆ PRDs of the checkout's inbox to its overview (waiting for approval is PRD, approved is inbox, drifted, unreachable and refused are listed as held with their lines). `omni next <n>` on a checkout with no folder for n refuses as before. A ◇ PRD reads exactly as before and never calls the server.

## What it costs to change later

A constant change: reading the PRD folder from `<remote>/<feature branch>` instead of the working tree means `kit/lib/approval/approval.ts` hashing files from a git ref, plus the status facts listing each feature branch's inbox folders. No stored shape, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether /omni:drive runs `omni next` from a checkout of the feature branch or of the default branch for a ◆ PRD: if the latter, a ◆ PRD is invisible to the loop until s7's skills check out its branch.
- (author) `omni prd <n>` still exits 0 on every stage and prints `state: prd`, `drifted`, `unreachable` or `refused`; the skills (s7) read that line, as they read `state: inbox` today.
