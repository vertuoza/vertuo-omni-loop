-- Voiding an approval on `omni dossier push` (PRD 1322 s6). The supabase workflow runs it on every pull
-- request, after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/approval_voiding.sql
-- dossier_push() appends an approval_voids row only when it adds a version of a kind the approval in
-- force pinned, with another sha256: an unchanged push, a kind the approval did not pin and a push after
-- the void leave none. It never edits the approval. dossier_approval() answers the voided approval with
-- its voids, and a new approval is in force again. approval_voids_of_push() names the caller's last
-- push's voids only; approval_void_recipients() is the service role's alone. One transaction, rolled
-- back at the end. Any `FAIL:` stops the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000d00a1', 'owen@av.test'),
  ('00000000-0000-4000-8000-0000000d00a2', 'ada@av.test'),
  ('00000000-0000-4000-8000-0000000d00a4', 'irisa@av.test'),
  ('00000000-0000-4000-8000-0000000d00c1', 'carl@av-other.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-0000000d0000', 'av', 'AV', 'av-org'),
  ('00000000-0000-4000-8000-0000000d0100', 'av-other', 'Other', 'av-other');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-0000000d0000', '00000000-0000-4000-8000-0000000d00a1', 'owner'),
  ('00000000-0000-4000-8000-0000000d0000', '00000000-0000-4000-8000-0000000d00a2', 'member'),
  ('00000000-0000-4000-8000-0000000d0000', '00000000-0000-4000-8000-0000000d00a4', 'member'),
  ('00000000-0000-4000-8000-0000000d0100', '00000000-0000-4000-8000-0000000d00c1', 'owner');
-- av-org/mobile is Mobile's, and Irisa its approver, with both channels on and one device.
insert into public.businesses (id, workspace_id, name) values
  ('00000000-0000-4000-8000-0000000d0b00', '00000000-0000-4000-8000-0000000d0000', 'AV');
insert into public.products (id, workspace_id, business_id, name) values
  ('00000000-0000-4000-8000-0000000d0d01', '00000000-0000-4000-8000-0000000d0000', '00000000-0000-4000-8000-0000000d0b00', 'Mobile');
insert into public.repositories (workspace_id, full_name) values
  ('00000000-0000-4000-8000-0000000d0000', 'av-org/mobile');
insert into public.product_repositories (product_id, workspace_id, repository, added_by) values
  ('00000000-0000-4000-8000-0000000d0d01', '00000000-0000-4000-8000-0000000d0000', 'av-org/mobile', 'person');
insert into public.product_approvers (workspace_id, product_id, user_id, state) values
  ('00000000-0000-4000-8000-0000000d0000', '00000000-0000-4000-8000-0000000d0d01', '00000000-0000-4000-8000-0000000d00a4', 'asked');
insert into public.players (workspace_id, user_id, display_name, github_login, hero) values
  ('00000000-0000-4000-8000-0000000d0000', '00000000-0000-4000-8000-0000000d00a2', 'ADA', 'Ada-GH', '{"v":1,"body":"girl","skin":2,"hair":3,"suit":0,"cape":8}');
insert into public.alert_channels (user_id, push, email) values
  ('00000000-0000-4000-8000-0000000d00a4', true, true);
insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth, device_label) values
  ('00000000-0000-4000-8000-0000000d0e01', '00000000-0000-4000-8000-0000000d00a4', 'https://push.example/irisa', 'key', 'secret', 'Phone');

create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- Ada pushes PRD 1's folder: `kinds` maps each kind to its content.
create function pg_temp.push(kinds jsonb) returns jsonb language sql as $$
  select public.dossier_push('av-org/mobile', 1, 'Voided', null,
    (select jsonb_agg(jsonb_build_object('kind', k.key, 'content', k.value #>> '{}')) from jsonb_each(kinds) k));
$$;

create temporary table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated, service_role;

set local role authenticated;

-- ── Ada pushes a ◆ PRD; Irisa approves it ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000d00a2', 'ada@av.test');
do $$
declare
  made jsonb := pg_temp.push(jsonb_build_object(
    'spec', E'---\nprd: 1\nphase0: server\n---\n\n# Voided\n', 'plan', 'plan 1', 'before-after', '<p>before</p>'));
begin
  insert into ids values ('mobile', (made ->> 'id')::uuid);
  if exists (select 1 from public.approval_voids) then raise exception 'FAIL: a push with no approval voided something'; end if;
end $$;

select pg_temp.sign_in('00000000-0000-4000-8000-0000000d00a4', 'irisa@av.test');
do $$
declare
  made jsonb := public.dossier_approve((select id from ids where name = 'mobile'));
begin
  insert into ids values ('first', (made ->> 'id')::uuid);
  if public.dossier_approval('av-org/mobile', 1) -> 'approval' -> 'voids' <> '[]'::jsonb then
    raise exception 'FAIL: an approval in force carried voids';
  end if;
end $$;

-- ── An unchanged push, and a kind the approval did not pin, void nothing ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000d00a2', 'ada@av.test');
do $$
declare
  made jsonb;
begin
  made := pg_temp.push(jsonb_build_object(
    'spec', E'---\nprd: 1\nphase0: server\n---\n\n# Voided\n', 'plan', 'plan 1', 'before-after', '<p>before</p>'));
  if jsonb_array_length(made -> 'added') <> 0 then raise exception 'FAIL: an unchanged push added %', made -> 'added'; end if;
  made := pg_temp.push(jsonb_build_object('voice', '{"personas":[]}'));
  if jsonb_array_length(made -> 'added') <> 1 then raise exception 'FAIL: the voice was not added: %', made; end if;
  if exists (select 1 from public.approval_voids) then raise exception 'FAIL: an unchanged push or an unpinned kind voided the approval'; end if;
  if jsonb_array_length(public.approval_voids_of_push((select id from ids where name = 'mobile'))) <> 0 then
    raise exception 'FAIL: a push that voided nothing named a void';
  end if;
end $$;

-- ── A changed plan voids the approval, in the same push, and leaves it as it was ──
reset role;
create temporary table before_void as select * from public.approvals;
grant select on before_void to authenticated;
set local role authenticated;
do $$
declare
  pinned  text := (select f ->> 'sha256' from public.approvals a, jsonb_array_elements(a.files) f
                    where a.id = (select id from ids where name = 'first') and f ->> 'kind' = 'plan');
  newest  public.dossier_versions%rowtype;
  void    public.approval_voids%rowtype;
  read    jsonb;
  told    jsonb;
begin
  perform pg_temp.push(jsonb_build_object('spec', E'---\nprd: 1\nphase0: server\n---\n\n# Voided\n', 'plan', 'plan 2'));
  select v.* into newest from public.dossier_versions v
   where v.dossier_id = (select id from ids where name = 'mobile') and v.kind = 'plan'
   order by v.created_at desc, v.id desc limit 1;
  if (select count(*) from public.approval_voids) <> 1 then
    raise exception 'FAIL: a changed plan left % voids', (select count(*) from public.approval_voids);
  end if;
  select x.* into void from public.approval_voids x;
  if void.approval_id <> (select id from ids where name = 'first') or void.kind <> 'plan' or void.from_sha256 <> pinned
     or void.to_sha256 <> newest.sha256 or void.version_id <> newest.id or void.pusher_login <> 'ada-gh'
     or void.pushed_by <> '00000000-0000-4000-8000-0000000d00a2' then
    raise exception 'FAIL: the void read %', to_jsonb(void);
  end if;
  insert into ids values ('void', void.id);
  if exists (select * from public.approvals except select * from before_void)
     or (select count(*) from public.approvals) <> (select count(*) from before_void) then
    raise exception 'FAIL: voiding edited or added an approval';
  end if;

  read := public.dossier_approval('av-org/mobile', 1) -> 'approval';
  if read -> 'voids' <> jsonb_build_array(jsonb_build_object('pusher', 'ada-gh', 'kind', 'plan', 'from', pinned, 'to', newest.sha256, 'voidedAt', void.voided_at)) then
    raise exception 'FAIL: dossier_approval() read the voids as %', read -> 'voids';
  end if;

  told := public.approval_voids_of_push((select id from ids where name = 'mobile'));
  if jsonb_array_length(told) <> 1 or told -> 0 ->> 'id' <> void.id::text or told -> 0 ->> 'approver' <> 'irisa@av.test'
     or told -> 0 ->> 'pusher' <> 'ada-gh' or (told -> 0 ->> 'prd')::int <> 1 or told -> 0 ->> 'repo' <> 'av-org/mobile'
     or told -> 0 ->> 'title' <> 'Voided' or told -> 0 ->> 'kind' <> 'plan' then
    raise exception 'FAIL: the push named %', told;
  end if;
  begin perform public.approval_void_recipients(void.id); raise exception 'FAIL: a member read who a void reaches';
  exception when insufficient_privilege then null; end;
end $$;

-- ── A push after the void voids nothing more, and names no void ──
do $$
begin
  perform pg_temp.push(jsonb_build_object('plan', 'plan 3', 'before-after', '<p>after</p>'));
  if (select count(*) from public.approval_voids) <> 1 then raise exception 'FAIL: a voided approval was voided again'; end if;
  if jsonb_array_length(public.approval_voids_of_push((select id from ids where name = 'mobile'))) <> 0 then
    raise exception 'FAIL: a later push named the earlier push''s void';
  end if;
end $$;

-- Irisa, who did not push, is named no void.
select pg_temp.sign_in('00000000-0000-4000-8000-0000000d00a4', 'irisa@av.test');
do $$
begin
  if jsonb_array_length(public.approval_voids_of_push((select id from ids where name = 'mobile'))) <> 0 then
    raise exception 'FAIL: a void was named to someone who did not push';
  end if;
  -- She approves again: the new approval is in force, with no void.
  insert into ids values ('second', (public.dossier_approve((select id from ids where name = 'mobile')) ->> 'id')::uuid);
  if public.dossier_approval('av-org/mobile', 1) -> 'approval' -> 'voids' <> '[]'::jsonb then
    raise exception 'FAIL: a new approval carried the old one''s voids';
  end if;
end $$;

-- ── One push changing two pinned kinds leaves a void for each ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000d00a2', 'ada@av.test');
do $$
declare
  told jsonb;
begin
  perform pg_temp.push(jsonb_build_object('spec', E'---\nprd: 1\nphase0: server\n---\n\n# Voided again\n', 'before-after', '<p>later</p>'));
  if (select array_agg(kind order by voided_at, id) from public.approval_voids where approval_id = (select id from ids where name = 'second'))
     is distinct from array['spec', 'before-after'] then
    raise exception 'FAIL: two changed kinds left %', (select array_agg(kind) from public.approval_voids where approval_id = (select id from ids where name = 'second'));
  end if;
  told := public.approval_voids_of_push((select id from ids where name = 'mobile'));
  if jsonb_array_length(told) <> 2 then raise exception 'FAIL: the push named %', told; end if;
  if jsonb_array_length(public.dossier_approval('av-org/mobile', 1) -> 'approval' -> 'voids') <> 2 then
    raise exception 'FAIL: dossier_approval() did not read both voids';
  end if;
end $$;

-- ── Carl, of another workspace, is named nothing ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000d00c1', 'carl@av-other.test');
do $$
begin
  if jsonb_array_length(public.approval_voids_of_push((select id from ids where name = 'mobile'))) <> 0 then
    raise exception 'FAIL: another workspace was named a void';
  end if;
end $$;

-- ── Signed out: neither function ──
reset role;
set local role anon;
do $$
begin
  begin perform public.approval_voids_of_push((select id from ids where name = 'mobile')); raise exception 'FAIL: anon read a push''s voids';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── The service role reads how the approver is reached ──
set local role service_role;
do $$
declare
  reached jsonb := public.approval_void_recipients((select id from ids where name = 'void'));
begin
  if reached <> jsonb_build_array(jsonb_build_object(
       'user', '00000000-0000-4000-8000-0000000d00a4', 'email', 'irisa@av.test',
       'devices', jsonb_build_array(jsonb_build_object('id', '00000000-0000-4000-8000-0000000d0e01',
         'endpoint', 'https://push.example/irisa', 'p256dh', 'key', 'auth', 'secret')))) then
    raise exception 'FAIL: the void reached %', reached;
  end if;
end $$;
reset role;

-- An approver who left the workspace is reached by nobody.
delete from public.workspace_members where user_id = '00000000-0000-4000-8000-0000000d00a4';
set local role service_role;
do $$
begin
  if public.approval_void_recipients((select id from ids where name = 'void')) <> '[]'::jsonb then
    raise exception 'FAIL: an approver who left was reached';
  end if;
end $$;
reset role;

rollback;
