---
title: API
description: Make an API key, read your workspace's PRDs and bug fixes with curl, start a bug fix in one repository or across a plan repository's targets, follow its job end to end (what it did, its lines, its questions, its thread), answer, dismiss, cancel or relaunch it, get pinged when it changes, run the jobs as your own GitHub App, page with the cursor, and read the errors. The full reference is below.
---

A program outside the loop can read a workspace's PRDs and bug fixes, and start a bug fix, in one
repository or across a plan repository's targets, with an **API key**. It can then run that job end
to end without anyone opening the Omni page: read what the job did, its lines and its questions,
answer or dismiss the questions, cancel or relaunch the job, and be pinged when it changes. This
page says how to make a key, what each route answers, how to page through a list, and what the
errors mean. The reference under it, rendered from the same schemas the routes validate with, lists
every route with its parameters, responses and examples. The document itself is
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
fleet's key) to choose where it runs; with neither, any runner of the workspace may take it. Add
`acting_for` to say [whom the app acts for](#say-whom-the-app-acts-for), and `notify_url` to be
[pinged](#get-pinged) when the job changes.

The Runners page shows the job as sent by `API key <name>`, with `made by @<login>` under it, then
` · for <acting_for>` when you sent one, and the pull request the job opens says it was sent by the
key: `Sent through the Omni API by API key <name> on runner <runner>`, with no login in it. The job
still ends in a pull request a person merges: a key never merges anything. Unless you
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
- The body takes `repo`, `description`, `runner`, `fleet`, `acting_for` and `notify_url`, and nothing
  else: any other field answers 422, naming it.

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
or `cancelled`, or ask to be [pinged](#get-pinged) instead; `pr_url` is the pull request when it
opened one. For a bug fix and a mega bug fix it also says [what the job did](#read-what-a-job-did),
where its [questions](#answer-or-dismiss-the-questions) and its [thread](#follow-the-thread) stand,
and its `log_tail`, the last lines of its log.

Which jobs a key reaches:

- **Any key of the workspace** reads and acts on any job a key of that workspace sent, so a rotated
  key keeps the jobs its predecessor sent.
- **Within the key's allow-list.** A job in a repository outside the list of the key that asks
  answers 403.
- **Never a person's job, never another workspace's.** A job a person sent from the Runners page,
  and a job of another workspace, answer 404.

What follows is additive: every field, route and refusal that was here keeps its meaning, so a
client built before it keeps working unchanged.

## Read what a job did

A bug fix that stops without a pull request still ends `done`. The `outcome` field says how it
ended, in one word:

| `outcome` | the job |
|---|---|
| `pr_opened` | opened a fix pull request for review: it is in `prs` |
| `already_fixed` | proved that the bug is already fixed: `fixed_by` is the pull request that fixed it |
| `need_human` | stopped to ask its questions: `questions.state` says whether they are still `open` |
| `needs_brainstorm` | found that a product decision comes before any fix |
| `not_a_bug` | found tooling or a flaky check, not a behaviour bug |
| `stuck` | ran out of attempts: its draft pull request, labelled `omni:needs-fix`, is in `prs` |
| `blocked` | could not go on: the repository lacks what the fix needs (a smoke command), its answers could not be read, or a target could not be cloned or pushed to |

`outcome` is `null` while the job runs, when the job failed (`status` is `failed`), and when its
runner reported none: a runner on a kit from before outcomes does not. Read a `null` as "unknown",
never as an error.

- `fixed_by` is the pull request's URL when `outcome` is `already_fixed`, and `null` otherwise.
- `prs` lists every pull request the job opened, in order, across repositories, as
  `{url, repo, number}`: a mega bug fix's target pull requests first, its record last. A failed or
  stuck job lists the draft it left, and a job that opened none lists none. `pr_url` keeps its
  meaning: one pull request, the record for a mega bug fix.
- `follow_ups` lists the problems the run saw and did not fix, in order, as
  `{repos, summary}`: `repos` is one to ten repositories as `owner/name`, `summary` is one sentence
  of what the run saw, at most 300 characters. There are at most five. It is always an array: `[]`
  when the run saw none, for a job of another skill, and for a runner on a kit from before
  follow-ups. Any outcome can carry them, `stuck` and `need_human` included. They are an agent's
  words, not a verdict: say so wherever you show one.

  For example, `{"repos": ["demo-org/nimbus-backend-php"], "summary": "The Peppol check sends company data the service rejects."}`.

### Fix a follow-up

A follow-up is never a rerun of the job that found it: a rerun resumes the first fix. Each one is its
own issue, its own bug folder and its own record, and one issue never carries two fixes. To fix one:

1. File a new issue in the follow-up's repository that says `Follow-up of <the first issue>` (for
   example `Follow-up of #386`), with the same ticket key in its title as the first, so the ticket
   gathers every pull request. Omni files no issue for you.
2. Start a [bug fix](#start-a-bug-fix) on that issue when `repos` holds one repository. When it
   names several, start a [mega bug fix](#start-a-bug-fix-across-repositories) on the plan repository.

## Read a job's lines

```bash terminal
curl -H "Authorization: Bearer $OMNI_API_KEY" "https://www.omni-loop.xyz/api/v1/jobs/<job id>/lines?limit=100"
```

It answers `{"data": [{"seq": 12, "text": "…"}], "next_cursor": "..."}`, the job's lines oldest first,
as the Runners page reads them, while the job runs and after. It pages with the
[cursor](#page-with-the-cursor) every list uses: `limit` is 1 to 100, 50 when you send none. The
workspace keeps the lines of its 50 newest ended jobs: an older job answers an empty `data`, and its
`log_tail` stays on the job. The same key rules apply as for the job itself.

## Answer or dismiss the questions

A bug fix that stops for a decision on a runner asks questions: its `outcome` is `need_human` and
its `questions` field is `{"state": "open"}`. `state` is `open` until someone answers or dismisses
them, then `answered` or `dismissed`; it is `null` for a job that asked none.

```bash terminal
curl -H "Authorization: Bearer $OMNI_API_KEY" "https://www.omni-loop.xyz/api/v1/jobs/<job id>/questions"
```

It answers the round: `lead`, which says why the job stopped, then `questions`, each with its
`question`, `header`, `multi_select` and its `options` (a `label` and a `description` each), the
`state`, the `answers` once given, and `closed_by`: `{key, acting_for}` when an API key closed the
round, `{login}` when a person did on the Runners page, `null` while it is open. A job that asked
none answers 404.

```bash terminal
curl -X POST -H "Authorization: Bearer $OMNI_API_KEY" -H "Content-Type: application/json" \
  -d '{"answers": {"Which fix?": "Guard the input"}, "acting_for": "Jane D."}' \
  "https://www.omni-loop.xyz/api/v1/jobs/<job id>/answers"
```

- **Answer** with one answer to each question the job asked, and no other, as the Runners page
  does: each question's text is the key, and the value is a pick (an option's `label`) or an answer
  of your own of 1 to 2,000 characters. Anything else answers 422. It answers `202` with the job
  it queued to carry on: its `continues` is the first job's id, it is sent by the same key, and the
  first job's `continued_by` is the new one, which the key reads like any job.
- **Dismiss** with `POST /api/v1/jobs/<job id>/dismiss` to close the round with no answer. It queues
  nothing and answers `200` with the job, its `questions.state` now `dismissed`. The body is optional.
- **The first close wins.** A second answer or dismissal, from a key or from a person on the Runners
  page, answers 409 `conflict` and changes nothing; the message says who closed the round.
- **A key answers as itself.** The Runners page reads the round `Already answered by API key <name>`
  or `Dismissed by API key <name>`, then ` · for <acting_for>` when you sent one: never as given
  by a person. The kit's own sign-in (`OMNI_TOKEN`) still never answers or dismisses: it gets 403.

## Cancel or relaunch a job

```bash terminal
curl -X POST -H "Authorization: Bearer $OMNI_API_KEY" "https://www.omni-loop.xyz/api/v1/jobs/<job id>/cancel"
```

`cancel` does what the Runners page's Cancel does. A queued or claimed job ends at once as
`cancelled`; a running one is asked to stop, and ends as `cancelled` when its runner stops it. It
answers `200` with the job, whose `cancelled_by` is `{key, acting_for}`, the name of the key and
whom it said it acted for; the Runners page reads `Cancelled`, with `by API key <name>` under it. A
job already asked to stop answers `200` again and keeps the key that asked first. A job that has
ended, `done`, `failed` or `cancelled`, answers 409.

```bash terminal
curl -X POST -H "Authorization: Bearer $OMNI_API_KEY" "https://www.omni-loop.xyz/api/v1/jobs/<job id>/relaunch"
```

`relaunch` does what the Runners page offers for that job: Send again for a failed or cancelled
one, Resume for one that stopped mid-way. It queues a new job with the same line on the same
runner target and answers `202` with it: its `continues` is the first job's id, it is sent by the
same key, and it keeps the first job's `notify_url`. A job the page offers neither for answers 409.
So does a job that was already carried on, by a relaunch, an answer or the page's automatic
continuation: a job is carried on once. Relaunch the newest job of its [thread](#follow-the-thread)
instead.

Both bodies are optional: send none, `{}`, or `{"acting_for": "…"}`.

## Follow the thread

A job can carry another on: the answer to its questions, a relaunch, and the page's automatic
continuation all queue a new job. Two fields link them:

- `continues` is the id of the job this one carries on, or `null`.
- `continued_by` is the id of the newest job that carries this one on, or `null`.

Follow `continued_by` one job at a time until it is `null` to reach the end of the thread. Every job
queued from a key's job stays the key's: it is sent by the same key and sets `continues`, whoever
asked for it, so any key of the workspace reads the whole thread. This holds when a person answers
on the Runners page, too.

## Say whom the app acts for

An API key acts as itself, never in a person's name: it does not sign in as a member, and a key's
action never earns points. To let the board say which colleague a key's action was for, send an
optional `acting_for` with the action, on the start routes, `answers`, `dismiss`, `cancel` and
`relaunch`:

```bash terminal
curl -X POST -H "Authorization: Bearer $OMNI_API_KEY" -H "Content-Type: application/json" \
  -d '{"acting_for": "Jane D."}' "https://www.omni-loop.xyz/api/v1/jobs/<job id>/relaunch"
```

It is 1 to 80 characters: letters of any alphabet, digits, spaces and `. _ ' @ - ·`. Anything else
answers 422. It is stored and shown as given, beside the key's name on the Runners page, and never
matched to a member. A job reads back the text sent with the action that queued it as its
`acting_for`.

## Get pinged

Send `notify_url` with a start route to hear about a job instead of polling it:

```bash terminal
curl -X POST -H "Authorization: Bearer $OMNI_API_KEY" -H "Content-Type: application/json" \
  -d '{"repo": "acme/backend", "description": "Issue 548 the invoice total is off by a cent", "notify_url": "https://hooks.example.com/omni/jobs"}' \
  "https://www.omni-loop.xyz/api/v1/bug-fixes"
```

The link is an `https` link of at most 500 characters, with no user name or password, on a public
host. A host that resolves to a loopback, internal-network or link-local address, or to none, answers 422
when you send the job, and nothing is queued.

When the job's status, outcome or questions change, the server posts `{"job_id", "event", "at"}` to
the link, and nothing else:

| `event` | when |
|---|---|
| `status` | the job is claimed, starts running, or ends with no outcome (failed, cancelled, or a runner that reported none) |
| `outcome` | the job ends with an outcome, `need_human` included |
| `questions` | the job asks its questions, and when they are answered or dismissed |

The ping says that something changed, never what: read the job with your key to learn more. A forged
ping can therefore only make you read.

- **Delivery.** The server posts after the change is stored. Each try waits at most 5 seconds for an
  answer, and a try is good when you answer with a 2xx. It tries at most 3 times within about 30
  seconds, then logs the failure; a ping that fails never fails the change. A redirect is never
  followed.
- **Checked again.** The host is checked again before every try.
- **The thread inherits it.** An answer, a relaunch and the automatic continuation keep the link, so
  every job of the thread pings it.
- **Polling stays the truth.** No ping is signed or queued for later, and a change the database
  makes alone, a stale claim the scheduled sweep ends, sends none: read the job now and then.

## Page with the cursor

A list answers at most `limit` rows (1 to 100, 50 when you send none) and a `next_cursor`: the PRDs,
the bug fixes and a job's lines. Send it back as `cursor` to read the next page; it is `null` on the
last page. A page never repeats or skips a row, even when rows are added while you page.

```bash terminal
curl -H "Authorization: Bearer $OMNI_API_KEY" "https://www.omni-loop.xyz/api/v1/prds?limit=50&cursor=<next_cursor>"
```

The cursor is opaque: send it back unchanged. One that was altered answers 422.

## Errors

Every refusal answers one shape, `{"error": {"code": "…", "message": "…"}}`.

| status | code | when |
|---|---|---|
| 401 | `unauthorized` | no key, an unknown key, a revoked key, or a key whose maker left the workspace |
| 403 | `forbidden` | a repository outside the workspace or outside the key's allow-list, to start a job in, to read the job of or to act on the job of |
| 404 | `not_found` | a job that does not exist or that no key of this workspace queued, or, for its questions, a job that asked none |
| 409 | `conflict` | questions already answered or dismissed, by a key or by a person on the Runners page (the first close wins), or a job that is not waiting for an answer; a cancel of a job that has ended; a relaunch of a job the Runners page offers neither Send again nor Resume for, or that was carried on already |
| 422 | `invalid_request` | a query or body the contract refuses, a bad cursor, a repository that is not a plan repository, answers that are not one to each question the job asked, an `acting_for` the contract refuses, or a `notify_url` on a host that is not public or does not resolve; the message names the field |
| 422 | `github_app_not_installed` | the key has a GitHub App and it is not installed on the repository; the message names the repository, and nothing is queued |
| 422 | `github_app_permissions` | the key has a GitHub App whose installation on the repository lacks write access to `contents`, `pull_requests` or `issues`; the message names the permission, and nothing is queued |
| 500 | `internal` | anything else; the message never carries a stack or a database error |

## Reference

[Next → Getting started](/docs)
