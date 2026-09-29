-- Who may read and write the sends (PRD 251, "Send posts the reply as you"). The supabase workflow runs it
-- on every pull request, after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/outbox_sends.sql
-- Accounts each with its own JWT. A send is inserted by a member of its dossier's workspace, as
-- themselves, read only by its owner, and its outcome recorded once, by its owner, through
-- outbox_send_done(); nobody updates or deletes one directly. One transaction, rolled back at the end.
-- Any `FAIL:` stops the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com'),
  ('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com'),
  ('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
-- A second workspace, Acme. Ada and Bob belong to Vertuoza, Carl to Acme, Eve to none.
insert into public.workspaces (slug, name, github_org) values ('acme', 'Acme', 'acme');
insert into public.workspace_members (workspace_id, user_id, joined_at)
select w.id, m.user_id, now() - interval '1 day'
  from (values
         ('vertuoza', '00000000-0000-4000-8000-0000000000a1'::uuid),
         ('vertuoza', '00000000-0000-4000-8000-0000000000b1'::uuid),
         ('acme',     '00000000-0000-4000-8000-0000000000c1'::uuid)
       ) as m (slug, user_id)
  join public.workspaces w on w.slug = m.slug;

create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

create temporary table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated, service_role;

-- One numbered dossier in each workspace.
with made as (
  insert into public.dossiers (workspace_id, home_repo, prd, title, numbered_at)
  select w.id, d.repo, d.prd, d.title, now()
    from (values ('vertuoza', 'vertuoza/vertuo-omni-loop', 7, 'Team inbox'),
                 ('acme',     'acme/widgets',              3, 'Widgets')) as d (slug, repo, prd, title)
    join public.workspaces w on w.slug = d.slug
  returning id, home_repo
)
insert into ids select case when home_repo like 'acme/%' then 'acme' else 'dossier' end, id from made;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.outbox_sends limit 1; raise exception 'FAIL: anon read the sends';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.outbox_sends (dossier_id, pr_number, reply, nonce_hash)
    values ((select id from ids where name = 'dossier'), 12, '1: A', 'hash-anon');
    raise exception 'FAIL: anon made a send';
  exception when insufficient_privilege then null; end;
  begin perform public.outbox_send_done(gen_random_uuid(), 'https://x', 'ada', true, null); raise exception 'FAIL: anon recorded a send';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Ada, a member: sends, and records her send's outcome once ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
declare
  kept uuid := (select id from ids where name = 'dossier');
  sent uuid;
begin
  insert into public.outbox_sends (dossier_id, pr_number, reply, nonce_hash)
  values (kept, 12, E'1: A\n\n_answered on the Omni page · PRD 7_', 'hash-a')
  returning id into sent;
  if (select owner from public.outbox_sends where id = sent) <> '00000000-0000-4000-8000-0000000000a1' then
    raise exception 'FAIL: a send was not owned by the member who made it';
  end if;
  begin
    insert into public.outbox_sends (dossier_id, owner, pr_number, reply, nonce_hash)
    values (kept, '00000000-0000-4000-8000-0000000000b1', 12, '1: A', 'hash-forged');
    raise exception 'FAIL: a member made a send in another person''s name';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.outbox_sends (dossier_id, pr_number, reply, nonce_hash, posted_at, comment_url)
    values (kept, 12, '1: A', 'hash-early', now(), 'https://x');
    raise exception 'FAIL: a member made a send already posted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.outbox_sends (dossier_id, pr_number, reply, nonce_hash)
    values ((select id from ids where name = 'acme'), 4, '1: A', 'hash-other');
    raise exception 'FAIL: a member sent on another workspace''s dossier';
  exception when insufficient_privilege then null; end;

  begin
    perform public.outbox_send_done(sent, null, null, null, null);
    raise exception 'FAIL: a send was recorded with neither a link nor an error';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.outbox_send_done(sent, 'https://x', 'ada', true, 'both');
    raise exception 'FAIL: a send was recorded with both a link and an error';
  exception when invalid_parameter_value then null; end;
  perform public.outbox_send_done(sent, 'https://github.com/vertuoza/vertuo-omni-loop/pull/12#issuecomment-1', 'ada', true, null);
  if not exists (select 1 from public.outbox_sends where id = sent and posted_at is not null and login = 'ada' and counted
                  and comment_url like '%issuecomment-1' and error is null) then
    raise exception 'FAIL: a send''s outcome was not recorded';
  end if;
  begin
    perform public.outbox_send_done(sent, null, null, null, 'posted twice');
    raise exception 'FAIL: a send''s outcome was recorded twice';
  exception when invalid_parameter_value then null; end;
  if (select error from public.outbox_sends where id = sent) is not null then
    raise exception 'FAIL: a second outcome changed the send';
  end if;

  begin
    update public.outbox_sends set reply = 'rewritten' where id = sent;
    raise exception 'FAIL: a send was rewritten directly';
  exception when insufficient_privilege then null; end;
  begin
    update public.outbox_sends set posted_at = null, comment_url = null where id = sent;
    raise exception 'FAIL: a send''s outcome was undone directly';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.outbox_sends where id = sent;
    raise exception 'FAIL: a send was deleted';
  exception when insufficient_privilege then null; end;
  insert into ids values ('ada-send', sent);
end $$;
reset role;

-- ── Bob, a member who is not the owner: never reads Ada's send, records nothing of it ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com');
do $$
declare
  kept uuid := (select id from ids where name = 'dossier');
  mine uuid;
begin
  if exists (select 1 from public.outbox_sends where id = (select id from ids where name = 'ada-send')) then
    raise exception 'FAIL: a member read another person''s send';
  end if;
  begin
    perform public.outbox_send_done((select id from ids where name = 'ada-send'), null, null, null, 'not mine');
    raise exception 'FAIL: a member recorded the outcome of another person''s send';
  exception when no_data_found then null; end;
  insert into public.outbox_sends (dossier_id, pr_number, reply, nonce_hash) values (kept, 12, '2: B because red', 'hash-b')
  returning id into mine;
  perform public.outbox_send_done(mine, null, null, null, 'GitHub is down');
  if not exists (select 1 from public.outbox_sends where id = mine and error = 'GitHub is down' and posted_at is null and comment_url is null) then
    raise exception 'FAIL: a failed send''s error was not recorded';
  end if;
  if (select count(*) from public.outbox_sends) <> 1 then
    raise exception 'FAIL: a member read sends other than their own';
  end if;
end $$;
reset role;

-- Bob's attempt left Ada's send as she recorded it.
do $$
begin
  if not exists (select 1 from public.outbox_sends where id = (select id from ids where name = 'ada-send') and error is null and posted_at is not null) then
    raise exception 'FAIL: another member changed Ada''s send';
  end if;
end $$;

-- ── Carl, of another workspace: reads no send, sends nothing on Vertuoza's dossier ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test');
do $$
begin
  if exists (select 1 from public.outbox_sends) then
    raise exception 'FAIL: a member of another workspace read a send';
  end if;
  begin
    insert into public.outbox_sends (dossier_id, pr_number, reply, nonce_hash) values ((select id from ids where name = 'dossier'), 12, '1: A', 'hash-c');
    raise exception 'FAIL: a member of another workspace sent on Vertuoza''s dossier';
  exception when insufficient_privilege then null; end;
  begin
    perform public.outbox_send_done((select id from ids where name = 'ada-send'), null, null, null, 'not mine');
    raise exception 'FAIL: a member of another workspace recorded a send''s outcome';
  exception when no_data_found then null; end;
end $$;
reset role;

-- ── Eve, in no workspace: nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
do $$
begin
  if exists (select 1 from public.outbox_sends) then
    raise exception 'FAIL: an account in no workspace read a send';
  end if;
  begin
    insert into public.outbox_sends (dossier_id, pr_number, reply, nonce_hash) values ((select id from ids where name = 'dossier'), 12, '1: A', 'hash-e');
    raise exception 'FAIL: an account in no workspace sent';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Grants ──
do $$
begin
  if has_table_privilege('authenticated', 'public.outbox_sends', 'update, delete, truncate')
     or has_any_column_privilege('authenticated', 'public.outbox_sends', 'update')
     or has_column_privilege('authenticated', 'public.outbox_sends', 'owner', 'insert')
     or has_column_privilege('authenticated', 'public.outbox_sends', 'posted_at', 'insert')
     or has_column_privilege('authenticated', 'public.outbox_sends', 'comment_url', 'insert')
     or has_column_privilege('authenticated', 'public.outbox_sends', 'error', 'insert') then
    raise exception 'FAIL: the signed-in may rewrite a send, or set its owner or outcome';
  end if;
  if has_table_privilege('anon', 'public.outbox_sends', 'select, insert, update, delete')
     or has_function_privilege('anon', 'public.outbox_send_done(uuid, text, text, boolean, text)', 'execute') then
    raise exception 'FAIL: anon may touch the sends';
  end if;
  if has_table_privilege('service_role', 'public.outbox_sends', 'select, insert, update, delete') then
    raise exception 'FAIL: the service role may read or write the sends';
  end if;
end $$;

select 'outbox sends checks passed' as result;
rollback;
