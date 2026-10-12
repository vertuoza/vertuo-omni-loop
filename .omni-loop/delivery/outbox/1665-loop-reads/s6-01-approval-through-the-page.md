---
id: s6-01-approval-through-the-page
prd: 1665
slice: s6
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

The merge check for a slice can ask that a person approved it, a fact that came from GitHub directly and that the Omni page does not give yet: where should it come from now?

## The decision, in plain words

I let the page's answer carry who approved, as an optional fact, and until the page sends it nobody counts as having approved, so a slice that needs a person's approval waits rather than merging without one.

## The intro, for fun

The doorman now reads the guest list from the front desk, which has not printed the names yet.

## The punchline, for fun

So for now nobody gets in on a name alone, which is the safe kind of rude.

## The options, in plain words

A. A. The page's answer carries who approved, optional; absent reads as nobody, so the slice waits (built).
B. B. The same field, but absent reads as not known, with its own line naming the page as too old.
C. C. Keep reading approvals from GitHub through the command-line tool for this one check.

## What I had to decide

`omni flow check merge` read `approvedBy` from `gh pr view --json reviews` (personApproved: each non-bot login whose last deciding review approves). The loop's contract had no approval field, so LoopReads could not carry it. Built: kit/lib/loop-reads/contract.ts's LoopReviewSchema gains `approvedBy: z.array(z.string()).optional()` (the page's strict ReviewSchema spreads the kit's shape, so it accepts the field without requiring it); flow.ts reads `review.approvedBy ?? []`. Until apps/galaxy/src/loop/github.ts answers it (landing 1's ground, not this slice's), an area with `approval: person` holds every sub-PR with `no person has approved #n`. contract.ts is s3's territory, not s6's.

## What I did meanwhile

Tested: an approval the fake page answers lets the kernel sub-PR merge, and a page that answers none holds it with the approval reason. No flow in this repository sets `approval: person`, so nothing here is held by it today.

## What it costs to change later

A field on the page's GitHub adapter (the reviews of the pull request, grouped as personApproved does), or one constant if the field is renamed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the page should answer approvals in this PRD (a follow-up to landing 1) or in a later one.
- (author) Whether a page that does not answer the field should read as nobody approved (built) or as not known, with its own line.
