---
id: s7-03-fix-folder-from-branch-number
prd: 1342
slice: s7
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

When the server checks a fix, how does it find the folder where the fix's questions about rules live?

## The decision, in plain words

It reads the issue number at the start of the fix's branch name and looks for that number's bug or visual folder; a fix made for a plan repository is pointed to the plan's own pull request instead, where its record lives.

## The intro, for fun

Every fix carries its ticket number on its sleeve.

## The punchline, for fun

The check just reads the sleeve.

## The options, in plain words

A. A. Find the folder from the branch's issue number; a target's fix PR defers to the plan PR (built).
B. B. Find the folder from the files the range adds under bugs/ or visual/.
C. C. Grade a target's fix PR in the target too, failing it when it touches a law.

## What I had to decide

How evaluate finds a fix PR's folder (bugs/<nnnn>-<slug> or visual/<nnnn>-<slug>), and what a target repository's fix PR with a 'Part of <plan repo>#<n>' body gets.

## What I did meanwhile

The folder is the one whose number prefix is the leading digits of the branch topic (branches.fix, topic <n>-<slug>), searched under bugs/ then visual/. A branch with no leading number, or no such folder, has no fix folder: a change to a law then fails naming that. A target's fix PR deferring to a plan PR passes and links it, as a target feature PR does. The fix's outbox comment is posted like a feature PR's.

## What it costs to change later

A constant: one function in apps/omni-app/src/evaluate/evaluate.ts and one branch in checkTarget.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the folder but not how the server finds it; the fix skills cut the branch with topic <n>-<slug>, which this relies on.
- (author) Whether a target's fix PR touching a law should instead be graded in the target is not settled by the spec.
