-- Questions agents couldn't answer (PRD 855 s3, docs: .omni-loop/delivery/inbox/0855-agent-connect/spec.md).
-- An editor's agent holding a link (20261028090000_agent_tokens.sql) reports a question no claim answers
-- through the MCP link's report_unknown; it waits on Settings › Business, where any member answers it
-- once as a confirmed claim (source `answer`) or dismisses it. Open questions count in the bell.
--
--   public.agent_questions                  one row per question: open, answered or dismissed (and
--                                           `set-aside`, which PRD 855 s4's Jev writes). The same open
--                                           question (case and spaces aside) is one row, asked N times
--                                           (decision 12): the latest asker, repository and file win
--   public.agent_question_reports           one row per report, for the limit: 30 a link in 24 hours
--   agent_question_report(hash, question, repo, file)   what report_unknown calls, for anyone holding a
--                                           working link (anon included): 1 to 300 characters on one line
--   agent_questions_list(workspace)         any member: the open questions, the latest asked first
--   agent_questions_open(workspace)         any member: how many are open, for the bell's Business count
--   agent_question_answer(workspace, question, kind, value, product)   any member: saves the answer as a
--                                           confirmed claim of the picked kind (decision 14: the question's
--                                           repository's product for every kind but region, else the only
--                                           product, else the product given) and closes the question on it
--   agent_question_dismiss(workspace, question)   any member: closes it with no claim
--
-- Refusals: 28000 (a link that does not work), 42501 (not a member, another workspace's repository),
-- 22023 (a bad value, its field in the hint), 54000 (the 31st report of a link in 24 hours), P0002 (a
-- question the workspace does not hold open).
-- Proven by supabase/checks/agent_questions.sql.
-- Rollback: a follow-up migration drops the two tables and the six functions; the claims answered stay.

-- ── The tables ───────────────────────────────────────────────────────────────────

create table public.agent_questions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces on delete cascade,
  question      text not null check (char_length(question) between 1 and 300),
  -- The question as it is matched: lower case, spaces squeezed (decision 12).
  match_key     text not null,
  asked         integer not null default 1 check (asked >= 1),
  token_id      uuid not null references public.agent_tokens on delete cascade,
  repo          text,
  file          text check (char_length(file) between 1 and 300),
  first_asked_at timestamptz not null default now(),
  last_asked_at timestamptz not null default now(),
  state         text not null default 'open' check (state in ('open', 'set-aside', 'answered', 'dismissed')),
  claim_id      uuid references public.claims on delete set null,
  closed_by     uuid references auth.users on delete set null,
  closed_at     timestamptz
);

comment on table public.agent_questions is
  'A question an editor''s agent could not answer from the business (PRD 855). One row per open question of a workspace (case and spaces aside), asked N times; the latest asker (token_id), repository and file. Written only by agent_question_report(), agent_question_answer() and agent_question_dismiss().';

create unique index agent_questions_waiting on public.agent_questions (workspace_id, match_key) where state in ('open', 'set-aside');
create index agent_questions_workspace on public.agent_questions (workspace_id, state, last_asked_at desc);

create table public.agent_question_reports (
  id          bigint generated always as identity primary key,
  token_id    uuid not null references public.agent_tokens on delete cascade,
  question_id uuid not null references public.agent_questions on delete cascade,
  reported_at timestamptz not null default now()
);

comment on table public.agent_question_reports is 'One row per report_unknown call that stored or bumped a question, for the limit of 30 a link in 24 hours (PRD 855).';

create index agent_question_reports_token on public.agent_question_reports (token_id, reported_at desc);

-- ── The report ───────────────────────────────────────────────────────────────────

-- What an agent's link reports: a question no claim answered, with the repository and file it worked on.
-- It bumps the workspace's open (or set-aside) question of the same words, or stores a new one. Answers
-- `{id, asked}`. Anyone holding the token may call it, signed in or not.
create function public.agent_question_report(p_hash text, p_question text, p_repo text default null, p_file text default null) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.agent_tokens := public.agent_token_of(p_hash);
  v_question text := btrim(coalesce(p_question, ''));
  v_key text;
  v_repo text := nullif(lower(btrim(coalesce(p_repo, ''))), '');
  v_file text := nullif(btrim(coalesce(p_file, '')), '');
  org text;
  reported integer;
  q public.agent_questions;
begin
  if char_length(v_question) not between 1 and 300 or v_question ~ '[\r\n\t]' then
    raise exception 'Question: 1 to 300 characters, on one line.' using errcode = '22023', hint = 'question';
  end if;
  if v_file is not null and (char_length(v_file) > 300 or v_file ~ '[\r\n\t]') then
    raise exception 'File: at most 300 characters, on one line.' using errcode = '22023', hint = 'file';
  end if;
  if v_repo is not null then
    if v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' then
      raise exception 'Repository: owner/name.' using errcode = '22023', hint = 'repo';
    end if;
    select lower(w.github_org) into org from public.workspaces w where w.id = t.workspace_id;
    if not exists (select 1 from public.repositories r where r.workspace_id = t.workspace_id and r.full_name = v_repo)
       and org is distinct from split_part(v_repo, '/', 1) then
      raise exception 'Repository: % is not one of this workspace''s repositories.', v_repo using errcode = '42501', hint = 'repo';
    end if;
  end if;
  v_key := lower(regexp_replace(v_question, '\s+', ' ', 'g'));

  -- One link's reports are counted one call at a time.
  perform pg_advisory_xact_lock(hashtextextended('agent_questions:' || t.id::text, 0));
  select count(*) into reported from public.agent_question_reports r
   where r.token_id = t.id and r.reported_at > now() - interval '24 hours';
  if reported >= 30 then
    raise exception 'This link has sent 30 questions in 24 hours: tell your person this is not known yet, and do not guess.'
      using errcode = '54000', hint = 'limit';
  end if;

  insert into public.agent_questions (workspace_id, question, match_key, token_id, repo, file)
  values (t.workspace_id, v_question, v_key, t.id, v_repo, v_file)
  on conflict (workspace_id, match_key) where state in ('open', 'set-aside')
  do update set asked = public.agent_questions.asked + 1, token_id = excluded.token_id, repo = excluded.repo,
                file = excluded.file, last_asked_at = now()
  returning * into q;
  insert into public.agent_question_reports (token_id, question_id) values (t.id, q.id);
  if t.last_used_at is null or t.last_used_at < now() - interval '1 minute' then
    update public.agent_tokens x set last_used_at = now() where x.id = t.id;
  end if;
  return jsonb_build_object('id', q.id, 'asked', q.asked);
end;
$$;

-- ── What a member sees and does ──────────────────────────────────────────────────

-- The workspace's open questions, the latest asked first: who asked (the link's name), the repository,
-- the file, how often, when, and the product an answer goes to when the page can tell (the repository's,
-- or the only one), else null.
create function public.agent_questions_list(p_workspace uuid) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  perform public.business_member_only(p_workspace);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', q.id,
             'question', q.question,
             'asked', q.asked,
             'askedBy', t.name,
             'repo', q.repo,
             'file', q.file,
             'firstAskedAt', q.first_asked_at,
             'lastAskedAt', q.last_asked_at,
             'product', public.agent_question_product(q, null)) order by q.last_asked_at desc, q.id)
      from public.agent_questions q join public.agent_tokens t on t.id = q.token_id
     where q.workspace_id = p_workspace and q.state = 'open'), '[]'::jsonb);
end;
$$;

-- The product an answer to `q` goes to (decision 14): the one given, else the repository's, else the only
-- one; null when the workspace has several and neither tells.
create function public.agent_question_product(q public.agent_questions, p_product uuid) returns uuid
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.id from public.products p where p.id = p_product and p.workspace_id = q.workspace_id),
    (select r.product_id from public.repositories r where r.workspace_id = q.workspace_id and r.full_name = q.repo),
    (select min(p.id::text)::uuid from public.products p where p.workspace_id = q.workspace_id
      having count(*) = 1))
$$;

-- How many questions are open, for the bell's "Business · N to check".
create function public.agent_questions_open(p_workspace uuid) returns integer
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  perform public.business_member_only(p_workspace);
  return (select count(*)::integer from public.agent_questions q where q.workspace_id = p_workspace and q.state = 'open');
end;
$$;

-- The open question `p_question` of the workspace, locked, or P0002.
create function public.agent_question_open(p_workspace uuid, p_question uuid) returns public.agent_questions
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.agent_questions;
begin
  perform public.business_member_only(p_workspace);
  select * into q from public.agent_questions x where x.id = p_question and x.workspace_id = p_workspace and x.state = 'open' for update;
  if not found then
    raise exception 'Question: this workspace holds no such open question.' using errcode = 'P0002', hint = 'question';
  end if;
  return q;
end;
$$;

-- Answers an open question once: the value saved as a confirmed claim of `p_kind`, source `answer`, and
-- the question closed on it. A value the business already holds is confirmed and linked, not doubled.
-- Answers `{id, claim}`, the claim's display id `<kind>#<seq>`.
create function public.agent_question_answer(p_workspace uuid, p_question uuid, p_kind text, p_value text, p_product uuid default null) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.agent_questions := public.agent_question_open(p_workspace, p_question);
  biz public.businesses;
  v text;
  product uuid;
  made public.claims;
  seq_next integer;
begin
  if p_kind is null or p_kind not in ('region', 'offering', 'size', 'trade', 'rival', 'never') then
    raise exception 'Kind: region, offering, size, trade, rival or never.' using errcode = '22023', hint = 'kind';
  end if;
  v := public.business_claim_value(p_value, p_kind);
  if p_kind = 'size' then
    perform public.business_size_check(v);
  end if;

  perform public.business_open(p_workspace);
  -- The business's row is locked, so two answers never take one number.
  select * into biz from public.businesses b where b.workspace_id = p_workspace for update;
  if p_kind <> 'region' then
    if p_product is not null then
      perform public.business_product(p_workspace, p_product);
    end if;
    product := public.agent_question_product(q, p_product);
    if product is null then
      raise exception 'Product: name the product this answer is about.' using errcode = '22023', hint = 'product';
    end if;
  end if;

  select * into made from public.claims c
   where c.business_id = biz.id and c.product_id is not distinct from product and c.kind = p_kind and lower(c.value) = lower(v);
  if found then
    if made.state <> 'confirmed' then
      update public.claims c set state = 'confirmed', updated_at = now() where c.id = made.id returning * into made;
    end if;
  else
    select coalesce(max(c.seq), 0) + 1 into seq_next from public.claims c where c.business_id = biz.id;
    insert into public.claims (workspace_id, business_id, product_id, seq, kind, value, source, state, receipt, created_by)
    values (p_workspace, biz.id, product, seq_next, p_kind, v, 'answer', 'confirmed', 'Answered: ' || left(q.question, 180), auth.uid())
    returning * into made;
  end if;

  update public.agent_questions x set state = 'answered', claim_id = made.id, closed_by = auth.uid(), closed_at = now() where x.id = q.id;
  return jsonb_build_object('id', q.id, 'claim', made.kind || '#' || made.seq);
end;
$$;

-- Dismisses an open question: closed, with no claim.
create function public.agent_question_dismiss(p_workspace uuid, p_question uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.agent_questions := public.agent_question_open(p_workspace, p_question);
begin
  update public.agent_questions x set state = 'dismissed', closed_by = auth.uid(), closed_at = now() where x.id = q.id;
  return jsonb_build_object('id', q.id);
end;
$$;

-- ── Who may do what ──────────────────────────────────────────────────────────────

alter table public.agent_questions enable row level security;
alter table public.agent_question_reports enable row level security;

-- No policy: every read and write goes through the functions above.
revoke all on public.agent_questions from public, anon, authenticated, service_role;
revoke all on public.agent_question_reports from public, anon, authenticated, service_role;

revoke execute on function public.agent_question_product(public.agent_questions, uuid) from public, anon, authenticated;
revoke execute on function public.agent_question_open(uuid, uuid) from public, anon, authenticated;

revoke execute on function public.agent_questions_list(uuid) from public, anon;
grant execute on function public.agent_questions_list(uuid) to authenticated;
revoke execute on function public.agent_questions_open(uuid) from public, anon;
grant execute on function public.agent_questions_open(uuid) to authenticated;
revoke execute on function public.agent_question_answer(uuid, uuid, text, text, uuid) from public, anon;
grant execute on function public.agent_question_answer(uuid, uuid, text, text, uuid) to authenticated;
revoke execute on function public.agent_question_dismiss(uuid, uuid) from public, anon;
grant execute on function public.agent_question_dismiss(uuid, uuid) to authenticated;

-- The token is the credential: galaxy's MCP route calls it as nobody.
revoke execute on function public.agent_question_report(text, text, text, text) from public;
grant execute on function public.agent_question_report(text, text, text, text) to anon, authenticated;
