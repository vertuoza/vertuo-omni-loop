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

<!-- omni-outbox-settled: s3-01-the-session-finds-the-page-in-the-token-file -->

## s3-01-the-session-finds-the-page-in-the-token-file — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-the-session-finds-the-page-in-the-token-file
prd: 2433
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

When a job running as the GitHub App needs a fresh token, how does the job's own session know where to ask for one?

## The decision, in plain words

The runner writes the address of the Omni page into the small private file that already holds the job's token, when the job starts, so the session can ask the app by itself and needs no new setting.

## The intro, for fun

A token about to run out needs to know whom to call.

## The punchline, for fun

So the runner tucks the phone number into the same drawer.

## The options, in plain words

A. A. Keep the page address in the job's private token file, written when the job starts, so the session needs nothing else.
B. B. Hand the page address to the session as one more setting of its environment, which every tool in the session could read and print.
C. C. Read the address from the checkout's own configuration, which ties the job to a checkout the kit may not have set up.

## What I had to decide

Whoever owns the runner. The address is saved next to the token by the function that saves a job's token (github-token.ts), and read back by omni runner github-token; moving it to another place is a change in those two spots and in runner.ts where the job starts.

Decided by: Jev (hardToRevert 0.46) · agent said false

## What I did meanwhile

Added an optional page field to the job's token file (job-<id>.github, mode 0600). The runner fills it from the page it already talks to, at the moment it saves the first token. omni runner github-token reads it to post to the refresh route; a job whose file has no page field says so and fails the refresh instead of guessing. The kit never prints the field.

## What it costs to change later

Small. A different home for the address (an environment variable, or the checkout's configuration) is a constant and two reads; no migration, and old token files simply have no page field.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The PRD names the refresh route but not how the session learns the page address; the registers and the glossary do not settle it.
- (author) A job started before this change has a token file with no page field: its session cannot ask for a fresh token itself, while the runner still refreshes it on its own tick. Whether that is enough is not settled.

```

<!-- /omni-outbox-settled: s3-01-the-session-finds-the-page-in-the-token-file -->

<!-- omni-outbox-settled: s3-02-an-app-job-with-no-token-left-is-released-as-nothing -->

## s3-02-an-app-job-with-no-token-left-is-released-as-nothing — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-an-app-job-with-no-token-left-is-released-as-nothing
prd: 2433
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

When a job that ran as the GitHub App has ended and no valid token is left, may its claims be released with the machine's own GitHub login instead?

## The decision, in plain words

No. The claims are left as they are and the job's result says why, in the words github app followed by the reason, because a job that ran as the App is never closed out as a person.

## The intro, for fun

A badge that ran out is no reason to borrow someone else's.

## The punchline, for fun

So the claims stay put, and the page says why.

## The options, in plain words

A. A. Leave the claims as they are and say why in the job's release line, so no claim is ever cleared by a person's account on behalf of the App.
B. B. Release them with the machine's own GitHub login, so nothing stays claimed, though the action would be taken by a person's account.
C. C. Keep asking for a fresh token for a longer time before giving up, and only then leave the claims as they are.

## What I had to decide

Whoever owns the runner fleet. Releasing as the machine is one branch in releasedAs (runner.ts) and would cost the guarantee in the spec that an App job never runs as a person; leaving the claims is the reversible side.

## What I did meanwhile

releasedAs in runner.ts keeps the job's token current with keepGithubToken. When none is left, it skips the release, sets the release error to github app: followed by the reason, and prints that line with every token masked. A job whose token file is gone is treated the same, with the reason that the job has no token kept on this machine.

## What it costs to change later

Small. Letting the machine release instead is one branch; a claim left in place is cleared by a later release or by a person, and nothing is lost.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Who clears a claim left in place, and when, is not settled by the PRD.
- (author) Whether the sweep should retry the release of such a job later, once the app answers again, is not settled.

```

<!-- /omni-outbox-settled: s3-02-an-app-job-with-no-token-left-is-released-as-nothing -->

<!-- omni-outbox-settled: s3-03-release-asks-a-fresh-token-when-it-is-late -->

## s3-03-release-asks-a-fresh-token-when-it-is-late — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-release-asks-a-fresh-token-when-it-is-late
prd: 2433
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

When a job has ended and its claims are about to be released as the GitHub App, should the runner ask the app for a fresh token if the one it holds is nearly out?

## The decision, in plain words

Yes. If the token has less than five minutes left, the runner asks the app for a fresh one before it releases, as it does during the job; if the app says no, the claims are left as they are.

## The intro, for fun

Cleaning up after a job can take longer than the badge lasts.

## The punchline, for fun

So the runner asks for a new badge before it tidies up.

## The options, in plain words

A. A. Ask the app for a fresh token at release when less than five minutes are left, as during the job.
B. B. Never ask at release: use the token the job ended with, and leave the claims when it has run out.
C. C. Always ask for a fresh token at release, even when the one held is new.

## What I had to decide

Whoever builds the app's refresh route (slice s7 of this PRD). The runner assumes that route answers for a job that ended a few minutes ago; if it does not, the release leaves the claims as in the earlier item and the cost is a claim left in place.

Decided by: Jev (hardToRevert 0.52) · agent said false

## What I did meanwhile

The release asks keepGithubToken for the job's token: it reuses the one it holds when more than five minutes are left, and asks for a fresh one otherwise, with the same lock, the same one-minute retry and the same wait as during the job. A release never waits for the app longer than the token has left.

## What it costs to change later

Small. Dropping the ask at release is one call removed; the release then uses what the job ended with, and claims are left in place when it has run out.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The refresh route is not built yet (slice s7), so whether it answers for a job that has already ended is not known.
- (author) Whether the five-minute margin should be longer at release than during the job is not settled.

```

<!-- /omni-outbox-settled: s3-03-release-asks-a-fresh-token-when-it-is-late -->

<!-- omni-outbox-settled: s3-04-stranded-app-jobs-are-recognized-before-the-cleanup -->

## s3-04-stranded-app-jobs-are-recognized-before-the-cleanup — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-04-stranded-app-jobs-are-recognized-before-the-cleanup
prd: 2433
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

When a runner finds a job from an earlier run that never ended cleanly, how does it know the job ran as the GitHub App, given that its own cleanup deletes old files?

## The decision, in plain words

It looks for the job's private token file before the cleanup deletes old files, so a job that ran as the App is released as the App, or not at all, and never as the machine.

## The intro, for fun

The runner checks the guest list before it sweeps the floor.

## The punchline, for fun

Otherwise it would forget who the guest was and let a stranger lock up.

## The options, in plain words

A. A. Read whether the job ran as the App from its token file before the cleanup runs.
B. B. Keep the token files of stranded jobs out of the cleanup, so they can be read afterwards.
C. C. Write a line into the job's log when it starts as the App, and read that line later.

## What I had to decide

Whoever owns the runner. The order is fixed in the sweeper of runner.ts: ranAsApp is read for every stranded job before sweep runs. Another way to remember that a job ran as the App (for example a line in the job's log) is a change in ranAsApp alone.

## What I did meanwhile

The sweeper lists the stranded jobs and marks each with whether it ran as the App, by looking for its token file, then runs the cleanup, then releases each job as the App with whatever token is left, or as nothing. The token file of a released job is forgotten after its release.

## What it costs to change later

Small. Recording the mark somewhere else is a change in one function and its tests; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A job whose token file vanished by other means, such as a person deleting it, cannot be recognized as an App job and would be released with the machine's own login; the PRD does not say how to tell.
- (author) Whether the claim's own record, rather than the token file, should say that a job ran as the App is not settled.

```

<!-- /omni-outbox-settled: s3-04-stranded-app-jobs-are-recognized-before-the-cleanup -->

<!-- omni-outbox-settled: s4-01-pair-checked-before-owner -->

## s4-01-pair-checked-before-owner — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-pair-checked-before-owner
prd: 2433
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

When someone sends an App ID and a private key to attach to an API key, should the server ask GitHub whether the pair is valid before the database says whether that person may attach it at all?

## The decision, in plain words

Yes: the server checks the pair with GitHub first, then the database decides who may attach it. Nothing the server can read tells it which workspace a key belongs to before that, so an owner check cannot come first without a new read or a new field.

## The intro, for fun

Knocking on GitHub's door before asking who owns the house.

## The punchline, for fun

The database still decides who may stay, and GitHub only vouches for the key.

## The options, in plain words

A. A. Check the pair with GitHub first, then let the database refuse anyone who may not attach it, so the request stays exactly as the spec words it.
B. B. Add a small database read that says whether the caller owns a key's workspace, and ask it before GitHub is called, which adds a migration to this slice's sibling.
C. C. Ask the sender to name the workspace as well as the key, check ownership first with the read the page already uses, then ask GitHub, which changes the request the spec words.

## What I had to decide

The spec sends only the App ID and the private key, with the key's id in the path, and the database function that attaches (api_key_github_app_attach) needs the App's slug and its bot's id, which only GitHub can give, and it is the function that refuses a member or another workspace's owner. No read maps a key's id to its workspace for the caller, so I put the GitHub check first and the database's refusal second.

## What I did meanwhile

attachGithubApp in keys/api-keys.service.ts checks the pair (two read-only GitHub calls), seals the private key under the master key and calls the database function; a member or a stranger gets 403, a revoked key 404, a pair GitHub refuses 422, GitHub down 502 and a deployment with no master key 503, and nothing is stored in any of them. A pair a non-owner sends is used for those two calls and nowhere else: never stored, logged or answered.

## What it costs to change later

Small. Naming the workspace in the request, or adding a database read of a key's workspace, moves the owner check ahead of GitHub in a few lines of the service and the controller; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a member's pair reaching GitHub for two read-only calls is acceptable, or the owner check must always come first (author)

```

<!-- /omni-outbox-settled: s4-01-pair-checked-before-owner -->

<!-- omni-outbox-settled: s4-02-token-needs-named-repositories -->

## s4-02-token-needs-named-repositories — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-token-needs-named-repositories
prd: 2433
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

When the server asks GitHub for a token on a key's App, may it ask without naming repositories, or for a repository that belongs to someone other than the owner of the installation?

## The decision, in plain words

No. It refuses to ask for a token without at least one repository, and refuses a repository whose owner is not the installation's, so a job's token never reaches further than the repositories it was asked for.

## The intro, for fun

A token with a blank list would open every door in the street.

## The punchline, for fun

So the list is never blank, and never from another street.

## The options, in plain words

A. A. Refuse an empty list and a repository of another owner before asking GitHub, so a token can only ever cover named repositories of the installation.
B. B. Pass the list on as given and let GitHub scope an empty one to every repository of the installation, which gives a job more reach than the repositories it was sent for.
C. C. Refuse only an empty list and leave the owner check to GitHub, which then looks a namesake up in the installation's own account.

## What I had to decide

GitHub reads an empty list of repositories as every repository the installation covers, and it takes repository names only, looking each one up in the account that holds the installation, so a namesake owner's repository would be looked up in the wrong account. The spec says a token for the given repositories with exactly three write permissions and metadata read, so I made the module that mints refuse both cases before it asks GitHub.

## What I did meanwhile

mintToken in keys/github-app.ts throws before any call when the list is empty or when a repository's owner differs from the installation's account, in any letter case, and sends each name once. keys/github-app.test.ts names both refusals.

## What it costs to change later

Small. Dropping either guard is a few lines of one function and its test; nothing stored depends on them, and the later slices that mint only import the function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How a key with no allow-list, which means every repository of its workspace, gets a token for the one repository a job targets: the slices that mint decide it (author)

```

<!-- /omni-outbox-settled: s4-02-token-needs-named-repositories -->

<!-- omni-outbox-settled: s4-03-list-new-github-caller -->

## s4-03-list-new-github-caller — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-list-new-github-caller
prd: 2433
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

The module that checks a key's GitHub App and mints its tokens calls GitHub with the App's own signed requests, and a test outside this slice's folders lists every file that calls GitHub: may this slice add one line there?

## The decision, in plain words

Yes: the new file is listed in that test as one of the App's own signed callers, which is the only change outside the slice's folders. Without the line the whole test run stays red.

## The intro, for fun

A new caller signs the guest book at the door of GitHub.

## The punchline, for fun

One line outside the folders, and the book stays honest.

## The options, in plain words

A. A. Add one line to the call-sites test for the new file, as a signed caller of the App, and report the breach of the slice's folders.
B. B. Keep the GitHub address out of the new file by importing it from the sign-up module, which leaves the test untouched but ties two features to one file.
C. C. Move the new module into the sign-up folder where the first signed caller already lives, which changes the path the later slices were told to import.

## What I had to decide

A test that lives beside the arcade's sources fails whenever a source file names GitHub's address and is not on its list, so a new caller must be added there, whatever folder it sits in. The plan's territory for this slice does not name that test, and the full test run is the check a slice must pass before its pull request is marked ready.

Decided by: Jev (hardToRevert 0.76) · agent said false

## What I did meanwhile

Added the one line for keys/github-app.ts, kind jwt (the App's own signed calls, like the sign-up module's), to apps/galaxy/src/github-call-sites.test.ts. Nothing else outside the slice's folders and the outbox changed.

## What it costs to change later

Small. Removing the line puts the test back to red; a later slice that moves or renames the module changes the same one line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the later slices that import this module must be listed as callers too: they only import it and name no GitHub address, so I believe not (author)

```

<!-- /omni-outbox-settled: s4-03-list-new-github-caller -->
