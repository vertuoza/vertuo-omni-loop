-- The Done tab's history, read in the database (PRD omni-loop-23, s1). Until now the page read the
-- newest 1,000 rounds with all their answers on every visit and filtered them in the app (ADR-0049):
-- slow, and the count stopped at 1,000. Here the rounds gain a search column and two indexes, and two
-- functions read one page and the counts, in the database:
--
--   ask_rounds.search                         a tsvector of the questions (header and text) and the
--                                             answers, `simple` configuration (words, not stems);
--                                             generated, so nobody writes it and no answer changes
--                                             (BR-PRODUCT-12)
--   ask_history_page(filters, before, size)   one page of the answered and moved rounds, newest first,
--                                             keyed on created time then id; `before` is the id of the
--                                             last round shown, and a round the caller cannot read
--                                             gives an empty page
--   ask_history_facets(filters)               one row per category, unsorted last: `matched`, its
--                                             rounds under every filter but the category, and `total`,
--                                             its rounds under none
--
-- `filters` is an object with the keys the app's HistoryFilters use, each left out (or empty) letting
-- every round through: category (one of the six, or `unsorted`), repo, prd, skill, askedBy, answeredBy,
-- search (words, each of which the round must hold). Waiting rounds are never read: they are on the
-- Open tab.
--
-- Both functions run as the caller (security invoker): row-level security decides what each person
-- reads, so a member reads only their workspaces' rounds (BR-PRODUCT-29), and a session of no workspace
-- is never read (BR-PRODUCT-39). Only a signed-in person runs them.
-- Proven by supabase/checks/ask_history_page.sql.
--
-- Adding the column rewrites ask_rounds once, and the GIN index is built over it once.
-- Rollback: a follow-up migration drops the three functions, the two indexes, the column and
-- public.ask_round_words(); nothing else reads them.

-- ── The search column ─────────────────────────────────────────────────────────

-- Every word a search looks through, as the app's search did: each question's header and text, and
-- every answer. Immutable, so a generated column may call it.
create function public.ask_round_words(questions jsonb, answers jsonb) returns tsvector
language sql immutable parallel safe
set search_path = ''
as $$
  select to_tsvector('simple'::regconfig, concat_ws(' ',
    (select string_agg(concat_ws(' ', q ->> 'header', q ->> 'question'), ' ')
       from jsonb_array_elements(case when jsonb_typeof(questions) = 'array' then questions else '[]' end) q
      where jsonb_typeof(q) = 'object'),
    (select string_agg(e.value, ' ')
       from jsonb_each_text(case when jsonb_typeof(answers) = 'object' then answers else '{}' end) e)))
$$;

revoke execute on function public.ask_round_words(jsonb, jsonb) from public;
grant execute on function public.ask_round_words(jsonb, jsonb) to anon, authenticated, service_role;

alter table public.ask_rounds
  add column search tsvector generated always as (public.ask_round_words(questions, answers)) stored;

comment on column public.ask_rounds.search is
  'The words of the questions and the answers (simple configuration), for the history''s search. Generated: never written, never shown.';

create index ask_rounds_search_idx on public.ask_rounds using gin (search);

-- The history's newest-first order over the rounds it lists (answered or moved), and its cursor.
create index ask_rounds_history_idx on public.ask_rounds (created_at desc, id desc)
  where status in ('answered', 'abandoned');

-- ── The filters, read once ────────────────────────────────────────────────────

-- The filters of an address, each null when left out or empty; `words` is the search as a query, null
-- when it holds no word. Read once per call, so the search is parsed once, never once per round.
create function public.ask_history_filters(filters jsonb)
returns table (category text, repo text, prd text, skill text, asked_by text, answered_by text, words tsquery)
language sql stable
security invoker
set search_path = ''
as $$
  select nullif(filters ->> 'category', ''),
         nullif(filters ->> 'repo', ''),
         nullif(filters ->> 'prd', ''),
         nullif(filters ->> 'skill', ''),
         nullif(filters ->> 'askedBy', ''),
         nullif(filters ->> 'answeredBy', ''),
         case when numnode(t.q) > 0 then t.q end
    from (select case when btrim(coalesce(filters ->> 'search', '')) <> ''
                      then plainto_tsquery('simple'::regconfig, filters ->> 'search') end as q) t
$$;

-- ── One page ──────────────────────────────────────────────────────────────────

create function public.ask_history_page(filters jsonb default '{}', before uuid default null, page_size integer default 50)
returns setof public.ask_rounds
language sql stable
security invoker
set search_path = ''
as $$
  select r.*
    from public.ask_history_filters(coalesce(ask_history_page.filters, '{}')) f
   cross join public.ask_rounds r
    join public.ask_sessions s on s.id = r.session_id
   where r.status in ('answered', 'abandoned')
     and (ask_history_page.before is null
          or (r.created_at, r.id) < (select c.created_at, c.id from public.ask_rounds c where c.id = ask_history_page.before))
     and (f.category is null or coalesce(r.category, 'unsorted') = f.category)
     and (f.repo is null or s.repo = f.repo)
     and (f.prd is null or r.prd::text = f.prd)
     and (f.skill is null or r.skill = f.skill)
     and (f.asked_by is null or s.owner::text = f.asked_by)
     and (f.answered_by is null or r.answered_by::text = f.answered_by)
     and (f.words is null or r.search @@ f.words)
   order by r.created_at desc, r.id desc
   limit least(greatest(coalesce(ask_history_page.page_size, 50), 1), 200)
$$;

comment on function public.ask_history_page(jsonb, uuid, integer) is
  'One page of the answered and moved rounds the caller may read, newest first (created time, then id), under the filters; before: the id of the last round shown. At most 200 rounds, 50 by default.';

-- ── The counts ────────────────────────────────────────────────────────────────

create function public.ask_history_facets(filters jsonb default '{}')
returns table (category text, matched bigint, total bigint)
language sql stable
security invoker
set search_path = ''
as $$
  with history as (
    select coalesce(r.category, 'unsorted') as category,
           (f.repo is null or s.repo = f.repo)
       and (f.prd is null or r.prd::text = f.prd)
       and (f.skill is null or r.skill = f.skill)
       and (f.asked_by is null or s.owner::text = f.asked_by)
       and (f.answered_by is null or r.answered_by::text = f.answered_by)
       and (f.words is null or r.search @@ f.words) as hit
      from public.ask_history_filters(coalesce(ask_history_facets.filters, '{}')) f
     cross join public.ask_rounds r
      join public.ask_sessions s on s.id = r.session_id
     where r.status in ('answered', 'abandoned')
  )
  select c.category,
         count(h.category) filter (where h.hit),
         count(h.category)
    from unnest(array['business', 'product', 'ux-ui', 'architecture', 'harness', 'other', 'unsorted']) with ordinality as c (category, place)
    left join history h on h.category = c.category
   group by c.category, c.place
   order by c.place
$$;

comment on function public.ask_history_facets(jsonb) is
  'Each category of the history the caller may read, unsorted last: matched, its rounds under every filter but the category; total, its rounds under none.';

revoke execute on function public.ask_history_filters(jsonb) from public, anon;
revoke execute on function public.ask_history_page(jsonb, uuid, integer) from public, anon;
revoke execute on function public.ask_history_facets(jsonb) from public, anon;
grant execute on function public.ask_history_filters(jsonb) to authenticated;
grant execute on function public.ask_history_page(jsonb, uuid, integer) to authenticated;
grant execute on function public.ask_history_facets(jsonb) to authenticated;
