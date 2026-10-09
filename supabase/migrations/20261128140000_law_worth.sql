-- Worth a law (PRD 1342 s3, docs: .omni-loop/delivery/inbox/1342-laws-with-their-test/spec.md).
-- A seventh Jev decision, `law-worth`, Off by default like the others: whether a rule or an invariant the
-- harvest found, with no test proving it yet, is worth a law (an executable test that fails when it is
-- broken). The App's harvest asks it through Galaxy's signed judge route (POST /api/laws/judge), a
-- terminal through `omni decide law-worth`; Galaxy runs it as the service role, as every Jev decision
-- (apps/galaxy/src/jev/decisions/law-worth.ts). Nothing else is stored: its calls go to jev_calls.
--
--   jev_decision_names()   gains `law-worth`
--
-- Proven by supabase/checks/jev.sql.
-- Rollback: a follow-up migration restores jev_decision_names() of 20261113100000_hitl_category.sql and
-- deletes the decision's jev_decisions rows (its jev_calls rows may stay or go: nothing reads them back).

create or replace function public.jev_decision_names() returns text[]
language sql immutable
set search_path = ''
as $$
  select array['question-category', 'outbox-risk', 'bug-risk', 'unknown-worth-asking', 'constituent-break', 'hitl-category', 'law-worth']
$$;
