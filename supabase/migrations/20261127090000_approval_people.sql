-- PRD 1322: the people a PRD's approval history names (its author, who asked and who is asked), each
-- with the login member_login() gives them, so the approval stream names a person exactly as the
-- request route does. Read as the caller: only a member of the dossier's workspace gets rows.
--
-- Rollback: a follow-up migration drops approval_people(). Only the approval stream reads it.

create function public.approval_people(p_dossier uuid) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'user', u.id,
           'login', public.member_login(d.workspace_id, u.id),
           'name', nullif(btrim(pl.display_name), ''))), '[]'::jsonb)
    from public.dossiers d
    cross join lateral (
      select distinct x as id
        from unnest(array[d.opened_by] || coalesce((
               select array_agg(y)
                 from public.approval_requests r, unnest(r.asked || r.asked_by) y
                where r.dossier_id = d.id), '{}'::uuid[])) x
       where x is not null) u
    left join public.players pl on pl.workspace_id = d.workspace_id and pl.user_id = u.id
   where d.id = p_dossier and public.is_member(d.workspace_id);
$$;

comment on function public.approval_people(uuid) is
  'PRD 1322: the people a dossier''s approval history names, with member_login(), for a member of its workspace.';

revoke execute on function public.approval_people(uuid) from public, anon;
grant execute on function public.approval_people(uuid) to authenticated;
