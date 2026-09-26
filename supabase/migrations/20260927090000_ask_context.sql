-- Question history, step 1 (PRD 144, docs: .omni-loop/delivery/inbox/0144-question-history/spec.md):
-- every round records where it came from and what the Claude session had cost when it asked, and who
-- answered it. Every column is optional: an older kit sends no context, and its rows carry nulls.
-- Nothing here changes who may read or write a row; the workspace-wide read comes in a later step.

-- ── Where a session and its rounds came from ─────────────────────────────────

-- The repository comes with the session open; the branch and the Claude session come with each round
-- (they may change while ask mode stays on), and the session keeps the latest.
alter table public.ask_sessions
  add column repo              text check (repo is null or char_length(repo) between 1 and 200),
  add column branch            text check (branch is null or char_length(branch) between 1 and 250),
  add column claude_session_id text check (claude_session_id is null or char_length(claude_session_id) between 1 and 200);

comment on column public.ask_sessions.repo is 'The repository the kit named when the session opened (owner/name), or null.';
comment on column public.ask_sessions.branch is 'The branch of the latest round that named one, or null.';
comment on column public.ask_sessions.claude_session_id is 'The Claude session of the latest round that named one, or null.';

-- The token counts a round carries: {input, output, cacheRead, cacheWrite}, each a whole number >= 0.
create function public.ask_tokens_valid(t jsonb) returns boolean
language sql immutable
set search_path = ''
as $$
  select jsonb_typeof(t) = 'object'
    and (select array_agg(k order by k) from jsonb_object_keys(t) k) = array['cacheRead', 'cacheWrite', 'input', 'output']
    and not exists (
      select 1 from jsonb_each(t) e
       where jsonb_typeof(e.value) <> 'number' or (e.value)::numeric < 0 or (e.value)::numeric <> trunc((e.value)::numeric))
$$;

alter table public.ask_rounds
  add column prd         integer check (prd is null or prd > 0),
  add column skill       text check (skill is null or char_length(skill) between 1 and 200),
  add column model       text check (model is null or char_length(model) between 1 and 200),
  add column tokens      jsonb check (tokens is null or public.ask_tokens_valid(tokens)),
  add column cost_usd    numeric(10, 4) check (cost_usd is null or cost_usd >= 0),
  add column answered_by uuid references auth.users (id) on delete set null;

comment on column public.ask_rounds.tokens is 'The Claude session''s tokens up to the question: {input, output, cacheRead, cacheWrite}.';
comment on column public.ask_rounds.cost_usd is 'Those tokens priced by the app''s one price table, or null for a model it does not know. An estimate.';
comment on column public.ask_rounds.answered_by is 'The account that answered: whoever answered on the page, the session owner for an answer from the terminal. Set by the database, never sent.';

-- ── Who answered ─────────────────────────────────────────────────────────────

-- ask_rounds_guard, as the ask sessions migration wrote it, and one more line: the moment a round is
-- answered, answered_by is the account answering (the session owner, for an answer the terminal
-- recorded); otherwise it never changes.
create or replace function public.ask_rounds_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    if new.answers is distinct from old.answers or new.answered_via is distinct from old.answered_via then
      raise exception 'This round is already %: its answer cannot change.', old.status using errcode = 'check_violation';
    end if;
  elsif not (
    old.status = 'open'
    or (old.status = 'abandoned' and new.status = 'answered' and new.answered_via = 'terminal')
  ) then
    raise exception 'An ask round cannot go from % to %.', old.status, new.status using errcode = 'check_violation';
  end if;
  new.answered_at := case
    when new.status = 'answered' and old.status <> 'answered' then now()
    else old.answered_at
  end;
  new.answered_by := case
    when new.status = 'answered' and old.status <> 'answered' then
      case when new.answered_via = 'terminal'
        then (select s.owner from public.ask_sessions s where s.id = new.session_id)
        else auth.uid()
      end
    else old.answered_by
  end;
  return new;
end;
$$;

-- A round is asked with nobody's answer on it.
create function public.ask_rounds_new_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.answered_by := null;
  return new;
end;
$$;

create trigger ask_rounds_new_guard
  before insert on public.ask_rounds
  for each row execute function public.ask_rounds_new_guard();

revoke execute on function public.ask_rounds_new_guard() from public, anon, authenticated;
grant execute on function public.ask_tokens_valid(jsonb) to anon, authenticated, service_role;

-- ── Grants ───────────────────────────────────────────────────────────────────

-- The new columns are written with the row they belong to, as the caller: the context with the
-- session open and the round, the latest branch and Claude session on the session. answered_by is
-- nobody's to write.
grant insert (repo) on public.ask_sessions to authenticated;
grant update (branch, claude_session_id) on public.ask_sessions to authenticated;
grant insert (prd, skill, model, tokens, cost_usd) on public.ask_rounds to authenticated;
