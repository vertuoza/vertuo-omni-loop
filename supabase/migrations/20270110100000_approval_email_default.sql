-- Approval email is on by default (PRD 2608 s2, docs:
-- .omni-loop/delivery/inbox/2608-tech-approval/spec.md §4).
--
-- - alert_channels.email defaults to true: a row made without naming the switch has Email on. A row
--   already there is kept as it is, because the table cannot tell a person who chose off from one who
--   turned on phone alerts only. Phone alerts stay off by default.
-- - approval_recipients() and approval_void_recipients(): a person with no alert_channels row reads as
--   Email on and Phone alerts off, so they are emailed; a row with email off is never emailed.
--
-- Proven by supabase/checks/approval_requests.sql (no row, email off, email on).
--
-- Rollback: a follow-up migration sets the column default back to false and restores both functions
-- of supabase/migrations/20261125090000_approval_requests.sql and 20261126090000_approval_voiding.sql.
-- It does not unsend any email.

alter table public.alert_channels alter column email set default true;

comment on table public.alert_channels is
  'PRD 1322, PRD 2608: each person''s own alert switches, Phone alerts (Web Push to their subscribed devices, off by default) and Email (to their sign-in address, on by default; a person with no row reads as on). Read and written by that person only; the service role reads them to send.';

-- How each person a request asked is reached: [{user, email, devices: [{id, endpoint, p256dh, auth}]}],
-- `email` null when their Email switch is off (on when they have no row), `devices` empty unless Phone
-- alerts is on. For the server's service role only: it reads addresses no member reads.
create or replace function public.approval_recipients(p_request uuid) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'user', u.id,
           'email', case when coalesce(c.email, true) then au.email end,
           'devices', case when coalesce(c.push, false) then (
             select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)
                                       order by s.created_at, s.id), '[]'::jsonb)
               from public.push_subscriptions s where s.user_id = u.id) else '[]'::jsonb end)
         order by u.o), '[]'::jsonb)
    from public.approval_requests r
    cross join unnest(r.asked) with ordinality as u (id, o)
    left join public.alert_channels c on c.user_id = u.id
    left join auth.users au on au.id = u.id
   where r.id = p_request
$$;

-- How the approver a void voided is reached, in approval_recipients()'s shape: [] when they left the
-- workspace. For the server's service role only: it reads addresses no member reads.
create or replace function public.approval_void_recipients(p_void uuid) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'user', a.approved_by,
           'email', case when coalesce(c.email, true) then au.email end,
           'devices', case when coalesce(c.push, false) then (
             select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)
                                       order by s.created_at, s.id), '[]'::jsonb)
               from public.push_subscriptions s where s.user_id = a.approved_by) else '[]'::jsonb end)), '[]'::jsonb)
    from public.approval_voids x
    join public.approvals a on a.id = x.approval_id
    join public.dossiers d on d.id = x.dossier_id
    join public.workspace_members m on m.workspace_id = d.workspace_id and m.user_id = a.approved_by
    left join public.alert_channels c on c.user_id = a.approved_by
    left join auth.users au on au.id = a.approved_by
   where x.id = p_void
$$;
