-- Each search's nearest distance in the MCP search log (PRD omni-loop-9 s2, the spec's "Each search logs its
-- nearest distance").
--
-- A search by meaning drops every entry farther from the question than a ceiling (s1, MAX_DISTANCE in
-- apps/galaxy/src/product-mcp/search.ts). So that the ceiling can be checked on real questions later, each row
-- now keeps the smallest cosine distance among the entries the search ranked:
--
--   mcp_search_log.nearest_distance  double precision, null: none for a words search, a listing, a
--                                    get_knowledge, or a meaning search that ranked no vector. Written by the
--                                    service role with the rest of its row, never updated; a member of the
--                                    product's workspace reads it with the row, through the table's policy
--                                    (L-GDPR-1). It holds no key and no text (L-GDPR-2), and goes with its row
--                                    after 90 days (mcp_search_log_forget(), L-GDPR-4).
--
-- It has no range check: a distance pgvector answers can round a hair below 0, and a refused row would be a
-- search lost from the log. One nullable column added, nothing else changes: the table's grants (select for
-- the signed in, select and insert for the service role, update of the opened id and rank alone) cover it as
-- they cover every column.
-- Proven by supabase/checks/mcp_search_log.sql.
--
-- Rollback: revert the pull request (the route stops writing the column, the Search page stops showing it);
-- then a follow-up migration runs `alter table public.mcp_search_log drop column nearest_distance;`. The
-- column is derived: dropping it loses no answer.

alter table public.mcp_search_log
  add column nearest_distance double precision;

comment on column public.mcp_search_log.nearest_distance is
  'PRD omni-loop-9: the smallest cosine distance (0 to 2) between the question and the entries a search by meaning ranked; null for a words search, a listing, a get_knowledge, or when no entry held a vector.';
