---
prd: 1017
title: Rank and sort the People table
blocked-by: none
spec: file
---

# Rank and sort the People table

**Date:** 2026-10-02 · **PRD:** #1017 · **From:** visual issue #1016, stopped as more than a visual
fix · **Touches:** `apps/galaxy/src/dashboard/board/tally.ts`, a new
`apps/galaxy/src/dashboard/board/sort.ts`, `Board.tsx` and `board.css` beside them, and their tests.
**Out of scope:** what a point is worth, any read or stored shape, any script on the board, the
Repositories and Fleets tables.

## Problem

The People table that every board draws (Home, Fleet and Workspace, `Board.tsx`) is ordered by PRs
merged, then points, then name (`peopleRows`, `tally.ts`). The game scores points, so the person on
top is not the one who scored most: on the Workspace board today, someone with 16 PRs and 0 points
sits above someone with 8 PRs and 125 points. Nobody can tell their place by points without counting
rows, and nobody can reorder the table to look at PRs, PRDs or questions instead.

## Solution

1. **Default order: points.** `peopleRows` orders the rows by points, highest first, then by PRs
   merged, highest first, then by name A to Z (case-insensitive, as today). A missing value (no
   GitHub login, a dash) or an unreadable one (`?`) sorts below every number, as today.
2. **A rank, always by points.** Each row carries `rank`: the person's place by points among the
   table's rows, in standard competition ranking: equal points share a rank and the next rank skips
   the places they took (125, 50, 50, 0, 0 rank 1, 2, 2, 4, 4). A row whose points are a dash or `?`
   has no rank. The rank never changes with the column the table is sorted by. The table draws it
   as a new first column, `RANK`, right-aligned like the other figures; a row with no rank shows
   `–`.
3. **Sortable headers, in the URL.** Every header of the People table (Rank, Name, Fleet, Points,
   PRs, PRDs, Questions) is a plain link. The sort lives in the query as `?sort=<key>` and, when
   reversed, `&dir=asc|desc`; every other query value (`period`, `fleet`, …) is kept, through
   `hrefWith` (`links.ts`), and the period switch keeps the sort the same way, since it already
   keeps the rest of the query. Each link ends in `#board-people`, so the page opens at the table.
   - Keys: `rank`, `name`, `fleet`, `points`, `prs`, `prds`, `questions`.
   - Each key has a natural direction: `rank`, `name` and `fleet` ascending (1 first, A to Z);
     `points`, `prs`, `prds` and `questions` descending (most first).
   - A header that is not the current sort links to its key in its natural direction, with no
     `dir`. The current sort's header links to the same key in the other direction.
   - No `sort`, or one this table does not know, is `points` in its natural direction; a `dir`
     other than `asc` or `desc` is the key's natural direction.
   - `prds` compares shipped, then building, then open. `fleet` compares the fleet's label as the row reads it, A to Z, case-insensitive; a member with no fleet reads `SOLO` and sorts by that word.

   - Whatever the key and direction, a dash or `?` sorts last, and ties fall back to the default
     order (points, PRs, name), so the order is always total.
   - The sorted header shows ▼ (descending) or ▲ (ascending), hidden from a screen reader, and its
     `<th>` carries `aria-sort="descending|ascending"`; the others carry none.
4. **Drawn on the server, as today.** `Board` reads the sort from the query it already receives and
   orders the rows before drawing them. No script, no client state, no new read.

## Decisions

- **Rank follows points, not the current sort** (asked): #1 is the top scorer whatever column is
  sorted, as the Fleets ranking reads.
- **Ties share a rank, and the next rank skips** (asked): 1, 2, 2, 4. Everyone on 0 points shares
  the last rank.
- **Every column sorts, and a second click reverses it** (asked); the first click sorts the natural
  way for that column.
- **The sort lives in the URL, as the period does** (taken here, the most reversible option): a
  header is a link, so the board keeps drawing on the server with no script, and a sorted table can
  be shared as a link.
- **One change for every board:** Home, Fleet and Workspace all draw the same People table, so all
  three rank and sort; nothing asks for one to differ.
- **The voice objected, settled `none`.** persona:Lead Engineer: a rank beside every person on the
  shared Workspace board turns it into a leaderboard of individuals, and a shared last place in
  front of the whole workspace (size#37) could hurt more than it motivates. The person approved the
  design as it stood.
- **No proof video** (asked).

## User stories

1. As a player, I open the Workspace board and the top scorer is the first row, with rank 1.
2. As a player, I see my own rank beside my name, and people on the same points share it.
3. As a lead, I click `PRS` and the table is ordered by PRs merged, most first; I click it again and
   it is fewest first.
4. As a lead, I switch the period to 30 days and the table stays sorted the way I left it.
5. As anyone, I send the sorted board's link and the person who opens it sees the same order.

## Scope

- In: the People table's order, its rank column, its header links and their marks, on every board
  that draws it.
- Out: points themselves, the Repositories table, the Fleets ranking, any client-side sorting, any
  remembered sort beyond the URL, any change to a read, a route or a stored shape.

## Test seams

The repository's tests sit beside the code (`*.test.ts` under `apps/*/src/`), run by `pnpm test`, and
never call GitHub or Supabase.

- **`tally.test.ts`** (pure): the default order by points, then PRs, then name, replacing
  `'sorts by PRs merged, then points, then name'`; the rank, with shared ranks, a skipped rank,
  0-point rows sharing the last rank, and no rank for a dash or `?`.
- **`sort.test.ts`** (pure, new): reading `sort` and `dir` from a query, unknown values included;
  each key in both directions; dashes and `?` last in both directions; ties falling back to the
  default order; the header link for the current sort and for another key, keeping `period` and
  `fleet` and ending in `#board-people`.
- **`render.test.ts`** (the board drawn to HTML): the `RANK` column and its cells, each header a
  link, `aria-sort` and the mark on the sorted header only, and the rows in the order the query
  asks.

## Risks

A merge to `main` publishes the arcade (`apps/galaxy`) as its Vercel project deploys it; this PRD
touches no migration and nothing under `kit/`, so it publishes no database change and no kit change.
What changes for everyone is the People table on Home, Fleet and Workspace: its order and a new
column. A link someone kept keeps working: a board URL with no `sort` draws the points order. Roll
back by reverting the feature PR.

## Acceptance criteria

1. With no `sort` in the URL, every board's People table lists its people by points, highest first,
   ties by PRs merged, highest first, then by name A to Z; a dash or `?` in points sorts last.
2. The People table's first column is `RANK`: each row's place by points, equal points sharing a
   rank and the next rank skipping (1, 2, 2, 4); a row whose points are a dash or `?` shows `–`.
3. The rank of every row is the same whatever column the table is sorted by.
4. Each of the seven headers is a link; following it orders the table by that column in its natural
   direction (Rank, Name and Fleet ascending; Points, PRs, PRDs and Questions descending), and
   following the sorted header again reverses it.
5. PRDs sort by shipped, then building, then open; a dash or `?` sorts last in either direction.
6. Every header link keeps the URL's other values (`period`, `fleet`) and ends in `#board-people`,
   and the period switch keeps `sort` and `dir`.
7. The sorted header alone shows ▼ or ▲ and carries `aria-sort` (`descending` or `ascending`).
8. A `sort` or `dir` the table does not know draws the default order, with no error.
9. The board still draws with no script: the page's HTML holds the rows in the requested order.
