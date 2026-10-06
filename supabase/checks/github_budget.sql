-- Who may read and write the GitHub budget (PRD 902, s1). Run it after `supabase db start` has applied the
-- migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/github_budget.sql
-- The service role keeps ETags and budgets, refreshes them in place, keeps a pause through a refresh and
-- drops old ETags. Nobody signed in, nor signed out, reads or writes either table. One transaction,
-- rolled back at the end. Any `FAIL:` stops the run.

begin;

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
insert into public.workspace_members (workspace_id, user_id, joined_at)
select id, '00000000-0000-4000-8000-0000000000a1', now() - interval '1 day' from public.workspaces where slug = 'vertuoza';

create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- ── The service role keeps and refreshes ──
set local role service_role;
do $$
begin
  insert into public.github_etags (installation_id, url, etag, body, content_type, read_at) values
    (42, 'https://api.github.com/repos/vertuoza/vertuo-omni-loop/issues/902', 'W/"a1"', '{"number":902}', 'application/json', '2026-10-01T09:00:00Z'),
    (42, 'https://api.github.com/repos/vertuoza/vertuo-omni-loop/contents/.omni-loop/config.yml', '"c1"', 'kit: 1', 'application/vnd.github.raw+json', '2026-09-20T09:00:00Z');
  insert into public.github_etags (installation_id, url, etag, body, read_at)
  values (42, 'https://api.github.com/repos/vertuoza/vertuo-omni-loop/issues/902', 'W/"a2"', '{"number":902,"state":"closed"}', '2026-10-01T09:05:00Z')
  on conflict (installation_id, url) do update set etag = excluded.etag, body = excluded.body, read_at = excluded.read_at;
  if (select etag from public.github_etags where url like '%/issues/902') <> 'W/"a2"' or (select count(*) from public.github_etags) <> 2 then
    raise exception 'FAIL: an ETag was not refreshed in place';
  end if;
  begin
    insert into public.github_etags (installation_id, url, etag, body) values (42, 'https://example.com/x', '"e"', '');
    raise exception 'FAIL: an ETag was stored for another host than api.github.com';
  exception when check_violation then null; end;

  insert into public.github_budget (installation_id, resource, "limit", remaining, reset_at, updated_at)
  values (42, 'core', 5000, 900, '2026-10-01T10:00:00Z', '2026-10-01T09:05:00Z'),
         (42, 'graphql', 5000, 4990, '2026-10-01T10:00:00Z', '2026-10-01T09:05:00Z');
  update public.github_budget set paused_until = '2026-10-01T10:00:00Z' where installation_id = 42 and resource = 'core';
  -- An answer's budget, as the client upserts it: the pause is kept.
  insert into public.github_budget (installation_id, resource, "limit", remaining, reset_at, updated_at)
  values (42, 'core', 5000, 0, '2026-10-01T10:00:00Z', '2026-10-01T09:06:00Z')
  on conflict (installation_id, resource) do update
    set "limit" = excluded."limit", remaining = excluded.remaining, reset_at = excluded.reset_at, updated_at = excluded.updated_at;
  if (select paused_until from public.github_budget where resource = 'core') is distinct from '2026-10-01T10:00:00Z'::timestamptz then
    raise exception 'FAIL: a budget refresh lost the pause';
  end if;
  begin
    insert into public.github_budget (installation_id, resource, "limit", remaining, reset_at) values (42, 'core', 5000, -1, now());
    raise exception 'FAIL: a negative remaining was stored';
  exception when check_violation then null; end;

  -- The sync drops ETags unread for 7 days.
  delete from public.github_etags where read_at < '2026-10-01T09:00:00Z'::timestamptz - interval '7 days';
  if (select count(*) from public.github_etags) <> 1 then
    raise exception 'FAIL: the service role could not drop an old ETag';
  end if;
  begin
    delete from public.github_budget;
    raise exception 'FAIL: the service role deleted a budget';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.github_etags limit 1; raise exception 'FAIL: anon read the ETags';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.github_budget limit 1; raise exception 'FAIL: anon read the budget';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Ada, a member of the installation's workspace: nothing either ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
begin
  begin perform 1 from public.github_etags limit 1; raise exception 'FAIL: a member read the ETags';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.github_budget limit 1; raise exception 'FAIL: a member read the budget';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.github_budget (installation_id, resource, "limit", remaining, reset_at) values (42, 'core', 5000, 5000, now());
    raise exception 'FAIL: a member wrote the budget';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Grants ──
do $$
begin
  if has_table_privilege('authenticated', 'public.github_etags', 'select, insert, update, delete')
     or has_table_privilege('authenticated', 'public.github_budget', 'select, insert, update, delete') then
    raise exception 'FAIL: the signed-in may touch the GitHub budget';
  end if;
  if has_table_privilege('anon', 'public.github_etags', 'select, insert, update, delete')
     or has_table_privilege('anon', 'public.github_budget', 'select, insert, update, delete') then
    raise exception 'FAIL: anon may touch the GitHub budget';
  end if;
end $$;

select 'github budget checks passed' as result;
rollback;
