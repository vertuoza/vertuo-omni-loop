---
title: API
description: Make an API key, read your workspace's PRDs and bug fixes with curl, start a bug fix in one repository or across a plan repository's targets and follow its job, run the jobs as your own GitHub App, page with the cursor, and read the errors. The full reference is below.
---

A program outside the loop can read a workspace's PRDs and bug fixes, and start a bug fix, in one
repository or across a plan repository's targets, with an **API key**. This page says how to make a key, what each route answers, how to page through a list, and what the errors
mean. The reference under it, rendered from the same schemas the routes validate with, lists every
route with its parameters, responses and examples. The document itself is
[`/api/v1/openapi.json`](/api/v1/openapi.json), and it needs no key.

## Make a key

Only a workspace owner makes or revokes a key.

1. Open **Settings › API keys** in the Omni app (`/app/settings/api-keys`).
2. Choose **New key**, give it a name, and leave **All repositories** on, or pick the repositories
   it may read. That list is the key's allow-list.
3. Copy the secret. It starts with `oma_`, it is shown once, and the page shows it afterwards only as
   `oma_…<last four>`.

A key stops working when an owner revokes it, or when the person who made it leaves the workspace.
Keep it out of your repository: send it as a header, as below.

## Read the PRDs

```bash terminal
curl -H "Authorization: Bearer $OMNI_API_KEY" "https://www.omni-loop.xyz/api/v1/prds?limit=20"
```

It answers `{"data": [...], "next_cursor": "..."}`, the workspace's PRDs newest first. A PRD has
`id`, `ref` (`"42"`, or `"mobile-3"` for a product PRD), `number`, `title`, `repo` (`null` for a
product PRD), `product` (`{key, name}` or `null`), `stage`, `created_at` and `links` (`page` and
`issue`, which is `null` when it has no GitHub issue).

## Read the bug fixes

```bash terminal
curl -H "Authorization: Bearer $OMNI_API_KEY" "https://www.omni-loop.xyz/api/v1/bug-fixes?limit=20"
```

A bug fix answers `id`, `number`, `title`, `repo`, `created_at` and `links`. A key limited to some
repositories lists only theirs.

## Start a bug fix

```bash terminal
curl -X POST -H "Authorization: Bearer $OMNI_API_KEY" -H "Content-Type: application/json" \
  -d '{"repo": "acme/backend", "description": "Issue 548 the invoice total is off by a cent"}' \
  "https://www.omni-loop.xyz/api/v1/bug-fixes"
```

It answers `202` with the queued job, and the job runs `/omni:bug-fix <description>` on one of the
workspace's runners. The `repo` must be one of the workspace's, and on the key's allow-list when it
has one, or it answers 403. The `description` is 1 to 186 characters of letters, digits, spaces and
`. _ / : # -`, the same line check the runners apply to a person's job: 186 characters after
`/omni:bug-fix ` make the 200 characters a runner's line holds at most. A longer description, or any
other character, answers 422 and nothing is queued. Add `runner` (a runner's name) or `fleet` (a
fleet's key) to choose where it runs; with neither, any runner of the workspace may take it.

The Runners page shows the job as sent by `API key <name>`, with `made by @<login>` under it, and
the pull request the job opens says it was sent by the key:
`Sent through the Omni API by API key <name> on runner <runner>`, with no login in it. The job still
ends in a pull request a person merges: a key never merges anything. Unless you
[run as your own GitHub App](#run-as-your-own-github-app), the job writes on GitHub as the account
of the person who set the runner up.

## Start a bug fix across repositories

```bash terminal
curl -X POST -H "Authorization: Bearer $OMNI_API_KEY" -H "Content-Type: application/json" \
  -d '{"repo": "acme/plan", "description": "https://github.com/acme/plan/issues/612"}' \
  "https://www.omni-loop.xyz/api/v1/mega-bug-fixes"
```

It answers `202` with the queued job, and the job runs `/omni:mega-bug-fix <description>` in a
[plan repository](/docs/several-repositories), for a bug that shows in one of its targets while its
cause may sit in another. The skill finds where the cause is among the plan's targets, opens one fix
pull request per target that must change, in merge order, then a record pull request in the plan
repository that closes the issue. The job's `pr_url` is that record pull request, and its body names
each target pull request on a `Merge after` line. A person merges every one, the record last.

- The `repo` is a plan repository of the workspace, one a product names as its plan repository, and
  on the key's allow-list when it has one: off the list answers 403, and a repository no product of
  the workspace names as its plan repository answers 422, one outside the workspace included. A
  workspace owner names it on the product's **Repositories & approvers** tab, under **Plan
  repository**. A runner that holds a checkout of it runs the job.
- The `description` is the bug's issue in the plan repository (its URL, `#612` or `612`), or what is
  wrong: 1 to 181 characters, under the same line check, and no word starting with `--`.
- The body takes `repo`, `description`, `runner` and `fleet`, and nothing else: any other field
  answers 422, naming it.

This route is newer than the others. A deployment without it answers `404` with an HTML page, not
the error shape; the route itself never answers 404, so a program may read a 404 as "not deployed
here yet".

## Run as your own GitHub App

A job a key starts writes on GitHub as the account of the person who set the runner up
([Runners](/docs/runners)), so a person appears on the issue, the branch, the commits and the pull
request. Attach a **GitHub App** of your own to the key and every job it sends is visibly your app's
instead: the bug's issue, its comments and labels, the branch, the commits (author and committer),
the pull request and its status comment, and the release of the job's claims are all written by the
app's bot, `<slug>[bot]`. The job names no person, adds no assignee, requests no reviewer and
mentions no `@login`. A key with no app works as above.

1. **Create the app.** On GitHub, create a GitHub App (in your account's or your organization's
   Settings › Developer settings › GitHub Apps › New GitHub App) with these repository permissions,
   and no other:
   - **Contents:** Read and write;
   - **Pull requests:** Read and write;
   - **Issues:** Read and write.

   GitHub adds **Metadata:** Read-only itself. Note the **App ID** on the app's page, and generate
   a key for the app there: GitHub downloads it as a `.pem` file.
2. **Install it** on the repositories the key's jobs work in, with those permissions. A bug fix needs
   it on the job's repository. A mega bug fix needs it on the plan repository, and on each
   repository of the plan repository's product that a fix may change.
3. **Attach it to the key.** A workspace owner opens **Settings › API keys**, chooses **Attach a
   GitHub App** on the key's row, gives the **App ID** and the app's `.pem` key file, and presses
   **Attach**.
   - Omni checks the pair, the App ID and the key, with GitHub before it keeps anything. A pair
     GitHub refuses is refused on the form and nothing is stored. On a deployment with no master
     key, attaching is refused too, and the form says it isn't available on this deployment.
   - Omni keeps the key sealed and never shows it again, to anyone. Every member then reads the
     app's slug in the key's **GitHub App** column, and an owner also reads under it
     `last token <date>`, or `no token yet`: when the app last made a token for a job.
   - **Replace** attaches another pair the same way. **Remove**, then **Remove for good**, deletes
     the app; revoking the key deletes it too. Only an owner does any of these.

Nothing changes in the calls you send. Two checks run before a job is queued, and each refuses it
with a 422 and queues nothing:

- `github_app_not_installed`: the app is not installed on the repository; the message names the
  repository.
- `github_app_permissions`: the app's installation on the repository lacks write access to
  `contents`, `pull_requests` or `issues`; the message names the permission.

For a mega bug fix the repository checked is the plan repository, since its targets are only chosen
while the job runs. Install the app on those targets too: a target the app does not hold fails its
push, and the whole fix stops, as it does whenever a target cannot be pushed to.

### What the job gets

When a runner takes the job, Omni makes a token for it from the app, and the job writes with that
token and nothing else:

- it lasts an hour, and the runner refreshes it before it ends, so a job that runs longer keeps
  writing as the app;
- it covers the job's repository. For a mega bug fix it covers the plan repository and every
  repository its product names that the app's installation holds, each within the key's allow-list;
- it holds `contents`, `pull_requests` and `issues` write and `metadata` read, nothing more. A fix
  that changes a workflow file therefore fails to push, as any push that fails does;
- the runner replaces it with `***` in every line, log tail and report it sends to Omni.

A job never runs as a person: when its token cannot be made, it ends `failed` with a reason that
starts `github app:`, and no runner runs it under its own account. That covers an app removed or
uninstalled, a pair GitHub now refuses, a key revoked or whose maker left the workspace, and a master
key Omni lost. A job queued while an app was attached keeps needing one: removing the app does not
send it as a person. A refresh that keeps failing until the token ends fails the job the same way.

Two things stay with the repository, outside the job. A `CODEOWNERS` file still makes GitHub request
its owners' review on the pull request. The job asks for no reviewer itself, not even one the
repository's playbook names. And only a runner on a recent enough kit takes such a job: see
[Runners](/docs/runners#a-job-of-a-key-with-a-github-app).

## Follow a job

```bash terminal
curl -H "Authorization: Bearer $OMNI_API_KEY" "https://www.omni-loop.xyz/api/v1/jobs/<job id>"
```

It answers the job's `status` (`queued`, `claimed`, `running`, then `done`, `failed` or
`cancelled`), the `runner` that took it, `pr_url`, `exit_code`, `reason` and its times
(`queued_at`, `claimed_at`, `running_at`, `ended_at`). Poll it until the status is `done`, `failed`
or `cancelled`; `pr_url` is the pull request when it opened one. A job another workspace queued, or
a person queued, answers 404.

## Page with the cursor

A list answers at most `limit` rows (1 to 100, 50 when you send none) and a `next_cursor`. Send it
back as `cursor` to read the next page; it is `null` on the last page. A page never repeats or skips
a row, even when rows are added while you page.

```bash terminal
curl -H "Authorization: Bearer $OMNI_API_KEY" "https://www.omni-loop.xyz/api/v1/prds?limit=50&cursor=<next_cursor>"
```

The cursor is opaque: send it back unchanged. One that was altered answers 422.

## Errors

Every refusal answers one shape, `{"error": {"code": "…", "message": "…"}}`.

| status | code | when |
|---|---|---|
| 401 | `unauthorized` | no key, an unknown key, a revoked key, or a key whose maker left the workspace |
| 403 | `forbidden` | a repository outside the workspace or outside the key's allow-list |
| 404 | `not_found` | a job that does not exist or that no key of this workspace queued |
| 422 | `invalid_request` | a query or body the contract refuses, a bad cursor, or a repository that is not a plan repository; the message names the field |
| 422 | `github_app_not_installed` | the key has a GitHub App and it is not installed on the repository; the message names the repository, and nothing is queued |
| 422 | `github_app_permissions` | the key has a GitHub App whose installation on the repository lacks write access to `contents`, `pull_requests` or `issues`; the message names the permission, and nothing is queued |
| 500 | `internal` | anything else; the message never carries a stack or a database error |

## Reference

[Next → Getting started](/docs)
