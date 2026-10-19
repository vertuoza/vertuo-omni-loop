# Bug 2165: the Runners page shows no runner at all

## Triage

- **Domain:** runners — the Runners page's board read (`apps/galaxy/src/runners/runners.repository.ts`, PRD 1830), meeting the API keys' table (PRD 2022)
- **Risk:** high — every member of a workspace whose recent runner jobs include one sent by an API key loses the whole Runners page (no runners, no jobs, no send); no workaround in the app.
- **Regression:** yes — #2023 made the board read key names straight from `agent_tokens`, whose privileges `20261028090000_agent_tokens.sql` revokes from `service_role`; production logs `the page could not be read (agent_tokens: permission denied for table agent_tokens)` once a job sent by an API key exists.

## Reproduction

- **File:** `apps/galaxy/src/runners/runners.grants.test.ts`
- **Red:** `× reads with from() only tables the service role may read` — expected `[]`, received `["agent_tokens"]`

## Fix

The board names a job an API key sent by the key's name, and read those names with `from('agent_tokens')` as the service role, which the table shuts out: the whole page read failed. A new definer function, `api_key_names(workspace, keys)`, only the service role runs, answers the workspace's API keys' names, and the runners' storage calls it instead (`supabase/migrations/20261213090000_api_key_names.sql`, proven in `supabase/checks/api_keys.sql`).

## Guard

`runners.grants.test.ts` reads the migrations in order and fails when the runners' storage reads, with `from()`, a table the service role was revoked from and not granted `select` since; it would have failed on #2023.

## Mutation

mutation: no changed core file against origin/main (56df4880): nothing to mutate
