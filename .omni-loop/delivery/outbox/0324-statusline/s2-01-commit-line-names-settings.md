---
id: s2-01-commit-line-names-settings
prd: 324
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Setting up the loop now also adds the status line to the shared Claude Code settings. Should the closing message ask the person to commit that settings file too?

## The decision, in plain words

Yes. The closing message names both the loop's folder and the settings file when both were written, the settings file alone when only it was, and still says nothing is new when neither was.

## The intro, for fun

Setup now touches a second file, and its goodbye note only knew how to mention one.

## The punchline, for fun

The note now lists both, so nothing is left behind uncommitted.

## The options, in plain words

A. Name every place this run wrote, the settings file included, so a rerun that only adds the status line asks for a commit. The option built.
B. Keep the commit line as it was: it names only the loop's folder, and a rerun that only adds the status line says there is nothing new to commit.

## What I had to decide

What `omni init`'s closing steps ask a person to commit once init can write `.claude/settings.json` too. The spec gives the status line paragraph and the new removal line, but says nothing of the line above the steps, `Commit .omni-loop/ and merge it into <branch>, then, by hand:`, which named only the loop's folder.

## What I did meanwhile

The commit line names what this run wrote: `Commit .omni-loop/ and .claude/settings.json, and merge them into <branch>, then, by hand:` when both; `Commit .claude/settings.json and merge it into <branch>, then, by hand:` when only the key was written (a repository that already had the loop runs init again); `Commit .omni-loop/ and merge it into <branch>, then, by hand:` when only the loop's folder was; `Nothing new to commit. By hand, unless already done:` when neither. With `--force` the kit's line is rewritten, so it counts as written, as the config and the bin do.

## What it costs to change later

One expression in `kit/lib/init/steps.mjs` and the expected lines in `kit/bin/init.test.mjs`. No stored data, and no other slice reads init's output.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists what the closing steps gain (the status line paragraph, the new removal line) but not whether the commit line above the steps names the settings file; before this PRD it named only the loop's folder.
