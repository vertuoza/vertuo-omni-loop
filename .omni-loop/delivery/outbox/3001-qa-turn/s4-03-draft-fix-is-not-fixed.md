---
id: s4-03-draft-fix-is-not-fixed
prd: 3001
slice: s4
rank: medium
bears-on: none
raised: 2026-11-17
wave: 2
---

## The question, in plain words

When the engineer's fix for a bug is finished but its change is still left as a draft, should the mission wait for it or move on to the next bug?

## The decision, in plain words

The mission moves on: a fix still left as a draft once the engineer's job ended is marked 'not fixed', and QA's second check looks at that bug again.

## The intro, for fun

The engineer went home and left the fix half-wrapped on the desk.

## The punchline, for fun

QA will check the gift again on its second round.

## The options, in plain words

A. Mark a fix still left as a draft 'not fixed' and send the next bug.
B. Wait for the draft to be marked ready before moving on, as a repair's fix does.

## What I had to decide

Spec section 4 lists a fix that cannot land as red, closed or refused by GitHub, and says nothing of a draft. Taken in apps/omni-app/src/missions/qa.ts (judgeBugFix): a fix pull request still a draft when its /omni:bug-fix job ended is refused, `#<n> is still a draft`, and the bug is marked `not fixed: #<n> is still a draft`; the next bug goes. A repair's fix (repair.ts judgeFix) waits on a draft instead, but no job is left to mark a QA fix ready, so waiting would hold the PRD with nothing at work. Checks still running on a ready fix are waited for, as a repair's are.

## What I did meanwhile

Built and tested this way (qa.test.ts, 'a fix lands on the feature branch only').

## What it costs to change later

Waiting on a draft instead is one line in judgeBugFix and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether /omni:bug-fix sent with --base ever ends with its fix pull request still a draft
