-- Vertuoza's real sectors: the repositories where Omni Loop PRDs run today. The workspaces migration
-- (20260926120000) left the sectors empty on purpose; the game records history for good, so it stays
-- off (GAME_ENABLED) until the sectors name the real repositories. Add a sector, or a repository to
-- one, with a migration of its own.
--
-- The fleets keep no home sector (home stays null): a player may give theirs one later.
--
-- The plan repository was renamed vertuo-omni-plan → vertuo-omni-loop; name it as it is now rather
-- than lean on GitHub's rename redirect.

insert into public.sectors (workspace_id, name, repos)
select w.id, s.name, s.repos
  from public.workspaces w,
       (values
         ('omni-core', array['vertuo-omni-loop']::text[]),
         ('ai-nebula', array['vertuo-ai-domain']::text[]),
         ('flow-rim',  array['vertuo-workflow-domain']::text[])
       ) as s (name, repos)
 where w.slug = 'vertuoza';

update public.workspaces set plan_repo = 'vertuo-omni-loop' where slug = 'vertuoza';
