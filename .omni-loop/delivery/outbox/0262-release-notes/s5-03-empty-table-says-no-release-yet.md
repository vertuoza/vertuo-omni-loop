---
id: s5-03-empty-table-says-no-release-yet
prd: 262
slice: s5
rank: medium
bears-on: none
raised: 2026-09-27
wave: 3
---

## The question, in plain words

Right after the page goes live, and before the first publishing run, the list of releases is empty. What should a visitor read then?

## The decision, in plain words

A short line saying no release is published yet, under the page's heading. It differs from the message shown when the page cannot be read at all.

## The intro, for fun

Opening night: the stage is set, and the cast has not arrived yet.

## The punchline, for fun

The sign on the door says the show starts soon, not that the theatre burned down.

## The options, in plain words

A. A line of its own, saying no release is published yet: the option built.
B. The same line as when the page cannot be read, saying release notes are unavailable right now.
C. Only the heading and its line, with nothing under them.

## What I had to decide

What `/releases` shows when `public.releases` answers with no row: the migration has run and the sync has not. The spec names the unavailable message for closed mode and a failed read, and says nothing of an empty table.

## What I did meanwhile

`RELEASES.empty`, *No release is published yet.*, in `apps/galaxy/src/releases/words.ts`, shown by `ReleasesPage` when there is no week (`apps/galaxy/src/releases/page/render.test.ts`). An empty read is a good read: it replaces an older render like any other.

## What it costs to change later

One word constant and one branch of the page. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How long the table stays empty in production: the sync follows each successful migration run on main, so minutes once the repository variables are set.
