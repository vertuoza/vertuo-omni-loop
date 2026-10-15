---
id: s1-04-worktree-behind-no-fix
prd: 1990
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

When a working copy a skill made is a day behind, what fix should the check offer?

## The decision, in plain words

It shows red with no fix to run, because the automatic fix only ever touches the main branch of the main copy, and a skill's copy belongs to the skill that made it.

## The intro, for fun

Red with no button to press feels a little rude.

## The punchline, for fun

But pressing it would have touched someone else's work.

## The options, in plain words

A. Red with no fix in a skill's working copy.
B. Red, and offer merging the main branch in by hand as its fix.
C. Orange at most in a skill's working copy, since the skill owns it.

## What I had to decide

Spec section 5 runs only the behind rule in a linked worktree, and section 7's fixes switch and fast-forward the default branch of the main checkout only. A red behind finding in a linked worktree therefore carries no fix, and the fix line does not name it; the wording names the branch against the remote ('feat/x--s1 is 3 behind origin/main, the oldest 3 d old'). In the main checkout on another branch the same finding offers omni sync --fix, which switches first. Also decided here: omni sync --quiet does nothing while another run holds the lock beside the cache, and --background starts none then, so a session start and the status line never stack runs.

## What I did meanwhile

kit/lib/sync/status.ts gives the linked worktree's red finding no fix; kit/bin/commands/sync.ts skips a quiet run while the lock is held.

## What it costs to change later

A constant: a fix text can be added to that finding in one line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a skill's worktree that is a day behind should be red at all, or only orange, was not asked (author).
