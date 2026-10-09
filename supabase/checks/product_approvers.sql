-- Who approves a product's PRDs, and how each person is reached (PRD 1322 s1). The supabase workflow
-- runs it on every pull request, after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/product_approvers.sql
-- Only a workspace's owner lists a product's approvers, each asked to approve or skipped, through
-- product_approver_set() and product_approver_remove(); a member, another workspace's account and
-- anyone signed out are refused (42501), a stranger to the workspace or another state is refused
-- (22023). Every member reads the list; nobody signed in writes it directly. Once a product lists a
-- member asked to approve, dossier_approve() lets only those members approve its PRDs; with no product,
-- or no member asked, any member still may (PRD 1299). alert_channels and push_subscriptions are each
-- read and written by their own member only. One transaction, rolled back at the end. Any `FAIL:`
-- stops the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000b00a1', 'owen@pa.test'),
  ('00000000-0000-4000-8000-0000000b00a2', 'ada@pa.test'),
  ('00000000-0000-4000-8000-0000000b00a3', 'sam@pa.test'),
  ('00000000-0000-4000-8000-0000000b00a4', 'max@pa.test'),
  ('00000000-0000-4000-8000-0000000b00c1', 'carl@pa-other.test');
-- PA owns the GitHub organisation pa-org: Owen owns it, Ada, Sam and Max are members. Carl owns Other.
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-0000000b0000', 'pa', 'PA', 'pa-org'),
  ('00000000-0000-4000-8000-0000000b0100', 'pa-other', 'Other', 'pa-other');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-0000000b0000', '00000000-0000-4000-8000-0000000b00a1', 'owner'),
  ('00000000-0000-4000-8000-0000000b0000', '00000000-0000-4000-8000-0000000b00a2', 'member'),
  ('00000000-0000-4000-8000-0000000b0000', '00000000-0000-4000-8000-0000000b00a3', 'member'),
  ('00000000-0000-4000-8000-0000000b0000', '00000000-0000-4000-8000-0000000b00a4', 'member'),
  ('00000000-0000-4000-8000-0000000b0100', '00000000-0000-4000-8000-0000000b00c1', 'owner');
-- Mobile and Web are PA's products; pa-org/mobile is Mobile's, pa-org/web Web's, pa-org/loose nobody's.
-- Other's product Rival is Carl's.
insert into public.businesses (id, workspace_id, name) values
  ('00000000-0000-4000-8000-0000000b0b00', '00000000-0000-4000-8000-0000000b0000', 'PA'),
  ('00000000-0000-4000-8000-0000000b0b01', '00000000-0000-4000-8000-0000000b0100', 'Other');
insert into public.products (id, workspace_id, business_id, name) values
  ('00000000-0000-4000-8000-0000000b0d01', '00000000-0000-4000-8000-0000000b0000', '00000000-0000-4000-8000-0000000b0b00', 'Mobile'),
  ('00000000-0000-4000-8000-0000000b0d02', '00000000-0000-4000-8000-0000000b0000', '00000000-0000-4000-8000-0000000b0b00', 'Web'),
  ('00000000-0000-4000-8000-0000000b0d09', '00000000-0000-4000-8000-0000000b0100', '00000000-0000-4000-8000-0000000b0b01', 'Rival');
insert into public.repositories (workspace_id, full_name) values
  ('00000000-0000-4000-8000-0000000b0000', 'pa-org/mobile'),
  ('00000000-0000-4000-8000-0000000b0000', 'pa-org/web'),
  ('00000000-0000-4000-8000-0000000b0000', 'pa-org/loose');
update public.repositories set product_id = case full_name
    when 'pa-org/mobile' then '00000000-0000-4000-8000-0000000b0d01'::uuid
    when 'pa-org/web' then '00000000-0000-4000-8000-0000000b0d02'::uuid
  end
 where workspace_id = '00000000-0000-4000-8000-0000000b0000';

create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

create temporary table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated, service_role;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.product_approvers limit 1; raise exception 'FAIL: anon read the approvers';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.alert_channels limit 1; raise exception 'FAIL: anon read the alert channels';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.push_subscriptions limit 1; raise exception 'FAIL: anon read the push subscriptions';
  exception when insufficient_privilege then null; end;
  begin perform public.product_approver_set('00000000-0000-4000-8000-0000000b0d01', '00000000-0000-4000-8000-0000000b00a2', 'asked');
    raise exception 'FAIL: anon listed an approver';
  exception when insufficient_privilege then null; end;
  begin perform public.product_approver_remove('00000000-0000-4000-8000-0000000b0d01', '00000000-0000-4000-8000-0000000b00a2');
    raise exception 'FAIL: anon removed an approver';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Ada pushes three ◆ PRDs: Mobile's, Web's, and one of a repository with no product ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000b00a2', 'ada@pa.test');
do $$
declare
  repo text;
  prd  int;
  made jsonb;
begin
  foreach repo in array array['pa-org/mobile', 'pa-org/web', 'pa-org/loose'] loop
    prd := array_position(array['pa-org/mobile', 'pa-org/web', 'pa-org/loose'], repo);
    made := public.dossier_push(repo, prd, 'Born on the server', null, jsonb_build_array(
      jsonb_build_object('kind', 'spec', 'content', format(E'---\nprd: %s\nphase0: server\n---\n\n# Born\n', prd)),
      jsonb_build_object('kind', 'plan', 'content', 'plan'),
      jsonb_build_object('kind', 'before-after', 'content', '<p>before</p>')));
    insert into ids values (split_part(repo, '/', 2), (made ->> 'id')::uuid);
  end loop;

  -- With nobody listed yet, any member approves, as in PRD 1299.
  perform public.dossier_approve((select id from ids where name = 'mobile'));
end $$;

-- ── A member lists nobody ──
do $$
begin
  begin perform public.product_approver_set('00000000-0000-4000-8000-0000000b0d01', '00000000-0000-4000-8000-0000000b00a2', 'asked');
    raise exception 'FAIL: a member who is not an owner listed an approver';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.product_approvers (workspace_id, product_id, user_id, state)
    values ('00000000-0000-4000-8000-0000000b0000', '00000000-0000-4000-8000-0000000b0d01', '00000000-0000-4000-8000-0000000b00a2', 'asked');
    raise exception 'FAIL: a member wrote the approvers table directly';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.product_approvers) then raise exception 'FAIL: a refusal listed an approver'; end if;
end $$;

-- ── Owen lists Mobile's approvers: Ada asked, Sam skipped ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000b00a1', 'owen@pa.test');
do $$
declare
  made jsonb;
begin
  made := public.product_approver_set('00000000-0000-4000-8000-0000000b0d01', '00000000-0000-4000-8000-0000000b00a2', 'asked');
  if made <> jsonb_build_object('product', '00000000-0000-4000-8000-0000000b0d01', 'member', '00000000-0000-4000-8000-0000000b00a2', 'state', 'asked') then
    raise exception 'FAIL: listing an approver answered %', made;
  end if;
  perform public.product_approver_set('00000000-0000-4000-8000-0000000b0d01', '00000000-0000-4000-8000-0000000b00a3', 'asked');
  -- Setting again changes the state in place: one row per member.
  perform public.product_approver_set('00000000-0000-4000-8000-0000000b0d01', '00000000-0000-4000-8000-0000000b00a3', 'skipped');
  if (select count(*) from public.product_approvers where product_id = '00000000-0000-4000-8000-0000000b0d01') <> 2 then
    raise exception 'FAIL: setting a member twice did not keep one row';
  end if;
  if (select state from public.product_approvers where user_id = '00000000-0000-4000-8000-0000000b00a3') <> 'skipped' then
    raise exception 'FAIL: Sam is not skipped';
  end if;

  -- Refusals: a stranger to the workspace, another state, another workspace's product, no product.
  begin perform public.product_approver_set('00000000-0000-4000-8000-0000000b0d01', '00000000-0000-4000-8000-0000000b00c1', 'asked');
    raise exception 'FAIL: a stranger to the workspace was listed';
  exception when invalid_parameter_value then
    if sqlerrm not like '%not a member%' then raise exception 'FAIL: a stranger''s refusal said %', sqlerrm; end if;
  end;
  begin perform public.product_approver_set('00000000-0000-4000-8000-0000000b0d01', '00000000-0000-4000-8000-0000000b00a4', 'maybe');
    raise exception 'FAIL: a state other than asked or skipped was kept';
  exception when invalid_parameter_value then null; end;
  begin perform public.product_approver_set('00000000-0000-4000-8000-0000000b0d09', '00000000-0000-4000-8000-0000000b00a4', 'asked');
    raise exception 'FAIL: an owner listed an approver on another workspace''s product';
  exception when insufficient_privilege then null; end;
  begin perform public.product_approver_set(gen_random_uuid(), '00000000-0000-4000-8000-0000000b00a4', 'asked');
    raise exception 'FAIL: an approver was listed on no product';
  exception when no_data_found then null; end;
end $$;

-- ── Carl, owner of another workspace, neither reads nor writes PA's list ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000b00c1', 'carl@pa-other.test');
do $$
begin
  if exists (select 1 from public.product_approvers) then raise exception 'FAIL: another workspace read the approvers'; end if;
  begin perform public.product_approver_remove('00000000-0000-4000-8000-0000000b0d01', '00000000-0000-4000-8000-0000000b00a2');
    raise exception 'FAIL: another workspace''s owner removed an approver';
  exception when insufficient_privilege then null; end;
end $$;

-- ── Every member reads the list; only Mobile's asked approvers approve its PRDs ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000b00a4', 'max@pa.test');
do $$
begin
  if (select count(*) from public.product_approvers) <> 2 then raise exception 'FAIL: a member did not read the list'; end if;
  begin perform public.dossier_approve((select id from ids where name = 'mobile'));
    raise exception 'FAIL: a member outside the list approved Mobile''s PRD';
  exception when insufficient_privilege then
    if sqlerrm not like '%Mobile%' then raise exception 'FAIL: the outsider''s refusal said %', sqlerrm; end if;
  end;
  -- Web lists nobody, and pa-org/loose has no product: any member approves those.
  perform public.dossier_approve((select id from ids where name = 'web'));
  perform public.dossier_approve((select id from ids where name = 'loose'));
end $$;

select pg_temp.sign_in('00000000-0000-4000-8000-0000000b00a3', 'sam@pa.test');
do $$
begin
  begin perform public.dossier_approve((select id from ids where name = 'mobile'));
    raise exception 'FAIL: a skipped member approved Mobile''s PRD';
  exception when insufficient_privilege then null; end;
end $$;

-- Ada, its author, approves it: she is one of Mobile's approvers.
select pg_temp.sign_in('00000000-0000-4000-8000-0000000b00a2', 'ada@pa.test');
do $$
begin
  perform public.dossier_approve((select id from ids where name = 'mobile'));
  if (select count(*) from public.approvals where dossier_id = (select id from ids where name = 'mobile')) <> 2 then
    raise exception 'FAIL: Mobile''s approver did not approve';
  end if;
end $$;

-- ── Owen removes Ada: with only Sam skipped, nobody is asked, and any member approves again ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000b00a1', 'owen@pa.test');
do $$
begin
  if not public.product_approver_remove('00000000-0000-4000-8000-0000000b0d01', '00000000-0000-4000-8000-0000000b00a2') then
    raise exception 'FAIL: removing a listed approver answered false';
  end if;
  if public.product_approver_remove('00000000-0000-4000-8000-0000000b0d01', '00000000-0000-4000-8000-0000000b00a2') then
    raise exception 'FAIL: removing an unlisted member answered true';
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000b00a4', 'max@pa.test');
do $$
begin
  perform public.dossier_approve((select id from ids where name = 'mobile'));
end $$;

-- ── Each member's alert channels and push subscriptions are their own ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000b00a2', 'ada@pa.test');
do $$
begin
  insert into public.alert_channels (user_id) values ('00000000-0000-4000-8000-0000000b00a2');
  if (select row(push, email) from public.alert_channels) is distinct from row(false, false) then
    raise exception 'FAIL: the alert channels are not off by default';
  end if;
  update public.alert_channels set push = true, email = true where user_id = '00000000-0000-4000-8000-0000000b00a2';
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, device_label)
  values ('00000000-0000-4000-8000-0000000b00a2', 'https://push.example/ada-phone', 'BKey', 'auth-secret', 'Ada''s phone');
  begin
    insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values ('00000000-0000-4000-8000-0000000b00a2', 'http://push.example/plain', 'BKey', 'auth-secret');
    raise exception 'FAIL: an endpoint that is not https was kept';
  exception when check_violation then null; end;
end $$;

select pg_temp.sign_in('00000000-0000-4000-8000-0000000b00a3', 'sam@pa.test');
do $$
begin
  if exists (select 1 from public.alert_channels) then raise exception 'FAIL: Sam read Ada''s alert channels'; end if;
  if exists (select 1 from public.push_subscriptions) then raise exception 'FAIL: Sam read Ada''s push subscriptions'; end if;
  begin insert into public.alert_channels (user_id, push) values ('00000000-0000-4000-8000-0000000b00a2', false);
    raise exception 'FAIL: Sam wrote Ada''s alert channels';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values ('00000000-0000-4000-8000-0000000b00a2', 'https://push.example/sam-as-ada', 'BKey', 'auth-secret');
    raise exception 'FAIL: Sam subscribed a device for Ada';
  exception when insufficient_privilege then null; end;
  update public.alert_channels set push = false;
  delete from public.push_subscriptions;
end $$;
reset role;

do $$
begin
  if (select row(push, email) from public.alert_channels where user_id = '00000000-0000-4000-8000-0000000b00a2') is distinct from row(true, true) then
    raise exception 'FAIL: Sam changed Ada''s alert channels';
  end if;
  if (select count(*) from public.push_subscriptions where user_id = '00000000-0000-4000-8000-0000000b00a2') <> 1 then
    raise exception 'FAIL: Sam removed Ada''s push subscription';
  end if;
end $$;

-- Ada removes her own device.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000b00a2', 'ada@pa.test');
do $$
begin
  delete from public.push_subscriptions where endpoint = 'https://push.example/ada-phone';
  if exists (select 1 from public.push_subscriptions) then raise exception 'FAIL: Ada did not remove her own device'; end if;
end $$;
reset role;

-- ── A member who leaves the workspace leaves its products' lists ──
delete from public.workspace_members where user_id = '00000000-0000-4000-8000-0000000b00a3';
do $$
begin
  if exists (select 1 from public.product_approvers where user_id = '00000000-0000-4000-8000-0000000b00a3') then
    raise exception 'FAIL: a member who left is still listed';
  end if;
end $$;

select 'product approver checks passed' as result;
rollback;
