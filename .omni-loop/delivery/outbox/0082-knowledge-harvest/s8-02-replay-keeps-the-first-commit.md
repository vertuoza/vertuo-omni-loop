---
id: s8-02-replay-keeps-the-first-commit
prd: 82
slice: s8
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

When a harvest is run again for the same merge, its knowledge branch already holds the first run's changes. Should the rerun add its own changes on top, or leave the branch as it is and only refresh the pull request's description?

## The decision, in plain words

A rerun never adds a second change to a branch that already holds the harvest's change. It only rewrites the pull request's description, from what the rerun found.

## The intro, for fun

The second run arrives at the post office to find the letter already sent.

## The punchline, for fun

It rewrites the cover note and leaves the envelope sealed.

## The options, in plain words

A. A. Never commit again to a branch holding the harvest's commit; only rewrite the description (built).
B. B. Commit again when the rerun's files differ from the branch's, on top of the first commit.
C. C. Compare the rerun's files with the branch's, and when they differ, leave both alone and post a comment.

## What I had to decide

The spec says a replay finds the PR by its branch, rewrites its body, and never commits twice. It does not say what happens when the rerun's result differs from the first commit, for instance when the model places a decision differently the second time.

## What I did meanwhile

The publish step reads the knowledge branch's head commit; when it is not the tip it was cut from and its message carries 'The knowledge harvest of #<n>.', no commit is made and upsertPull rewrites the title and body from this run's result. A branch cut by a run that failed before its commit gets the commit. Ids are numbered with the run's own branch left out of the open knowledge branches, so a rerun numbers as the first run did.

## What it costs to change later

Low: one condition in the publish step. Committing a rerun's differing files instead would add a tree comparison before the commit; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The body a rerun writes can name a placement the committed files do not hold when the model answers differently; the spec does not say which should win.
