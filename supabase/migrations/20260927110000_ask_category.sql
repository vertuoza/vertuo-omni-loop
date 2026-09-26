-- Question history, step 3 (PRD 144, docs: .omni-loop/delivery/inbox/0144-question-history/spec.md):
-- every round carries one of six categories. A model picks one after the round is asked; any member of
-- the session's workspace may set, change or clear it. `category_by` says who set it last: 'model', or
-- the member's id. Null everywhere is a round nobody sorted yet, shown as unsorted.
--
-- Nobody writes these columns directly: no grant reaches them. Two functions do, each checking who
-- calls it: ask_round_categorize() for a member, ask_round_classified() for the model's guess, which
-- the galaxy records as the session's owner (the account that asked) and which never overwrites a
-- person's choice.
--
-- Rollback: drop the two functions; the columns may stay.

alter table public.ask_rounds
  add column category    text check (category is null or category in ('business', 'product', 'ux-ui', 'architecture', 'harness', 'other')),
  add column category_by text check (
    category_by is null
    or category_by = 'model'
    or category_by ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

comment on column public.ask_rounds.category is
  'One of business, product, ux-ui, architecture, harness, other; null is unsorted. Written only by ask_round_categorize() and ask_round_classified().';
comment on column public.ask_rounds.category_by is
  'Who set the category last: ''model'', or the id of the member who set or cleared it. Null until either did.';

-- A member of the session's workspace sets a round's category, or clears it (null). Returns the round's
-- category and who set it, or no row when the caller may not read the round (or it does not exist).
create function public.ask_round_categorize(round_id uuid, new_category text)
returns table (category text, category_by text)
language sql
security definer
set search_path = ''
as $$
  update public.ask_rounds r
     set category = new_category, category_by = (select auth.uid())::text
   where r.id = round_id
     and (select auth.uid()) is not null
     and exists (select 1 from public.ask_sessions s where s.id = r.session_id and public.is_member(s.workspace_id))
  returning r.category, r.category_by
$$;

-- The model's guess, recorded by the galaxy as the account that asked the round (the session's owner),
-- and only while nobody has set the round's category: a person's choice always stands. True when it
-- was recorded.
create function public.ask_round_classified(round_id uuid, new_category text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with sorted as (
    update public.ask_rounds r
       set category = new_category, category_by = 'model'
     where r.id = round_id
       and new_category is not null
       and r.category_by is null
       and exists (
         select 1 from public.ask_sessions s
          where s.id = r.session_id and s.owner = (select auth.uid()) and public.is_member(s.workspace_id))
    returning 1
  )
  select exists (select 1 from sorted)
$$;

revoke execute on function public.ask_round_categorize(uuid, text) from public, anon;
revoke execute on function public.ask_round_classified(uuid, text) from public, anon;
grant execute on function public.ask_round_categorize(uuid, text) to authenticated;
grant execute on function public.ask_round_classified(uuid, text) to authenticated;

create index ask_rounds_category_idx on public.ask_rounds (category);
