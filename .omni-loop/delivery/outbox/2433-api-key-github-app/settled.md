# Settled outbox items — PRD 2433

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-queued-jobs-stay-app-jobs -->

## s1-01-queued-jobs-stay-app-jobs — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-queued-jobs-stay-app-jobs
prd: 2433
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

If a key's GitHub App is removed, or the key is revoked, while jobs it sent are still waiting, may any runner take those jobs?

## The decision, in plain words

No. A job sent while its key held a GitHub App is marked at that moment, and only a runner that can act as an App takes it, even after the App is gone.

## The intro, for fun

A queued job remembers which badge it was promised.

## The punchline, for fun

Taking the badge away later does not hand the job to a stranger.

## The options, in plain words

A. Mark each job when it is queued, in a small table of its own, so a job promised to an App only ever goes to a runner that can act as one.
B. Look only at whether the key holds an App when a runner asks, so a job queued before the App was removed could be taken by any runner and run as a person.
C. Fail every waiting job of a key the moment its App is removed or the key is revoked, and let no mark outlive the App.
D. Add a yes-or-no column to the job itself instead of a table of its own, which changes what every reader of a job sees.

## What I had to decide

The spec says a runner that cannot act as an App never takes a job of a key that holds one, and that the job never runs as a person (spec section 10). It does not say what happens to a job already queued when the App is removed or the key revoked: the key then holds no row, so the claim would hand the job to any runner, and it would run as the person whose machine took it. I had to choose how a queued job remembers that it needed an App.

## What I did meanwhile

Added one table, public.runner_job_needs_app, one row per job, filled by a trigger on runner_jobs at insert when the sending key holds an App at that moment. runner_claim() skips a job that has a row, or whose key holds an App, for a runner whose github_app is false. Only the job itself deletes a mark. supabase/checks/api_key_github_apps.sql proves a mark survives Remove and revoke, and that a job queued after Remove carries none.

## What it costs to change later

Small. A follow-up migration drops the table, the trigger and the clause in runner_claim(); the marks are only for jobs still waiting, so no history is lost. Moving to a column on runner_jobs later is one migration that copies the marks over.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a job marked for an App that is gone should be failed at once instead of waiting for a runner that can act as an App (author)

```

<!-- /omni-outbox-settled: s1-01-queued-jobs-stay-app-jobs -->

<!-- omni-outbox-settled: s1-02-revoke-erases-the-sealed-key-by-trigger -->

## s1-02-revoke-erases-the-sealed-key-by-trigger — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-revoke-erases-the-sealed-key-by-trigger
prd: 2433
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

When an API key is revoked, where should its sealed GitHub App key be erased: inside the revoke step made for API keys, or wherever any key gets revoked?

## The decision, in plain words

Wherever any key is revoked. A trigger on the key's revoked date erases the sealed key, so revoking through the API key step or through the general token step both erase it.

## The intro, for fun

Two doors lead to a revoked key, and only one had a guard.

## The punchline, for fun

Now the lock sits on the key itself, not on either door.

## The options, in plain words

A. Erase the sealed key from a trigger on the key's revoked date, so any way of revoking a key erases it.
B. Edit only the API key revoke step to erase the sealed key, and leave the general token revoke step able to leave it behind.
C. Edit both revoke steps, and make the general one refuse an API key so there is one single way to revoke it.

## What I had to decide

The spec says revoking the key deletes its App's row. Two functions revoke an api-scope key: api_key_revoke(), made for API keys, and agent_token_revoke(), made for every token scope and still callable by an owner with an API key's id. Editing only api_key_revoke() would leave the sealed private key behind when the other one is used.

## What I did meanwhile

A trigger on agent_tokens, after an update of revoked_at that turns null into a date, deletes the row. api_key_revoke() is not edited, so its checks and the migration that defined it stay as they are. supabase/checks/api_key_github_apps.sql proves the erase for both functions.

## What it costs to change later

Small. One follow-up migration drops the trigger and its function and moves the delete into the revoke function instead; no data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the general token revoke should refuse an api-scope key outright, which would leave a single way in (author)

```

<!-- /omni-outbox-settled: s1-02-revoke-erases-the-sealed-key-by-trigger -->

<!-- omni-outbox-settled: s1-03-runners-table-test-allows-the-new-column -->

## s1-03-runners-table-test-allows-the-new-column — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-runners-table-test-allows-the-new-column
prd: 2433
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

A test outside this slice's area pins the exact columns of the runners table, so adding the new GitHub App column broke it. May this slice loosen that one line, or must a later slice do it?

## The decision, in plain words

This slice loosens that one line so it accepts the new column, and nothing else in the test changes. Leaving it would keep the slice's own checks red.

## The intro, for fun

A test counted the runners table's columns on its fingers.

## The punchline, for fun

One new column later, the count needed a thumb.

## The options, in plain words

A. Loosen the one test line in this slice so it allows the new column, leaving every other line of the test as it is.
B. Leave the test as it is and let the later slice that owns it fix it, accepting that this slice's own checks stay red until then.
C. Remove the pinned column order from the test altogether, so no future column on the runners table breaks it.

## What I had to decide

supabase/database.types.ts is this slice's, and the plan gives apps/galaxy/src/runners to a later slice (s7). The new runners.github_app column sorts between fleet and health in the generated types, and runners.migration.test.ts expects fleet and health to follow each other. The preflight stayed red on that one test, so I had to choose between touching a file outside the territory and leaving the slice red.

## What I did meanwhile

Changed one regular expression in apps/galaxy/src/runners/runners.migration.test.ts so that an optional github_app line may sit between fleet and health. Every other line of the test is as it was, and it still fails when fleet or health is missing from the types.

## What it costs to change later

Nothing to undo in the product: it is one line of a test. If s7 edits the same line, the two edits meet in a small merge conflict a person or the wave settles in a minute.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s7 rewrites or removes this test line anyway, which would make this edit moot (author)

```

<!-- /omni-outbox-settled: s1-03-runners-table-test-allows-the-new-column -->

<!-- omni-outbox-settled: s2-01-app-token-in-a-file -->

## s2-01-app-token-in-a-file — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-app-token-in-a-file
prd: 2433
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

A job that runs as the GitHub App needs a short-lived access token on the runner's machine. Where should the runner keep it while the job runs?

## The decision, in plain words

The token sits in a private file beside the job's log, readable by the runner's owner alone, and the tools the job uses read it from there. It is never placed in the job's environment, and it is removed when the job ends.

## The intro, for fun

A token is a house key: nobody leaves it under the doormat.

## The punchline, for fun

This one lives in a locked drawer and is shredded after the job.

## The options, in plain words

A. A. A private file beside the job's log, read through the runner's own command; every past token stays masked.
B. B. An environment variable of the job: simplest, but visible to every process and every printed environment.
C. C. A private file holding only the current token: smaller, but a past token is no longer masked.

## What I had to decide

Pick A to keep the token in a private file read through `omni runner github-token`. Pick B only if you accept that every process of the job, and any line it prints, can see the token. Pick C if past tokens need not be masked.

## What I did meanwhile

Option A is built: the file is `~/logs/job-<id>.github` (mode 0600), the credential helper, the `gh` on `PATH` and `githubEnv` read it, and the runner masks every token the job ever had in the log and in everything it sends. A crash leaves the file for the log sweep to take.

## What it costs to change later

Switching to B is a small change in `kit/lib/runner/runner.ts` and `kit/lib/env/read.ts`, but it breaks the rule that credentials never appear in clear in a log (L-GDPR-2): `env` and process listings would show it. Switching to C is a constant, but a past token leaked in a log would no longer be masked.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a job on a shared machine can read another user's home is outside the runner: the file is 0600 under the runner's own home.
- (author) A concurrent refresh of the same job's file could lose a past token (read-modify-write); the refresh is slice s3's, which should serialize it.

```

<!-- /omni-outbox-settled: s2-01-app-token-in-a-file -->

<!-- omni-outbox-settled: s2-02-app-identity-github-only -->

## s2-02-app-identity-github-only — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-app-identity-github-only
prd: 2433
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

When a job runs as the GitHub App, which hosts should the app's identity apply to: GitHub alone, or every host the job talks to?

## The decision, in plain words

The app's sign-in and the rewrite of ssh addresses apply to GitHub alone. The sign-in methods already set up on the machine keep working for every other host.

## The intro, for fun

The bot's badge opens the GitHub door and no other door.

## The punchline, for fun

Every other lock keeps the key it already had.

## The options, in plain words

A. A. GitHub alone: the helper and the rewrite name only GitHub, and every other host keeps the machine's own sign-in.
B. B. Every host: one helper for all, and the token is offered to hosts that are not GitHub.

## What I had to decide

Pick A to limit the app's sign-in to github.com. Pick B to give it to every host, which would break a job that pushes to another host.

## What I did meanwhile

Option A is built: the job's git configuration sets an empty then a real helper for `credential.https://github.com.helper`, and rewrites `git@github.com:` and `ssh://git@github.com/` to https, so a push can never fall back to the machine's own ssh key or helper for github.com.

## What it costs to change later

Moving to B is a change to the keys `gitConfigVariables` is given in `kit/bin/github.ts` and `kit/lib/runner/github-app.ts`, a few lines, but it would send the app's token to hosts that are not GitHub.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A GitHub Enterprise host is not covered: the plan names github.com only.
- (author) Whether a job ever pushes to another host is not stated in the spec.

```

<!-- /omni-outbox-settled: s2-02-app-identity-github-only -->

<!-- omni-outbox-settled: s2-03-gh-shim-shared -->

## s2-03-gh-shim-shared — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-gh-shim-shared
prd: 2433
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

A job running as the GitHub App must not use the machine's own GitHub sign-in when it runs the GitHub command line tool. How should the runner put the app's tool in front of it?

## The decision, in plain words

The runner installs one small stand-in for the GitHub command line tool in a folder of its own, shared by all jobs on the machine, and puts that folder first on the job's search path. The stand-in holds no token.

## The intro, for fun

A doorman who asks the right keyholder every single time.

## The punchline, for fun

He never carries the key, so there is nothing to lose.

## The options, in plain words

A. A. One shared, token-less stand-in under the runner's config folder, installed once and kept.
B. B. One stand-in per job in the job's own folder, removed when the job ends.

## What I had to decide

Pick A to keep one shared stand-in under the runner's own config folder. Pick B to write one per job and remove it at the job's end, at the price of more files written for every job.

## What I did meanwhile

Option A is built: `~/.config/omni/runner/bin/gh` runs the real `gh` with `GH_TOKEN` read from `omni runner github-token` at call time, so it holds no secret and persists between jobs; a job with no app never sees it.

## What it costs to change later

Switching to B moves the install into the job's folder and adds a removal step in `kit/lib/runner/runner.ts`: about thirty lines, with no data to migrate.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Two runners on one machine would share the stand-in; it is stateless, so they cannot disagree.
- (author) A person's own `gh` is found by searching the path past the shim: if none is installed, the stand-in refuses with a plain line.

```

<!-- /omni-outbox-settled: s2-03-gh-shim-shared -->

<!-- omni-outbox-settled: s2-04-key-sender-own-variable -->

## s2-04-key-sender-own-variable — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-04-key-sender-own-variable
prd: 2433
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

When an API key sent a job, the pull request line must name the key, not a person. How does the key's name reach the job?

## The decision, in plain words

The key's name travels in its own variable next to the existing one that names a person, so a job never mixes the two. A key name that starts with an at sign has it removed, so the line cannot read as a person's handle.

## The intro, for fun

A key has a name, and the name must never pass for a person.

## The punchline, for fun

So it wears its own badge, apart from the people.

## The options, in plain words

A. A. A separate variable for the key's name, with any leading at sign removed.
B. B. The same variable as the person's handle, holding the key's name.

## What I had to decide

Pick A to keep the key's name in its own variable. Pick B to fold it into the person's variable, which would let a key pass for a person.

## What I did meanwhile

Option A is built: `OMNI_SENT_BY_KEY` carries the name, the sender line reads `Sent through the Omni API by API key <name> on runner <runner>`, and a job without a key starts with exactly today's environment.

## What it costs to change later

Folding into the person's variable is a few lines in `kit/lib/env/read.ts` and `kit/lib/runner/sender.ts`, but it risks breaking L-AIACT-1: a pull request from an agent would read like a person's.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says only that the sender line names the key; the variable's name and the at-sign rule are the author's choice.

```

<!-- /omni-outbox-settled: s2-04-key-sender-own-variable -->

<!-- omni-outbox-settled: s2-05-register-app-only-when-able -->

## s2-05-register-app-only-when-able — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-05-register-app-only-when-able
prd: 2433
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

A runner tells the server at sign-up whether it can run a job as the GitHub App. When should it say yes?

## The decision, in plain words

The runner says yes only when it was started with the means to hand a job its token, so the server never gives an app job to one that cannot serve it. If keeping the token on the machine fails, the job ends as failed with one plain reason.

## The intro, for fun

Say yes only to a job you can actually do.

## The punchline, for fun

A runner that cannot hold the key never gets handed one.

## The options, in plain words

A. A. Register as able only when the runner holds its token command.
B. B. Always register as able, and fail the job when the token cannot be kept.

## What I had to decide

Pick A to register as able only with the token command in hand. Pick B to always register as able, and let a job fail when the token cannot be kept.

## What I did meanwhile

Option A is built: register sends `githubApp: true` only when the runner has its token command; a failure to write the token file ends the job `failed` with the reason `github app: the token could not be kept on this machine`.

## What it costs to change later

Switching to B is one line in `kit/lib/runner/runner.ts`, but every runner started in a way that cannot serve the token would take app jobs and fail them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The failure reason is deliberately generic so no path or token reaches the Omni page; slice s7 may want a richer one.

```

<!-- /omni-outbox-settled: s2-05-register-app-only-when-able -->
