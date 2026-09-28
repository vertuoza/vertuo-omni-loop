---
id: s4-01-init-closing-message-order
prd: 420
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

In what order does the install command tell a person what it did and what is left for them, now that it also installs the plugin and signs in?

## The decision, in plain words

It lists what it wrote, then the install pull request, then what it did on this computer, then the steps left for a person, numbered: the GitHub App, merging the pull request by its number, the optional protection, and filling the forms. A step it could not do shows the exact lines to type right below its own status.

## The intro, for fun

The install command had a lot to say and one terminal to say it in.

## The punchline, for fun

So it spoke in the order it worked, and saved the chores for last.

## The options, in plain words

A. A. Four blocks: written, install pull request, this computer, then the numbered steps by hand; each fallback under its block (built).
B. B. Fold every fallback (the /plugin lines, omni signin) into the numbered steps by hand, and keep only status lines above.
C. C. One flat list of status lines for every step, then one block of everything left to type.

## What I had to decide

Where the plugin and sign-in status lines and their fallback lines print, and what replaces the old commit-and-merge-by-hand line in the closing steps.

## What I did meanwhile

Four blocks in order: what was written, `Install pull request:`, `On this computer:` (plugin, then sign-in, each fallback printed under the block), then `Then, by hand:` with the App link, `Merge PR #N into <default branch>` and its link, the optional branch protection and `/omni:invade`. The setup and pull request lines print before the plugin and sign-in run, so a person sees progress before the browser opens. This settles the layout the wave 2 item left open.

## What it costs to change later

A few lines in the closing-steps module and the expected output in the init tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec orders the steps and lists what the closing lines print, but not where each step's fallback lines go or what the header of the closing steps says.
