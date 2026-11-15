---
id: s6-06-landing-closes-prd-issues
prd: 2896
slice: s6
rank: medium
bears-on: none
raised: 2026-11-15
wave: 6
---

## The question, in plain words

A mission's feature pull request merges into the mission branch, which closes no issue, where one merged into the main branch closes its PRD's. Should the mission pull request close each PRD's issue when it lands?

## The decision, in plain words

Yes: its body ends with the repository's own closing line for each PRD on it, read from the main branch's settings, so each issue closes at the landing, as it does today when a feature pull request lands. A repository without that line gets none.

## The intro, for fun

Every ticket gets its stamp, just at the gate where the train really arrives.

## The punchline, for fun

Closed on arrival, not on boarding.

## The options, in plain words

A. Close each PRD's issue when the mission pull request lands (built).
B. Close nothing: a person closes each PRD's issue.

## What I had to decide

Keep the closing lines in the mission pull request's body, or close nothing and leave each PRD's issue for a person to close.

## What I did meanwhile

The mission pull request's body lists one closing line per PRD on the branch, filled from the main branch's feature link setting.

## What it costs to change later

Dropping the lines later is one change to the body and its tests; issues already closed stay closed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a PRD is shipped at its landing but does not say whether its issue closes then.
