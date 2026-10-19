-- The names of a workspace's API keys, for the Runners page (issue 2165). A job an API key sent reads
-- as sent by `API key <name>` (PRD 2022 s4), and the runners' storage read those names straight from
-- agent_tokens as the service role, which 20261028090000_agent_tokens.sql shuts out of the table: the
-- whole board failed, `permission denied for table agent_tokens`, once one such job existed. The table
-- stays shut; the names come through a definer function only the service role runs, as api_key_of().
--
--   api_key_names(workspace, keys)   the service role: { "<key id>": "<name>" } for the workspace's API
--                                    keys among `keys`, revoked ones included (a job keeps naming the
--                                    key that sent it); never a business link nor a kit token
--
-- Rollback: `drop function public.api_key_names(uuid, uuid[]);` — the board then fails again on a key's job.

create function public.api_key_names(p_workspace uuid, p_keys uuid[]) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(t.id, t.name), '{}'::jsonb)
    from public.agent_tokens t
   where t.workspace_id = p_workspace and t.scope = 'api' and t.id = any(p_keys);
$$;

revoke execute on function public.api_key_names(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.api_key_names(uuid, uuid[]) to service_role;
