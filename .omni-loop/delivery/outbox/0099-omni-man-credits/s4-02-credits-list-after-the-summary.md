---
id: s4-02-credits-list-after-the-summary
prd: 99
slice: s4
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

When someone asks the record for its list of items, should the summary still print above the list, or should the list stand alone?

## The decision, in plain words

The summary prints first, then a blank line, then one line per item, since the design says the list is added. Asked for the machine-readable form as well, only that prints, because it already holds the list.

## The intro, for fun

The design's words and its picture disagreed about what sits above the list.

## The punchline, for fun

The words won, and the picture keeps its artistic licence.

## The options, in plain words

A. Print the summary, then the list, the option built.
B. Print the list alone, as the before-after page shows it.

## What I had to decide

What `omni credits --list` prints. The spec says `--list` adds one line per item, oldest first (`omni credits`, What it prints), while the before-after page shows `omni credits --list --since 2026-09` printing item lines straight after the command, with no report above them. Neither says what `--list` and `--json` do together, nor where the warnings go under `--json`.

## What I did meanwhile

`kit/bin/commands/credits.mjs`: `--list` prints the report, a blank line, then `creditsList` (`kit/lib/credits/report.mjs`): short repository name, `#<n>`, kind, state, created date (UTC), signature (`-` when none), title, each column padded to its widest. `--json` wins over `--list`, and carries the warnings in its `warnings` field instead of stderr. Tested in `kit/bin/credits.test.mjs` (the --list and --json cases) and `kit/lib/credits/report.test.mjs`.

## What it costs to change later

Three lines in `kit/bin/commands/credits.mjs` and one test. Nothing reads the text back.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the list is added, and the before-after page shows it alone; neither says what the list and the machine-readable form do together.
