---
id: s4-01-game-scripts-refuse-stray-arguments
prd: 100
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When a game command is given something it does not understand, should it stop, or carry on as if it had not been given it?

## The decision, in plain words

It stops and says what it did not understand. Before, the polling command ignored everything it was given, so a misspelt workspace option would have quietly polled whichever workspace the setting named.

## The intro, for fun

A command that nods politely at words it does not know is how the wrong workspace gets polled.

## The punchline, for fun

Now it frowns and asks again, which is less polite and much kinder to the ledger.

## The options, in plain words

A. Stop on anything not understood, and say what it was. This is what was built.
B. Ignore what is not understood, as the commands did before, and use whichever workspace is named.
C. Warn about what is not understood, and carry on.

## What I had to decide

The spec asks every game script to take `--workspace <slug>`, falling back to `OMNI_LOOP_WORKSPACE`, and to fail loudly without one (D11), but says nothing of other arguments. `game/cli/project.mjs` read no argument at all, and `game/cli/banner.mjs` and `game/cli/export.mjs` ignored anything after their first. Once the flag exists, a misspelt `--worksapce acme` would have been ignored while `OMNI_LOOP_WORKSPACE` named another workspace, and the poll would have appended to that one.

## What I did meanwhile

`openWorkspace()` in `game/cli/workspace.mjs` parses each script's own arguments before any read: `game:project` takes none, `game:banner` exactly one PRD number, `game:export` exactly one directory, and `game:score` what `scoreArgs()` already accepted (it already refused the rest). Anything else exits 2 with the usage line, before Supabase or GitHub is called. `game/cli/scripts.test.mjs` pins it for all four scripts.

## What it costs to change later

A constant per script: the `parse` function each passes to `openWorkspace()`. Nothing stored changes, and the game workflow passes no extra argument.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether anything outside this repository runs the game scripts with arguments they used to ignore is not known (author)
