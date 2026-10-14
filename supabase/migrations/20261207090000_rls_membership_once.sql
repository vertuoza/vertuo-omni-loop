-- Membership is read once per statement, never once per row (bug #1832).
--
-- Every policy below called public.is_member() with a row's column (its own `workspace_id`, a parent's
-- through an EXISTS, or a workspace's own `id`), so a statement ran the function, and its lookup in
-- workspace_members, once for every row it read: a member counting a workspace's 10,323 ledger events
-- paid 351 ms and 20,928 buffer reads on production, against 7 ms and 186 when the person's workspaces
-- are read once. Each policy now reads them once, through public.my_workspaces(), whose answer does not
-- depend on the row, so Postgres evaluates it once per statement (a hashed subplan).
--
-- Who may read and write what does not change: each policy keeps its command, roles and every other
-- condition, and `x in (select public.my_workspaces())` holds exactly when public.is_member(x) does
-- (neither is ever negated here). supabase/checks/access.sql and the other checks prove the access;
-- supabase/checks/rls_membership_once.sql proves no policy calls is_member() again.
--
-- The bodies were generated from the migrated database's own pg_policy, read with an empty
-- search_path so every name is schema-qualified, with each is_member(x) replaced and nothing else.
-- public.is_member() stays: functions still call it once per call.
--
-- Rollback: a migration that sets each policy's body back to is_member(x), from the texts before
-- this one, and drops public.my_workspaces().

-- ── The person's workspaces, read once ─────────────────────────────────────────────
create function public.my_workspaces() returns setof uuid
language sql stable
security definer
set search_path = ''
as $$
  select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid())
$$;

-- The same grants as public.is_member(): the signed-in person and the service role only.
revoke all on function public.my_workspaces() from public;
grant execute on function public.my_workspaces() to authenticated, service_role;

-- ── The policies ─────────────────────────────────────────────────────────────────────

alter policy "a member reads their workspace's approval requests" on public."approval_requests"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads the voids of their workspace's dossiers" on public."approval_voids"
  using ((EXISTS ( SELECT 1
   FROM public.dossiers d
  WHERE ((d.id = approval_voids.dossier_id) AND (d.workspace_id in (select public.my_workspaces()))))));

alter policy "a member reads the approvals of their workspace's dossiers" on public."approvals"
  using ((EXISTS ( SELECT 1
   FROM public.dossiers d
  WHERE ((d.id = approvals.dossier_id) AND (d.workspace_id in (select public.my_workspaces()))))));

alter policy "a member reads their workspace's scores" on public."arcade_scores"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads the ask rounds of their workspace" on public."ask_rounds"
  using ((EXISTS ( SELECT 1
   FROM public.ask_sessions s
  WHERE ((s.id = ask_rounds.session_id) AND (s.workspace_id in (select public.my_workspaces()))))));

alter policy "a member reads the ask sessions of their workspace" on public."ask_sessions"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a person keeps and closes their own ask sessions" on public."ask_sessions"
  using (((owner = ( SELECT auth.uid() AS uid)) AND (workspace_id in (select public.my_workspaces()))))
  with check ((owner = ( SELECT auth.uid() AS uid)));

alter policy "a person opens ask sessions as themself" on public."ask_sessions"
  with check (((owner = ( SELECT auth.uid() AS uid)) AND (workspace_id IS NOT NULL) AND (workspace_id in (select public.my_workspaces()))));

alter policy "a member reads the shares of their workspace's rounds" on public."ask_shares"
  using (((shared_with = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM (public.ask_rounds r
     JOIN public.ask_sessions s ON ((s.id = r.session_id)))
  WHERE ((r.id = ask_shares.round_id) AND (s.workspace_id in (select public.my_workspaces())))))));

alter policy "a member reads their workspace's drafts" on public."business_drafts"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's web pages" on public."business_sources"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's business" on public."businesses"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's citations" on public."claim_citations"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's receipts" on public."claim_receipts"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's claims" on public."claims"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's constituent history" on public."constituent_events"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's constituents" on public."constituents"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's contributions" on public."contributions"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's GitHub snapshots" on public."dossier_github"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads the versions of their workspace's dossiers" on public."dossier_versions"
  using ((EXISTS ( SELECT 1
   FROM public.dossiers d
  WHERE ((d.id = dossier_versions.dossier_id) AND (d.workspace_id in (select public.my_workspaces()))))));

alter policy "a member reads the dossiers of their workspace" on public."dossiers"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "the opener deletes their own draft" on public."dossiers"
  using (((opened_by = ( SELECT auth.uid() AS uid)) AND (prd IS NULL) AND (product_seq IS NULL) AND (workspace_id in (select public.my_workspaces()))));

alter policy "a member reads their workspace's fix facts" on public."fix_facts"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member adds an idea to their workspace's board" on public."ideas"
  with check (((workspace_id in (select public.my_workspaces())) AND (added_by = ( SELECT auth.uid() AS uid))));

alter policy "a member changes their workspace's ideas" on public."ideas"
  using ((workspace_id in (select public.my_workspaces())))
  with check ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's ideas" on public."ideas"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's Jev calls" on public."jev_calls"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's Jev decisions" on public."jev_decisions"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's ledger" on public."ledger_events"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's loop plans" on public."loop_plans"
  using ((EXISTS ( SELECT 1
   FROM public.loops l
  WHERE ((l.id = loop_plans.loop_id) AND (l.workspace_id in (select public.my_workspaces()))))));

alter policy "a member reads their workspace's loop ticks" on public."loop_ticks"
  using ((EXISTS ( SELECT 1
   FROM public.loops l
  WHERE ((l.id = loop_ticks.loop_id) AND (l.workspace_id in (select public.my_workspaces()))))));

alter policy "a member reads their workspace's loops" on public."loops"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads the outbox items of their workspace's PRDs" on public."outbox_items"
  using ((EXISTS ( SELECT 1
   FROM public.dossiers d
  WHERE ((d.id = outbox_items.dossier_id) AND (d.workspace_id in (select public.my_workspaces()))))));

alter policy "a member sends on their workspace's dossiers, as themselves" on public."outbox_sends"
  with check (((owner = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.dossiers d
  WHERE ((d.id = outbox_sends.dossier_id) AND (d.workspace_id in (select public.my_workspaces())))))));

alter policy "a member reads the settlements of their workspace's PRDs" on public."outbox_settlements"
  using ((EXISTS ( SELECT 1
   FROM (public.outbox_items i
     JOIN public.dossiers d ON ((d.id = i.dossier_id)))
  WHERE ((i.id = outbox_settlements.item_id) AND (d.workspace_id in (select public.my_workspaces()))))));

alter policy "a member reads their workspace's personas" on public."personas"
  using (((workspace_id in (select public.my_workspaces())) AND (deleted_at IS NULL)));

alter policy "a member reads the pitch runs of their workspace's dossiers" on public."pitch_runs"
  using ((EXISTS ( SELECT 1
   FROM public.dossiers d
  WHERE ((d.id = pitch_runs.dossier_id) AND (d.workspace_id in (select public.my_workspaces()))))));

alter policy "a member reads their workspace's XP" on public."player_xp"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member joins as themself, with GitHub linked" on public."players"
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND (workspace_id in (select public.my_workspaces())) AND (EXISTS ( SELECT 1
   FROM public.my_github() my_github(github_id, github_login)))));

alter policy "a member reads their workspace's players" on public."players"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a player edits only themself" on public."players"
  using (((user_id = ( SELECT auth.uid() AS uid)) AND (workspace_id in (select public.my_workspaces()))))
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND (workspace_id in (select public.my_workspaces()))));

alter policy "a member reads their workspace's outboxes" on public."prd_outbox"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's stages" on public."prd_stages"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's topics" on public."prd_topics"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's approvers" on public."product_approvers"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's product links" on public."product_repositories"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's products" on public."products"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads the proof runs of their workspace's dossiers" on public."proof_runs"
  using ((EXISTS ( SELECT 1
   FROM public.dossiers d
  WHERE ((d.id = proof_runs.dossier_id) AND (d.workspace_id in (select public.my_workspaces()))))));

alter policy "a member reads their workspace's reviews" on public."pull_request_reviews"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's pull requests" on public."pull_requests"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's repositories" on public."repositories"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's roadmap human work" on public."roadmap_human_work"
  using ((EXISTS ( SELECT 1
   FROM public.roadmaps r
  WHERE ((r.id = roadmap_human_work.roadmap_id) AND (r.workspace_id in (select public.my_workspaces()))))));

alter policy "a member reads their workspace's roadmap PRDs" on public."roadmap_prds"
  using ((EXISTS ( SELECT 1
   FROM public.roadmaps r
  WHERE ((r.id = roadmap_prds.roadmap_id) AND (r.workspace_id in (select public.my_workspaces()))))));

alter policy "a member reads their workspace's roadmap prerequisites" on public."roadmap_prerequisites"
  using ((EXISTS ( SELECT 1
   FROM public.roadmaps r
  WHERE ((r.id = roadmap_prerequisites.roadmap_id) AND (r.workspace_id in (select public.my_workspaces()))))));

alter policy "a member reads their workspace's roadmaps" on public."roadmaps"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's sectors" on public."sectors"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's fleets" on public."teams"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace's working pings" on public."working_pings"
  using ((workspace_id in (select public.my_workspaces())));

alter policy "a member reads their workspace" on public."workspaces"
  using ((id in (select public.my_workspaces())));
