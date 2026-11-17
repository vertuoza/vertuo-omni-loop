-- Any member of the workspace requests a ◆ PRD's Tech Approval, not only its author (bug #2992).
--
-- dossier_request_tech_approval(dossier, login) drops one refusal: `Only the author of PRD #<n> requests its
-- Tech Approval.` Everything else stands: a non-member, a ◇ PRD, a product PRD, a roadmap and an approved PRD
-- are refused; the request is made once, nobody withdraws it, and only a workspace owner names another
-- person once the named one left; the author never gives it, so nobody may name the author. The request's
-- author is still whoever opened the PRD (BR-PRODUCT-103), and `asked_by` records who asked.
--
-- Proven by supabase/checks/tech_approval.sql.
--
-- Rollback: a follow-up migration restores the function of 20270110093000_tech_approval.sql. Requests a
-- member who is not the author made stay as they are.

create or replace function public.dossier_request_tech_approval(p_dossier uuid, p_login text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller  uuid := (select auth.uid());
  target  public.dossiers%rowtype;
  wanted  text := lower(btrim(ltrim(btrim(coalesce(p_login, '')), '@')));
  author  uuid;
  named   uuid;
  earlier public.approval_requests%rowtype;
  renamed boolean := false;
  made    public.approval_requests%rowtype;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select d.* into target from public.dossiers d where d.id = p_dossier for update;
  if not found then
    raise exception 'No such dossier.' using errcode = 'P0002';
  end if;
  if not public.is_member(target.workspace_id) then
    raise exception 'Only a member of the workspace that owns % requests a Tech Approval of its PRDs.', coalesce(target.home_repo, 'this PRD')
      using errcode = '42501';
  end if;
  if target.kind = 'roadmap' then
    raise exception 'A roadmap takes no Tech Approval: only a PRD of one repository does.' using errcode = '22023';
  end if;
  if target.kind <> 'prd' or target.home_repo is null or target.product_seq is not null then
    raise exception 'Only a PRD of one repository takes a Tech Approval: a product PRD does not.' using errcode = '22023';
  end if;
  if target.prd is null then
    raise exception 'Only a numbered PRD takes a Tech Approval: number it with its first push.' using errcode = '22023';
  end if;
  if target.birthplace is distinct from 'server' then
    raise exception 'PRD #% was born in the repository: its phase-0 pull request approves it, with no Tech Approval.', target.prd
      using errcode = '22023';
  end if;
  author := coalesce(target.opened_by, caller);

  select r.* into earlier from public.approval_requests r
   where r.dossier_id = target.id and r.approval_kind = 'tech'
   order by r.asked_at desc, r.id desc
   limit 1;
  if earlier.id is not null then
    if exists (select 1 from public.workspace_members m
                where m.workspace_id = target.workspace_id and m.user_id = earlier.asked[1]) then
      raise exception 'PRD #% already waits for %''s Tech Approval: nobody withdraws it or names another person.',
        target.prd, public.member_login(target.workspace_id, earlier.asked[1]) using errcode = '22023';
    end if;
    if not public.is_owner(target.workspace_id) then
      if caller = author then
        raise exception 'PRD #%''s Tech Approval named %, who left the workspace: only a workspace owner names another person.',
          target.prd, public.member_login(target.workspace_id, earlier.asked[1]) using errcode = '22023';
      end if;
      raise exception 'Only a workspace owner names another person for PRD #%''s Tech Approval.', target.prd using errcode = '42501';
    end if;
    if (public.tech_approval_state(target.id) ->> 'state') = 'approved' then
      raise exception 'PRD #%''s Tech Approval is already given.', target.prd using errcode = '22023';
    end if;
    renamed := true;
  end if;
  if (public.approval_in_force(target.id, 'product')).id is not null then
    raise exception 'PRD #% is approved: a Tech Approval is requested before the PRD is approved.', target.prd using errcode = '22023';
  end if;

  if wanted = '' then
    raise exception 'Name the member who gives the Tech Approval, by their login.' using errcode = '22023';
  end if;
  select m.user_id into named
    from public.workspace_members m
   where m.workspace_id = target.workspace_id and public.member_login(target.workspace_id, m.user_id) = wanted
   order by m.joined_at, m.user_id
   limit 1;
  if named is null then
    raise exception 'No member of this workspace is %: name a member by their login.', wanted using errcode = '22023';
  end if;
  if named = author then
    raise exception 'The author of PRD #% never gives its Tech Approval: name another member.', target.prd using errcode = '22023';
  end if;

  insert into public.approval_requests (dossier_id, workspace_id, product_id, asked_by, asked, nobody_else, kind, approval_kind)
  values (target.id, target.workspace_id, target.product_id, caller, array[named], false,
          case when renamed then 're-asked' else 'asked' end, 'tech')
  returning * into made;

  return jsonb_build_object(
    'id', made.id,
    'dossier', target.id,
    'repo', target.home_repo,
    'prd', target.prd,
    'title', target.title,
    'kind', made.kind,
    'approvalKind', made.approval_kind,
    'askedAt', made.asked_at,
    'author', public.member_login(target.workspace_id, author),
    'asked', (
      select jsonb_build_array(jsonb_build_object(
               'user', named,
               'login', public.member_login(target.workspace_id, named),
               'name', nullif(btrim(pl.display_name), '')))
        from (select 1) one
        left join public.players pl on pl.workspace_id = target.workspace_id and pl.user_id = named));
end;
$$;
