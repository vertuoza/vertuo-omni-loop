---
id: s5-04-roadmap-answers-and-ticks
prd: 1665
slice: s5
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

Besides each PRD's progress, the roadmap commands also read the answers and the ticks left as comments on the roadmap's issue: should those be read through the Omni page too?

## The decision, in plain words

Yes: the answers, the ticks and the comments the progress needs are read through the Omni page as well, so a roadmap push works without GitHub's own tool, and a failed read says which read stopped it.

## The intro, for fun

Moving house, the movers took the furniture and asked about the mail.

## The punchline, for fun

The mail came along too; only the outgoing letters still leave by the old post office.

## The options, in plain words

A. A. Read the answers and the ticks through the Omni page, as built.
B. B. Read only the feature PRs through the Omni page, and keep the comments on GitHub's tool.

## What I had to decide

Whether omni roadmap's reads of the roadmap issue's comments (answers in push, ticks in prereqs), done by githubClientFor(...).listComments(), move to LoopReads.comments with the feature PRs, and what a failed read prints.

## What I did meanwhile

kit/bin/commands/roadmap.ts reads the feature PRs, their comments, the answers and the ticks through LoopReads; a failed read prints its own line (no sign-in, unreachable, refused ...) where push printed 'github unreachable', which stays for any other failure; prereqs says '(<line>)' when the ticks cannot be read. Posting an answer or a tick still goes through gh. Tested in kit/bin/roadmap.test.ts.

## What it costs to change later

Putting listComments back is two lines in roadmap.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names only the gate's 'gh pr list'; reading the comments the same way was judged from 'every read that decides is in scope'.
