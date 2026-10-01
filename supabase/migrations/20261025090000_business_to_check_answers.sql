-- The customer voice, the count to check (PRD 822, docs: .omni-loop/delivery/inbox/0822-customer-voice/spec.md).
-- An overrule a person saved as a claim (claim_answer(), source `answer`, state `proposed`) waits for a
-- member on Settings › Business, and the bell's "Business · N to check" counts it there:
--
--   business_to_check(workspace)   as 20261021090000_business_evidence.sql, counting each proposed `answer`
--                                  claim beside each proposed `evidence` claim and each faded claim
--
-- Its grants are kept: `create or replace` leaves them as 20261021090000_business_evidence.sql set them.
--
-- Proven by supabase/checks/business.sql.
-- Rollback: a follow-up migration restores business_to_check() from 20261021090000_business_evidence.sql.

create or replace function public.business_to_check(p_workspace uuid) returns integer
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  perform public.business_member_only(p_workspace);
  return (
    select count(*)::integer from public.claims c
     where c.workspace_id = p_workspace
       and ((c.state = 'proposed' and c.source in ('evidence', 'answer'))
            or (c.state = 'confirmed' and c.last_seen < now() - interval '8 weeks'
                and exists (select 1 from public.claim_receipts x where x.claim_id = c.id))));
end;
$$;
