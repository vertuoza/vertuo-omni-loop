-- A person drops a PRD from its mission's branch (PRD 2896 s7, docs: .omni-loop/delivery/inbox/2896-fleet-alone/spec.md, criterion 11).
-- It runs after 20270123110000_mission_joins.sql, which last set the kinds of a mission event.
--
-- - mission_events.kind takes three more kinds:
--     drop-asked        a member ran `omni mission drop <mission> <prd>`: the PRD's commit leaves the branch on the mission's next run,
--                       and the later PRDs that share its territory go with it. Written by the service role, signed with the member's login.
--     drop-asked-keep   the same with `--keep`: only that PRD leaves.
--     prd-dropped       the App removed the PRD's commit from the branch by rebase and reopened its feature pull request, role supervisor,
--                       actor agent, linking the reopened pull request. A PRD is dropped until a person sends it again.
--   A mission's PRDs on its branch are read back from these events and the joins', in order.
--
-- Every statement can run twice. Nobody's grants change: a member still reads the events, and only the service role writes them.
-- Proven by supabase/checks/missions.sql.
-- Rollback: the kinds are additive, and an event is never deleted: once one of them is recorded it stays in the list.
-- Reverting the App's code stops new drops; the kinds of 20270123110000_mission_joins.sql come back only while none is recorded.

alter table public.mission_events drop constraint if exists mission_events_kind_check;
alter table public.mission_events add constraint mission_events_kind_check check (kind in (
  'started', 'paused', 'resumed', 'dispatched', 'job-ended', 'waits', 'prd-ready',
  'prd-merged', 'held', 'stopped', 'delivered', 'reviewed', 'prd-joined',
  'drop-asked', 'drop-asked-keep', 'prd-dropped'));

comment on column public.mission_events.kind is
  'What happened: started, paused, resumed, dispatched, job-ended, waits, prd-ready, prd-merged, held, stopped or delivered (PRD 2842), reviewed (PRD 2871: a verdict of the Reviewer, role reviewer, actor agent, linking its review), prd-joined (PRD 2896: the App squash-merged a PRD''s feature pull request into the mission branch, role supervisor, actor agent, linking the pull request), drop-asked or drop-asked-keep (PRD 2896: a member asked for a PRD to leave the branch, with or without the later PRDs sharing its territory, actor the member''s login) or prd-dropped (PRD 2896: the App removed the PRD''s commit from the branch and reopened its feature pull request, role supervisor, actor agent, linking it).';
