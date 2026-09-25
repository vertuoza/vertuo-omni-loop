---
id: s5-02-second-claim-is-a-second-sub-pr
prd: 72
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

A slice counts as claimed twice only when it had two pull requests, because a quiet claim taken over in place leaves no lasting mark. Is that good enough, or should the loop leave a mark when it takes a claim over?

## The decision, in plain words

The retro counts a second claim when one slice had two or more pull requests. A takeover in place goes uncounted, and the retro cannot tell it happened.

## The intro, for fun

Claiming a seat twice is easy to spot when there are two coats on it.

## The punchline, for fun

When the second claim just sits on the first coat, nothing shows.

## The options, in plain words

A. Count a slice's pull requests only, the option built.
B. Also read the edit history of each status comment for the takeover line.
C. Ask the loop to leave a lasting mark on every takeover, and count that.

## What I had to decide

What `frictionFacts` counts as "a second claim of the same slice" (spec, Agent friction). A new claim after a closed sub-PR opens a second sub-PR for the slice. A stale claim is taken over in place by `/omni:wave`, which adds the in-progress label (already there) and rewrites the status comment with "taken over from a stale claim", a line the next rewrite of that comment erases and no event records.

## What I did meanwhile

A slice's claims are the sub-PRs whose head is its slice branch, from the pull requests the retro already reads. The count is a fact (`friction.counts.reclaimed`, and `claims` per slice), named in the finding of a slice that also went stuck or needed a fix, and never a finding on its own, as the spec's table says ("any stuck or needs-fix slice"). The status comment is not read.

## What it costs to change later

A read of each status comment's edit history, or a lasting mark left by `/omni:wave` on a takeover (a label or an empty commit, a kit change), then one more check in `frictionFacts`; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether `/omni:wave` should leave a lasting mark when it takes over a stale claim, a kit change outside this PRD.
