---
id: s5-01-merge-gate-reading
prd: 1089
slice: s5
rank: medium
bears-on: none
raised: 2026-10-06
wave: 4
---

## The question, in plain words

Before the loop merges a slice's pull request, which parts of the code does it hold it to, what counts as a green check or a person's approval, and how does it read a pull request in another repository?

## The decision, in plain words

The pull request meets the rules of every part its plan names and every part its changes reach; a passed, skipped or neutral check counts as green; only a person's latest review counts, never a bot's; and in another repository it asks that repository's pull request while still reading the rules of this one.

## The intro, for fun

A pull request knocks on the merge door and the doorman asks to see its whole family tree.

## The punchline, for fun

Cousins it never mentioned count too, and robots cannot vouch for it.

## The options, in plain words

A. A. Keep it: the plan's parts and the parts the changes reach, passed, skipped or neutral checks green, a person's latest review, and --repo asks the other repository while the rules come from this checkout.
B. B. Judge only by the parts the plan names, and count only a passed check as green.
C. C. Have --repo also read the target's committed rules from GitHub, so the plan repository can check a target's pull request without its worktree.

## What I had to decide

Whether the merge check should judge a pull request by the parts its changes reach as well as the parts its plan names, and whether reading a target repository's own rules belongs in this command or in the later slice that wires the targets.

## What I did meanwhile

Built omni flow check merge that way, with tests for each rule (approval, required checks, territory report and block, the open count, two merge methods, the default branch guard), and the merge command it prints with no flow is today's squash.

## What it costs to change later

A constant change in kit/lib/flow/merge-gate.ts and the check merge command in kit/bin/commands/flow.ts, with their tests: judging by the plan's parts alone, counting a skipped check as not green, or reading a target's own config is a few lines; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the rules of the slice's areas apply, not whether a change outside the territory brings its own area's rules: they do here, as the stricter reading.
- (author) A pull request whose head is no slice of a plan in the inbox is merged with its territory reported as unknown, and refused under territory: block.
- (author) The open count counts open sub-PRs into the same base whose slice, read from the plan, touches the area, this one included; one whose head is no slice is not counted.
- (author) --repo takes owner/name or a target's short name; the rules still come from this checkout's config, so in a target the command runs in the target's worktree, as the spec's section on several repositories asks. Reading the target's committed config from the plan repository is left to the slices that wire the targets.
- (author) omni help flow still lists show and verdict only: the help entries sit outside this slice's territory; the command's own usage line names check merge.
