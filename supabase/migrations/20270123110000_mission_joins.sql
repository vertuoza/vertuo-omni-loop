-- A PRD joins its mission's branch (PRD 2896 s4, docs: .omni-loop/delivery/inbox/2896-fleet-alone/spec.md, criteria 6 and 7).
-- It runs after 20270122122000_reviewer.sql, which last set the kinds of a mission event.
--
-- - mission_events.kind takes `prd-joined`: the App squash-merged a PRD's feature pull request into the mission branch, its
--   merge gate passed (green checks, the Reviewer's pass on the head, no open high or human-action item). Written by the
--   service role, signed `supervisor` and `agent`, linking the pull request; never in a person's name. A mission's PRDs on
--   its branch are read back from these events, in order.
--
-- Every statement can run twice. Nobody's grants change: a member still reads the events, and only the service role writes
-- them. Proven by supabase/checks/missions.sql.
-- Rollback: the kind is additive, and an event is never deleted: once a `prd-joined` is recorded the kind stays in the list.
-- Reverting the App's code stops new joins; the kinds of 20270122122000_reviewer.sql come back only while none is recorded.

alter table public.mission_events drop constraint if exists mission_events_kind_check;
alter table public.mission_events add constraint mission_events_kind_check check (kind in (
  'started', 'paused', 'resumed', 'dispatched', 'job-ended', 'waits', 'prd-ready',
  'prd-merged', 'held', 'stopped', 'delivered', 'reviewed', 'prd-joined'));

comment on column public.mission_events.kind is
  'What happened: started, paused, resumed, dispatched, job-ended, waits, prd-ready, prd-merged, held, stopped or delivered (PRD 2842), reviewed (PRD 2871: a verdict of the Reviewer, role reviewer, actor agent, linking its review), or prd-joined (PRD 2896: the App squash-merged a PRD''s feature pull request into the mission branch, role supervisor, actor agent, linking the pull request).';
