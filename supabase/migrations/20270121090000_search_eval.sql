-- A product's eval set: its questions, their right answers, and its runs (PRD omni-loop-8 s1, the spec's "The
-- eval set" and "The runs").
--
-- The App's `search-eval-promote` job (s4) adds each category's most-asked groups to the set and has Jev's
-- `search-relevant` decision (s3) judge their answers; its `search-eval-run` job (s4) searches every question
-- of the set and keeps one run with its measures and misses. The Search page's Eval view (s5) reads all three
-- and lets a member correct the set. A person's word wins over Jev's (Q4).
--
--   public.search_eval_questions     one question of a product's set: its workspace, the question, its category
--                                    (null when a member gave none), the group it came from (null when a member
--                                    added it, or once the log forgot the group), who added it (`promotion`, or
--                                    the member's login), when, and who removed it and when (null while it is in
--                                    the set). A removed question stays, with its answers: the promotion never
--                                    adds its group again, and a group joins the set once
--   public.search_eval_answers       one entry judged for one question: relevant or not, its source (`jev`, with
--                                    its confidence; `person`, with the member's login), when. One row per
--                                    question and entry: a person's answer replaces Jev's or an earlier
--                                    person's; Jev's never replaces a person's
--   public.search_eval_runs          one run of a product's set: its trigger (`daily` or `embed`) and slot (the
--                                    day, or the embed job), when it ran, its measures (an object: overall and
--                                    per category) and per question the ranks of its right answers and the ids
--                                    that came first (an array). Kept once per product, trigger and slot
--
-- A member of the product's workspace reads all three (L-GDPR-1, BR-PRODUCT-63); a member of another
-- workspace and anon read none. Nobody writes them straight: every write goes through one function.
--
--   search_eval_question_add(product, question, category)        a member: adds a question, recording their
--                                                                login; answers its id
--   search_eval_question_remove(question)                        a member: removes it from the set, recording
--                                                                their login; true when it was in the set
--   search_eval_answer_set(question, entry, relevant)            a member: sets a person's answer, recording
--                                                                their login; answers the row
--   search_eval_question_promote(product, group, category)       the service role: adds the group's first
--                                                                question as `promotion`; null when the group
--                                                                already joined the set (removed or not)
--   search_eval_answer_jev(question, entry, relevant, confidence)
--                                                                the service role: sets Jev's answer; false,
--                                                                writing nothing, when a person answered that
--                                                                entry or the question was removed
--   search_eval_run_record(product, trigger, slot, measures, questions)
--                                                                the service role: keeps one run; null when the
--                                                                product already holds one of that trigger and
--                                                                slot
--   jev_decision_names()                                         gains `search-relevant`
--
-- Questions, answers and runs are measures and decisions: no retention deletes them, and forgetting a search
-- group only empties a question's group. A question's answers go with it, and the set and the runs with their
-- product.
--
-- Every change adds: three tables, six functions, one name of an existing function's answer. Nothing is dropped.
-- Proven by supabase/checks/search_eval.sql.
--
-- Rollback: revert the pull request (the jobs and the view go); then a follow-up migration restores
-- jev_decision_names() as 20270120093000_mcp_search_groups.sql wrote it, deletes the decision's jev_decisions
-- rows, and drops the six functions and public.search_eval_runs. The questions and answers hold people's
-- corrections, which a drop loses: keep public.search_eval_questions and public.search_eval_answers unless a
-- person asks for them to go.

-- ── The questions ────────────────────────────────────────────────────────────────

create table public.search_eval_questions (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  question     text not null constraint search_eval_questions_question_check check (char_length(question) between 1 and 300),
  category     text constraint search_eval_questions_category_check check (char_length(category) between 1 and 80),
  group_id     uuid,
  added_by     text not null constraint search_eval_questions_added_by_check check (char_length(added_by) between 1 and 200),
  added_at     timestamptz not null default now(),
  removed_by   text constraint search_eval_questions_removed_by_check check (char_length(removed_by) between 1 and 200),
  removed_at   timestamptz,
  constraint search_eval_questions_removed_check check ((removed_at is null) = (removed_by is null)),
  -- The question's workspace is its product's, always.
  constraint search_eval_questions_product_fkey foreign key (product_id, workspace_id)
    references public.products (id, workspace_id) on delete cascade,
  -- A question comes only from a group of its own product.
  constraint search_eval_questions_group_fkey foreign key (group_id, product_id)
    references public.mcp_search_groups (id, product_id) on delete set null (group_id),
  -- What an answer references, so an answer is filed under its question's workspace.
  constraint search_eval_questions_id_workspace_key unique (id, workspace_id)
);

comment on table public.search_eval_questions is
  'PRD omni-loop-8: one question of a product''s eval set, promoted from a search group (added_by `promotion`) or added by a member (added_by their login). Removed by a member, it stays with its answers, and its group is never promoted again. Written only through search_eval_question_add(), search_eval_question_remove() and search_eval_question_promote(); a member of the product''s workspace reads it.';
comment on column public.search_eval_questions.group_id is
  'PRD omni-loop-8: the search group the question was promoted from; null when a member added it, or once mcp_search_log_forget() deleted the group. A group joins the set once.';

-- A group joins the set once, even after its question was removed.
create unique index search_eval_questions_group_key on public.search_eval_questions (group_id) where group_id is not null;
create index search_eval_questions_product_idx on public.search_eval_questions (product_id, added_at);

alter table public.search_eval_questions enable row level security;

create policy "a member reads their workspace's eval questions" on public.search_eval_questions
  for select to authenticated
  using (workspace_id in (select public.my_workspaces()));

-- ── The right answers ────────────────────────────────────────────────────────────

create table public.search_eval_answers (
  question_id  uuid not null,
  workspace_id uuid not null,
  entry_id     text not null constraint search_eval_answers_entry_id_check check (char_length(entry_id) between 1 and 200),
  relevant     boolean not null,
  confidence   real constraint search_eval_answers_confidence_check check (confidence between 0 and 1),
  source       text not null constraint search_eval_answers_source_check check (source in ('jev', 'person')),
  decided_by   text constraint search_eval_answers_decided_by_check check (char_length(decided_by) between 1 and 200),
  decided_at   timestamptz not null default now(),
  primary key (question_id, entry_id),
  -- Jev's answer carries its confidence and no login; a person's carries their login and no confidence.
  constraint search_eval_answers_source_shape_check check (
    (source = 'jev' and confidence is not null and decided_by is null)
    or (source = 'person' and confidence is null and decided_by is not null)),
  constraint search_eval_answers_question_fkey foreign key (question_id, workspace_id)
    references public.search_eval_questions (id, workspace_id) on delete cascade
);

comment on table public.search_eval_answers is
  'PRD omni-loop-8: whether one entry answers one question of the eval set: Jev''s (search-relevant, with its confidence) or a person''s (with their login). A person''s answer replaces Jev''s; Jev''s never replaces a person''s (Q4). Written only through search_eval_answer_set() and search_eval_answer_jev(); a member of the workspace reads it.';

create index search_eval_answers_workspace_idx on public.search_eval_answers (workspace_id);

alter table public.search_eval_answers enable row level security;

create policy "a member reads their workspace's eval answers" on public.search_eval_answers
  for select to authenticated
  using (workspace_id in (select public.my_workspaces()));

-- ── The runs ─────────────────────────────────────────────────────────────────────

create table public.search_eval_runs (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  trigger      text not null constraint search_eval_runs_trigger_check check (trigger in ('daily', 'embed')),
  slot         text not null constraint search_eval_runs_slot_check check (char_length(slot) between 1 and 80),
  ran_at       timestamptz not null default now(),
  measures     jsonb not null constraint search_eval_runs_measures_check check (jsonb_typeof(measures) = 'object'),
  questions    jsonb not null constraint search_eval_runs_questions_check check (jsonb_typeof(questions) = 'array'),
  constraint search_eval_runs_product_fkey foreign key (product_id, workspace_id)
    references public.products (id, workspace_id) on delete cascade,
  -- A second run of the same slot keeps nothing.
  constraint search_eval_runs_slot_key unique (product_id, trigger, slot)
);

comment on table public.search_eval_runs is
  'PRD omni-loop-8: one run of a product''s eval set: its trigger (daily, or embed after a knowledge-embed job that stored new vectors) and slot, its measures (top@1, top@5, recall@5, recall@10 and the mean reciprocal rank, overall and per category) and per question the ranks of its right answers and the ids that came first. Kept once per product, trigger and slot. Written only through search_eval_run_record(); a member of the workspace reads it.';

create index search_eval_runs_product_idx on public.search_eval_runs (product_id, ran_at desc);

alter table public.search_eval_runs enable row level security;

create policy "a member reads their workspace's eval runs" on public.search_eval_runs
  for select to authenticated
  using (workspace_id in (select public.my_workspaces()));

-- ── Shared checks ────────────────────────────────────────────────────────────────

-- The question `p_question`, locked, when the signed-in caller is a member of its workspace. 42501 signed out
-- or not a member, P0002 no such question.
create function public.search_eval_question_of_member(p_question uuid) returns public.search_eval_questions
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.search_eval_questions;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select * into q from public.search_eval_questions x where x.id = p_question for update;
  if not found then
    raise exception 'Question: no such question in the eval set.' using errcode = 'P0002', hint = 'question';
  end if;
  if not public.is_member(q.workspace_id) then
    raise exception 'Only a member of the workspace corrects its eval set.' using errcode = '42501';
  end if;
  return q;
end;
$$;

-- 22023 naming the field when `p_category` is not null and not 1 to 80 characters.
create function public.search_eval_category_ok(p_category text) returns text
language plpgsql immutable
set search_path = ''
as $$
begin
  if p_category is not null and char_length(p_category) not between 1 and 80 then
    raise exception 'Category: 1 to 80 characters.' using errcode = '22023', hint = 'category';
  end if;
  return p_category;
end;
$$;

-- 22023 naming the field when `p_entry` is not 1 to 200 characters.
create function public.search_eval_entry_ok(p_entry text) returns text
language plpgsql immutable
set search_path = ''
as $$
begin
  if p_entry is null or char_length(p_entry) not between 1 and 200 then
    raise exception 'Entry: an entry id of 1 to 200 characters.' using errcode = '22023', hint = 'entry';
  end if;
  return p_entry;
end;
$$;

-- ── A member's corrections ───────────────────────────────────────────────────────

-- Adds `p_question` (trimmed) to the product's set, for a member of its workspace, recording their login.
-- Answers its id. 42501 signed out or not a member, P0002 no such product or an archived one, 22023 a question
-- not 1 to 300 characters or a category not 1 to 80.
create function public.search_eval_question_add(p_product uuid, p_question text, p_category text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  v_question text := btrim(coalesce(p_question, ''));
  p public.products;
  added uuid;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select * into p from public.products x where x.id = p_product;
  if not found then
    raise exception 'Product: no such product.' using errcode = 'P0002', hint = 'product';
  end if;
  if not public.is_member(p.workspace_id) then
    raise exception 'Only a member of the workspace adds a question to %''s eval set.', p.name using errcode = '42501';
  end if;
  perform public.product_live(p);
  if char_length(v_question) not between 1 and 300 then
    raise exception 'Question: 1 to 300 characters.' using errcode = '22023', hint = 'question';
  end if;
  insert into public.search_eval_questions (product_id, workspace_id, question, category, added_by)
  values (p.id, p.workspace_id, v_question, public.search_eval_category_ok(nullif(btrim(p_category), '')),
          public.member_login(p.workspace_id, caller))
  returning id into added;
  return added;
end;
$$;

-- Removes the question from its set, for a member of its workspace, recording their login. Its answers stay.
-- True when it was in the set, false when it was removed already. 42501 signed out or not a member, P0002 no
-- such question.
create function public.search_eval_question_remove(p_question uuid) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.search_eval_questions := public.search_eval_question_of_member(p_question);
begin
  if q.removed_at is not null then
    return false;
  end if;
  update public.search_eval_questions x
     set removed_at = now(), removed_by = public.member_login(q.workspace_id, (select auth.uid()))
   where x.id = q.id;
  return true;
end;
$$;

-- Sets a person's answer: whether `p_entry` answers the question, for a member of its workspace, recording
-- their login. Replaces Jev's answer or an earlier person's. Answers the row. 42501 signed out or not a member,
-- P0002 no such question or a removed one, 22023 an entry id not 1 to 200 characters or no yes or no.
create function public.search_eval_answer_set(p_question uuid, p_entry text, p_relevant boolean)
returns public.search_eval_answers
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.search_eval_questions := public.search_eval_question_of_member(p_question);
  v_entry text := public.search_eval_entry_ok(p_entry);
  a public.search_eval_answers;
begin
  if q.removed_at is not null then
    raise exception 'Question: removed from the eval set.' using errcode = 'P0002', hint = 'question';
  end if;
  if p_relevant is null then
    raise exception 'Relevant: true or false.' using errcode = '22023', hint = 'relevant';
  end if;
  insert into public.search_eval_answers as x (question_id, workspace_id, entry_id, relevant, confidence, source, decided_by)
  values (q.id, q.workspace_id, v_entry, p_relevant, null, 'person', public.member_login(q.workspace_id, (select auth.uid())))
  on conflict (question_id, entry_id) do update
     set relevant = excluded.relevant, confidence = null, source = 'person',
         decided_by = excluded.decided_by, decided_at = now()
  returning x.* into a;
  return a;
end;
$$;

-- ── The service role's writes ────────────────────────────────────────────────────

-- Adds the first question of the product's group `p_group` to the set, added by `promotion`, with
-- `p_category`. Answers its id, or null when the group already joined the set (its question removed or not).
-- P0002 no such group of the product, 22023 a category not 1 to 80 characters.
create function public.search_eval_question_promote(p_product uuid, p_group uuid, p_category text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.mcp_search_groups;
  added uuid;
begin
  select * into g from public.mcp_search_groups x where x.id = p_group and x.product_id = p_product;
  if not found then
    raise exception 'Group: no such search group of the product.' using errcode = 'P0002', hint = 'group';
  end if;
  insert into public.search_eval_questions (product_id, workspace_id, question, category, group_id, added_by)
  values (g.product_id, g.workspace_id, g.question, public.search_eval_category_ok(p_category), g.id, 'promotion')
  on conflict (group_id) where group_id is not null do nothing
  returning id into added;
  return added;
end;
$$;

-- Sets Jev's answer: whether `p_entry` answers the question, with Jev's confidence. Replaces Jev's earlier
-- answer of that entry; leaves a person's as it is (Q4). True when written; false, writing nothing, when a
-- person answered that entry or the question was removed. P0002 no such question, 22023 an entry id not 1 to
-- 200 characters, no yes or no, or a confidence not between 0 and 1.
create function public.search_eval_answer_jev(p_question uuid, p_entry text, p_relevant boolean, p_confidence real)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.search_eval_questions;
  v_entry text := public.search_eval_entry_ok(p_entry);
  written integer;
begin
  if p_relevant is null then
    raise exception 'Relevant: true or false.' using errcode = '22023', hint = 'relevant';
  end if;
  if p_confidence is null or p_confidence not between 0 and 1 then
    raise exception 'Confidence: a number from 0 to 1.' using errcode = '22023', hint = 'confidence';
  end if;
  select * into q from public.search_eval_questions x where x.id = p_question;
  if not found then
    raise exception 'Question: no such question in the eval set.' using errcode = 'P0002', hint = 'question';
  end if;
  if q.removed_at is not null then
    return false;
  end if;
  insert into public.search_eval_answers as x (question_id, workspace_id, entry_id, relevant, confidence, source)
  values (q.id, q.workspace_id, v_entry, p_relevant, p_confidence, 'jev')
  on conflict (question_id, entry_id) do update
     set relevant = excluded.relevant, confidence = excluded.confidence, decided_at = now()
   where x.source = 'jev';
  get diagnostics written = row_count;
  return written = 1;
end;
$$;

-- Keeps one run of the product's set. Answers its id, or null when the product already holds a run of that
-- trigger and slot. P0002 no such product, 22023 a trigger not daily or embed, a slot not 1 to 80 characters,
-- measures not an object or questions not an array.
create function public.search_eval_run_record(p_product uuid, p_trigger text, p_slot text, p_measures jsonb, p_questions jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.products;
  kept uuid;
begin
  if p_trigger is null or p_trigger not in ('daily', 'embed') then
    raise exception 'Trigger: daily or embed.' using errcode = '22023', hint = 'trigger';
  end if;
  if p_slot is null or char_length(p_slot) not between 1 and 80 then
    raise exception 'Slot: 1 to 80 characters.' using errcode = '22023', hint = 'slot';
  end if;
  if p_measures is null or jsonb_typeof(p_measures) <> 'object' then
    raise exception 'Measures: an object.' using errcode = '22023', hint = 'measures';
  end if;
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' then
    raise exception 'Questions: an array.' using errcode = '22023', hint = 'questions';
  end if;
  select * into p from public.products x where x.id = p_product;
  if not found then
    raise exception 'Product: no such product.' using errcode = 'P0002', hint = 'product';
  end if;
  insert into public.search_eval_runs (product_id, workspace_id, trigger, slot, measures, questions)
  values (p.id, p.workspace_id, p_trigger, p_slot, p_measures, p_questions)
  on conflict (product_id, trigger, slot) do nothing
  returning id into kept;
  return kept;
end;
$$;

comment on function public.search_eval_question_add(uuid, text, text) is
  'PRD omni-loop-8: a member adds a question to the product''s eval set, recording their login; answers its id. 42501 signed out or not a member, P0002 no such product or an archived one, 22023 a question not 1 to 300 characters or a category not 1 to 80.';
comment on function public.search_eval_question_remove(uuid) is
  'PRD omni-loop-8: a member removes a question from the set, recording their login; its answers stay. True when it was in the set, false when removed already. 42501 not a member, P0002 no such question.';
comment on function public.search_eval_answer_set(uuid, text, boolean) is
  'PRD omni-loop-8: a member sets a person''s answer (whether the entry answers the question), recording their login; replaces Jev''s or an earlier person''s. Answers the row. 42501 not a member, P0002 no such or a removed question, 22023 a bad entry id or no yes or no.';
comment on function public.search_eval_question_promote(uuid, uuid, text) is
  'PRD omni-loop-8: the service role adds a search group''s first question to the set as `promotion`; null when the group already joined it, its question removed or not. P0002 no such group of the product, 22023 a bad category.';
comment on function public.search_eval_answer_jev(uuid, text, boolean, real) is
  'PRD omni-loop-8: the service role sets Jev''s answer with its confidence; never over a person''s answer (Q4). True when written, false when a person answered the entry or the question was removed. P0002 no such question, 22023 bad input.';
comment on function public.search_eval_run_record(uuid, text, text, jsonb, jsonb) is
  'PRD omni-loop-8: the service role keeps one run of the product''s set (trigger daily or embed, its slot, its measures object and its per-question array); null when the product holds a run of that trigger and slot. P0002 no such product, 22023 bad input.';

-- ── The Jev decision ─────────────────────────────────────────────────────────────

-- As 20270120093000_mcp_search_groups.sql wrote it, with `search-relevant` (s3) added: Off until a workspace's
-- owner switches it on, as every decision.
create or replace function public.jev_decision_names() returns text[]
language sql immutable
set search_path = ''
as $$
  select array['question-category', 'outbox-risk', 'bug-risk', 'unknown-worth-asking', 'constituent-break', 'hitl-category', 'law-worth', 'search-category', 'search-relevant']
$$;

-- ── Who may do what ──────────────────────────────────────────────────────────────

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false): a member and the service
-- role read the three tables (the member through the policies above); every write goes through a function.
revoke all on public.search_eval_questions, public.search_eval_answers, public.search_eval_runs
  from public, anon, authenticated, service_role;
grant select on public.search_eval_questions, public.search_eval_answers, public.search_eval_runs
  to authenticated, service_role;

revoke execute on function public.search_eval_question_of_member(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.search_eval_category_ok(text) from public, anon, authenticated, service_role;
revoke execute on function public.search_eval_entry_ok(text) from public, anon, authenticated, service_role;

revoke execute on function public.search_eval_question_add(uuid, text, text) from public, anon, service_role;
revoke execute on function public.search_eval_question_remove(uuid) from public, anon, service_role;
revoke execute on function public.search_eval_answer_set(uuid, text, boolean) from public, anon, service_role;
grant execute on function public.search_eval_question_add(uuid, text, text) to authenticated;
grant execute on function public.search_eval_question_remove(uuid) to authenticated;
grant execute on function public.search_eval_answer_set(uuid, text, boolean) to authenticated;

revoke execute on function public.search_eval_question_promote(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.search_eval_answer_jev(uuid, text, boolean, real) from public, anon, authenticated;
revoke execute on function public.search_eval_run_record(uuid, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.search_eval_question_promote(uuid, uuid, text) to service_role;
grant execute on function public.search_eval_answer_jev(uuid, text, boolean, real) to service_role;
grant execute on function public.search_eval_run_record(uuid, text, text, jsonb, jsonb) to service_role;
