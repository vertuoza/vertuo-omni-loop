---
id: s6-01-send-check-needs-key-keyed-app-read
prd: 2433
slice: s6
rank: human-action
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

Before a send from an API key that holds a GitHub App is queued, Omni must check that the App is installed on the repository, but the database can only hand over the App's sealed credentials once a job exists, so a person has to add a way to read them by key.

## The decision, in plain words

Everything that can be built here is built: the two refusals, the check against GitHub, and both answers in the API reference. Until the database can hand over a key's App, a send from a key that holds one fails plainly and nothing is queued, while keys without an App are not affected.

## The intro, for fun

The guard at the door is trained, tested and ready to check every ticket.

## The punchline, for fun

He just cannot read the guest list until someone prints it.

## What a person must do

In supabase/migrations/20261228090000_api_key_github_apps.sql (s1's, on the feature branch, not merged), right after api_key_github_app_of_job, add the key-keyed read the send check calls, and list it in the header comment beside the others:

```sql
create function public.api_key_github_app_of_key(p_key uuid) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('app', jsonb_build_object('app_id', g.app_id, 'slug', g.slug, 'ciphertext', g.ciphertext, 'iv', g.iv))
    from public.api_key_github_apps g where g.key_id = p_key
$$;

revoke execute on function public.api_key_github_app_of_key(uuid) from public, anon, authenticated;
grant execute on function public.api_key_github_app_of_key(uuid) to service_role;
```

It answers null for a key with no App, which the repository reads as no App. Then:

1. Add the function to the supabase check that lists the service-role-only functions, if there is one, and run `pnpm schemas:verify` against a database.
2. Merge the feature branch's migration change, then take the sub-PR of s6 out of draft (or ask the wave to).
3. Try it once against a throwaway key: attach an App that is not installed on a test repository and send a bug fix there; expect 422 github_app_not_installed and no job in the queue.

## What I had to decide

The spec has the two POST routes check the key's GitHub App installation before queuing. That needs the key's sealed private key at send time, to sign the App's own JWT for GET /repos/{owner}/{repo}/installation. S1's migration opens the sealed key only by job (api_key_github_app_of_job(p_job), service role), and the service role's column grant on api_key_github_apps is key_id alone. At send there is no job yet, so no existing call can read it. Changing the migration is outside this slice's territory (public-api.*, openapi.*, fixtures/), so it is a decision, not a fix I make.

Built, behind ports, so the one missing piece is one database function: the repository's githubAppOf(key) reads key_id first (a key with no App costs one read and no more), then calls api_key_github_app_of_key(p_key); the service takes an injected CheckInstallation and refuses with github_app_not_installed or github_app_permissions (both 422, message naming the repository or the permission) for bug-fixes on the job's repository and for mega-bug-fixes on the plan repository, after the allow-list and the plan-repository check, before anything is queued; public-api.installation.ts opens the sealed key under the master key and asks GitHub through keys/github-app.ts (appInstallation, missingPermission); public-api.live.ts wires it. ERROR_CODES, PUBLIC_API_ERRORS and the OpenAPI document list both codes. The s4 note holds: no token is minted at send, only the installation read, so mintToken's repository rule does not apply here; the repository is named in the installation path.

Until api_key_github_app_of_key exists, githubAppOf rejects for a key that holds an App, the controller answers 500 internal with the usual logged cause and nothing is queued. Failing closed is the only safe choice: queuing without the check would send a job that fails at claim.

## What I did meanwhile

Both routes keep working for every key without an App, as before. A key with an App cannot start a job on a deployment where the function is missing (500, logged, nothing queued) rather than queuing one the runner would fail. Tests cover the service rules, the controller's refusals and 500s, the repository's two calls, the GitHub adapter (JWT signed by the key's pair, 404 as not installed, the permission order, no master key, a wrong master key, a GitHub 500), and the reference. pnpm schemas:verify was not run here: it needs a database.

## What it costs to change later

Small. One function and its grant in s1's migration (still unmerged on the feature branch), after api_key_github_app_of_job. If its answer takes another shape, the repository's OpenedApp schema in public-api.repository.ts is the one place to follow it. Nothing else changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the function should live in s1's migration or in a new one dated after it (author)
- That the deployed service-role key can run the function: pnpm schemas:verify needs a database and could not run here (author)
- Whether GitHub's installation read at send adds acceptable latency to a send: one GitHub call per send, not measured (author)
