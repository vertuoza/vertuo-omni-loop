---
id: s1-02-check-config-shape
prd: 1089
slice: s1
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

How does a team mark a hook as one only Claude reads, how big may a hook file be when nobody says, and does the config check run with every other check?

## The decision, in plain words

A Claude-only hook is written as its path plus a 'claude' mark; the size limit is optional and falls back to twenty kilobytes without appearing in the printed config; and the new config check runs on its own and inside the run of every check.

## The intro, for fun

A config file asked to be checked, and then asked who checks the checker.

## The punchline, for fun

Now it gets checked every time, with the others, whether it likes it or not.

## The options, in plain words

A. Keep it: the Claude mark sits on each hook, the size limit is optional with a quiet default, and the config check runs inside every full check.
B. Fill the size limit's default in the printed config, like the other limits, accepting one changed existing test.
C. Put the Claude mark on the whole point rather than on each hook, and keep the config check out of the full run.

## What I had to decide

The spec names alias: claude but not where it sits; I made a hook reference either a path or { path, alias: claude }, the latter also taking a slash command (pr.openWith's alias resolves to that). limits.hookMaxBytes is optional, not defaulted in the parsed config, so a config without it parses exactly as before and the existing limits test stays unchanged; the 20480 default lives in kit/lib/flow/schema.ts. omni check config is a new guard, and omni check all runs it first. To exit 1 on an invalid config, omni check now loads its own context: check config turns an invalid config into a red guard, every other guard still stops with exit 2 as before.

## What I did meanwhile

Built the guard, the alias form and the optional limit, each with tests in kit/bin/check-config.test.ts and kit/lib/flow/schema.test.ts.

## What it costs to change later

A constant change: defaulting hookMaxBytes in the schema (and updating one existing test), moving alias: claude onto the point, or leaving config out of check all are each a few lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether omni config should print hookMaxBytes with its default like the other limits
