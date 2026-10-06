---
id: s7-02-target-flow-read-in-clone
prd: 1089
slice: s7
rank: medium
bears-on: none
raised: 2026-10-06
wave: 6
---

## The question, in plain words

When the loop builds part of a feature in another repository, how does it read that repository's own rules without running its code, and what does it do when those rules changed since the plan was made?

## The decision, in plain words

The loop's own tool reads the other repository's rules from its local copy, never running that repository's code; a repository with no rules gets the usual ones; and rules that changed since planning are raised as a decision for a person, like any other change there.

## The intro, for fun

Visiting another house, the loop reads the rules pinned on its fridge, not the photo taken last month.

## The punchline, for fun

If the fridge note changed, it leaves a sticky note for the owner.

## The options, in plain words

A. Keep it: the plan repository's command reads each target's committed rules in its checkout, with a fallback to the usual rules and a decision raised when the rules moved.
B. Teach omni flow check merge and flow show to read a target's committed config from GitHub with --repo, and drop the step that runs inside the checkout.
C. Use the imported copy of each target's rules for building too, and refresh it before every run.

## What I had to decide

Whether reading a target's committed rules this way, by running the plan repository's command inside the target's checkout, is acceptable until the command can read a target's rules from GitHub directly.

## What I did meanwhile

In ultra-wave, do-work --target, pr --repo and ultra-yolo, a target's flow is read by the plan repository's omni run with the target's clone or slice worktree as its working directory; do-work --target calls flow show once per territory entry with --path; ultra-wave runs omni flow check merge there, the territory reading as unknown (reported, or refused under territory: block) since the target holds no plan; a target without a committed config is gated from the plan repository; ultra-yolo raises a medium <target>-flow-moved item for each target omni targets reports as flow moved; mega-invade writes the copy as flow/config.yml with hook files at their paths and redraws it on --sync; mega-brainstorm reads plan.slice from the copy as guidance only.

## What it costs to change later

Small: sentences in the ultra and target skills; a later CLI change letting omni flow check merge --repo read the target's committed config from GitHub would replace the cd step with one flag.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The guardrail says nothing runs in a target but its preflight; running the plan repository's own omni there reads files and runs none of the target's code, and the spec allows a target's hooks to be followed in its worktree.
- (author) omni flow check merge reads the slice's territory from the inbox of the repository it runs in: in a target there is none, so territory: block in a target refuses every sub-PR until the command learns to read the plan's territory with --repo.
- (author) A target with no committed config is gated from the plan repository, whose own areas then apply to the target's paths; with no flow in the plan repository that is the kit's default squash.
- (author) flow show --path takes one path, so a target slice with several territory entries calls it once per entry and follows each hook once.
