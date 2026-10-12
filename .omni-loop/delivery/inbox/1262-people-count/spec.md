---
prd: 1262
title: The People table says how many people it lists (e2e beta test)
blocked-by: none
proof: video
spec: file
---

## Problem

The People table on the galaxy app lists every member of the workspace, but nothing says how many that
is: a reader counts the rows. This PRD is also a deliberate test: it is the smallest change with
visible acceptance criteria, built so that `/omni:validate-e2e` (PRD 1233) can be run end to end on
a ready feature PR with a preview. Its feature PR is closed without merging once the skill has run.

## Solution

Under the `People` heading, a line says how many people the table lists: `N people`, or `1 person`
for one. It is drawn by the `People` component of `apps/galaxy/src/dashboard/board/Board.tsx`, so it
appears wherever that component does (the workspace page and Home's "Your fleet"). When the people
cannot be read, the table is replaced by the "could not load" message and no count is shown.

## Decisions

- **N is the number of rows the table lists**, whatever a column's own state: a column that could not
  be read does not change the count.
- **The line sits in the `People` component, so Home shows it too.** One place to change, no second
  copy of the rule. A person who wants it on the workspace page only says so.
- **Proof video: yes.** The person asked for it, so `/omni:yolo` follows `/omni:prove` once the feature
  PR is ready.
- **Nothing is merged to the default branch.** The feature PR is closed after `/omni:validate-e2e` has
  run on it.

## User stories

1. As a reader of the workspace page, I see how many people the People table lists without counting.
2. As a person trying `/omni:validate-e2e`, I get criteria a screen can show, so the skill writes and
   records real tests.

## Scope

In: the count line in `People`, its singular, its absence when the people cannot be read, and its
tests. Out: any change to the data, the sort, the columns, the period switch or the other tables.

## Test seams

Component rendering tests beside `Board.tsx` (`render.test.ts`), as the other People tests are written:
render `People` with a list of rows and read the line. The e2e level is written by
`/omni:validate-e2e` from the criteria below, never by hand here.

## Risks

Merging would add one line of text to the galaxy app: no stored data, no migration. It is rolled back
by reverting the pull request. It will not be merged: the feature PR is closed after the e2e trial.

## Acceptance criteria

1. On `/app/workspace`, a line `N people` is visible under the `People` heading, where N is the number
   of rows in the table.
2. With exactly one person, the line reads `1 person`. (Ordinary test: the demo world lists several
   people.)
3. Sorting the table by a header does not change the number the line shows.
4. When the people cannot be read, no count line is shown. (Ordinary test: a screen does not show a
   failure on demand.)
