---
title: API
description: Make an API key, read your workspace's PRDs and bug fixes with curl, start a bug fix and follow its job, page with the cursor, and read the errors. The full reference is below.
---

A program outside the loop can read a workspace's PRDs and bug fixes, and start a bug fix, with an
**API key**. This page says how to make a key, what each route answers, how to page through a list, and what the errors
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
the pull request the job opens says it was sent by the key. The job still ends in a pull request a
person merges: a key never merges anything.

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
| 422 | `invalid_request` | a query or body the contract refuses, or a bad cursor; the message names the field |
| 500 | `internal` | anything else; the message never carries a stack or a database error |

## Reference

[Next → Getting started](/docs)
