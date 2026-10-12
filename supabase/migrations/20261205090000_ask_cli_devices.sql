-- The device sign-in (PRD 1660 s1, docs: .omni-loop/delivery/inbox/1660-signin-device/spec.md, "The
-- server"). `omni signin` and `omni setup-token` in a terminal the browser cannot reach (a cloud session,
-- an SSH box) ask galaxy for a request, print its link and its user code, and poll until the person
-- approves it in any browser (RFC 8628's shape). A request lives 10 minutes.
--
--   public.ask_cli_devices       one row per request: the SHA-256 of the terminal's device code, the
--                                user code the person matches by eye, the purpose (`signin`, or `token`
--                                with the kit token's name, days and workspace), the status, the payload
--                                once approved (the one-time code of ask_cli_codes for `signin`; the kit
--                                token sealed with galaxy's key, KIT_TOKEN_KEY, for `token`, and that
--                                token's expiry), the poll interval and the last poll
--   ask_cli_device_issue(…)      a new pending request, clearing those past their time; false when the
--                                user code is taken (galaxy draws another)
--   ask_cli_device_read(hash)    a request by its device code's hash, payload left out
--   ask_cli_device_polled(…)     records a poll of a pending request and its interval from now on
--   ask_cli_device_take(hash)    deletes an approved request and returns its payload: handed over once
--   ask_cli_device_find(code)    a request by its user code, payload left out, for /ask/device
--   ask_cli_device_approve(…)    attaches a payload to a pending request in time, of that purpose
--   ask_cli_device_deny(…)       marks a pending request in time denied
--
-- Every rule over these rows (expiry, slow_down, handed over once) is galaxy's, with galaxy's clock
-- given to each call (src/ask/device.service.ts); the functions keep the guards that must hold whatever
-- calls them: a payload only on a pending request still in time, and only once. No API role reaches the
-- table, and only the service role calls the functions: a terminal or a browser goes through galaxy's
-- routes, never to the database. Nothing here is a ledger event.
-- Rollback: a later migration drops the table and its seven functions; nothing else reads them.

create table public.ask_cli_devices (
  device_hash        text primary key check (device_hash ~ '^[0-9a-f]{64}$'),
  user_code          text not null unique check (user_code ~ '^[BCDFGHJKLMNPQRSTVWXZ2-9]{8}$'),
  purpose            text not null check (purpose in ('signin', 'token')),
  name               text check (name is null or char_length(name) between 1 and 40),
  days               integer check (days is null or days in (30, 90, 365)),
  workspace          text check (workspace is null or workspace ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  status             text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  payload            text check (payload is null or payload <> ''),
  payload_expires_at timestamptz,
  poll_interval      integer not null default 3 check (poll_interval between 1 and 600),
  last_polled_at     timestamptz,
  expires_at         timestamptz not null,
  check ((purpose = 'token') = (name is not null and days is not null)),
  check (purpose = 'token' or workspace is null),
  check ((status = 'approved') = (payload is not null)),
  check (payload_expires_at is null or status = 'approved')
);

comment on table public.ask_cli_devices is
  'Device sign-in requests of omni signin and omni setup-token (PRD 1660): the SHA-256 of the terminal''s device code, the user code shown on both sides, the purpose, and once approved the payload handed over once (a one-time code, or a kit token sealed by galaxy). 10 minutes each. No API role reads or writes it: only the ask_cli_device_* functions do, for the service role.';
comment on column public.ask_cli_devices.payload is
  'The one-time code (signin) or the kit token sealed with galaxy''s KIT_TOKEN_KEY (token), set on approval and deleted with the row when the terminal takes it.';

create index ask_cli_devices_expires_idx on public.ask_cli_devices (expires_at);

-- Nobody reaches the table itself, the service role included: row-level security with no policy, and no
-- grant. The functions below, which run as their owner, are the only way in.
alter table public.ask_cli_devices enable row level security;
revoke all on public.ask_cli_devices from anon, authenticated, service_role;

-- POST /api/ask/device: a new pending request. Requests past their time go at the same moment.
create function public.ask_cli_device_issue(
  p_device_hash text, p_user_code text, p_purpose text, p_name text, p_days integer, p_workspace text,
  p_now timestamptz, p_expires_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored integer;
begin
  delete from public.ask_cli_devices d where d.expires_at < p_now;
  insert into public.ask_cli_devices (device_hash, user_code, purpose, name, days, workspace, expires_at)
  values (p_device_hash, p_user_code, p_purpose, p_name, p_days, p_workspace, p_expires_at)
  on conflict (user_code) do nothing;
  get diagnostics stored = row_count;
  return stored = 1;
end;
$$;

-- POST /api/ask/device/poll, first: the request as it stands, its payload left out.
create function public.ask_cli_device_read(p_device_hash text)
returns table (status text, purpose text, name text, days integer, workspace text, poll_interval integer, last_polled_at timestamptz, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select d.status, d.purpose, d.name, d.days, d.workspace, d.poll_interval, d.last_polled_at, d.expires_at
    from public.ask_cli_devices d
   where d.device_hash = p_device_hash
$$;

-- A poll of a pending request: when it came, and the interval from now on (longer after a slow_down).
create function public.ask_cli_device_polled(p_device_hash text, p_polled_at timestamptz, p_interval integer) returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.ask_cli_devices d
     set last_polled_at = p_polled_at, poll_interval = p_interval
   where d.device_hash = p_device_hash and d.status = 'pending'
$$;

-- An approved request, handed over: whoever polls first gets its payload, and the row is gone. Any later
-- poll finds nothing, which galaxy answers as expired.
create function public.ask_cli_device_take(p_device_hash text)
returns table (purpose text, payload text, payload_expires_at timestamptz)
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.ask_cli_devices d
   where d.device_hash = p_device_hash and d.status = 'approved'
  returning d.purpose, d.payload, d.payload_expires_at
$$;

-- /ask/device: the request the person's link names, by its user code, payload left out.
create function public.ask_cli_device_find(p_user_code text)
returns table (status text, purpose text, name text, days integer, workspace text, poll_interval integer, last_polled_at timestamptz, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select d.status, d.purpose, d.name, d.days, d.workspace, d.poll_interval, d.last_polled_at, d.expires_at
    from public.ask_cli_devices d
   where d.user_code = p_user_code
$$;

-- The auth callback, once the person signed in: the payload goes on the request, only while it is
-- pending, in time and of the purpose the payload is for. Whether it did.
create function public.ask_cli_device_approve(
  p_user_code text, p_purpose text, p_payload text, p_payload_expires_at timestamptz, p_now timestamptz
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  approved integer;
begin
  update public.ask_cli_devices d
     set status = 'approved', payload = p_payload, payload_expires_at = p_payload_expires_at
   where d.user_code = p_user_code and d.status = 'pending' and d.purpose = p_purpose and d.expires_at > p_now;
  get diagnostics approved = row_count;
  return approved = 1;
end;
$$;

-- No, it's not mine: the request is refused, only while it is pending and in time. Whether it was.
create function public.ask_cli_device_deny(p_user_code text, p_now timestamptz) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  denied integer;
begin
  update public.ask_cli_devices d
     set status = 'denied'
   where d.user_code = p_user_code and d.status = 'pending' and d.expires_at > p_now;
  get diagnostics denied = row_count;
  return denied = 1;
end;
$$;

revoke execute on function public.ask_cli_device_issue(text, text, text, text, integer, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.ask_cli_device_issue(text, text, text, text, integer, text, timestamptz, timestamptz) to service_role;
revoke execute on function public.ask_cli_device_read(text) from public, anon, authenticated;
grant execute on function public.ask_cli_device_read(text) to service_role;
revoke execute on function public.ask_cli_device_polled(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.ask_cli_device_polled(text, timestamptz, integer) to service_role;
revoke execute on function public.ask_cli_device_take(text) from public, anon, authenticated;
grant execute on function public.ask_cli_device_take(text) to service_role;
revoke execute on function public.ask_cli_device_find(text) from public, anon, authenticated;
grant execute on function public.ask_cli_device_find(text) to service_role;
revoke execute on function public.ask_cli_device_approve(text, text, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.ask_cli_device_approve(text, text, text, timestamptz, timestamptz) to service_role;
revoke execute on function public.ask_cli_device_deny(text, timestamptz) from public, anon, authenticated;
grant execute on function public.ask_cli_device_deny(text, timestamptz) to service_role;
