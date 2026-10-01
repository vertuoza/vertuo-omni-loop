-- Jev's Unknown worth asking (PRD 855 s4, docs: .omni-loop/delivery/inbox/0855-agent-connect/spec.md).
-- A fourth Jev decision, `unknown-worth-asking`, Off by default like the others: after an editor's agent
-- reported a new question (20261028100000_agent_questions.sql), Jev reads it, its repository and file and
-- the product's confirmed claims, and says whether a person should be asked. On, a "no" above the
-- confidence floor sets the question aside: it is folded under "Jev set aside N" on Settings › Business,
-- not counted in the bell, and any member brings it back. Shadow only logs Jev's answer (jev_calls); Off
-- never calls Jev.
--
--   jev_decision_names()                    gains `unknown-worth-asking`
--   agent_questions.set_aside_at            when Jev set the question aside, or null
--   agent_questions.brought_back_at         when a member brought it back: Jev never sets it aside again
--   agent_link_workspace(hash)              the link's own: the workspace a live link reports to, so galaxy
--                                           runs the Jev step only when that workspace has its Jev key
--   agent_question_for_jev(question)        the service role only: what Jev reads, and the workspace
--   agent_question_set_aside(question)      the service role only: Jev's "no", on an open question
--   agent_question_bring_back(workspace, question)   any member: a set-aside question open again
--   agent_questions_list(workspace)         now lists the set-aside questions too, each with `setAside`
--   agent_questions_open(workspace)         unchanged: open questions only, so set aside is out of the bell
--
-- Refusals: 42501 (not a member), P0002 (a question the workspace does not hold set aside).
-- Proven by supabase/checks/agent_questions.sql.
-- Rollback: a follow-up migration drops the two columns and the four functions, restores the list and
-- jev_decision_names(), and deletes the decision's jev_decisions rows; set-aside questions go back to open.

create or replace function public.jev_decision_names() returns text[]
language sql immutable
set search_path = ''
as $$
  select array['question-category', 'outbox-risk', 'bug-risk', 'unknown-worth-asking']
$$;

alter table public.agent_questions
  add column set_aside_at timestamptz,
  add column brought_back_at timestamptz;

-- The workspace a live link reports to (28000 otherwise), checked by the database as every link call is.
-- Galaxy runs the Jev step after a report only when this workspace has its Jev key set up (Settings › Jev)
-- and the decision is not Off; otherwise it reads nothing of the question and the question stays open.
create function public.agent_link_workspace(p_hash text) returns uuid
language sql stable
security definer
set search_path = ''
as $$
  select (public.agent_token_of(p_hash)).workspace_id
$$;

-- What Jev reads of a question (decision 13: after the report has answered): the question, its repository
-- and file, and the confirmed claims of its product (and the business's regions), as `<kind>#<seq>: value`.
-- Null when the question is gone. The service role only: galaxy runs Jev as it runs every Jev decision.
create function public.agent_question_for_jev(p_question uuid) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'id', q.id,
           'workspace', q.workspace_id,
           'question', q.question,
           'state', q.state,
           'repo', q.repo,
           'file', q.file,
           'claims', coalesce((
             select jsonb_agg(c.kind || '#' || c.seq || ': ' || c.value order by c.seq)
               from public.claims c
              where c.workspace_id = q.workspace_id and c.state = 'confirmed'
                and (c.product_id is null or c.product_id = public.agent_question_product(q, null))), '[]'::jsonb))
    from public.agent_questions q
   where q.id = p_question
$$;

-- Jev's "not worth asking", counted (On, at or above the floor): an open question is set aside. A question
-- answered, dismissed or brought back by a member meanwhile is left as it is. Answers `{id, state}`.
create function public.agent_question_set_aside(p_question uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.agent_questions;
begin
  update public.agent_questions x set state = 'set-aside', set_aside_at = now()
   where x.id = p_question and x.state = 'open' and x.brought_back_at is null
  returning * into q;
  if not found then
    select * into q from public.agent_questions x where x.id = p_question;
  end if;
  return jsonb_build_object('id', p_question, 'state', q.state);
end;
$$;

-- Bring back: a set-aside question is open again, counted in the bell, and Jev leaves it open from now on.
create function public.agent_question_bring_back(p_workspace uuid, p_question uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.business_member_only(p_workspace);
  update public.agent_questions x set state = 'open', set_aside_at = null, brought_back_at = now()
   where x.id = p_question and x.workspace_id = p_workspace and x.state = 'set-aside';
  if not found then
    raise exception 'Question: this workspace holds no such set-aside question.' using errcode = 'P0002', hint = 'question';
  end if;
  return jsonb_build_object('id', p_question);
end;
$$;

-- The workspace's open and set-aside questions, the latest asked first; `setAside` tells them apart.
create or replace function public.agent_questions_list(p_workspace uuid) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  perform public.business_member_only(p_workspace);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', q.id,
             'question', q.question,
             'asked', q.asked,
             'askedBy', t.name,
             'repo', q.repo,
             'file', q.file,
             'firstAskedAt', q.first_asked_at,
             'lastAskedAt', q.last_asked_at,
             'product', public.agent_question_product(q, null),
             'setAside', q.state = 'set-aside') order by q.last_asked_at desc, q.id)
      from public.agent_questions q join public.agent_tokens t on t.id = q.token_id
     where q.workspace_id = p_workspace and q.state in ('open', 'set-aside')), '[]'::jsonb);
end;
$$;

revoke execute on function public.agent_link_workspace(text) from public;
grant execute on function public.agent_link_workspace(text) to anon, authenticated;
revoke execute on function public.agent_question_for_jev(uuid) from public, anon, authenticated;
grant execute on function public.agent_question_for_jev(uuid) to service_role;
revoke execute on function public.agent_question_set_aside(uuid) from public, anon, authenticated;
grant execute on function public.agent_question_set_aside(uuid) to service_role;
revoke execute on function public.agent_question_bring_back(uuid, uuid) from public, anon;
grant execute on function public.agent_question_bring_back(uuid, uuid) to authenticated;
