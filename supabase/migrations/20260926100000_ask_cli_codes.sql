-- Ask mode's terminal sign-in (PRD 71, docs: .omni-loop/delivery/inbox/0071-ask-mode/spec.md).
-- `omni signin` opens /ask/signin in the browser; once the person has signed in with Google, the
-- auth callback hands the terminal a one-time code through its loopback address, and the terminal
-- trades that code at /api/ask/token for a sign-in of its own. The code is a random value, stored
-- here only as its hash, for 2 minutes, bound to the account that signed in, good for a single use.
-- Nothing here is a ledger event, and nothing here touches the game's tables.

create table public.ask_cli_codes (
  code_hash     text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  owner         uuid not null references auth.users (id) on delete cascade,
  refresh_token text not null check (refresh_token <> ''),
  expires_at    timestamptz not null
);

comment on table public.ask_cli_codes is
  'One-time codes of omni signin: the SHA-256 of the code, the account it was issued to, the refresh token of the sign-in it hands over, and when it stops working (2 minutes). Used once, then deleted. No API role reads or writes it: only ask_cli_code_issue() and ask_cli_code_redeem() do.';

create index ask_cli_codes_expires_idx on public.ask_cli_codes (expires_at);

-- Nobody signed in or signed out reaches the table itself: row-level security with no policy, and
-- no grant. The service role keeps it; the two functions below are the only other way in.
alter table public.ask_cli_codes enable row level security;
revoke all on public.ask_cli_codes from anon, authenticated;
grant select, insert, delete on public.ask_cli_codes to service_role;

-- The auth callback, acting as the sign-in it just made for the terminal, issues the code: bound to
-- that account (the crew only), for 2 minutes. Codes already past their time go at the same moment.
create function public.ask_cli_code_issue(p_code_hash text, p_refresh_token text) returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  expires timestamptz := now() + interval '2 minutes';
begin
  if auth.uid() is null or not public.is_crew() then
    raise exception 'Sign in with your vertuoza.com account first.' using errcode = '42501';
  end if;
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' or coalesce(p_refresh_token, '') = '' then
    raise exception 'A sign-in code needs its hash and a refresh token.' using errcode = '22023';
  end if;
  delete from public.ask_cli_codes c where c.expires_at < now();
  insert into public.ask_cli_codes (code_hash, owner, refresh_token, expires_at)
  values (p_code_hash, auth.uid(), p_refresh_token, expires);
  return expires;
end;
$$;

-- /api/ask/token redeems a code: whoever holds it, signed in or not, gets its row once, and the row
-- is gone. The caller decides whether it is still in time (expires_at) and whether the sign-in it
-- hands over is the owner's. A code that is unknown or already used returns no row.
create function public.ask_cli_code_redeem(p_code_hash text)
returns table (owner uuid, refresh_token text, expires_at timestamptz)
language sql
volatile
security definer
set search_path = ''
as $$
  with used as (
    delete from public.ask_cli_codes c
     where c.code_hash = p_code_hash
    returning c.owner, c.refresh_token, c.expires_at
  ), stale as (
    delete from public.ask_cli_codes c
     where c.expires_at < now() and c.code_hash is distinct from p_code_hash
  )
  select used.owner, used.refresh_token, used.expires_at from used
$$;

revoke execute on function public.ask_cli_code_issue(text, text) from public, anon;
grant execute on function public.ask_cli_code_issue(text, text) to authenticated, service_role;
revoke execute on function public.ask_cli_code_redeem(text) from public;
grant execute on function public.ask_cli_code_redeem(text) to anon, authenticated, service_role;
