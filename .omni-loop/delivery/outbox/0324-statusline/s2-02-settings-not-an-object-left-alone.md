---
id: s2-02-settings-not-an-object-left-alone
prd: 324
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

If the shared Claude Code settings file holds valid JSON that is not a set of settings, such as a bare list or a single value, or cannot be read as a file at all, what should setup do?

## The decision, in plain words

Treat it like a file that is not valid JSON: leave it exactly as it is, add no status line, say that it skipped the file, and finish setup as usual.

## The intro, for fun

The settings file was perfectly valid, and perfectly not settings.

## The punchline, for fun

Setup leaves it alone and moves on, as it does with any file it cannot use.

## The options, in plain words

A. Leave the file alone and print the line for a file that is not valid JSON. The option built.
B. Leave the file alone and print a line of its own, saying the file holds no settings.
C. Stop setup with an error, so a person repairs the file first.

## What I had to decide

What `omni init` does when `.claude/settings.json` parses as JSON but is not an object (`[]`, `null`, a string, a number), or when that path cannot be read as a file (a folder, no permission). The spec names only a file that is not valid JSON.

## What I did meanwhile

Both are left byte-identical and print the spec's line for a file that is not valid JSON, `skipped .claude/settings.json: not valid JSON, no status line added`, and init exits 0. A missing file is still created with its folder.

## What it costs to change later

One branch in `kit/lib/init/settings.mjs` and two cases in `kit/lib/init/settings.test.mjs`; a line of its own would be one more entry in `kit/lib/init/steps.mjs`. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec gives four printed lines, and none for valid JSON that holds no settings object, or for a settings path that is not a readable file.
