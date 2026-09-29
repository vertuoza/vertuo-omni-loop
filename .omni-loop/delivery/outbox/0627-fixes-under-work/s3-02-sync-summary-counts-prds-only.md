---
id: s3-02-sync-summary-counts-prds-only
prd: 627
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The background sync ends with one line of totals. Should those totals count the fix pages it made, beside the PRD pages?

## The decision, in plain words

Each repository's own line now names its fix folders, the fix pages made and the fix versions added, but the closing totals line still counts PRD pages only, because it lives outside this piece of work.

## The intro, for fun

The sync's last line can count to PRDs, and stops there.

## The punchline, for fun

The fixes are in the per-repository lines, waving.

## The options, in plain words

A. Leave the closing totals counting PRD pages only (built).
B. Add the fix pages and fix versions to the closing totals.

## What I had to decide

Whether to change the sync command's closing totals, which sit outside this slice's territory, to add the fixes.

## What I did meanwhile

Left the closing totals as they are; the per-repository lines and the report each repository returns carry the fixes in full.

## What it costs to change later

A constant: adding the fix counts to the closing line is two lines in the sync command.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives this slice the fallback's folder only, and the closing line lives in the command that runs it.
