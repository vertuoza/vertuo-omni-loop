-- Who may record an approved rewind finding's outcome, and how often (PRD 2498). The supabase workflow
-- runs it on every pull request, after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/rewind_outcome.sql
-- The service role and a member of the finding's workspace record an approved finding's outcome once,
-- through rewind_finding_outcome(): `proposed` with its pull request, `already` with the rule that says
-- it, `asks` with the question. A second outcome, a finding still proposed or rejected, an unknown
-- finding, a missing, misplaced or too long value, a member of another workspace, an account in no
-- workspace and anyone signed out are refused, and a refusal changes nothing. A member reads the three
-- columns with the row; nobody writes them but through the function, the service role included, and the
-- table itself refuses an outcome on a finding not approved or out of shape. One transaction, rolled
-- back at the end. Any `FAIL:` stops the run.

begin;

-- The checks' own workspace, Initech, with its fleets, sectors and repositories (PRD 2305).
\ir fixtures/initech.sql

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000025a1', 'ada@example.com'),
  ('00000000-0000-4000-8000-0000000025c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000025e1', 'eve@example.com');
-- A second workspace, Acme. Ada belongs to Initech, Carl to Acme, Eve to none.
insert into public.workspaces (slug, name, github_org) values ('acme', 'Acme', 'acme');
insert into public.workspace_members (workspace_id, user_id, joined_at)
select w.id, m.user_id, now() - interval '1 day'
  from (values
         ('initech', '00000000-0000-4000-8000-0000000025a1'::uuid),
         ('acme',    '00000000-0000-4000-8000-0000000025c1'::uuid)
       ) as m (slug, user_id)
  join public.workspaces w on w.slug = m.slug;

-- The two workspaces' ids, for every role below to name, whatever it may read.
select set_config('rewind_outcome.initech', (select id::text from public.workspaces where slug = 'initech'), true),
       set_config('rewind_outcome.acme', (select id::text from public.workspaces where slug = 'acme'), true);

-- The rewind's findings: Initech's PRD 7 has six, Acme's PRD 3 one.
insert into public.rewind_findings (workspace_id, repository, prd, check_name, origin, happened, evidence, fix)
select w.id, f.repository, f.prd, f.check_name, f.origin, f.happened, f.evidence::jsonb, 'A rule in the playbook.'
  from (values
         ('initech', 'initech/nimbus-plan', 7, 'knowledge', 'knowledge',  'Nobody wrote down that a migration is re-dated.', '["https://github.com/initech/nimbus-plan/pull/21"]'),
         ('initech', 'initech/nimbus-plan', 7, 'spec',      'knowledge',  'The spec named a rule the playbook already had.', '["https://github.com/initech/nimbus-plan/pull/22"]'),
         ('initech', 'initech/nimbus-plan', 7, 'plan',      'knowledge',  'The lesson would change a locked law.',           '["https://github.com/initech/nimbus-plan/pull/23"]'),
         ('initech', 'initech/nimbus-plan', 7, 'reviews',   'knowledge',  'A review rule nobody wrote down.',                '["https://github.com/initech/nimbus-plan/pull/24"]'),
         ('initech', 'initech/nimbus-plan', 7, 'ci',        'repository', 'A red run nobody read.',                          '["https://github.com/initech/nimbus-plan/pull/25"]'),
         ('initech', 'initech/nimbus-plan', 7, 'waves',     'knowledge',  'Two slices shared a file.',                       '["https://github.com/initech/nimbus-plan/pull/26"]'),
         ('acme',    'acme/widgets',        3, 'knowledge', 'knowledge',  'Nobody wrote down how a quote total rounds.',     '["https://github.com/acme/widgets/issues/41"]')
       ) as f (slug, repository, prd, check_name, origin, happened, evidence)
  join public.workspaces w on w.slug = f.slug;
-- An Initech finding still waiting for its outcome, for Carl to name though he cannot read it.
select set_config('rewind_outcome.reviews', (select id::text from public.rewind_findings where check_name = 'reviews'), true);

-- Ada approves four of Initech's and rejects one; `ci` stays proposed. Carl approves Acme's.
update public.rewind_findings
   set state = 'approved', decided_by = '00000000-0000-4000-8000-0000000025a1', decided_at = now()
 where check_name in ('knowledge', 'spec', 'plan', 'reviews') and repository = 'initech/nimbus-plan';
update public.rewind_findings
   set state = 'rejected', reason = 'Not a lesson.', decided_by = '00000000-0000-4000-8000-0000000025a1', decided_at = now()
 where check_name = 'waves';
update public.rewind_findings
   set state = 'approved', decided_by = '00000000-0000-4000-8000-0000000025c1', decided_at = now()
 where repository = 'acme/widgets';

-- ── The table itself: an outcome on an approved finding only, and in shape ──
do $$
declare
  reviews uuid := (select id from public.rewind_findings where check_name = 'reviews');
  ci      uuid := (select id from public.rewind_findings where check_name = 'ci');
begin
  if exists (select 1 from public.rewind_findings where outcome is not null or outcome_pr is not null or outcome_note is not null) then
    raise exception 'FAIL: a finding had an outcome before one was recorded';
  end if;
  begin
    update public.rewind_findings set outcome = 'proposed', outcome_pr = 12 where id = ci;
    raise exception 'FAIL: the table kept an outcome on a finding not approved';
  exception when check_violation then null; end;
  begin
    update public.rewind_findings set outcome = 'proposed' where id = reviews;
    raise exception 'FAIL: the table kept a proposed outcome without its pull request';
  exception when check_violation then null; end;
  begin
    update public.rewind_findings set outcome = 'asks', outcome_pr = 12, outcome_note = 'Which form?' where id = reviews;
    raise exception 'FAIL: the table kept a question with a pull request';
  exception when check_violation then null; end;
  begin
    update public.rewind_findings set outcome = 'merged', outcome_pr = 12 where id = reviews;
    raise exception 'FAIL: the table kept an outcome it does not know';
  exception when check_violation then null; end;
  begin
    update public.rewind_findings set outcome = 'proposed', outcome_pr = 0 where id = reviews;
    raise exception 'FAIL: the table kept pull request 0';
  exception when check_violation then null; end;
  begin
    update public.rewind_findings set outcome = 'asks', outcome_note = repeat('x', 2001) where id = reviews;
    raise exception 'FAIL: the table kept a note of 2001 characters';
  exception when check_violation then null; end;
end $$;

create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- ── The service role: records an outcome once, never writes the columns itself ──
set local role service_role;
select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
do $$
declare
  initech   uuid := current_setting('rewind_outcome.initech')::uuid;
  knowledge uuid := (select id from public.rewind_findings where check_name = 'knowledge' and repository = 'initech/nimbus-plan');
  reviews   uuid := (select id from public.rewind_findings where check_name = 'reviews');
  recorded  public.rewind_findings;
begin
  recorded := public.rewind_finding_outcome(initech, knowledge, 'proposed', 2506);
  if recorded.outcome <> 'proposed' or recorded.outcome_pr <> 2506 or recorded.outcome_note is not null or recorded.state <> 'approved' then
    raise exception 'FAIL: the service role could not record a proposed rule with its pull request';
  end if;

  begin
    perform public.rewind_finding_outcome(initech, knowledge, 'already', null, 'playbook/conventions#naming');
    raise exception 'FAIL: a second outcome was recorded';
  exception when insufficient_privilege then
    if sqlerrm not like 'Outcome: already proposed%' then raise exception 'FAIL: a second outcome was refused for another reason: %', sqlerrm; end if;
  end;
  begin
    update public.rewind_findings set outcome = 'proposed', outcome_pr = 9 where id = reviews;
    raise exception 'FAIL: the service role wrote the outcome without its function';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.rewind_findings (workspace_id, repository, prd, check_name, origin, happened, evidence, fix, outcome, outcome_note)
    values (initech, 'initech/nimbus-plan', 8, 'spec', 'knowledge', 'Said.', '["https://example.com/8"]', 'A rule.', 'asks', 'Which form?');
    raise exception 'FAIL: the service role wrote the outcome without its function';
  exception when insufficient_privilege then null; end;
  if (select outcome_pr from public.rewind_findings where id = knowledge) <> 2506
     or exists (select 1 from public.rewind_findings where id = reviews and outcome is not null) then
    raise exception 'FAIL: a refused outcome changed something';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin
    perform public.rewind_finding_outcome(current_setting('rewind_outcome.initech')::uuid,
      (select gen_random_uuid()), 'asks', null, 'Which form?');
    raise exception 'FAIL: anon recorded an outcome';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Ada, a member: reads the outcome, records one per approved finding, refused anything else ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000025a1', 'ada@example.com');
do $$
declare
  initech   uuid := current_setting('rewind_outcome.initech')::uuid;
  acme      uuid := current_setting('rewind_outcome.acme')::uuid;
  knowledge uuid := (select id from public.rewind_findings where check_name = 'knowledge');
  spec      uuid := (select id from public.rewind_findings where check_name = 'spec');
  plan      uuid := (select id from public.rewind_findings where check_name = 'plan');
  reviews   uuid := (select id from public.rewind_findings where check_name = 'reviews');
  ci        uuid := (select id from public.rewind_findings where check_name = 'ci');
  waves     uuid := (select id from public.rewind_findings where check_name = 'waves');
  recorded  public.rewind_findings;
begin
  if (select count(*) from public.rewind_findings) <> 6 then
    raise exception 'FAIL: a member did not read exactly their workspace''s findings';
  end if;
  if (select outcome || ' #' || outcome_pr from public.rewind_findings where id = knowledge) is distinct from 'proposed #2506' then
    raise exception 'FAIL: a member did not read the outcome';
  end if;

  -- Each refusal names its field, and records nothing.
  begin
    perform public.rewind_finding_outcome(initech, reviews, 'merged', 12);
    raise exception 'FAIL: an unknown outcome was recorded';
  exception when invalid_parameter_value then
    if sqlerrm not like 'Outcome:%' then raise exception 'FAIL: an unknown outcome was refused for another reason: %', sqlerrm; end if;
  end;
  begin
    perform public.rewind_finding_outcome(initech, reviews, null);
    raise exception 'FAIL: no outcome was recorded';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.rewind_finding_outcome(initech, reviews, 'proposed');
    raise exception 'FAIL: a proposed rule was recorded without its pull request';
  exception when invalid_parameter_value then
    if sqlerrm not like 'Pull request:%' then raise exception 'FAIL: a proposed rule without its pull request was refused for another reason: %', sqlerrm; end if;
  end;
  begin
    perform public.rewind_finding_outcome(initech, reviews, 'proposed', -3);
    raise exception 'FAIL: a proposed rule was recorded with pull request -3';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.rewind_finding_outcome(initech, reviews, 'proposed', 12, 'A note.');
    raise exception 'FAIL: a proposed rule was recorded with a note';
  exception when invalid_parameter_value then
    if sqlerrm not like 'Note:%' then raise exception 'FAIL: a proposed rule with a note was refused for another reason: %', sqlerrm; end if;
  end;
  begin
    perform public.rewind_finding_outcome(initech, reviews, 'already', 12, 'playbook/conventions#naming');
    raise exception 'FAIL: an already said was recorded with a pull request';
  exception when invalid_parameter_value then
    if sqlerrm not like 'Pull request:%' then raise exception 'FAIL: an already said with a pull request was refused for another reason: %', sqlerrm; end if;
  end;
  begin
    perform public.rewind_finding_outcome(initech, reviews, 'already', null, '   ');
    raise exception 'FAIL: an already said was recorded without its rule';
  exception when invalid_parameter_value then
    if sqlerrm not like 'Note:%' then raise exception 'FAIL: an already said without its rule was refused for another reason: %', sqlerrm; end if;
  end;
  begin
    perform public.rewind_finding_outcome(initech, reviews, 'asks');
    raise exception 'FAIL: a question was recorded without its words';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.rewind_finding_outcome(initech, reviews, 'already', null, 'playbook/' || chr(10) || 'conventions');
    raise exception 'FAIL: an already said was recorded on two lines';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.rewind_finding_outcome(initech, reviews, 'already', null, repeat('x', 201));
    raise exception 'FAIL: an already said of 201 characters was recorded';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.rewind_finding_outcome(initech, reviews, 'asks', null, repeat('x', 2001));
    raise exception 'FAIL: a question of 2001 characters was recorded';
  exception when invalid_parameter_value then null; end;

  -- A finding not approved, no such finding, a workspace she is not in.
  begin
    perform public.rewind_finding_outcome(initech, ci, 'proposed', 12);
    raise exception 'FAIL: an outcome was recorded on a finding not approved';
  exception when insufficient_privilege then
    if sqlerrm not like 'Finding: proposed%' then raise exception 'FAIL: an outcome on a proposed finding was refused for another reason: %', sqlerrm; end if;
  end;
  begin
    perform public.rewind_finding_outcome(initech, waves, 'already', null, 'playbook/conventions#naming');
    raise exception 'FAIL: an outcome was recorded on a finding not approved';
  exception when insufficient_privilege then
    if sqlerrm not like 'Finding: rejected%' then raise exception 'FAIL: an outcome on a rejected finding was refused for another reason: %', sqlerrm; end if;
  end;
  begin
    perform public.rewind_finding_outcome(initech, gen_random_uuid(), 'proposed', 12);
    raise exception 'FAIL: an outcome was recorded on an unknown finding';
  exception when no_data_found then null; end;
  begin
    perform public.rewind_finding_outcome(acme, reviews, 'proposed', 12);
    raise exception 'FAIL: a member recorded an outcome in a workspace she is not in';
  exception when insufficient_privilege then null; end;
  begin
    update public.rewind_findings set outcome = 'proposed', outcome_pr = 12 where id = reviews;
    raise exception 'FAIL: a member wrote the outcome without its function';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.rewind_findings where id in (reviews, ci, waves) and outcome is not null) then
    raise exception 'FAIL: a refused outcome changed something';
  end if;

  -- Already said: the rule, trimmed. Asks: the question, on several lines if it needs them.
  recorded := public.rewind_finding_outcome(initech, spec, 'already', null, '  playbook/conventions#naming  ');
  if recorded.outcome <> 'already' or recorded.outcome_note <> 'playbook/conventions#naming' or recorded.outcome_pr is not null then
    raise exception 'FAIL: a member could not record the rule that already says it';
  end if;
  recorded := public.rewind_finding_outcome(initech, plan, 'asks', null,
    'This would change BR-PRODUCT-12, a locked law: may it?' || chr(10) || 'I would leave the law as it is.');
  if recorded.outcome <> 'asks' or recorded.outcome_note not like 'This would change BR-PRODUCT-12%law as it is.' then
    raise exception 'FAIL: a member could not record a question';
  end if;
  begin
    perform public.rewind_finding_outcome(initech, plan, 'asks', null, 'Asked again?');
    raise exception 'FAIL: a second outcome was recorded';
  exception when insufficient_privilege then
    if sqlerrm not like 'Outcome: already asks%' then raise exception 'FAIL: a second question was refused for another reason: %', sqlerrm; end if;
  end;
  if (select outcome_note from public.rewind_findings where id = plan) like 'Asked again%' then
    raise exception 'FAIL: a second outcome rewrote the first';
  end if;
end $$;
reset role;

-- ── Carl, of another workspace: reads only Acme's, records nothing of Initech's ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000025c1', 'carl@acme.test');
do $$
declare
  initech uuid := current_setting('rewind_outcome.initech')::uuid;
  acme    uuid := current_setting('rewind_outcome.acme')::uuid;
begin
  if (select count(*) from public.rewind_findings) <> 1 or exists (select 1 from public.rewind_findings where outcome is not null) then
    raise exception 'FAIL: a member of another workspace read an Initech outcome';
  end if;
  begin
    perform public.rewind_finding_outcome(initech, current_setting('rewind_outcome.reviews')::uuid, 'proposed', 12);
    raise exception 'FAIL: a member of another workspace recorded an outcome';
  exception when insufficient_privilege then null; end;
  -- An Initech finding named under his own workspace is no finding of his.
  begin
    perform public.rewind_finding_outcome(acme, current_setting('rewind_outcome.reviews')::uuid, 'proposed', 12);
    raise exception 'FAIL: a member of another workspace recorded an outcome';
  exception when no_data_found then null; end;
  -- His workspace's approved finding: he may.
  if (public.rewind_finding_outcome(acme, (select id from public.rewind_findings), 'proposed', 41)).outcome_pr <> 41 then
    raise exception 'FAIL: a member could not record the outcome of his own workspace''s finding';
  end if;
end $$;
reset role;

-- ── Eve, in no workspace: records nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000025e1', 'eve@example.com');
do $$
begin
  if exists (select 1 from public.rewind_findings) then
    raise exception 'FAIL: an account in no workspace read a finding';
  end if;
  begin
    perform public.rewind_finding_outcome(current_setting('rewind_outcome.initech')::uuid, gen_random_uuid(), 'asks', null, 'Which form?');
    raise exception 'FAIL: an account in no workspace recorded an outcome';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Nothing was rewritten: the three outcomes recorded are the first ones ──
do $$
begin
  if (select string_agg(check_name || '=' || outcome, ',' order by check_name) from public.rewind_findings where outcome is not null)
     <> 'knowledge=proposed,knowledge=proposed,plan=asks,spec=already' then
    raise exception 'FAIL: the outcomes recorded were not exactly the first ones';
  end if;
end $$;

rollback;

select 'rewind_outcome: every check passed' as result;
