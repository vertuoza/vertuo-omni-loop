-- A person overturns a decision of the fleet (PRD 2896 s11, docs: .omni-loop/delivery/inbox/2896-fleet-alone/spec.md, "6. The committee,
-- at `alone`", criteria 17 and 18). It runs after 20270123130000_mission_committee.sql, which last set the kinds of a mission event.
--
-- - mission_events.kind takes one more kind:
--     overturned   a member ran `omni mission overturn <mission> <decision>`: the fleet's decision (a PRD's approval, or the answer to one
--                  of its items) stays as it was recorded, the `decided` event and its mission_decisions row untouched (BR-PRODUCT-12), and
--                  this event is added beside it, role supervisor, actor the member's login, naming the decision. An overturned approval no
--                  longer counts for the mission; the PRD leaves the mission branch when it had joined (a `drop-asked-keep` rides with it).
--   Written by the service role, as `drop-asked` is; a member reads it and writes none. The Missions tab counts these for its trust line.
--
-- Every statement can run twice. Nobody's grants change. Proven by supabase/checks/missions.sql.
-- Rollback: the kind is additive, and an event is never deleted: once one is recorded it stays in the list. Reverting the App's code stops
-- new overturns; mission_events_kind_check of 20270123130000_mission_committee.sql comes back only while none is recorded.

alter table public.mission_events drop constraint if exists mission_events_kind_check;
alter table public.mission_events add constraint mission_events_kind_check check (kind in (
  'started', 'paused', 'resumed', 'dispatched', 'job-ended', 'waits', 'prd-ready',
  'prd-merged', 'held', 'stopped', 'delivered', 'reviewed', 'prd-joined',
  'drop-asked', 'drop-asked-keep', 'prd-dropped', 'decided', 'escalated', 'overturned'));

comment on column public.mission_events.kind is
  'What happened: started, paused, resumed, dispatched, job-ended, waits, prd-ready, prd-merged, held, stopped or delivered (PRD 2842), reviewed (PRD 2871: a verdict of the Reviewer, role reviewer, actor agent, linking its review), prd-joined (PRD 2896: the App squash-merged a PRD''s feature pull request into the mission branch, role supervisor, actor agent, linking the pull request), drop-asked or drop-asked-keep (PRD 2896: a member asked for a PRD to leave the branch, with or without the later PRDs sharing its territory, actor the member''s login), prd-dropped (PRD 2896: the App removed the PRD''s commit from the branch and reopened its feature pull request, role supervisor, actor agent, linking it), decided or escalated (PRD 2896: the fleet''s committee carried a decision, or sent it to a person, role pm, actor agent) or overturned (PRD 2896: a member overturned a decision the fleet carried, which stays as recorded, role supervisor, actor the member''s login).';
