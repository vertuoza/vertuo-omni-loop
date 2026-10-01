-- Questions agents couldn't answer (PRD 855 s3, 20261028100000_agent_questions.sql). The supabase workflow
-- runs it on every pull request, after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/agent_questions.sql
-- A working link reports a question with its asker, repository and file; the same question (case and
-- spaces aside) bumps one row; a question over 300 characters is refused (22023), and so is the 31st
-- report of a link in 24 hours (54000). Any member lists, answers and dismisses the open questions: an
-- answer is a confirmed claim (source `answer`) of the picked kind, on the question's product, that the
-- next read through the link carries, and it closes the question linked to it; a dismissal closes it with
-- no claim. Open questions are counted for the bell. A member of another workspace sees and does nothing
-- (42501), and nobody signed in reads the tables. Jev's Unknown worth asking (PRD 855 s4,
-- 20261028110000_unknown_worth_asking.sql): the service role alone reads what Jev reads and sets an open
-- question aside; set aside, it is listed folded and not counted in the bell; a member brings it back, and
-- Jev never sets it aside again.
--
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Olga owns Vertuoza; Mo is its member; Carl owns Acme.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000086a1', 'olga@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000000086b1', 'mo@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000000086c1', 'carl@acme.test', now());
insert into public.workspaces (slug, name, github_org) values ('acme-asks', 'Acme', 'acme-asks');
update public.workspaces set github_org = 'vertuoza' where slug = 'vertuoza' and github_org is null;
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('vertuoza', '00000000-0000-4000-8000-0000000086a1'::uuid, 'owner'),
         ('vertuoza', '00000000-0000-4000-8000-0000000086b1'::uuid, 'member'),
         ('acme-asks', '00000000-0000-4000-8000-0000000086c1'::uuid, 'owner')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug
on conflict (workspace_id, user_id) do nothing;

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.sign_out() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
$$;
create temporary table ids (slug text primary key, id uuid);
insert into ids select w.slug, w.id from public.workspaces w where w.slug in ('vertuoza', 'acme-asks');
grant select on ids to anon, authenticated, service_role;
create function pg_temp.ws(slug text) returns uuid language sql as $$
  select i.id from ids i where i.slug = ws.slug;
$$;
create function pg_temp.hash(token text) returns text language sql immutable as $$
  select encode(sha256(convert_to(token, 'UTF8')), 'hex');
$$;
-- The question reported, kept for the steps after.
create temporary table kept (name text primary key, id uuid);
grant select, insert on kept to anon, authenticated, service_role;
create function pg_temp.kept(name text) returns uuid language sql as $$
  select k.id from kept k where k.name = kept.name;
$$;
-- A question's row, read as the check's owner: nobody signed in reads the table.
create function pg_temp.question(id uuid) returns public.agent_questions language sql security definer as $$
  select q from public.agent_questions q where q.id = question.id;
$$;
-- How many reports a link sent, read as the check's owner.
create function pg_temp.reports(h text) returns integer language sql security definer as $$
  select count(*)::integer from public.agent_question_reports r join public.agent_tokens t on t.id = r.token_id where t.token_hash = h;
$$;
-- Runs a call that must be refused with `state`.
create function pg_temp.refused(stmt text, state text) returns void language plpgsql as $$
declare got text;
begin
  begin
    execute stmt;
  exception when others then
    got := sqlstate;
  end;
  if got is distinct from state then
    raise exception 'FAIL: % answered % (want %)', stmt, coalesce(got, 'success'), state;
  end if;
end;
$$;

-- ── Mo opens the business, picks a region, and makes a link ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000086b1');
do $$
begin
  perform public.business_open(pg_temp.ws('vertuoza'));
  perform public.claim_pick(pg_temp.ws('vertuoza'), null, 'region', 'Belgium', 'pick');
  perform public.agent_token_make(pg_temp.ws('vertuoza'), 'Mo''s editor', pg_temp.hash('omb_mo_asks'), 'asks');
end $$;
reset role;

-- ── Signed out: the link reports; nothing else runs, the tables are not read ──
set local role anon;
select pg_temp.sign_out();
do $$
declare
  h text := pg_temp.hash('omb_mo_asks');
  got jsonb;
  again jsonb;
  c text;
begin
  got := public.agent_question_report(h, '  Do we sell in Luxembourg? ', 'vertuoza/vertuo-apps', 'src/NewQuoteForm.tsx');
  if (got->>'asked')::integer <> 1 then raise exception 'FAIL: a first report answered %', got; end if;
  insert into kept values ('lux', (got->>'id')::uuid);
  -- The same question, case and spaces aside, bumps the one row.
  again := public.agent_question_report(h, 'do we SELL  in luxembourg?', 'vertuoza/vertuo-apps', 'src/Other.tsx');
  if again->>'id' <> got->>'id' or (again->>'asked')::integer <> 2 then
    raise exception 'FAIL: the same question again answered %', again;
  end if;
  insert into kept select 'size', (public.agent_question_report(h, 'How big are our customers?')->>'id')::uuid;

  perform pg_temp.refused(format('select public.agent_question_report(%L, %L)', h, repeat('q', 301)), '22023');
  perform pg_temp.refused(format('select public.agent_question_report(%L, '''')', h), '22023');
  perform pg_temp.refused(format('select public.agent_question_report(%L, ''Two'' || chr(10) || ''lines'')', h), '22023');
  perform pg_temp.refused(format('select public.agent_question_report(%L, ''Who?'', ''acme-asks/widgets'')', h), '42501');
  perform pg_temp.refused(format('select public.agent_question_report(%L, ''Who?'')', pg_temp.hash('omb_nobody')), '28000');

  foreach c in array array[
    format('select public.agent_questions_list(%L)', pg_temp.ws('vertuoza')),
    format('select public.agent_questions_open(%L)', pg_temp.ws('vertuoza')),
    format('select public.agent_question_dismiss(%L, %L)', pg_temp.ws('vertuoza'), pg_temp.kept('lux')),
    format('select public.agent_question_answer(%L, %L, ''region'', ''Luxembourg'')', pg_temp.ws('vertuoza'), pg_temp.kept('lux')),
    'select 1 from public.agent_questions',
    'select 1 from public.agent_question_reports'
  ] loop perform pg_temp.refused(c, '42501'); end loop;
end $$;
reset role;

-- ── The row: its asker, repository and file, the latest ones ──
do $$
declare q public.agent_questions;
begin
  q := pg_temp.question(pg_temp.kept('lux'));
  if q.question <> 'Do we sell in Luxembourg?' or q.asked <> 2 or q.repo <> 'vertuoza/vertuo-apps'
     or q.file <> 'src/Other.tsx' or q.state <> 'open'
     or q.token_id <> (select id from public.agent_tokens where token_hash = pg_temp.hash('omb_mo_asks')) then
    raise exception 'FAIL: the question was stored as %', q;
  end if;
end $$;

-- ── Members see the open questions and their count; another workspace does not ──
set local role authenticated;
do $$
declare
  listed jsonb;
  lux jsonb;
begin
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000086a1');
  listed := public.agent_questions_list(pg_temp.ws('vertuoza'));
  select e into lux from jsonb_array_elements(listed) e where (e->>'id')::uuid = pg_temp.kept('lux');
  if jsonb_array_length(listed) <> 2 or lux->>'question' <> 'Do we sell in Luxembourg?'
     or lux->>'askedBy' <> 'Mo''s editor' or (lux->>'asked')::integer <> 2
     or lux->>'repo' <> 'vertuoza/vertuo-apps' or lux->>'file' <> 'src/Other.tsx' or lux->>'product' is null then
    raise exception 'FAIL: the owner listed %', listed;
  end if;
  if public.agent_questions_open(pg_temp.ws('vertuoza')) <> 2 then
    raise exception 'FAIL: the bell counts % open questions', public.agent_questions_open(pg_temp.ws('vertuoza'));
  end if;

  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000086c1');
  perform pg_temp.refused(format('select public.agent_questions_list(%L)', pg_temp.ws('vertuoza')), '42501');
  perform pg_temp.refused(format('select public.agent_questions_open(%L)', pg_temp.ws('vertuoza')), '42501');
  perform pg_temp.refused(format('select public.agent_question_dismiss(%L, %L)', pg_temp.ws('vertuoza'), pg_temp.kept('lux')), '42501');
  perform pg_temp.refused(format('select public.agent_question_answer(%L, %L, ''region'', ''Luxembourg'')', pg_temp.ws('vertuoza'), pg_temp.kept('lux')), '42501');
  -- Through his own workspace, the question is not his.
  perform public.business_open(pg_temp.ws('acme-asks'));
  perform pg_temp.refused(format('select public.agent_question_dismiss(%L, %L)', pg_temp.ws('acme-asks'), pg_temp.kept('lux')), 'P0002');
  if jsonb_array_length(public.agent_questions_list(pg_temp.ws('acme-asks'))) <> 0 then
    raise exception 'FAIL: another workspace lists the questions';
  end if;
end $$;
reset role;

-- ── Answer once: a confirmed claim, the question closed on it, read through the link ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000086b1');
do $$
declare
  got jsonb;
  q public.agent_questions;
  c public.claims;
begin
  perform pg_temp.refused(format('select public.agent_question_answer(%L, %L, ''planet'', ''Mars'')', pg_temp.ws('vertuoza'), pg_temp.kept('lux')), '22023');
  perform pg_temp.refused(format('select public.agent_question_answer(%L, %L, ''region'', '''')', pg_temp.ws('vertuoza'), pg_temp.kept('lux')), '22023');
  perform pg_temp.refused(format('select public.agent_question_answer(%L, %L, ''size'', ''lots'')', pg_temp.ws('vertuoza'), pg_temp.kept('size')), '22023');

  got := public.agent_question_answer(pg_temp.ws('vertuoza'), pg_temp.kept('lux'), 'region', ' Luxembourg ');
  q := pg_temp.question(pg_temp.kept('lux'));
  select * into c from public.claims where id = q.claim_id;
  if q.state <> 'answered' or q.closed_by <> '00000000-0000-4000-8000-0000000086b1' or q.closed_at is null
     or c.kind <> 'region' or c.value <> 'Luxembourg' or c.source <> 'answer' or c.state <> 'confirmed'
     or c.product_id is not null or got->>'claim' <> 'region#' || c.seq then
    raise exception 'FAIL: answer once left % and %', q, c;
  end if;
  -- Once: it is no longer open.
  perform pg_temp.refused(format('select public.agent_question_answer(%L, %L, ''region'', ''France'')', pg_temp.ws('vertuoza'), pg_temp.kept('lux')), 'P0002');

  -- A size goes to the only product.
  perform public.agent_question_answer(pg_temp.ws('vertuoza'), pg_temp.kept('size'), 'size', '2-50');
  select c2.* into c from public.claims c2 where c2.id = (pg_temp.question(pg_temp.kept('size'))).claim_id;
  if c.kind <> 'size' or c.product_id is distinct from (select p.id from public.products p where p.workspace_id = pg_temp.ws('vertuoza')) then
    raise exception 'FAIL: the size answer was stored as %', c;
  end if;
  if public.agent_questions_open(pg_temp.ws('vertuoza')) <> 0 or jsonb_array_length(public.agent_questions_list(pg_temp.ws('vertuoza'))) <> 0 then
    raise exception 'FAIL: answered questions are still open';
  end if;
end $$;
reset role;
set local role anon;
select pg_temp.sign_out();
do $$
declare got jsonb := public.business_for_token(pg_temp.hash('omb_mo_asks'));
begin
  if not exists (select 1 from jsonb_array_elements(got->'claims') e
                  where e->>'kind' = 'region' and e->>'value' = 'Luxembourg' and e->>'source' = 'answer' and e->>'state' = 'confirmed') then
    raise exception 'FAIL: the next read through the link does not carry the answer: %', got;
  end if;
  -- Asked again once answered, it is a new open question.
  insert into kept select 'again', (public.agent_question_report(pg_temp.hash('omb_mo_asks'), 'Do we sell in Luxembourg?')->>'id')::uuid;
  if pg_temp.kept('again') = pg_temp.kept('lux') then
    raise exception 'FAIL: an answered question was bumped';
  end if;
end $$;
reset role;

-- ── Several products: an answer about an untracked repository names its product ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000086b1');
select public.product_add(pg_temp.ws('vertuoza'), 'Second product');
reset role;
set local role anon;
select pg_temp.sign_out();
insert into kept select 'stray', (public.agent_question_report(pg_temp.hash('omb_mo_asks'), 'Which trade?', 'vertuoza/not-tracked')->>'id')::uuid;
reset role;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000086b1');
do $$
declare
  second uuid := (select p.id from public.products p where p.workspace_id = pg_temp.ws('vertuoza') and p.name = 'Second product');
  c public.claims;
begin
  if (select e->>'product' from jsonb_array_elements(public.agent_questions_list(pg_temp.ws('vertuoza'))) e
       where (e->>'id')::uuid = pg_temp.kept('stray')) is not null then
    raise exception 'FAIL: the list guessed a product for an untracked repository';
  end if;
  perform pg_temp.refused(format('select public.agent_question_answer(%L, %L, ''trade'', ''plumbing'')', pg_temp.ws('vertuoza'), pg_temp.kept('stray')), '22023');
  perform public.agent_question_answer(pg_temp.ws('vertuoza'), pg_temp.kept('stray'), 'trade', 'plumbing', second);
  select c2.* into c from public.claims c2 where c2.id = (pg_temp.question(pg_temp.kept('stray'))).claim_id;
  if c.product_id is distinct from second then raise exception 'FAIL: the trade went to %', c; end if;
end $$;
reset role;

-- ── Dismiss: closed, no claim ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000086a1');
do $$
declare
  q public.agent_questions;
  claims_before integer := (select count(*) from public.claims);
begin
  perform public.agent_question_dismiss(pg_temp.ws('vertuoza'), pg_temp.kept('again'));
  q := pg_temp.question(pg_temp.kept('again'));
  if q.state <> 'dismissed' or q.claim_id is not null or q.closed_at is null or (select count(*) from public.claims) <> claims_before then
    raise exception 'FAIL: dismiss left %', q;
  end if;
  perform pg_temp.refused(format('select public.agent_question_dismiss(%L, %L)', pg_temp.ws('vertuoza'), q.id), 'P0002');
end $$;
reset role;

-- ── Jev's Unknown worth asking (PRD 855 s4): set aside, out of the bell, brought back ──
-- The owner can name the fourth decision; switching it on needs a key, so it is set Off here.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000086a1');
select public.set_jev_decision(pg_temp.ws('vertuoza'), 'unknown-worth-asking', 'off', 0.5, 0.4);
reset role;
set local role anon;
select pg_temp.sign_out();
insert into kept select 'junk', (public.agent_question_report(pg_temp.hash('omb_mo_asks'), 'Is the sky blue?', 'vertuoza/vertuo-apps', 'src/Sky.tsx')->>'id')::uuid;
do $$
begin
  -- The link names its own workspace, so galaxy can look for its Jev key before reading any question;
  -- a link that does not work names none.
  if public.agent_link_workspace(pg_temp.hash('omb_mo_asks')) is distinct from pg_temp.ws('vertuoza') then
    raise exception 'FAIL: the link''s workspace';
  end if;
  perform pg_temp.refused(format('select public.agent_link_workspace(%L)', pg_temp.hash('omb_nobody')), '28000');
  -- Neither the link nor anybody signed in reads what Jev reads, or sets a question aside.
  perform pg_temp.refused(format('select public.agent_question_for_jev(%L)', pg_temp.kept('junk')), '42501');
  perform pg_temp.refused(format('select public.agent_question_set_aside(%L)', pg_temp.kept('junk')), '42501');
  perform pg_temp.refused(format('select public.agent_question_bring_back(%L, %L)', pg_temp.ws('vertuoza'), pg_temp.kept('junk')), '42501');
end $$;
reset role;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000086b1');
do $$
begin
  perform pg_temp.refused(format('select public.agent_question_for_jev(%L)', pg_temp.kept('junk')), '42501');
  perform pg_temp.refused(format('select public.agent_question_set_aside(%L)', pg_temp.kept('junk')), '42501');
end $$;
reset role;

-- What Jev reads: the question, its repository and file, the workspace and the confirmed claims.
set local role service_role;
do $$
declare
  ctx jsonb := public.agent_question_for_jev(pg_temp.kept('junk'));
  verdict jsonb;
begin
  if ctx->>'question' <> 'Is the sky blue?' or ctx->>'repo' <> 'vertuoza/vertuo-apps' or ctx->>'file' <> 'src/Sky.tsx'
     or (ctx->>'workspace')::uuid <> pg_temp.ws('vertuoza') or not exists (select 1 from jsonb_array_elements_text(ctx->'claims') c where c like 'region#%: Belgium') then
    raise exception 'FAIL: Jev reads %', ctx;
  end if;
  -- Jev's counted "no": the open question is set aside.
  verdict := public.agent_question_set_aside(pg_temp.kept('junk'));
  if verdict->>'state' <> 'set-aside' then raise exception 'FAIL: the verdict left %', verdict; end if;
  -- An answered question is never set aside.
  verdict := public.agent_question_set_aside(pg_temp.kept('lux'));
  if verdict->>'state' <> 'answered' then raise exception 'FAIL: an answered question became %', verdict; end if;
end $$;
reset role;
do $$
declare q public.agent_questions := pg_temp.question(pg_temp.kept('junk'));
begin
  if q.state <> 'set-aside' or q.set_aside_at is null then raise exception 'FAIL: set aside stored %', q; end if;
end $$;

-- The same question again bumps the set-aside row, which stays set aside.
set local role anon;
select pg_temp.sign_out();
do $$
declare again jsonb := public.agent_question_report(pg_temp.hash('omb_mo_asks'), 'is the sky BLUE?');
begin
  if (again->>'id')::uuid <> pg_temp.kept('junk') or (again->>'asked')::integer <> 2 then
    raise exception 'FAIL: the set-aside question asked again answered %', again;
  end if;
end $$;
reset role;

-- Members see it folded (setAside), the bell does not count it; only a member brings it back, once.
set local role authenticated;
do $$
declare
  open_before integer;
  junk jsonb;
begin
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000086b1');
  select e into junk from jsonb_array_elements(public.agent_questions_list(pg_temp.ws('vertuoza'))) e
   where (e->>'id')::uuid = pg_temp.kept('junk');
  if junk is null or (junk->>'setAside')::boolean is not true then raise exception 'FAIL: the set-aside question listed as %', junk; end if;
  if exists (select 1 from jsonb_array_elements(public.agent_questions_list(pg_temp.ws('vertuoza'))) e
              where (e->>'setAside')::boolean and (e->>'id')::uuid <> pg_temp.kept('junk')) then
    raise exception 'FAIL: an open question listed as set aside';
  end if;
  open_before := public.agent_questions_open(pg_temp.ws('vertuoza'));
  if open_before <> (select count(*) from jsonb_array_elements(public.agent_questions_list(pg_temp.ws('vertuoza'))) e
                      where not (e->>'setAside')::boolean) then
    raise exception 'FAIL: the bell counts % with a set-aside question', open_before;
  end if;

  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000086c1');
  perform pg_temp.refused(format('select public.agent_question_bring_back(%L, %L)', pg_temp.ws('vertuoza'), pg_temp.kept('junk')), '42501');
  perform pg_temp.refused(format('select public.agent_question_bring_back(%L, %L)', pg_temp.ws('acme-asks'), pg_temp.kept('junk')), 'P0002');

  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000086b1');
  perform public.agent_question_bring_back(pg_temp.ws('vertuoza'), pg_temp.kept('junk'));
  if public.agent_questions_open(pg_temp.ws('vertuoza')) <> open_before + 1 then
    raise exception 'FAIL: a question brought back is not counted in the bell';
  end if;
  perform pg_temp.refused(format('select public.agent_question_bring_back(%L, %L)', pg_temp.ws('vertuoza'), pg_temp.kept('junk')), 'P0002');
end $$;
reset role;

-- Brought back, Jev never sets it aside again.
set local role service_role;
do $$
declare verdict jsonb := public.agent_question_set_aside(pg_temp.kept('junk'));
begin
  if verdict->>'state' <> 'open' then raise exception 'FAIL: a question brought back was set aside again: %', verdict; end if;
end $$;
reset role;

-- ── The 31st report of a link in 24 hours is refused ──
set local role anon;
select pg_temp.sign_out();
do $$
declare
  h text := pg_temp.hash('omb_mo_asks');
  sent integer := pg_temp.reports(h);
  i integer;
begin
  for i in (sent + 1)..30 loop
    perform public.agent_question_report(h, 'Question number ' || i);
  end loop;
  perform pg_temp.refused(format('select public.agent_question_report(%L, ''One too many'')', h), '54000');
  -- A repeat counts as a report too.
  perform pg_temp.refused(format('select public.agent_question_report(%L, ''Question number 30'')', h), '54000');
end $$;
reset role;
-- A day later, it reports again.
update public.agent_question_reports set reported_at = reported_at - interval '25 hours';
set local role anon;
select pg_temp.sign_out();
select public.agent_question_report(pg_temp.hash('omb_mo_asks'), 'One day later');
reset role;

rollback;
