# ADR-0171 — The Done tab's history is paged, searched and counted in the database, as the caller

**Status:** accepted · **Date:** 2026-11-23 · **PRD:** omni-loop-23 · **Supersedes:** ADR-0049 · **Decided:** @pierrederval, in the PRD's spec · **Layers:** db, ui · **Domain:** ask

## Context

ADR-0049 had the history read the newest 1,000 rounds the caller may see, with all their answers, on
every visit, and filter and search them in the app. Since PRD omni-loop-22 that history is the
Inbox's Done tab. Customers reported the app slow, and the count stopped at 1,000: an older round
could be opened by its link but never found by a filter or a search. ADR-0049's own consequences
named the way out: move the filters and the search into the database, with a text index, and leave
the page as it is. Pierre chose it in PRD omni-loop-23 ("Done reads in the database and pages by
50"), over raising the number.

## Decision

1. **The database reads the history** (`supabase/migrations/20270129090000_ask_history_page.sql`):
   - the rounds gain `search`, a generated `tsvector` of the questions (header and text) and the
     answers in the `simple` configuration, with a GIN index, and an index for newest first over the
     rounds the history lists. The column is derived, never written by a person and never shown, so no
     answer changes (BR-PRODUCT-12, BL-ASK-1);
   - `ask_history_page(filters, before, page_size)` reads one page of the answered and moved rounds,
     newest first, keyed on created time then id; `before` is the id of the last round shown;
   - `ask_history_facets(filters)` reads one row per category, unsorted last, zeros kept: `matched`,
     its rounds under every filter but the category, and `total`, its rounds under none.

   `filters` carries the keys of the app's `HistoryFilters` (category, repo, prd, skill, askedBy,
   answeredBy, search). Both functions run as the caller (security invoker), so row-level security
   decides what each person reads: a member reads only their workspaces' rounds (BR-PRODUCT-29), and a
   session of no workspace is never read (BR-PRODUCT-39).
2. **Waiting rounds are not history.** Done lists only what was answered or moved to the terminal; a
   round still waiting is on the Open tab.
3. **The app draws a page of 50 and the counts it is given.** `askHistoryRepository`
   (`apps/galaxy/src/ask/ask.repository.ts`) calls the two functions, reading every column but
   `search`; `readHistory` (`apps/galaxy/src/ask/page/source.ts`) asks one round more than a page to
   tell whether an older page follows, and returns the page, the counts and the next cursor;
   `doneViewOf` (`apps/galaxy/src/inbox/inbox.controller.ts`) builds the Done view: the page, the true
   total, the count every filter lets through, every category's count, the cursor. "Show older"
   carries the cursor as `?before=`; any other link starts from the newest. There is no page count.
4. **Today's addresses still read.** `category`, `repo`, `prd`, `skill`, `asked`, `answered` and `q`
   mean what they meant; `before` is the only new parameter.
5. **The demo reads the same way, in memory.** `historyPageOf` and `historyFacetsOf`
   (`apps/galaxy/src/ask/page/workspace-history.ts`) page and count the demo's made-up workspace as the
   two functions do.

## What it supersedes in ADR-0049

All of it: the history no longer reads the newest thousand rounds, and no filter or search runs in
the app on a signed-in person's history. A filter or a search now finds any round the caller may read,
however old.

## Consequences

- The Done tab reads 51 rounds and seven counts a visit, not 1,000 rounds; its count is the true
  total.
- The search matches words, not stems, in the `simple` configuration: "migrations" does not find
  "migration". The app's search matched parts of words, so a search for part of a word no longer
  finds it. Changing the configuration is a new migration of the column and its index.
- The filters' choices (repository, PRD, skill, who asked, who answered) are drawn from the page read
  and the values chosen, not from every round: listing every value the history holds would be one
  more function.
- Rollback: revert the read; the functions go unused, and the column stays harmless until a later
  migration drops them.
