---
id: s3-02-mutation-nightly-proving-run
prd: 1072
slice: s3
rank: medium
bears-on: none
raised: 2026-10-05
wave: 3
---

## The question, in plain words

The plan asked for one hand-started run of the new nightly check before the feature is ready, but GitHub only offers that button once the check is on the main branch. How do we prove it beforehand?

## The decision, in plain words

A throwaway copy of this work, with one extra line that starts the check when that copy is uploaded, ran it once. The real file is unchanged, and the copy is deleted afterwards.

## The intro, for fun

The start button only appears once the check lives on the main branch.

## The punchline, for fun

So we built a spare copy with its own button and pressed that one.

## The options, in plain words

A. A throwaway branch with a temporary push trigger, the shipped file untouched, the option built.
B. A permanent push trigger for a proving branch name in the shipped workflow, which stays as a back door to run it.
C. Wait for the first on-demand or nightly run after the feature PR merges, so nothing is proved before merging.

## What I had to decide

How to run `.github/workflows/mutation.yml` once before the feature PR is ready, when `workflow_dispatch` only works for a workflow on the default branch and nothing may be pushed to `main`.

## What I did meanwhile

Pushed a throwaway branch, `prove/mutation-nightly`, holding the slice branch plus one commit that adds `push: branches: [prove/mutation-nightly]` to the workflow's triggers. The run on that branch is linked from the sub-PR. The committed workflow has only `schedule` and `workflow_dispatch`; the throwaway branch is deleted once the run ends.

## What it costs to change later

Nothing to undo in the shipped file. Proving again after a change means pushing the same throwaway branch again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the first on-demand run from the Actions tab, once the feature is on main, is still the spec's proof as written
