# Settled outbox items — PRD 71

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-02-hooks-read-the-sign-in -->

## s1-02-hooks-read-the-sign-in — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-hooks-read-the-sign-in
prd: 71
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

The hooks need the person's sign-in to talk to the page, but the sign-in itself is built by a later slice. Should the hooks read the saved sign-in on their own now, or wait for that slice?

## The decision, in plain words

The hooks read the saved sign-in themselves, and save a renewed one when the server asks for it, in the layout the spec describes. The later sign-in slice must write the same layout.

## The intro, for fun

Two slices need the same key, and only one of them is allowed to cut it.

## The punchline, for fun

So the first one borrowed the spare and left a note on the door.

## The options, in plain words

A. The hooks read and renew the saved sign-in themselves, in the layout the spec describes, the option built.
B. The hooks make no call until the sign-in slice connects its own store to them.
C. Widen the sign-in slice's ground so that it connects its store to the hooks itself.

## What I had to decide

Where the hooks get their access token. The plan gives `kit/lib/ask/credentials` (the store `omni signin` writes) to s3, and `kit/bin/commands/ask.mjs`, where the hooks are wired, to s1 and s5 only, so s3 cannot connect its store to the hooks; yet s1's done-when needs "a 401 refreshes once and retries", which means reading and rewriting the stored tokens.

## What I did meanwhile

`kit/lib/ask/client-tokens.mjs` reads `~/.config/omni/credentials.json`, keyed by the host of `ask.url`, each entry the token exchange's reply as the spec gives it (`{access_token, refresh_token, expires_at, email}`), and writes it back at mode 0600 after a refresh, keeping every other host. The client takes the store as a small port (`read(host)`, `write(host, tokens)`), so s3's module can replace it where the hooks are wired. With no entry for the host, the hooks make no call and stay silent.

## What it costs to change later

If s3 chooses another file layout, one of the two modules changes to match it; nothing is stored in a repository.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether s3 will key the file by host alone or by host and account
- whether the hooks should also refresh ahead of `expires_at` rather than only on a 401

```

<!-- /omni-outbox-settled: s1-02-hooks-read-the-sign-in -->

<!-- omni-outbox-settled: s1-03-hooks-never-block -->

## s1-03-hooks-never-block — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-hooks-never-block
prd: 71
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

The plugin's hooks run in every repository where the plugin is on, including ones without the loop, or with an older copy of it that knows nothing of ask mode. Should a hook that cannot run ever be allowed to block a person's message or question?

## The decision, in plain words

A hook that cannot run is ignored, so the person's message or question goes through exactly as it does today. The hooks stay silent in those repositories.

## The intro, for fun

A doorman who has lost his list should wave everyone in, not lock the building.

## The punchline, for fun

Nobody ever complained about a quiet doorman.

## The options, in plain words

A. A hook that cannot run is ignored and the person carries on, the option built.
B. Run the hooks exactly as the spec words them, and let an old install block messages until it is updated.

## What I had to decide

The spec's hook command is exactly `node "$CLAUDE_PROJECT_DIR/.omni-loop/bin/omni.mjs" ask hook <kind>`. Run as is, it fails in a checkout with no `.omni-loop/bin/omni.mjs` (exit 1, an error line) and, worse, in a checkout whose installed bundle predates `omni ask`: that bundle prints its usage line and exits 2, and exit 2 from a `UserPromptSubmit` hook blocks and erases the person's prompt, from a `PreToolUse` hook it blocks `AskUserQuestion`. The plugin updates on its own, apart from each repository's bundle, so this would happen in every such repository.

## What I did meanwhile

Each command in `kit/plugin/hooks/hooks.json` ends with `|| true`. `omni ask hook` itself never exits non-zero for a hook kind it knows: it runs without a loaded context, so no repository, no config, a broken config or an unreachable server all end in exit 0 with no output. `kit/bin/ask-hook.test.mjs` runs each hooks.json command through `sh -c` in a checkout without the kit and in one whose omni exits 2, and gets exit 0 and no output from both.

## What it costs to change later

Removing `|| true` from three lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a hook that fails silently hides a broken install a person would rather hear about

```

<!-- /omni-outbox-settled: s1-03-hooks-never-block -->

<!-- omni-outbox-settled: s1-04-where-the-hooks-send-calls -->

## s1-04-where-the-hooks-send-calls — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-where-the-hooks-send-calls
prd: 71
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

The saved session holds the link to its page, but the hooks also need the address of the server to talk to. Where should they take it from, and what if the two disagree?

## The decision, in plain words

The hooks take the server's address from the repository's settings, and stay silent when the setting is empty or points at another server than the one the session was opened on. Emptying the setting therefore switches the mode off at once.

## The intro, for fun

The note on the fridge says where the party is, but the invitation says somewhere else.

## The punchline, for fun

When in doubt, the hooks stay home and let the terminal host.

## The options, in plain words

A. Take the server's address from the settings, and stay silent when it is empty or disagrees with the session, the option built.
B. Keep the server's address in the saved session as well, so the hooks never read the settings.

## What I had to decide

The spec gives `.omni-loop/local/ask.json` as `{sessionId, url, host}` and says `omni ask status` prints "the link", so `url` reads as the session page, not the base of the `/api/ask/*` calls. The calls need `ask.url`, whose path is not recoverable from the page link.

## What I did meanwhile

`activeSession` in `kit/lib/ask/hook.mjs` reads `ask.json`, then `ask.url` from `.omni-loop/config.yml`: the mode is on only when both exist and the host of `ask.url` equals `ask.json`'s `host`. Every call goes to `<ask.url>/api/ask/...`, a path under `ask.url` kept. s5, which writes `ask.json` with `writeSession`, must store the page link as `url` and the host of `ask.url` as `host`.

## What it costs to change later

A few lines in `activeSession` if s5 stores the base URL in `ask.json` instead.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether s5 means `url` in `ask.json` to be the page link or the base of the calls

```

<!-- /omni-outbox-settled: s1-04-where-the-hooks-send-calls -->

<!-- omni-outbox-settled: s1-05-closed-session-signal -->

## s1-05-closed-session-signal — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-05-closed-session-signal
prd: 71
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

When a session has been closed on the page, the hooks should notice and switch the mode off in that checkout. How should they tell a closed session from a server that simply refused one question?

## The decision, in plain words

The hooks treat a session as closed only when the server says so while they wait for an answer. Any other refusal just sends the question to the terminal, and the mode stays on until it is switched off.

## The intro, for fun

Is the shop closed, or did the till just jam?

## The punchline, for fun

The hooks only believe the sign on the door.

## The options, in plain words

A. Only the waiting reply can close the mode, and any other refusal falls back to the terminal, the option built.
B. Add a closed reply to posting a question, so the first question after closing switches the mode off at once.

## What I had to decide

The contract says `GET /api/ask/rounds/:id/wait` answers `closed` for a closed or idle session, and s1's done-when says "a closed session deletes ask.json". It does not say what `POST /api/ask/sessions/:id/rounds` answers for a closed session.

## What I did meanwhile

Only a `wait` reply of `{status: "closed"}` deletes `ask.json` and `ask-round.json`. A refused round post (any non-2xx) prints nothing, so the terminal prompt shows, and `ask.json` stays. The fake server answers 409 to a round posted to a closed session; that is the fake's choice, not the contract's, and no test pins the hook to it.

## What it costs to change later

One branch in `preHook` once s2 names the reply.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- what s2's `POST /rounds` answers for a closed or 12-hour idle session

```

<!-- /omni-outbox-settled: s1-05-closed-session-signal -->

<!-- omni-outbox-settled: s2-01-rls-check-in-ci -->

## s2-01-rls-check-in-ci — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-rls-check-in-ci
prd: 71
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

The plan kept this slice away from the shared database checks and the automatic check runs, yet the test that proves one person cannot see another's ask sessions only protects anyone if it runs on every change. Should it run there?

## The decision, in plain words

The privacy test sits next to the game's own database test and runs automatically on every change that touches the database, just as that one does.

## The intro, for fun

A lock nobody ever tries is just a decoration on the door.

## The punchline, for fun

So this one gets its handle rattled on every change.

## The options, in plain words

A. Keep the privacy test next to the game's database test, run automatically on every database change, the option built.
B. Keep the privacy test inside this slice's own folders, and run it only by hand.
C. Fold the privacy test into the game's existing database test, so the whole database has one test.

## What I had to decide

The plan's territory for s2 names the migration, the ask routes and `apps/galaxy/src/ask/{api,store,auth}`, but not `supabase/checks/` or `.github/workflows/supabase.yml`. The done-when asks for "an RLS test run with two JWTs". The repository's only RLS check is `supabase/checks/access.sql`, which the `supabase` workflow runs with psql after `supabase db start` on every pull request touching `supabase/**`. A check file inside s2's own paths would run nowhere but by hand.

## What I did meanwhile

Added `supabase/checks/ask.sql` (the claims of two accounts' access tokens: A never reads, updates or deletes B's sessions or rounds, B never asks in A's session, an outsider opens nothing; plus the round's forward-only moves, the grants and the expiry) and one step in `.github/workflows/supabase.yml` that runs it after the access check. Both paths are outside s2's territory: a breach the wave reports.

## What it costs to change later

Removing it is deleting one file and one workflow step. Folding it into `access.sql` is a cut and paste. s3's own migration (`ask_cli_codes`) may want its checks beside it, in the same file or a step of its own.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan left `supabase/checks/` and the workflow out of s2's territory on purpose, or overlooked that the RLS test needs a place to run.

```

<!-- /omni-outbox-settled: s2-01-rls-check-in-ci -->

<!-- omni-outbox-settled: s2-02-contract-refusals -->

## s2-02-contract-refusals — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-contract-refusals
prd: 71
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

The agreed list of calls says what each call returns when it works, but not what it says when it cannot, such as a question sent to a session that is already over. What should those answers be?

## The decision, in plain words

Each refusal carries a standard code and a short reason: not signed in, not in the team, not found, already over, already answered, or the service is down. Whatever the refusal, the question falls back to the terminal, and closing a session or giving up on a question twice is simply fine.

## The intro, for fun

Every call already knows how to say yes; this one is about the polite ways to say no.

## The punchline, for fun

Now even the refusals come with a reason and a way home.

## The options, in plain words

A. Answer each refusal with a standard code and a short reason, and accept closing or giving up twice, the option built.
B. Answer every refusal the same way, so the hooks only learn that something went wrong.
C. Answer an ended session with a code that says it is gone for good, kept apart from the other refusals.

## What I had to decide

The spec's contract table fixes each call's success shape only. s1's hooks, built in the same wave, must tell a closed session from a network failure ("a `closed` session deletes `ask.json`"). Also unset: the success status (200 or 201), whether close and abandon may be repeated, what `/answers` does on a round the page already answered, and the input limits.

## What I did meanwhile

Every success is 200. `POST /sessions/:id/rounds` on a closed session, or one 12 hours idle: 409 `{error, status: "closed"}`. `/answers` or `/abandon` on an answered round: 409 `{error, status: "answered"}`, the page's answer kept. `close` answers `{id, status: "closed"}` and `abandon` `{id, status: "abandoned"}`, both again on a repeat. `/answers` takes `via: "terminal"` only (400 otherwise), records on an abandoned round too, and answers `{id, status: "answered", via: "terminal"}`. 401: no or invalid token; 403: not crew; 404: missing, another owner's, or not a uuid; 503: no database configured, or the Auth server unreachable; 500: a database error; 413: a body over 256 KiB; 400: a title outside 1 to 200 characters, or `questions` that is not a non-empty list of objects with `question` text (stored as given otherwise).

## What it costs to change later

Each is a constant or one branch in `apps/galaxy/src/ask/api.ts` and its test; no stored data depends on it. If s1's hooks already read another shape, one side's code changes, not the database.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) What s1's hook client expects on a closed session or an answered round: it is built in parallel, and its branch had no code pushed when this slice was built.

```

<!-- /omni-outbox-settled: s2-02-contract-refusals -->

<!-- omni-outbox-settled: s2-03-expiry-hourly -->

## s2-03-expiry-hourly — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-expiry-hourly
prd: 71
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Old ask sessions must be cleaned up, but nothing said how often the clean-up runs, or from when a week is counted for a session that was simply left idle. How should it work?

## The decision, in plain words

A clean-up runs once an hour inside the database, and a session is deleted with its questions and answers a week after it ends. A session left for 12 hours without activity counts as ended from that moment, without being rewritten.

## The intro, for fun

Every good party needs someone who stacks the chairs at the end.

## The punchline, for fun

Ours shows up every hour and never asks who stayed late.

## The options, in plain words

A. Clean up once an hour inside the database, and delete a session a week after it ends, counting an idle one as ended after 12 hours, the option built.
B. Clean up once a day, which keeps old sessions around a little longer.
C. Also mark idle sessions as ended in the database, so whatever reads them sees it without working it out.

## What I had to decide

The spec: "A session with no call for 12 h reads as closed, and rounds go 7 days after their session closes, both through one scheduled SQL function". Unsettled: the scheduler, how often it runs, whether an idle session is rewritten to closed, whether the session row goes with its rounds, and from when the 7 days count for a session that closed by idling.

## What I did meanwhile

`public.ask_expire()` deletes a session (its rounds cascade) closed more than 7 days ago (closing stamps `last_seen_at`), or still open with no call for 12 hours plus 7 days, and returns the count. It never rewrites an idle session: `sessionClosed()` in `apps/galaxy/src/ask/store.ts` reads one as closed, for the API and for the page. The migration enables `pg_cron` and schedules the function hourly at minute 17 as job `ask-expire`. It touches only the ask tables, and the API roles cannot run it.

## What it costs to change later

The schedule or the windows change with one new migration (`cron.schedule` under the same job name replaces the job). Rewriting idle sessions to closed is one more statement in the function. Data already deleted is gone, which is what the spec asks.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether `pg_cron` is allowed on the production Supabase project: the pull request check proves the migration on a fresh local stack only.

```

<!-- /omni-outbox-settled: s2-03-expiry-hourly -->

<!-- omni-outbox-settled: s2-04-round-moves-forward -->

## s2-04-round-moves-forward — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-04-round-moves-forward
prd: 71
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Once a question has been answered, or handed back to the terminal, may its answer still change, and may the web page still answer a question the terminal took over?

## The decision, in plain words

An answer, once given, is final, and a question handed back to the terminal can only be answered from the terminal, so the page never sends an answer nobody will read. Only the clean-up deletes sessions: their owners cannot.

## The intro, for fun

Some questions get a second chance; these ones get exactly one answer.

## The punchline, for fun

Changing your mind is still allowed, just not after the answer has left.

## The options, in plain words

A. Make every answer final, and let only the terminal answer a question it took over, the option built.
B. Let the page answer a question the terminal took over too, even though that answer never reaches Claude.
C. Also let people delete their own sessions whenever they like.

## What I had to decide

The spec gives the round's statuses (open, answered, abandoned) and `answered_via` (page, terminal), and says an abandoned round's terminal answer still shows on the page tagged terminal. It does not say which moves are allowed, whether an answer can be replaced, whether the page may answer an abandoned round, or whether an owner may delete a session. s4's page writes the page's answers.

## What I did meanwhile

A trigger (`ask_rounds_guard`) allows open to answered (page or terminal), open to abandoned, and abandoned to answered from the terminal only; an answer never changes, and `answered_at` is stamped. A closed session is never reopened (`ask_sessions_guard`), and closing stamps `last_seen_at`. Column grants: the owner inserts only `title` and `session_id, questions`, updates only `status, last_seen_at` and `status, answers, answered_via`, and deletes nothing.

## What it costs to change later

Loosening a rule is a new migration replacing a trigger function or a grant; no stored row changes shape. Meanwhile s4's page must not offer Send on an abandoned round, or the database refuses it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person should be able to delete a session before the week is out: the spec's scope is silent on it.

```

<!-- /omni-outbox-settled: s2-04-round-moves-forward -->
