-- A Commander per Virtual Fleet (PRD 3107 s1, docs: .omni-loop/delivery/inbox/3107-fleet-commander/spec.md, Solution
-- "Ask", "Claims, never free links", "Costs and refusals", criteria AC-1, AC-2, AC-9, AC-10). It runs after
-- 20270127100000_omni_bug_team.sql, and builds on 20270122090000_virtual_fleets.sql (teams.kind), 20270126100000_token_budget.sql
-- (teams.daily_tokens, fleet_tokens_24h()), 20261125090000_approval_requests.sql (member_login()) and
-- 20261207090000_rls_membership_once.sql (my_workspaces()).
--
-- - commander_messages: one shared thread per Virtual Fleet. A member's question (kind `question`), signed by its author
--   (their id and their login, as member_login() reads it), and the Commander's reply to it (kind `reply`), signed by no
--   person: the reply holds a verdict and the claims the app kept, each with the sources the app built (a label, a link
--   inside the app or on GitHub, and that record's own line), how many events it read, how many sentences it removed
--   and the tokens its model calls counted. At most one reply per question, of the question's own fleet. A row is never
--   changed: a new one is added.
-- - commander_ask(): the only way a member asks, as themselves: a member of the workspace, on one of its Virtual Fleets,
--   1 to 2000 characters. Anyone else 42501; a fleet that is no Virtual Fleet of the workspace, or an empty or long
--   question, 22023 with the field as the hint. The reply is written by the service role alone (the app, after its model
--   call and its link filter): nobody signed in writes a Commander's reply.
-- - commander_messages_forget(): deletes the messages older than 90 days, a reply with its question; pg_cron runs it
--   every hour (L-GDPR-4). The decisions a thread carried stay where they are recorded.
-- - fleet_tokens_24h(): as 20270126100000_token_budget.sql, with the Commander's replies added: what its model calls
--   counted spends the fleet's daily cap (teams.daily_tokens), as a job's tokens do.
--
-- Who reads: a member of the fleet's workspace reads its thread; anyone else nothing (BR-PRODUCT-29, L-GDPR-1). A deleted
-- account's questions go with it, and their replies with them (L-GDPR-3). A message holds a person's question or the
-- Commander's claims: no credential, no log excerpt (L-GDPR-2).
--
-- Laws kept: no answer is read or written (BR-PRODUCT-12); a member reads and asks only their own workspace's fleets
-- (BR-PRODUCT-29, BR-PRODUCT-63); no AI key is read or written, the key stays on the server (BR-PRODUCT-59); no
-- membership, ask session or agent link is read or written (BR-PRODUCT-28, 39, 64); no game ledger row is touched
-- (N-PRODUCT-16).
--
-- Every statement can run twice. Nobody's grants change on an existing table.
-- Proven by supabase/checks/commander_messages.sql.
-- Rollback: `select cron.unschedule('commander-messages-forget');`, then a follow-up migration drops commander_ask(),
-- commander_messages_forget(), commander_reply_ok(), the trigger function and commander_messages, and restores
-- fleet_tokens_24h() of 20270126100000_token_budget.sql. Nothing else reads them.

-- ── The thread ──────────────────────────────────────────────────────────────────

-- A reply as the app keeps it: {verdict, claims: [{text, sources: [{label, href, line}]}], read, removed}. The verdict is
-- null when nothing was kept; each claim has one to five sources, each a link the app built: inside the app (`/…`) or on
-- GitHub, never one the model wrote.
create or replace function public.commander_reply_ok(p_reply jsonb) returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare
  c jsonb;
  s jsonb;
begin
  if p_reply is null or jsonb_typeof(p_reply) <> 'object'
     or (select array_agg(k order by k) from jsonb_object_keys(p_reply) k) is distinct from array['claims', 'read', 'removed', 'verdict'] then
    return false;
  end if;
  if not (jsonb_typeof(p_reply -> 'verdict') = 'null'
          or (jsonb_typeof(p_reply -> 'verdict') = 'string' and char_length(btrim(p_reply ->> 'verdict')) between 1 and 300)) then
    return false;
  end if;
  if not (jsonb_typeof(p_reply -> 'read') = 'number' and (p_reply ->> 'read') ~ '^[0-9]{1,6}$'
          and jsonb_typeof(p_reply -> 'removed') = 'number' and (p_reply ->> 'removed') ~ '^[0-9]{1,3}$') then
    return false;
  end if;
  if jsonb_typeof(p_reply -> 'claims') <> 'array' or jsonb_array_length(p_reply -> 'claims') > 12 then
    return false;
  end if;
  -- Nothing kept, no verdict; a verdict, one claim at least.
  if (jsonb_typeof(p_reply -> 'verdict') = 'null') <> (jsonb_array_length(p_reply -> 'claims') = 0) then
    return false;
  end if;
  for c in select value from jsonb_array_elements(p_reply -> 'claims') loop
    -- One test at a time: the keys of a value that is no object cannot be read.
    if jsonb_typeof(c) <> 'object' then
      return false;
    end if;
    if (select array_agg(k order by k) from jsonb_object_keys(c) k) is distinct from array['sources', 'text']
       or jsonb_typeof(c -> 'text') <> 'string' or char_length(btrim(c ->> 'text')) not between 1 and 300
       or jsonb_typeof(c -> 'sources') <> 'array' or jsonb_array_length(c -> 'sources') not between 1 and 5 then
      return false;
    end if;
    for s in select value from jsonb_array_elements(c -> 'sources') loop
      if jsonb_typeof(s) <> 'object' then
        return false;
      end if;
      if (select array_agg(k order by k) from jsonb_object_keys(s) k) is distinct from array['href', 'label', 'line']
         or jsonb_typeof(s -> 'label') <> 'string' or char_length(s ->> 'label') not between 1 and 60
         or jsonb_typeof(s -> 'line') <> 'string' or char_length(s ->> 'line') not between 1 and 400
         or jsonb_typeof(s -> 'href') <> 'string' or char_length(s ->> 'href') > 500
         or (s ->> 'href') !~ '^(/[^/]|https://github\.com/)' then
        return false;
      end if;
    end loop;
  end loop;
  return true;
end;
$$;

create table if not exists public.commander_messages (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  fleet        text not null,
  kind         text not null check (kind in ('question', 'reply')),
  author_id    uuid references auth.users (id) on delete cascade,
  author_login text check (author_login is null or char_length(author_login) between 1 and 200),
  body         text check (body is null or char_length(body) between 1 and 2000),
  reply_to     uuid references public.commander_messages (id) on delete cascade,
  reply        jsonb constraint commander_messages_reply_shape check (reply is null or public.commander_reply_ok(reply)),
  tokens       bigint not null default 0 check (tokens >= 0),
  created_at   timestamptz not null default now(),
  constraint commander_messages_question check (kind <> 'question'
    or (author_id is not null and author_login is not null and body is not null and reply is null and reply_to is null and tokens = 0)),
  constraint commander_messages_reply check (kind <> 'reply'
    or (author_id is null and author_login is null and body is null and reply is not null and reply_to is not null)),
  foreign key (workspace_id, fleet) references public.teams (workspace_id, name) on update cascade on delete cascade
);

-- One reply per question: a replayed reply records nothing twice.
create unique index if not exists commander_messages_one_reply on public.commander_messages (reply_to) where reply_to is not null;
create index if not exists commander_messages_thread_idx on public.commander_messages (workspace_id, fleet, created_at desc);
create index if not exists commander_messages_created_idx on public.commander_messages (created_at);

comment on table public.commander_messages is
  'A Virtual Fleet''s Commander thread (PRD 3107): a member''s question, signed by them, and the Commander''s reply, signed by no person, holding only the claims the app kept and the links it built. Read by the workspace''s members, asked through commander_ask(), replied by the service role, kept 90 days (commander_messages_forget()).';
comment on column public.commander_messages.kind is 'question (a member asked) or reply (the Commander answered a question).';
comment on column public.commander_messages.author_id is 'The member who asked; null on a reply, which no person signs. A deleted account''s questions go with it.';
comment on column public.commander_messages.author_login is 'The asker''s login as member_login() reads it, set by commander_ask(), never by the caller.';
comment on column public.commander_messages.body is 'The question, as the member wrote it: data the model reads, never an instruction it follows.';
comment on column public.commander_messages.reply_to is 'The question a reply answers: one reply per question.';
comment on column public.commander_messages.reply is
  '{verdict, claims: [{text, sources: [{label, href, line}]}], read, removed}: the claims whose every reference was in the turn''s context, each source''s link built by the app (inside the app or on GitHub), how many events were read and how many sentences removed.';
comment on column public.commander_messages.tokens is 'What the reply''s model calls counted (input + output + cache writes): it spends the fleet''s daily cap.';

-- A reply is of its question's own fleet; nobody changes a message.
create or replace function public.commander_messages_keep() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  q public.commander_messages;
begin
  if tg_op = 'UPDATE' then
    raise exception 'A Commander message is never changed: add a new one.' using errcode = '42501';
  end if;
  if new.kind = 'reply' then
    select * into q from public.commander_messages m where m.id = new.reply_to;
    if q.id is null or q.kind <> 'question' or q.workspace_id <> new.workspace_id or q.fleet <> new.fleet then
      raise exception 'A reply answers a question of its own fleet.' using errcode = '22023', hint = 'reply_to';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists commander_messages_keep on public.commander_messages;
create trigger commander_messages_keep
  before insert or update on public.commander_messages
  for each row execute function public.commander_messages_keep();

-- ── Who reads and writes it ─────────────────────────────────────────────────────

alter table public.commander_messages enable row level security;

drop policy if exists "a member reads their workspace's Commander threads" on public.commander_messages;
create policy "a member reads their workspace's Commander threads" on public.commander_messages
  for select to authenticated
  using (workspace_id in (select public.my_workspaces()));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false). Nobody signed in writes the table:
-- commander_ask() does, as its owner, and the service role adds the replies.
revoke all on public.commander_messages from public, anon, authenticated, service_role;
grant select on public.commander_messages to authenticated;
grant select, insert on public.commander_messages to service_role;

-- A member asks their fleet's Commander, as themselves.
create or replace function public.commander_ask(p_workspace uuid, p_fleet text, p_text text) returns public.commander_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  v_text text := btrim(coalesce(p_text, ''));
  made   public.commander_messages;
begin
  if caller is null or p_workspace is null or p_workspace not in (select public.my_workspaces()) then
    raise exception 'Only a member of the workspace asks its fleet''s Commander.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.teams t where t.workspace_id = p_workspace and t.name = p_fleet and t.kind = 'virtual') then
    raise exception 'Fleet: not a virtual fleet of this workspace.' using errcode = '22023', hint = 'fleet';
  end if;
  if char_length(v_text) not between 1 and 2000 then
    raise exception 'Question: 1 to 2000 characters.' using errcode = '22023', hint = 'text';
  end if;
  insert into public.commander_messages (workspace_id, fleet, kind, author_id, author_login, body)
  values (p_workspace, p_fleet, 'question', caller, public.member_login(p_workspace, caller), v_text)
  returning * into made;
  return made;
end;
$$;

-- ── Kept 90 days (L-GDPR-4) ─────────────────────────────────────────────────────

-- Deletes the messages written more than 90 days ago, a reply with its question. Answers how many.
create or replace function public.commander_messages_forget() returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.commander_messages m where m.created_at < now() - interval '90 days'
    returning 1
  )
  select count(*)::integer from gone
$$;

comment on function public.commander_messages_forget() is
  'PRD 3107 (L-GDPR-4): deletes the Commander messages written more than 90 days ago, and answers how many. pg_cron runs it every hour; the service role''s only otherwise.';

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('commander-messages-forget', '17 * * * *', 'select public.commander_messages_forget()');

-- ── The fleet's tokens: the Commander's count too ───────────────────────────────

-- As 20270126100000_token_budget.sql, with the Commander's replies added by their time: what a fleet's missions and its
-- Commander spent in the 24 hours up to `p_at`, and the time of the oldest spending that counted (null when none did).
create or replace function public.fleet_tokens_24h(p_workspace uuid, p_fleet text, p_at timestamptz default now())
returns table (tokens bigint, oldest_end timestamptz)
language sql stable
set search_path = ''
as $$
  with spent (tokens, at) as (
    select public.job_counted_tokens(j.tokens), j.ended_at
      from public.runner_jobs j
      join public.missions m on m.id = j.mission_id
     where m.workspace_id = p_workspace and m.fleet = p_fleet
       and j.ended_at > p_at - interval '24 hours' and j.ended_at <= p_at
    union all
    select c.tokens, c.created_at
      from public.commander_messages c
     where c.workspace_id = p_workspace and c.fleet = p_fleet and c.kind = 'reply'
       and c.created_at > p_at - interval '24 hours' and c.created_at <= p_at
  )
  select coalesce(sum(s.tokens), 0)::bigint, min(s.at) filter (where s.tokens > 0)
    from spent s
$$;

-- ── Who calls what ──────────────────────────────────────────────────────────────

revoke execute on function public.commander_reply_ok(jsonb) from public, anon;
grant execute on function public.commander_reply_ok(jsonb) to authenticated, service_role;
revoke execute on function public.commander_messages_keep() from public, anon, authenticated;
revoke execute on function public.commander_ask(uuid, text, text) from public, anon;
grant execute on function public.commander_ask(uuid, text, text) to authenticated;
revoke execute on function public.commander_messages_forget() from public, anon, authenticated;
grant execute on function public.commander_messages_forget() to service_role;
revoke execute on function public.fleet_tokens_24h(uuid, text, timestamptz) from public, anon;
grant execute on function public.fleet_tokens_24h(uuid, text, timestamptz) to authenticated, service_role;
