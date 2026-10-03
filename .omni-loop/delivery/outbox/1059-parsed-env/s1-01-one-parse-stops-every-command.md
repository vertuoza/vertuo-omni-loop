---
id: s1-01-one-parse-stops-every-command
prd: 1059
slice: s1
rank: medium
bears-on: none
raised: 2026-10-03
wave: 1
---

## The question, in plain words

When one setting in the environment is half filled in or malformed, should every command of the loop's tool stop, or only the commands that use that setting?

## The decision, in plain words

Every command stops, with one message naming each setting that is wrong and never its value. The tool reads all its settings once when it starts, so a bad setting is found at once rather than deep inside a run.

## The intro, for fun

One typo in a setting, and the whole toolbox stays shut.

## The punchline, for fun

Loud and early beats quiet and wrong an hour later.

## The options, in plain words

A. A. One read at startup: any half-set or malformed group stops every command, naming its variables.
B. B. Each command reads only the groups it uses: a wrong setting it does not use is ignored.
C. C. As A, but the status line never stops: it draws as before and ignores the error.

## What I had to decide

Whether a wrong setting a command does not use (the game's database pair, the model's key) should stop that command too.

## What I did meanwhile

Every omni command, the status line included, and every game script and check:changed stop with exit 2 and one line naming the variables when any group of the kit's, the game's or the scripts' environment is half set or malformed.

## What it costs to change later

Answering B means a read per group in kit/lib/env/read.ts and each command asking for its own groups: a few hours, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a half-set group fails at startup but does not say whether a group the running command never reads counts.
- (author) The status line used to draw whatever the environment held; it now prints the error line instead when a setting is wrong.
