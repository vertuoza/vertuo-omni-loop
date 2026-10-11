---
id: s3-02-a-check-for-no-approval-yet
prd: 1548
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

The spec says what the approval check shows when the work matches, has drifted or cannot be read. What should it show when nobody approved the PRD yet, when the approver has left the workspace, or when the PRD named does not exist for this repository?

## The decision, in plain words

Each of those three shows a red check with its reason in a few words: waiting for approval, approver no longer a member, or no such PRD for this repository. Only an unreadable server shows the neutral, not-failed check.

## The intro, for fun

Three new ways to be not quite ready showed up at the gate.

## The punchline, for fun

All three get a polite red light, and only a power cut gets a shrug.

## The options, in plain words

A. A. Failure for pending, refused and unknown (built).
B. B. Neutral for unknown, failure for the other two.
C. C. Neutral for all three, as held.

## What I had to decide

Confirm failure for pending, refused and unknown, or ask for neutral on any of them.

## What I did meanwhile

approvedVerdict() in apps/omni-app/src/approved-check/state.ts posts failure with 'pending · mobile-12 waits for approval', 'refused · approver <login> is not a workspace member' and 'unknown · no product PRD mobile-12 holds this repository'; held stays neutral, as the spec asks. A drift is checked before the member tick, so a drifted PRD reads drifted.

## What it costs to change later

Each conclusion is one constant in approvedVerdict() and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names building, drifted and held only; acceptance 6 says nothing of a PRD not yet approved.
- (author) A required omni/approved check that fails on 'unknown' blocks a pull request whose body mistypes the PRD id until the body is fixed.
