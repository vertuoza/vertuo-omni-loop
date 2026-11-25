-- The Supervisor's store (PRD omni-loop-34 s1, spec on the PRD's page, Solution "The seat", "The checks", "The error
-- table", "Findings and suggestions", "Memory", "Chat", criteria AC-5 and AC-9). It runs after
-- 20270129150000_runner_skill_tech_review.sql, and builds on 20261207100000_runners.sql (runners),
-- 20261125090000_approval_requests.sql (member_login()), 20261003090000_own_fleets.sql (is_owner()) and
-- 20261207090000_rls_membership_once.sql (my_workspaces()).
--
-- - supervisor_seats: one seat per workspace, on one runner of it. An owner places, moves, pauses it and sets its daily
--   token limit (5,000,000 by default) through supervisor_seat_place() and supervisor_seat_set(); the service role keeps
--   its last look, its missed looks and its tokens of the day.
-- - supervisor_signals: what the plain-code checks of the `supervisor-watch` kind saw, one open signal per fingerprint
--   (`stuck:silent:<job>`), closed when its cause is gone. Written by the service role; kept 30 days once closed.
-- - supervisor_findings: what the owner is brought: its kind (stuck, bug, health), its severity (high, medium), its title,
--   the check that fired with its figures (null: raised by the Supervisor, no check fired), the evidence, the Supervisor's
--   explanation (null with no look yet), its state (open, acted, dismissed, resolved). Written by the service role; an
--   owner dismisses one through supervisor_finding_dismiss(). Kept: they record decisions.
-- - supervisor_proposals: append-only. A suggestion the Supervisor made on a finding (kind `suggestion`, at most two per
--   finding, each one of the actions the App already has), an owner's press of one (kind `press`, through
--   supervisor_proposal_approve(), once per suggestion), the result of a press (kind `result`, the service role, once per
--   press) and an owner's dismissal (kind `dismiss`, through supervisor_finding_dismiss(), once per finding). No row is
--   changed or deleted (BR-PRODUCT-12): a later press is a new row. Kept: they record decisions.
-- - supervisor_messages: the general thread (finding_id null) and a thread per finding. An owner writes through
--   supervisor_say(), signed by their login; the Supervisor's answers and the results of presses are the service role's,
--   signed by no person. A message is never changed. Kept 90 days.
-- - supervisor_memory: two scopes. Short-term notes expire after 24 h, at most 100; long-term notes stay until cleared, at
--   most 200; a note past its scope's cap pushes the oldest out. Each note is one line of at most 300 characters citing 1
--   to 10 findings, messages or decisions. Written by the service role; only an owner deletes one
--   (supervisor_memory_delete()) or clears a scope or all (supervisor_memory_clear()). Clearing memory never touches a
--   finding, a proposal or a message.
-- - app_errors: the App's own 5xx (service `galaxy` or `omni-app`, route, status, a message of at most 500 characters,
--   masked again on the way in). Written by the service role; a member reads their workspace's rows. Kept 14 days and at
--   most 10,000 rows per service, the oldest going first.
-- - supervisor_forget(): the retention, run by pg_cron every hour (L-GDPR-4).
--
-- Who reads: a member of the workspace reads its seat, signals, findings, proposals, messages, memory and errors; anyone
-- else nothing (BR-PRODUCT-29, BR-PRODUCT-63, L-GDPR-1). Only an owner acts (is_owner()). A deleted account's messages
-- go with it; its presses and dismissals keep their login, their id set null (L-GDPR-3). Evidence and errors are masked
-- before the write (L-GDPR-2).
--
-- Laws kept: a press and a dismissal are written once and never rewritten (BR-PRODUCT-12); every read and write stays in
-- one workspace (BR-PRODUCT-29, BR-PRODUCT-63); no AI key is read or written, the seat thinks on the runner's own accounts
-- (BR-PRODUCT-59); no membership, ask session or agent link is read or written (BR-PRODUCT-28, 39, 64); no game ledger
-- row is touched (N-PRODUCT-16).
--
-- Every statement can run twice. Nobody's grants change on an existing table.
-- Proven by supabase/checks/supervisor.sql.
-- Rollback: `select cron.unschedule('supervisor-forget');`, then a follow-up migration drops the functions and the seven
-- tables. Nothing else reads them.

-- ── The seat ────────────────────────────────────────────────────────────────────

create table if not exists public.supervisor_seats (
  workspace_id  uuid primary key references public.workspaces (id) on delete cascade,
  runner_id     uuid not null unique references public.runners (id) on delete cascade,
  placed_by     uuid references auth.users (id) on delete set null,
  placed_login  text not null check (char_length(placed_login) between 1 and 200),
  paused        boolean not null default false,
  daily_tokens  bigint not null default 5000000 check (daily_tokens between 1 and 1000000000),
  tokens_day    date,
  tokens_used   bigint not null default 0 check (tokens_used >= 0),
  last_look_at  timestamptz,
  missed_looks  integer not null default 0 check (missed_looks >= 0),
  placed_at     timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.supervisor_seats is
  'The Supervisor''s seat (PRD omni-loop-34): one per workspace, on one runner of it, which opens one slot fewer for jobs. Placed, moved, paused and limited by an owner (supervisor_seat_place(), supervisor_seat_set()); its looks and tokens kept by the service role.';
comment on column public.supervisor_seats.daily_tokens is 'The seat''s daily token limit; past it the seat checks in without thinking until midnight.';
comment on column public.supervisor_seats.tokens_day is 'The day tokens_used counts, in the workspace''s time zone.';
comment on column public.supervisor_seats.missed_looks is 'Looks missed in a row; at 3 the supervisor-watch kind raises the offline finding.';

-- A seat sits on a runner of its own workspace.
create or replace function public.supervisor_seat_keep() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.runner_id <> old.runner_id or new.workspace_id <> old.workspace_id)
     and not exists (select 1 from public.runners r where r.id = new.runner_id and r.workspace_id = new.workspace_id) then
    raise exception 'Runner: not a runner of this workspace.' using errcode = '22023', hint = 'runner';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists supervisor_seat_keep on public.supervisor_seats;
create trigger supervisor_seat_keep
  before insert or update on public.supervisor_seats
  for each row execute function public.supervisor_seat_keep();

-- ── Signals ─────────────────────────────────────────────────────────────────────

create table if not exists public.supervisor_signals (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  fingerprint   text not null check (char_length(fingerprint) between 3 and 200 and fingerprint ~ '^[a-z]+:[a-z-]+(:[^\s]+)?$'),
  check_name    text not null check (check_name in ('silent-job', 'queue-stuck', 'resume-loop', 'mission-not-moving',
                  'waiting-too-long', 'same-failure', 'route-failing', 'late-schedule', 'runner-health', 'seat-offline')),
  kind          text not null check (kind in ('stuck', 'bug', 'health')),
  check_line    text not null check (char_length(check_line) between 1 and 300 and check_line !~ '[\r\n]'),
  figures       jsonb not null default '{}' check (jsonb_typeof(figures) = 'object'),
  evidence      jsonb not null default '[]' check (jsonb_typeof(evidence) = 'array' and jsonb_array_length(evidence) <= 50),
  evidence_key  text not null check (char_length(evidence_key) between 1 and 128),
  finding_id    uuid,
  opened_at     timestamptz not null default now(),
  seen_at       timestamptz not null default now(),
  closed_at     timestamptz
);

-- One open signal per fingerprint: a check run twice upserts, never doubles.
create unique index if not exists supervisor_signals_open on public.supervisor_signals (workspace_id, fingerprint) where closed_at is null;
create index if not exists supervisor_signals_workspace_idx on public.supervisor_signals (workspace_id, opened_at desc);

comment on table public.supervisor_signals is
  'What a plain-code check of the supervisor-watch kind saw (PRD omni-loop-34): one open signal per fingerprint, closed when its cause is gone. Written by the service role, kept 30 days once closed.';
comment on column public.supervisor_signals.check_line is 'The check with its figures, as a finding shows it first: "Silent job: no line for 52 min, 3× the 2.5 min usual".';
comment on column public.supervisor_signals.evidence_key is 'A digest of the evidence: a dismissed fingerprint is raised again only when it changes.';

-- ── Findings ────────────────────────────────────────────────────────────────────

create table if not exists public.supervisor_findings (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  fingerprint   text check (fingerprint is null or char_length(fingerprint) between 3 and 200),
  kind          text not null check (kind in ('stuck', 'bug', 'health')),
  severity      text not null check (severity in ('high', 'medium')),
  title         text not null check (char_length(btrim(title)) between 1 and 200 and title !~ '[\r\n]'),
  check_line    text check (check_line is null or (char_length(check_line) between 1 and 300 and check_line !~ '[\r\n]')),
  figures       jsonb not null default '{}' check (jsonb_typeof(figures) = 'object'),
  evidence      jsonb not null default '[]' check (jsonb_typeof(evidence) = 'array' and jsonb_array_length(evidence) <= 50),
  evidence_key  text check (evidence_key is null or char_length(evidence_key) between 1 and 128),
  explanation   text check (explanation is null or char_length(explanation) between 1 and 4000),
  raised_by     text not null check (raised_by in ('check', 'supervisor')),
  looked_at     timestamptz,
  state         text not null default 'open' check (state in ('open', 'acted', 'dismissed', 'resolved')),
  notified_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  closed_at     timestamptz,
  -- A finding the check wrote alone carries the check; one the Supervisor raised with no check reads as such.
  constraint supervisor_findings_check check (raised_by = 'supervisor' or check_line is not null),
  constraint supervisor_findings_closed check ((state = 'open') = (closed_at is null))
);

create index if not exists supervisor_findings_list_idx on public.supervisor_findings (workspace_id, state, severity, created_at desc);
create index if not exists supervisor_findings_fingerprint_idx on public.supervisor_findings (workspace_id, fingerprint, created_at desc);

comment on table public.supervisor_findings is
  'What the Supervisor brings a workspace''s owners (PRD omni-loop-34): the check that fired with its figures first, the evidence, then the Supervisor''s explanation. Written by the service role, dismissed by an owner through supervisor_finding_dismiss(), kept as a record of decisions.';
comment on column public.supervisor_findings.check_line is 'The check that fired, with its figures; null when the Supervisor raised it with no check behind it.';
comment on column public.supervisor_findings.looked_at is 'When the seat looked at it; null reads "No Supervisor look yet" (written by the check alone).';
comment on column public.supervisor_findings.notified_at is 'When its one push and email went out, for a high finding: never twice.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'supervisor_signals_finding_fk') then
    alter table public.supervisor_signals
      add constraint supervisor_signals_finding_fk foreign key (finding_id) references public.supervisor_findings (id) on delete set null;
  end if;
end $$;

create or replace function public.supervisor_finding_keep() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.workspace_id <> old.workspace_id or new.created_at <> old.created_at) then
    raise exception 'A finding stays in its workspace.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.state <> 'open' and new.state <> old.state then
    raise exception 'A closed finding stays closed: raise a new one.' using errcode = '22023', hint = 'state';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists supervisor_finding_keep on public.supervisor_findings;
create trigger supervisor_finding_keep
  before insert or update on public.supervisor_findings
  for each row execute function public.supervisor_finding_keep();

-- ── Suggestions, presses, results and dismissals: append-only ───────────────────

create table if not exists public.supervisor_proposals (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  finding_id    uuid not null references public.supervisor_findings (id) on delete cascade,
  kind          text not null check (kind in ('suggestion', 'press', 'result', 'dismiss')),
  -- Only the actions the App already has: never a merge, an approval, a skipped check or a retry until green.
  action        text check (action is null or action in ('stop-resume-job', 'open-terminal', 'open-bug-fix', 'pause-mission',
                  'resume-mission', 'wake-mission', 'open-mission', 'clean-worktrees', 'copy-kit-update')),
  label         text check (label is null or (char_length(btrim(label)) between 1 and 120 and label !~ '[\r\n]')),
  target        jsonb check (target is null or jsonb_typeof(target) = 'object'),
  reply_to      uuid references public.supervisor_proposals (id) on delete cascade,
  author_id     uuid references auth.users (id) on delete set null,
  author_login  text check (author_login is null or char_length(author_login) between 1 and 200),
  outcome       text check (outcome is null or outcome in ('done', 'refused', 'failed')),
  note          text check (note is null or char_length(note) between 1 and 500),
  evidence_key  text check (evidence_key is null or char_length(evidence_key) between 1 and 128),
  created_at    timestamptz not null default now(),
  constraint supervisor_proposals_suggestion check (kind <> 'suggestion'
    or (action is not null and label is not null and target is not null and reply_to is null
        and author_id is null and author_login is null and outcome is null)),
  constraint supervisor_proposals_press check (kind <> 'press'
    or (reply_to is not null and author_login is not null and action is null and outcome is null)),
  constraint supervisor_proposals_result check (kind <> 'result'
    or (reply_to is not null and outcome is not null and author_id is null and author_login is null and action is null)),
  constraint supervisor_proposals_dismiss check (kind <> 'dismiss'
    or (reply_to is null and author_login is not null and action is null and outcome is null))
);

-- A suggestion is pressed once, a press has one result, a finding is dismissed once.
create unique index if not exists supervisor_proposals_one_reply on public.supervisor_proposals (reply_to) where reply_to is not null;
create unique index if not exists supervisor_proposals_one_dismiss on public.supervisor_proposals (finding_id) where kind = 'dismiss';
create index if not exists supervisor_proposals_finding_idx on public.supervisor_proposals (finding_id, created_at);

comment on table public.supervisor_proposals is
  'Append-only (PRD omni-loop-34, BR-PRODUCT-12): the Supervisor''s suggestions on a finding (at most two, each an action the App already has), an owner''s press of one, its result, and an owner''s dismissal. A row is never changed or deleted.';
comment on column public.supervisor_proposals.kind is
  'suggestion (the Supervisor proposed it), press (an owner pressed a suggestion), result (what carrying it out did), dismiss (an owner said Not a problem).';
comment on column public.supervisor_proposals.evidence_key is 'On a dismissal: the evidence it dismissed; the same fingerprint with the same evidence is never raised again.';

-- A row of the proposals is of its finding's workspace, answers a row of its own finding, and at most two suggestions
-- stand on a finding. Nobody changes or deletes one: only a cascade (a workspace, a finding or an account gone) does.
create or replace function public.supervisor_proposals_keep() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  f public.supervisor_findings;
  r public.supervisor_proposals;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if pg_trigger_depth() = 1 then
      raise exception 'A row of supervisor_proposals is never changed or deleted: append a new one instead.' using errcode = '42501';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  select * into f from public.supervisor_findings x where x.id = new.finding_id;
  if f.workspace_id is distinct from new.workspace_id then
    raise exception 'A proposal is of its finding''s workspace.' using errcode = '22023', hint = 'finding';
  end if;
  if new.reply_to is not null then
    select * into r from public.supervisor_proposals p where p.id = new.reply_to;
    if r.finding_id is distinct from new.finding_id
       or (new.kind = 'press' and r.kind <> 'suggestion') or (new.kind = 'result' and r.kind <> 'press') then
      raise exception 'A press answers a suggestion, a result answers a press, of the same finding.' using errcode = '22023', hint = 'reply_to';
    end if;
  end if;
  if new.kind = 'suggestion'
     and (select count(*) from public.supervisor_proposals p where p.finding_id = new.finding_id and p.kind = 'suggestion') >= 2 then
    raise exception 'Suggestions: at most two on a finding.' using errcode = '22023', hint = 'finding';
  end if;
  return new;
end;
$$;

drop trigger if exists supervisor_proposals_keep on public.supervisor_proposals;
create trigger supervisor_proposals_keep
  before insert or update or delete on public.supervisor_proposals
  for each row execute function public.supervisor_proposals_keep();

-- ── The threads ─────────────────────────────────────────────────────────────────

create table if not exists public.supervisor_messages (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  finding_id    uuid references public.supervisor_findings (id) on delete cascade,
  kind          text not null check (kind in ('owner', 'supervisor', 'result')),
  author_id     uuid references auth.users (id) on delete cascade,
  author_login  text check (author_login is null or char_length(author_login) between 1 and 200),
  body          text not null check (char_length(btrim(body)) between 1 and 4000),
  reply_to      uuid references public.supervisor_messages (id) on delete set null,
  remembered    text check (remembered is null or (char_length(remembered) between 1 and 300 and remembered !~ '[\r\n]')),
  tokens        bigint not null default 0 check (tokens >= 0),
  created_at    timestamptz not null default now(),
  constraint supervisor_messages_owner check (kind <> 'owner'
    or (author_id is not null and author_login is not null and remembered is null and tokens = 0)),
  constraint supervisor_messages_agent check (kind = 'owner' or (author_id is null and author_login is null))
);

create index if not exists supervisor_messages_thread_idx on public.supervisor_messages (workspace_id, finding_id, created_at);
create index if not exists supervisor_messages_created_idx on public.supervisor_messages (created_at);

comment on table public.supervisor_messages is
  'The Supervisor''s threads (PRD omni-loop-34): the general one (finding_id null) and one per finding. An owner writes through supervisor_say(), signed by their login; the Supervisor''s answers (signed Supervisor · agent on the page) and the results of presses are the service role''s. Never changed; kept 90 days.';
comment on column public.supervisor_messages.body is 'What was written: an owner''s words are data the Supervisor reads, never an instruction it follows.';
comment on column public.supervisor_messages.remembered is 'The memory note that shaped an answer, quoted under it ("Remembered: …").';

create or replace function public.supervisor_messages_keep() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and pg_trigger_depth() = 1 then
    raise exception 'A Supervisor message is never changed: add a new one.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and new.finding_id is not null
     and not exists (select 1 from public.supervisor_findings f where f.id = new.finding_id and f.workspace_id = new.workspace_id) then
    raise exception 'A thread is of its finding''s workspace.' using errcode = '22023', hint = 'finding';
  end if;
  return new;
end;
$$;

drop trigger if exists supervisor_messages_keep on public.supervisor_messages;
create trigger supervisor_messages_keep
  before insert or update on public.supervisor_messages
  for each row execute function public.supervisor_messages_keep();

-- ── Memory ──────────────────────────────────────────────────────────────────────

create table if not exists public.supervisor_memory (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  scope         text not null check (scope in ('short', 'long')),
  line          text not null check (char_length(btrim(line)) between 1 and 300 and line !~ '[\r\n]'),
  cites         uuid[] not null check (cardinality(cites) between 1 and 10),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz,
  constraint supervisor_memory_expiry check ((scope = 'short') = (expires_at is not null))
);

create index if not exists supervisor_memory_scope_idx on public.supervisor_memory (workspace_id, scope, created_at desc);
create index if not exists supervisor_memory_expiry_idx on public.supervisor_memory (expires_at) where expires_at is not null;

comment on table public.supervisor_memory is
  'What the Supervisor remembers (PRD omni-loop-34), in the shape of commander_notes: short-term notes (24 h, at most 100) and long-term ones (until cleared, at most 200), each one line citing 1 to 10 findings, messages or decisions. Written by the service role; deleted and cleared by an owner only.';

-- A short-term note expires 24 h after it is written; a note past its scope's cap pushes the oldest out.
create or replace function public.supervisor_memory_keep() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.expires_at := case when new.scope = 'short' then new.created_at + interval '24 hours' end;
  delete from public.supervisor_memory m
   where m.id in (
     select x.id from public.supervisor_memory x
      where x.workspace_id = new.workspace_id and x.scope = new.scope
      order by x.created_at desc, x.id desc
     offset (case when new.scope = 'short' then 99 else 199 end)
   );
  return new;
end;
$$;

drop trigger if exists supervisor_memory_keep on public.supervisor_memory;
create trigger supervisor_memory_keep
  before insert on public.supervisor_memory
  for each row execute function public.supervisor_memory_keep();

-- ── The App's errors ────────────────────────────────────────────────────────────

-- Masks what reads as a credential: GitHub, Anthropic, OpenAI and Supabase keys, JWTs, bearer tokens and `key=value`
-- secrets. The App masks before the write; this is the second pass (L-GDPR-2).
create or replace function public.app_error_mask(p_text text) returns text
language sql immutable
set search_path = ''
as $$
  select regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(p_text,
    '(gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{16,})', '[masked]', 'g'),
    '(sk-[A-Za-z0-9_-]{16,}|sb_(secret|publishable)_[A-Za-z0-9_-]{8,})', '[masked]', 'g'),
    'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', '[masked]', 'g'),
    '([Bb]earer|[Tt]oken)\s+[A-Za-z0-9._~+/=-]{8,}', '\1 [masked]', 'g'),
    '((password|passwd|secret|token|api[_-]?key|apikey|authorization)["'']?\s*[:=]\s*["'']?)[^\s"''&,;]+', '\1[masked]', 'gi')
$$;

create table if not exists public.app_errors (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references public.workspaces (id) on delete cascade,
  service       text not null check (service in ('galaxy', 'omni-app')),
  route         text not null check (char_length(route) between 1 and 200 and route !~ '[\r\n]'),
  status        smallint not null check (status between 500 and 599),
  message       text not null default '' check (char_length(message) <= 500),
  created_at    timestamptz not null default now()
);

create index if not exists app_errors_service_idx on public.app_errors (service, created_at desc);
create index if not exists app_errors_route_idx on public.app_errors (route, created_at desc);
create index if not exists app_errors_workspace_idx on public.app_errors (workspace_id, created_at desc) where workspace_id is not null;

comment on table public.app_errors is
  'The App''s own 5xx (PRD omni-loop-34): one row per error answered by the galaxy''s routes or the omni-app''s run log, its message masked and cut to 500 characters. Written by the service role, read by the workspace''s members when it names one, kept 14 days and at most 10,000 rows per service.';

create or replace function public.app_errors_keep() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.message := left(public.app_error_mask(coalesce(new.message, '')), 500);
  return new;
end;
$$;

drop trigger if exists app_errors_keep on public.app_errors;
create trigger app_errors_keep
  before insert or update on public.app_errors
  for each row execute function public.app_errors_keep();

-- ── Who reads and writes them ───────────────────────────────────────────────────

alter table public.supervisor_seats enable row level security;
alter table public.supervisor_signals enable row level security;
alter table public.supervisor_findings enable row level security;
alter table public.supervisor_proposals enable row level security;
alter table public.supervisor_messages enable row level security;
alter table public.supervisor_memory enable row level security;
alter table public.app_errors enable row level security;

drop policy if exists "a member reads their workspace's Supervisor seat" on public.supervisor_seats;
create policy "a member reads their workspace's Supervisor seat" on public.supervisor_seats
  for select to authenticated using (workspace_id in (select public.my_workspaces()));
drop policy if exists "a member reads their workspace's Supervisor signals" on public.supervisor_signals;
create policy "a member reads their workspace's Supervisor signals" on public.supervisor_signals
  for select to authenticated using (workspace_id in (select public.my_workspaces()));
drop policy if exists "a member reads their workspace's Supervisor findings" on public.supervisor_findings;
create policy "a member reads their workspace's Supervisor findings" on public.supervisor_findings
  for select to authenticated using (workspace_id in (select public.my_workspaces()));
drop policy if exists "a member reads their workspace's Supervisor proposals" on public.supervisor_proposals;
create policy "a member reads their workspace's Supervisor proposals" on public.supervisor_proposals
  for select to authenticated using (workspace_id in (select public.my_workspaces()));
drop policy if exists "a member reads their workspace's Supervisor threads" on public.supervisor_messages;
create policy "a member reads their workspace's Supervisor threads" on public.supervisor_messages
  for select to authenticated using (workspace_id in (select public.my_workspaces()));
drop policy if exists "a member reads their workspace's Supervisor memory" on public.supervisor_memory;
create policy "a member reads their workspace's Supervisor memory" on public.supervisor_memory
  for select to authenticated using (workspace_id in (select public.my_workspaces()));
drop policy if exists "a member reads their workspace's App errors" on public.app_errors;
create policy "a member reads their workspace's App errors" on public.app_errors
  for select to authenticated using (workspace_id in (select public.my_workspaces()));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false). Nobody signed in writes a table: the
-- owner-checked functions below do, as their owner, and the service role writes the rest.
revoke all on public.supervisor_seats, public.supervisor_signals, public.supervisor_findings, public.supervisor_proposals,
  public.supervisor_messages, public.supervisor_memory, public.app_errors from public, anon, authenticated, service_role;
grant select on public.supervisor_seats, public.supervisor_signals, public.supervisor_findings, public.supervisor_proposals,
  public.supervisor_messages, public.supervisor_memory, public.app_errors to authenticated;
grant select, insert, update, delete on public.supervisor_seats, public.supervisor_signals to service_role;
grant select, insert, update on public.supervisor_findings to service_role;
grant select, insert on public.supervisor_proposals, public.supervisor_messages to service_role;
grant select, insert, delete on public.supervisor_memory, public.app_errors to service_role;

-- ── What an owner does ──────────────────────────────────────────────────────────

-- Refuses anyone but an owner of the workspace.
create or replace function public.supervisor_owner_only(p_workspace uuid) returns uuid
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null or p_workspace is null or not public.is_owner(p_workspace) then
    raise exception 'Only an owner of the workspace acts on its Supervisor.' using errcode = '42501';
  end if;
  return caller;
end;
$$;

-- Places the seat on a runner of the workspace, or moves it there. Memory lives here, so nothing is lost.
create or replace function public.supervisor_seat_place(p_workspace uuid, p_runner uuid) returns public.supervisor_seats
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := public.supervisor_owner_only(p_workspace);
  made   public.supervisor_seats;
begin
  if p_runner is null or not exists (select 1 from public.runners r where r.id = p_runner and r.workspace_id = p_workspace) then
    raise exception 'Runner: not a runner of this workspace.' using errcode = '22023', hint = 'runner';
  end if;
  insert into public.supervisor_seats as s (workspace_id, runner_id, placed_by, placed_login)
  values (p_workspace, p_runner, caller, public.member_login(p_workspace, caller))
  on conflict (workspace_id) do update
    set runner_id = excluded.runner_id, placed_by = excluded.placed_by, placed_login = excluded.placed_login,
        placed_at = case when s.runner_id = excluded.runner_id then s.placed_at else now() end,
        missed_looks = case when s.runner_id = excluded.runner_id then s.missed_looks else 0 end
  returning * into made;
  return made;
end;
$$;

-- Pauses or resumes the seat, and sets its daily token limit; a null leaves that setting as it is.
create or replace function public.supervisor_seat_set(p_workspace uuid, p_paused boolean, p_daily_tokens bigint)
returns public.supervisor_seats
language plpgsql
security definer
set search_path = ''
as $$
declare
  made public.supervisor_seats;
begin
  perform public.supervisor_owner_only(p_workspace);
  if p_daily_tokens is not null and p_daily_tokens not between 1 and 1000000000 then
    raise exception 'Daily tokens: 1 to 1,000,000,000.' using errcode = '22023', hint = 'daily_tokens';
  end if;
  update public.supervisor_seats s
     set paused = coalesce(p_paused, s.paused), daily_tokens = coalesce(p_daily_tokens, s.daily_tokens)
   where s.workspace_id = p_workspace
  returning * into made;
  if made.workspace_id is null then
    raise exception 'Seat: this workspace has no Supervisor seat.' using errcode = '22023', hint = 'seat';
  end if;
  return made;
end;
$$;

-- An owner writes in the general thread (p_finding null) or in a finding's, as themselves.
create or replace function public.supervisor_say(p_workspace uuid, p_finding uuid, p_text text) returns public.supervisor_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := public.supervisor_owner_only(p_workspace);
  v_text text := btrim(coalesce(p_text, ''));
  made   public.supervisor_messages;
begin
  if p_finding is not null
     and not exists (select 1 from public.supervisor_findings f where f.id = p_finding and f.workspace_id = p_workspace) then
    raise exception 'Finding: not a finding of this workspace.' using errcode = '22023', hint = 'finding';
  end if;
  if char_length(v_text) not between 1 and 4000 then
    raise exception 'Message: 1 to 4000 characters.' using errcode = '22023', hint = 'text';
  end if;
  insert into public.supervisor_messages (workspace_id, finding_id, kind, author_id, author_login, body)
  values (p_workspace, p_finding, 'owner', caller, public.member_login(p_workspace, caller), v_text)
  returning * into made;
  return made;
end;
$$;

-- An owner presses a suggestion: the press is recorded once, as theirs; the App then carries it out through today's
-- route as that owner and records its result. A suggestion pressed already answers with that first press.
create or replace function public.supervisor_proposal_approve(p_proposal uuid) returns public.supervisor_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  s      public.supervisor_proposals;
  caller uuid;
  made   public.supervisor_proposals;
begin
  select * into s from public.supervisor_proposals p where p.id = p_proposal;
  if s.id is null then
    -- Read as no suggestion of the caller's workspace, whoever asks.
    if (select auth.uid()) is null then
      raise exception 'Only an owner of the workspace acts on its Supervisor.' using errcode = '42501';
    end if;
    raise exception 'Suggestion: not found.' using errcode = '22023', hint = 'proposal';
  end if;
  caller := public.supervisor_owner_only(s.workspace_id);
  if s.kind <> 'suggestion' then
    raise exception 'Suggestion: only a suggestion is pressed.' using errcode = '22023', hint = 'proposal';
  end if;
  select * into made from public.supervisor_proposals p where p.reply_to = s.id;
  if made.id is not null then
    return made;
  end if;
  if (select f.state from public.supervisor_findings f where f.id = s.finding_id) <> 'open' then
    raise exception 'Suggestion: its finding is closed.' using errcode = '22023', hint = 'proposal';
  end if;
  insert into public.supervisor_proposals (workspace_id, finding_id, kind, reply_to, author_id, author_login)
  values (s.workspace_id, s.finding_id, 'press', s.id, caller, public.member_login(s.workspace_id, caller))
  returning * into made;
  return made;
end;
$$;

-- An owner says Not a problem: the dismissal is recorded once, with the evidence it dismissed, and the finding closes as
-- dismissed. A finding dismissed already answers with that first dismissal.
create or replace function public.supervisor_finding_dismiss(p_finding uuid, p_reason text) returns public.supervisor_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  f      public.supervisor_findings;
  caller uuid;
  v_why  text := nullif(btrim(coalesce(p_reason, '')), '');
  made   public.supervisor_proposals;
begin
  select * into f from public.supervisor_findings x where x.id = p_finding;
  if f.id is null then
    if (select auth.uid()) is null then
      raise exception 'Only an owner of the workspace acts on its Supervisor.' using errcode = '42501';
    end if;
    raise exception 'Finding: not found.' using errcode = '22023', hint = 'finding';
  end if;
  caller := public.supervisor_owner_only(f.workspace_id);
  select * into made from public.supervisor_proposals p where p.finding_id = f.id and p.kind = 'dismiss';
  if made.id is not null then
    return made;
  end if;
  if f.state <> 'open' then
    raise exception 'Finding: already closed.' using errcode = '22023', hint = 'finding';
  end if;
  if v_why is not null and char_length(v_why) > 500 then
    raise exception 'Reason: at most 500 characters.' using errcode = '22023', hint = 'reason';
  end if;
  insert into public.supervisor_proposals (workspace_id, finding_id, kind, author_id, author_login, note, evidence_key)
  values (f.workspace_id, f.id, 'dismiss', caller, public.member_login(f.workspace_id, caller), v_why, f.evidence_key)
  returning * into made;
  update public.supervisor_findings x set state = 'dismissed', closed_at = now() where x.id = f.id;
  return made;
end;
$$;

-- An owner deletes one note.
create or replace function public.supervisor_memory_delete(p_note uuid) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace uuid := (select m.workspace_id from public.supervisor_memory m where m.id = p_note);
begin
  if v_workspace is null then
    if (select auth.uid()) is null then
      raise exception 'Only an owner of the workspace acts on its Supervisor.' using errcode = '42501';
    end if;
    raise exception 'Note: not found.' using errcode = '22023', hint = 'note';
  end if;
  perform public.supervisor_owner_only(v_workspace);
  delete from public.supervisor_memory m where m.id = p_note;
  return true;
end;
$$;

-- An owner clears a scope (`short`, `long`) or all memory (`all`), and is answered how many notes went. Findings,
-- proposals and messages stay: they record decisions.
create or replace function public.supervisor_memory_clear(p_workspace uuid, p_scope text) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  gone integer;
begin
  perform public.supervisor_owner_only(p_workspace);
  if p_scope is null or p_scope not in ('short', 'long', 'all') then
    raise exception 'Scope: short, long or all.' using errcode = '22023', hint = 'scope';
  end if;
  delete from public.supervisor_memory m
   where m.workspace_id = p_workspace and (p_scope = 'all' or m.scope = p_scope);
  get diagnostics gone = row_count;
  return gone;
end;
$$;

-- ── Kept as long as the spec says (L-GDPR-4) ────────────────────────────────────

-- Deletes the short-term notes past 24 h, the signals closed more than 30 days ago, the messages older than 90 days and
-- the errors older than 14 days or past the newest 10,000 of their service. Answers how many rows went.
create or replace function public.supervisor_forget() returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n     integer;
  total integer := 0;
begin
  delete from public.supervisor_memory m where m.expires_at is not null and m.expires_at <= now();
  get diagnostics n = row_count; total := total + n;
  delete from public.supervisor_signals s where s.closed_at is not null and s.closed_at < now() - interval '30 days';
  get diagnostics n = row_count; total := total + n;
  delete from public.supervisor_messages m where m.created_at < now() - interval '90 days';
  get diagnostics n = row_count; total := total + n;
  delete from public.app_errors e where e.created_at < now() - interval '14 days';
  get diagnostics n = row_count; total := total + n;
  delete from public.app_errors e
   where e.id in (
     select x.id from (
       select a.id, row_number() over (partition by a.service order by a.created_at desc, a.id desc) as place
         from public.app_errors a
     ) x where x.place > 10000
   );
  get diagnostics n = row_count; total := total + n;
  return total;
end;
$$;

comment on function public.supervisor_forget() is
  'PRD omni-loop-34 (L-GDPR-4): deletes the expired short-term notes, the signals closed more than 30 days ago, the Supervisor messages older than 90 days and the App errors older than 14 days or past 10,000 per service, and answers how many. pg_cron runs it every hour; the service role''s only otherwise.';

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('supervisor-forget', '23 * * * *', 'select public.supervisor_forget()');

-- ── Who calls what ──────────────────────────────────────────────────────────────

revoke execute on function public.supervisor_seat_keep() from public, anon, authenticated;
revoke execute on function public.supervisor_finding_keep() from public, anon, authenticated;
revoke execute on function public.supervisor_proposals_keep() from public, anon, authenticated;
revoke execute on function public.supervisor_messages_keep() from public, anon, authenticated;
revoke execute on function public.supervisor_memory_keep() from public, anon, authenticated;
revoke execute on function public.app_errors_keep() from public, anon, authenticated;
revoke execute on function public.app_error_mask(text) from public, anon;
grant execute on function public.app_error_mask(text) to authenticated, service_role;
revoke execute on function public.supervisor_owner_only(uuid) from public, anon, authenticated;
revoke execute on function public.supervisor_seat_place(uuid, uuid) from public, anon;
grant execute on function public.supervisor_seat_place(uuid, uuid) to authenticated;
revoke execute on function public.supervisor_seat_set(uuid, boolean, bigint) from public, anon;
grant execute on function public.supervisor_seat_set(uuid, boolean, bigint) to authenticated;
revoke execute on function public.supervisor_say(uuid, uuid, text) from public, anon;
grant execute on function public.supervisor_say(uuid, uuid, text) to authenticated;
revoke execute on function public.supervisor_proposal_approve(uuid) from public, anon;
grant execute on function public.supervisor_proposal_approve(uuid) to authenticated;
revoke execute on function public.supervisor_finding_dismiss(uuid, text) from public, anon;
grant execute on function public.supervisor_finding_dismiss(uuid, text) to authenticated;
revoke execute on function public.supervisor_memory_delete(uuid) from public, anon;
grant execute on function public.supervisor_memory_delete(uuid) to authenticated;
revoke execute on function public.supervisor_memory_clear(uuid, text) from public, anon;
grant execute on function public.supervisor_memory_clear(uuid, text) to authenticated;
revoke execute on function public.supervisor_forget() from public, anon, authenticated;
grant execute on function public.supervisor_forget() to service_role;
