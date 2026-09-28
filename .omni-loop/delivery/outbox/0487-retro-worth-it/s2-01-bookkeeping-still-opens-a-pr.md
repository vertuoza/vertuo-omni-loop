---
id: s2-01-bookkeeping-still-opens-a-pr
prd: 487
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

When a merged feature taught nothing new but its folder still has to move to the shipped shelf, should the app still open a knowledge pull request for that move?

## The decision, in plain words

Yes: the app skips the pull request only when there is truly nothing to change. If the move or the closing of open questions is still owed, it opens the pull request as before, and leaves no comment.

## The intro, for fun

Nothing new was learned, but the boxes are still sitting in the hallway.

## The punchline, for fun

Someone has to carry them upstairs, and that takes a pull request.

## The options, in plain words

A. Open the pull request only when there is something to write; a bookkeeping-only pull request still opens, the option built.
B. Never open a pull request without a promotion, and leave the move and the settling undone until a later harvest.
C. Never open a pull request without a promotion, and say in the comment that the move is still owed so a person does it by hand.

## What I had to decide

Whether the app gates the knowledge pull request on 'nothing to write at all' or on 'nothing promoted', when a feature with no promotion still has merge-time bookkeeping left.

## What I did meanwhile

The app opens no branch and no pull request, and leaves the 'Knowledge: nothing new' comment, only when the harvest has nothing at all to write. That is the usual case, since the feature branch already ships its own folder. When the move or the settling is still owed, the pull request opens as before, carrying only that bookkeeping. The count in the comment is every candidate the harvest looked at.

## What it costs to change later

One condition in the harvest's publish step: test for a promotion instead of for an empty change set.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says no promotion means no pull request, and the adopted s1 decision says the move and the settling still happen; both cannot hold for a feature still in the inbox at merge, so the app follows the s1 decision.
- (author) The spec does not say whether '<n> candidates stayed local' counts candidates the model could not place; the comment counts every candidate.
