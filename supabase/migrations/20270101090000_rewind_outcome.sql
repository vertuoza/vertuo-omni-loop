-- An approved rewind finding's outcome (PRD 2498 s1, docs: .omni-loop/delivery/inbox/2498-rewind-apply/spec.md):
-- what `/omni:rewind-apply` did with a finding a member approved, so the PRD page's Main tab shows it on the
-- card in place of the note that nothing is written.
--
-- - rewind_findings.outcome: `proposed` (a pull request proposes the rule), `already` (a rule already says
--   it) or `asks` (one question for a person); null until the skill records one.
-- - rewind_findings.outcome_pr: the pull request that proposes the rule, on a `proposed` outcome only.
-- - rewind_findings.outcome_note: the rule that already says it (`playbook/<form>#<slot>` or a register
--   entry's id, one line of at most 200 characters) on `already`, the question asked (2000 characters at
--   most) on `asks`; never on `proposed`.
--
--   rewind_finding_outcome(workspace, finding, outcome, pr, note)
--     the service role, or a signed-in member of the workspace (the `omni` command signs a runner in as
--     its kit token's maker), records the outcome of an approved finding, once.
--
-- Refusals: 42501 not the service role nor a member of the workspace, a finding not approved (`finding` in
-- its hint), or an outcome already recorded (`outcome` in its hint: an outcome is never rewritten,
-- BR-PRODUCT-12); P0002 no such finding in the workspace; 22023 an unknown outcome, a proposed rule without
-- its pull request or with a note, an already said or a question without its note or with a pull request,
-- or a note too long, the field in its hint.
--
-- The table keeps its row-level security and its grants: a member reads the columns with the row, and no
-- grant lets anyone insert or update them, the service role included; only the function writes them. An
-- outcome writes no event and no ledger row, and feeds nothing in the game (N-PRODUCT-16).
--
-- Proven by supabase/checks/rewind_outcome.sql.
--
-- Rollback: a follow-up migration drops rewind_finding_outcome(), then the columns outcome, outcome_pr and
-- outcome_note with their checks; nothing else reads them.

alter table public.rewind_findings
  add column outcome text
    constraint rewind_findings_outcome_check check (outcome in ('proposed', 'already', 'asks')),
  add column outcome_pr integer
    constraint rewind_findings_outcome_pr_check check (outcome_pr > 0),
  add column outcome_note text
    constraint rewind_findings_outcome_note_check check (char_length(outcome_note) between 1 and 2000),
  add constraint rewind_findings_outcome_approved check (outcome is null or state = 'approved'),
  add constraint rewind_findings_outcome_shape check (
    (outcome is null and outcome_pr is null and outcome_note is null)
    or (outcome = 'proposed' and outcome_pr is not null and outcome_note is null)
    or (outcome in ('already', 'asks') and outcome_pr is null and outcome_note is not null)
  );

comment on column public.rewind_findings.outcome is
  'PRD 2498: what /omni:rewind-apply did with the approved finding: proposed (a pull request proposes the rule), already (a rule already says it) or asks (one question). Null until recorded, then never rewritten.';
comment on column public.rewind_findings.outcome_pr is 'PRD 2498: the pull request that proposes the rule, on a proposed outcome only.';
comment on column public.rewind_findings.outcome_note is
  'PRD 2498: the rule that already says it, on already; the question asked, on asks. Never on proposed.';

-- The outcome of an approved finding of the workspace, recorded once by the service role or a member of
-- the workspace; the finding as it now stands.
create function public.rewind_finding_outcome(p_workspace uuid, p_finding uuid, p_outcome text, p_pr integer default null, p_note text default null)
returns public.rewind_findings
language plpgsql
security definer
set search_path = ''
as $$
declare
  note text := nullif(btrim(coalesce(p_note, '')), '');
  found_one public.rewind_findings;
  recorded public.rewind_findings;
begin
  if p_workspace is null or not (auth.role() is not distinct from 'service_role'
       or ((select auth.uid()) is not null and public.is_member(p_workspace))) then
    raise exception 'Only the Omni App or a member of the workspace records a rewind finding''s outcome.' using errcode = '42501';
  end if;

  if p_outcome is null or p_outcome not in ('proposed', 'already', 'asks') then
    raise exception 'Outcome: proposed, already or asks.' using errcode = '22023', hint = 'outcome';
  end if;
  if p_outcome = 'proposed' then
    if p_pr is null or p_pr <= 0 then
      raise exception 'Pull request: a proposed rule names the pull request that proposes it.' using errcode = '22023', hint = 'pr';
    end if;
    if note is not null then
      raise exception 'Note: a proposed rule takes its pull request, and no note.' using errcode = '22023', hint = 'note';
    end if;
  else
    if p_pr is not null then
      raise exception 'Pull request: only a proposed rule names one.' using errcode = '22023', hint = 'pr';
    end if;
    if note is null then
      raise exception 'Note: % names the rule that already says it, or the question asked.', p_outcome using errcode = '22023', hint = 'note';
    end if;
    if p_outcome = 'already' and (char_length(note) > 200 or note ~ '[\n\r]') then
      raise exception 'Note: the rule that already says it, one line of at most 200 characters.' using errcode = '22023', hint = 'note';
    end if;
    if char_length(note) > 2000 then
      raise exception 'Note: the question, 2000 characters at most.' using errcode = '22023', hint = 'note';
    end if;
  end if;

  select * into found_one from public.rewind_findings f
   where f.id = p_finding and f.workspace_id = p_workspace
   for update;
  if not found then
    raise exception 'Finding: no such finding in this workspace.' using errcode = 'P0002', hint = 'finding';
  end if;
  if found_one.state <> 'approved' then
    raise exception 'Finding: %, and only an approved finding has an outcome.', found_one.state using errcode = '42501', hint = 'finding';
  end if;
  if found_one.outcome is not null then
    raise exception 'Outcome: already %, and an outcome is never rewritten.', found_one.outcome using errcode = '42501', hint = 'outcome';
  end if;

  update public.rewind_findings f
     set outcome = p_outcome, outcome_pr = p_pr, outcome_note = note
   where f.id = found_one.id
  returning * into recorded;
  return recorded;
end;
$$;

comment on function public.rewind_finding_outcome(uuid, uuid, text, integer, text) is
  'PRD 2498: records, once, what /omni:rewind-apply did with an approved finding: proposed with its pull request, already with the rule, asks with the question. The service role or a member of the workspace; 42501 anyone else, a finding not approved or an outcome already recorded, P0002 no such finding, 22023 a value out of shape.';

-- ── Who may call it ──────────────────────────────────────────────────────────────

-- The Omni App as the service role, or a signed-in person (the function checks they are a member).
revoke execute on function public.rewind_finding_outcome(uuid, uuid, text, integer, text) from public, anon;
grant execute on function public.rewind_finding_outcome(uuid, uuid, text, integer, text) to authenticated, service_role;
