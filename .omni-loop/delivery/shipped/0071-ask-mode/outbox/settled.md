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

<!-- omni-outbox-settled: s4-01-sign-in-comes-back -->

## s4-01-sign-in-comes-back — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-sign-in-comes-back
prd: 71
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

A person who opens the page signed out must sign in and land back on the same questions, but the shared way back from the sign-in belongs to a later slice and always goes to the arcade. How should the page bring them back?

## The decision, in plain words

The page has its own way back from the Google sign-in: it returns the person to the same session, and shows why when the sign-in was refused. The arcade's sign-in is untouched.

## The intro, for fun

Stepping out to fetch your coat should not send you to the back of the queue.

## The punchline, for fun

So the page keeps its own coat check right by the door.

## The options, in plain words

A. The page has its own way back from the sign-in, straight to the same session, the option built.
B. Teach the shared way back to return to any page it is told, in the sign-in slice, and drop the page's own.
C. Finish the sign-in inside the page itself, which shows the signed-out card again for a moment on the way back.

## What I had to decide

s4's done-when: signed out, `/ask/<id>` shows a sign-in card, and after the sign-in it comes back to the same session. The galaxy's only sign-in return, `app/auth/callback`, always redirects to `/` (the arcade), and it belongs to s3, which adds its `?next=ask-cli` branch there; it is outside this slice's territory.

## What I did meanwhile

The sign-in card starts the galaxy's Google sign-in (Supabase Auth, `hd=vertuoza.com`) with `redirectTo` set to `/ask/<id>/callback`, a route under `app/ask/[session]/`. It exchanges the code for the session cookie and redirects to `/ask/<id>`, or to `/ask/<id>?signin_error=<reason>` when Google or Supabase refused the sign-in, which the card then shows; anything that is not a session id goes home. A signed-out visitor always gets the sign-in card first, so not found is only said to someone signed in, and the not-found card offers "Sign in with another account" (it signs out of the galaxy and reloads). The logic is `src/ask/page/sign-in.ts`, tested in `sign-in.test.ts`. `SignInCard` takes its return path as a prop, so s3's `/ask/signin` page can reuse it.

## What it costs to change later

One route file and one small function. If s3 generalises the shared callback to return to a given path, the card's return path changes and the route is deleted; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether s3 means to generalise the shared callback for every page, which would make this route redundant.
- (author) Whether production's Supabase redirect allow-list really covers every path on the host, as the galaxy README says it should (`https://<host>/**`): this route relies on it and it could not be checked here.

```

<!-- /omni-outbox-settled: s4-01-sign-in-comes-back -->

<!-- omni-outbox-settled: s4-02-question-moves-on-time -->

## s4-02-question-moves-on-time — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-question-moves-on-time
prd: 71
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

The waiting side gives up after nine minutes and asks in the terminal instead, but it may not manage to tell the page. Should the page still offer to answer a question that has waited longer than that?

## The decision, in plain words

After nine minutes the page shows the question as moved to the terminal and no longer offers to send an answer, even when nobody told it. Until then it says how many minutes are left.

## The intro, for fun

A bus that left ten minutes ago can still be up on the timetable.

## The punchline, for fun

The page now reads the clock instead of waiting for the driver to call.

## The options, in plain words

A. Stop offering an answer after nine minutes, whatever the page was told, the option built.
B. Offer an answer until the page is told the question moved, even when nobody is waiting for it any more.
C. Stop a little before nine minutes, to leave room for a slow network.

## What I had to decide

The spec: the hook waits up to 540 s in total, then the terminal prompt shows, and the page marks the round "moved to the terminal" once the hook calls `abandon`. When the hook is killed instead (its 600 s timeout, the person interrupting Claude, a machine going to sleep), no `abandon` arrives and the round stays `open`; an answer sent then is stored and nobody reads it. The spec also says a person who takes longer than 9 min gets the terminal prompt, "and the page says so".

## What I did meanwhile

`sessionView` in `src/ask/page/view.ts` reads the newest round as open only while its status is `open`, its questions can be read, and less than `HOOK_WAIT_MS` (540 000 ms) has passed since `created_at`; otherwise it shows "moved to the terminal", with no Send. An older round still `open` under a newer one shows in the history as not answered. The page counts on the server's clock (the offset is taken at render time), and the footer says "moves to the terminal in N min".

## What it costs to change later

One constant; nothing stored depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the kit's 540 s total wait is final: the page repeats the number rather than reading it from the kit, so the two can drift.

```

<!-- /omni-outbox-settled: s4-02-question-moves-on-time -->

<!-- omni-outbox-settled: s4-03-own-answer-with-several-choices -->

## s4-03-own-answer-with-several-choices — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-own-answer-with-several-choices
prd: 71
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When a question allows several choices and the person also types their own answer, what should Claude receive?

## The decision, in plain words

Claude receives the ticked choices first, in the order they were offered, then the typed answer, all separated by commas. For a question with a single choice, typing an answer replaces the choice.

## The intro, for fun

Ticking three boxes and then writing in the margin is a very human way to fill in a form.

## The punchline, for fun

Claude now reads the margin too, right after the boxes.

## The options, in plain words

A. The ticked choices, then the typed answer, separated by commas, the option built.
B. The typed answer alone, dropping the ticked choices.
C. Let a person either tick choices or type an answer, never both.

## What I had to decide

The contract: several labels are joined with ", " for a multi-select, and the typed text is used for Other. It does not say what a multi-select sends when it has both labels and Other text, nor whether the labels keep the order they were clicked in or the order they are listed in.

## What I did meanwhile

`answerOf` in `src/ask/answer-model.ts`: a multi-select sends its chosen labels in the order the options are listed, then the Other text verbatim, joined with ", ". A single choice sends its label exactly as Claude wrote it, "(Recommended)" included, or the Other text when Other is chosen (typing in it chooses it). Other holding only blanks is no answer, so Send stays off. `answer-model.test.ts` covers each case.

## What it costs to change later

One function and its tests; answers already given are not affected.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) What the terminal prompt itself sends for a multi-select with typed text, which the page should match: no live session could be run here to see it.

```

<!-- /omni-outbox-settled: s4-03-own-answer-with-several-choices -->

<!-- omni-outbox-settled: s4-04-keys-in-a-round-of-several -->

## s4-04-keys-in-a-round-of-several — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-04-keys-in-a-round-of-several
prd: 71
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

One round can hold up to four questions on the page at once, and the number keys pick an option. Which question should a key press answer?

## The decision, in plain words

The number keys answer the question the person is working in, or else the first question still without an answer, so a whole round can be answered with the keyboard alone. Enter sends once every question has an answer.

## The intro, for fun

Four questions, four number keys, and one very eager keyboard.

## The punchline, for fun

Each key press goes to the first question still waiting its turn.

## The options, in plain words

A. Keys answer the question in focus, else the first one without an answer, the option built.
B. Keys answer only the question in focus, and do nothing until the person picks one.
C. Show one question at a time, like the terminal does, and move on after each answer.

## What I had to decide

The spec: keys `1`–`4` pick an option and `Enter` sends. `AskUserQuestion` takes one to four questions per call and the page shows them all at once; the spec does not say which question a key acts on, nor what `Enter` does inside the Other field.

## What I did meanwhile

`activeQuestion` and `pickByKey` in `src/ask/answer-model.ts`: a key acts on the question that holds the focus, else the first without an answer (else the last); in a multi-select it toggles. While the Other field has the focus, digits are text, `Enter` sends when Send is on and Shift+Enter breaks the line. Keys held with Ctrl, Alt or Cmd are left to the browser, and the key hint hides on touch screens.

## What it costs to change later

One function and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether people will expect Enter on a focused option to pick it, as in the terminal, rather than send the round once it is complete.

```

<!-- /omni-outbox-settled: s4-04-keys-in-a-round-of-several -->

<!-- omni-outbox-settled: s3-01-terminal-gets-its-own-sign-in -->

## s3-01-terminal-gets-its-own-sign-in — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-terminal-gets-its-own-sign-in
prd: 71
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

When a person signs the terminal in, should it share the sign-in their browser already has, or get one of its own?

## The decision, in plain words

The terminal always gets a sign-in of its own, through a fresh Google sign-in on the page, and the browser keeps its own untouched. Sharing one would sign one of them out the first time the other renews it.

## The intro, for fun

Two doors, one key, and a lock that changes itself every hour.

## The punchline, for fun

So the terminal got its own key cut, and nobody is left outside.

## The options, in plain words

A. The terminal always gets its own sign-in, through a fresh Google sign-in, the option built.
B. The terminal shares the browser's current sign-in when there is one and skips Google, accepting that one side may be signed out when the other renews.
C. The terminal shares the browser's sign-in, and automatic renewal of sign-ins is set up so that sharing never signs anyone out.

## What I had to decide

The spec says the callback hands the CLI a one-time code bound to the account, stored with a `refresh_token`, but not whose sign-in that token belongs to. The galaxy's Supabase Auth rotates refresh tokens (`enable_refresh_token_rotation = true`, `refresh_token_reuse_interval = 10` in `supabase/config.toml`): if the browser's cookie session and the terminal held the same refresh token, the first to renew it would make the other's next renewal a reuse past the interval, which Supabase treats as theft and answers by revoking the whole session, on both sides.

## What I did meanwhile

`/ask/signin` always starts the Google sign-in (`hd=vertuoza.com`, `prompt=select_account`), even when the browser is signed in already. The callback's `?next=ask-cli` branch exchanges Google's code with a Supabase client that reads only the PKCE code-verifier cookie and writes no session cookie (`cliCallbackDeps` in `apps/galaxy/src/ask/cli-code-live.ts`), so the arcade's session is neither read, renewed nor replaced. That new session's refresh token is stored with the one-time code, and `/api/ask/token` renews it once when the code is redeemed, so the tokens the terminal keeps were never in the browser. An account outside the crew is refused on `/ask/signin` with the reason, its new session is ended, and nothing reaches the terminal.

## What it costs to change later

A change of two files: reusing the browser's session instead would read its cookies in the callback and skip the Google round trip. Nothing stored depends on the choice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a person already signed in on the page will mind picking their Google account once more for the terminal
- whether the production Auth settings keep refresh-token rotation on, which is what makes sharing unsafe; they could not be read from here

```

<!-- /omni-outbox-settled: s3-01-terminal-gets-its-own-sign-in -->

<!-- omni-outbox-settled: s3-02-codes-kept-behind-two-steps -->

## s3-02-codes-kept-behind-two-steps — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-codes-kept-behind-two-steps
prd: 71
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The spec keeps the terminal's one-time sign-in codes where only the server's master key can reach them, but the site has no master key. How should the codes be kept safe?

## The decision, in plain words

Nobody reaches the codes directly. The site stores and uses them only through two narrow database steps: one that issues a code for the person who just signed in, and one that uses a code up, once.

## The intro, for fun

The spec asked for a safe that only the master key opens, in a house with no master key.

## The punchline, for fun

So the safe got two slots instead: one to drop a code in, and one to take it out, once.

## The options, in plain words

A. Keep the codes behind two narrow database steps, with no direct access for anyone signed in or not, the option built.
B. Give the site the master key on its server, and let only that key reach the codes, as the spec words it.
C. Keep the two steps, and also add a check run on every database change that proves nobody else reaches the codes.

## What I had to decide

The spec: "The CLI-code table is service-role only." The galaxy app holds only the anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`): every ask call runs as the caller, and no service-role key is configured or read anywhere in `apps/galaxy`. Yet the callback must write a code, and `/api/ask/token` must read and delete it for a caller who is not signed in yet.

## What I did meanwhile

`ask_cli_codes` (migration `20260926100000_ask_cli_codes.sql`) has row-level security with no policy, and no grant to `anon` or `authenticated`; only `service_role` keeps it. Two `security definer` functions are the only other way in: `ask_cli_code_issue(p_code_hash, p_refresh_token)`, executable by `authenticated` and refused outside the crew, stores a code bound to `auth.uid()` for 2 minutes; `ask_cli_code_redeem(p_code_hash)`, executable by `anon` and `authenticated`, deletes the code's row and returns it, once. Expired rows go on either call. `/api/ask/token` then refuses an expired code, renews the refresh token, and refuses a sign-in that is not the code's owner's. Proved locally on an in-memory Postgres (PGlite) with a stand-in auth schema, every migration applied in order; no check file was added to `supabase/checks/`, which is outside this slice's paths.

## What it costs to change later

Moving to a service-role key later means a secret on the deployment, a server-only client, and a migration dropping the two functions; the table and the codes' shape stay.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a service-role key on the galaxy's server is wanted at all, which the spec's wording assumes
- whether the code table's grants should also be proved on every pull request, next to the ask sessions check, which lives outside this slice's paths

```

<!-- /omni-outbox-settled: s3-02-codes-kept-behind-two-steps -->

<!-- omni-outbox-settled: s3-03-signout-forgets-on-this-computer -->

## s3-03-signout-forgets-on-this-computer — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-signout-forgets-on-this-computer
prd: 71
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

When a person signs the terminal out, should the sign-in also be ended on the server, or only forgotten on this computer?

## The decision, in plain words

Signing out forgets the sign-in on this computer only. The server is not told, so a copy taken before the sign-out would keep working until it runs out on its own.

## The intro, for fun

Throwing the key away takes a second, but the lock never hears about it.

## The punchline, for fun

For the lock to hear, the list of calls would need one more line.

## The options, in plain words

A. Forget the sign-in on this computer only, the option built.
B. Also end the sign-in on the server, through a new call added to the list of calls the page serves.
C. Also end it on the server, with the terminal asking the sign-in service directly.

## What I had to decide

The spec: "`signout` deletes them" (the tokens), and the contract under `/api/ask/*` has no call that ends a sign-in on the server. Ending it there would need either a new contract call, which this slice may not add on its own (the plan: a slice that needs to change the contract raises an item), or the kit calling Supabase Auth's logout directly, which would tie the kit to Supabase instead of to the contract.

## What I did meanwhile

`omni signout` removes the host's entry from `~/.config/omni/credentials.json` (the file goes with its last host, and stays at mode 0600 otherwise) and prints `signed out of <host>`, or `signed out` when there was nothing to forget; exit 0. `omni whoami` prints the email kept for the host of `ask.url`, or `signed out`, exit 0 both ways, from the file alone, with no call. With `ask.url` null, all three commands exit 1 with `ask mode is not set up for this repository (ask.url)`.

## What it costs to change later

Adding a server-side sign-out later is one new contract call, one route and a few lines in the command; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- how long a refresh token lives under the production Auth settings, which bounds how long a copied one keeps working; they could not be read from here

```

<!-- /omni-outbox-settled: s3-03-signout-forgets-on-this-computer -->

<!-- omni-outbox-settled: s5-01-where-this-repository-asks -->

## s5-01-where-this-repository-asks — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-where-this-repository-asks
prd: 71
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

This repository must name the address of the page its questions go to, but that address is written nowhere here and could not be checked from this computer. Which address should it name?

## The decision, in plain words

It names the address the hosting service gives the page's project by default. A person checks it once against the real address, and corrects it if the page lives elsewhere.

## The intro, for fun

A letter needs an address, and this envelope was sealed before anyone read the doorplate.

## The punchline, for fun

So it goes to the likeliest door, with a note to check the number.

## The options, in plain words

A. Name the address the hosting service gives the project by default, and have a person check it, the option built.
B. Leave the address empty, so ask mode stays off in this repository until a person fills it in.
C. Name a custom address under the company's own domain, chosen now.

## What I had to decide

The spec: "this repository sets `ask.url` to the galaxy's production URL". No file in the repository names that URL: `apps/galaxy/vercel.json` gives only the region, and the deploy steps in `apps/galaxy/README.md` write it as `https://<production host>`. The deployed app could not be reached from this container either (the egress proxy refuses `*.vercel.app`).

## What I did meanwhile

`.omni-loop/config.yml` sets `ask.url: https://vertuo-omni-loop-galaxy.vercel.app`, the default production domain Vercel gives the project `vertuo-omni-loop-galaxy` (the name the Vercel bot's comments on this PRD's sub-PRs give it, in team `vertuoza-a88dca1a`), with a comment saying so. Nothing in the kit depends on the value. A sign-in is kept under the host of `ask.url`, so after a correction each person runs `omni signin` once more.

## What it costs to change later

One line of `.omni-loop/config.yml`. A sign-in kept under a wrong host is simply never read again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The galaxy project's real production domain: Vercel gives `<project>.vercel.app` only when it is free, else a suffixed one, and a custom domain may be attached.
- (author) Whether the production Supabase redirect allow-list and the Google sign-in already accept this host for `/ask/signin` and `/ask/<id>/callback`.

```

<!-- /omni-outbox-settled: s5-01-where-this-repository-asks -->

<!-- omni-outbox-settled: s5-02-switching-when-the-page-is-away -->

## s5-02-switching-when-the-page-is-away — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-switching-when-the-page-is-away
prd: 71
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

Turning ask mode on or off talks to the page's server, which may be unreachable or may refuse the sign-in. What should each do then?

## The decision, in plain words

Turning it on changes nothing unless a new session was opened, so a session already on stays on. Turning it off always stops sending questions to the page from this computer, and says so when the page could not be told.

## The intro, for fun

Flipping a switch is easy, until the wire on the far end goes quiet.

## The punchline, for fun

Now the near side always obeys, and the switch admits when the far side did not hear.

## The options, in plain words

A. Turning on changes nothing unless a new session opened, and turning off always works on this computer with a warning, the option built.
B. Turning off fails too when the page cannot be told, and the mode stays on until it can.
C. Turning on closes the old session before opening the new one, so two are never open at once.

## What I had to decide

The spec: `off` "closes the session and deletes the file", and a second `on` "replaces the first session and closes it". It does not say what either does when a call fails, in which order a second `on` opens and closes, what `off` does when `ask.url` is null or names another host than the session's, what the title is on a detached HEAD or without a repository slug, nor what `/omni:ask` does when the computer has no sign-in.

## What I did meanwhile

`turnOn` in `kit/lib/ask/mode.mjs` opens the new session first; only once it has an id and a link does it write `ask.json` (and clear `ask-round.json`), then close the session it replaced. When opening fails (unreachable, a 401 the refresh cannot cure, a 403), nothing changes and `omni ask on` exits 1 with one line, naming `omni signin` for a missing or refused sign-in. `turnOff` tries to close the session, then deletes `ask.json` and `ask-round.json` whatever happened: when the close failed, or `ask.url` is null or names another host, `omni ask off` still prints `off` and exits 0, with one stderr line saying the session was left open and closes by itself after 12 hours without a call. A 404 on close counts as closed. `omni ask status` reads only the checkout, as the hooks do, and calls nothing. The title is `<repo.slug, else the folder's name> · <branch, else the short commit>`, cut at 200 characters (the server's limit). `/omni:ask on`, told to sign in, asks the person to run `omni signin` themselves and never runs it for them, since it opens a browser and waits.

## What it costs to change later

A few lines in `kit/lib/ask/mode.mjs` and `kit/plugin/skills/ask/SKILL.md`, and their tests; nothing stored depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person would rather see `omni ask off` fail when the page could not be told, since the page then shows the session open for up to 12 hours.
- (author) Whether `omni ask status` should ask the server, so that a session closed on the page reads as off at once.

```

<!-- /omni-outbox-settled: s5-02-switching-when-the-page-is-away -->

<!-- omni-outbox-settled: s5-03-a-readme-for-the-kit -->

## s5-03-a-readme-for-the-kit — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-a-readme-for-the-kit
prd: 71
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

The plan asks for one line about ask mode in the kit's own readme, but the kit had no readme. Where should the line go?

## The decision, in plain words

A short readme for the kit was written: one paragraph on what the kit is, then the paragraph on ask mode. The repository's front page is unchanged.

## The intro, for fun

Adding a line to a book that was never printed takes a little extra paper.

## The punchline, for fun

So the book got a cover, one page, and exactly that line.

## The options, in plain words

A. Write a short readme for the kit, holding the line, the option built.
B. Put the line on the repository's front page instead, outside this slice's ground.
C. Leave the line out until the kit has a fuller readme.

## What I had to decide

The spec's scope names "a line in the kit README" and the plan gives `kit/README.md` to s5, but no `kit/README.md` exists on the feature branch or on `main`. The only README is the repository's own `README.md`, outside this slice's territory, whose table names `kit/` "the delivery kit (`omni` CLI)".

## What I did meanwhile

Created `kit/README.md`: one paragraph on what the kit is (the `omni` CLI, shipped bundled as `kit/dist/omni.mjs`, and the `omni` plugin's skills and hooks, reading everything specific to a repository from its `.omni-loop/config.yml`), then one on ask mode (`omni signin` once per computer, `/omni:ask on` prints the page's link, `/omni:ask off` turns it off, `ask.url` null by default, and the terminal takes over whenever the page cannot answer). `kit/test/no-game-words.test.mjs` scans it like every other non-test file under `kit/`.

## What it costs to change later

Deleting one file, or moving its ask mode paragraph to the repository's front page.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan meant the repository's front page, or expected a kit readme to exist already.

```

<!-- /omni-outbox-settled: s5-03-a-readme-for-the-kit -->

<!-- omni-outbox-settled: s1-01-live-proof-not-run -->

## s1-01-live-proof-not-run — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-09-26T05:16:51Z
- Channel: feature pull request #73
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/73#issuecomment-5843460219
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1
- Stays here: a one-off gate for this feature (a person runs the live proof before shipping), not a lasting rule; laws.source is none

### The answer, as it was given

```text
go with recommendation
```

### The item, as it was raised

```text
---
id: s1-01-live-proof-not-run
prd: 71
slice: s1
rank: high
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

This slice was meant to prove, in a real Claude session, that an answer given on the page reaches Claude and the terminal question never shows. That proof could not be run here, so should the build carry on before a person runs it?

## The decision, in plain words

Everything the proof sits on is built and tested against a stand-in server, and the live proof is left for a person to run on their own computer. The next slices carry on, and the feature is not shipped until the proof has passed.

## The intro, for fun

Everything is wired up and tested, except the one check that needs a real person at the keyboard.

## The punchline, for fun

The doorbell is built and wired, but nobody here was allowed to press it.

## The options, in plain words

A. Carry on, and have a person run the live proof before the feature is shipped, the option built.
B. Hold the slice that turns the mode on until a person has run the live proof.
C. Stop the whole feature now and send it back to design until the proof has been run.

## What I had to decide

Whether slice s1 can finish without its live tracer. The plan makes the tracer s1's gate: "a live Claude Code session with the plugin loaded and `ask.json` pointing at the fake server receives the fake's answer as its `AskUserQuestion` result, and the terminal prompt never shows. When this fails, the slice stops with an outbox item." Here it could not run at all, which is not the same as failing. In this container `claude -p` runs a live session but does not offer `AskUserQuestion` in headless mode (the model found no such tool, even through tool search), and driving an interactive `claude` session from a terminal multiplexer was refused by this session's permission policy.

## What I did meanwhile

Built and tested against `kit/test/fake-ask-server.mjs`: `ask.url`, the local state under `.omni-loop/local/`, the contract client and its token store, `omni ask hook pre|post|prompt`, and `kit/plugin/hooks/hooks.json`. `claude plugin validate` passes on the plugin with its hooks. A live headless run (`claude -p --plugin-dir kit/plugin` in a scratch checkout carrying the built bundle as `.omni-loop/bin/omni.mjs`, with ask mode on against the fake server) loaded the plugin and ran the `UserPromptSubmit` hook, which returned the context line with exit 0; the pre and post hooks were never reached, since that mode has no `AskUserQuestion`. To run the proof by hand: in a checkout whose `.omni-loop/bin/omni.mjs` is this branch's `kit/dist/omni.mjs` and whose config sets `ask.url: http://127.0.0.1:47831`, start `node kit/test/fake-ask-server.mjs --port 47831` (it prints a session id and answers every round with each question's first option), write `.omni-loop/local/ask.json` as `{sessionId, url, host: "127.0.0.1:47831"}` and `~/.config/omni/credentials.json` as `{"127.0.0.1:47831": {"access_token": "access-1", "refresh_token": "refresh-1"}}`, run `claude --plugin-dir kit/plugin`, and ask Claude to call `AskUserQuestion`. Pass: no terminal prompt, and Claude reports the first option as the answer. For the post hook, restart the fake with `--answer none`: after nine minutes without an answer the terminal prompt shows, and an answer typed there appears in the fake's log as a call to `/answers` with `via: "terminal"`.

## What it costs to change later

If the hook cannot answer `AskUserQuestion`, the spec sends the PRD back to design. The hooks here would be reworked or dropped, s5 (which turns the mode on) would wait, and the server and page slices would stand only if the redesign keeps the same contract.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a PreToolUse hook's `updatedInput.answers` answers `AskUserQuestion` in a live interactive session without showing the terminal prompt — the load-bearing assumption the spec names
- the exact shape of the PostToolUse `tool_response` for `AskUserQuestion`: the post hook reads `tool_response.answers` (question text to label) and falls back to `tool_input.answers`, unverified live

```

<!-- /omni-outbox-settled: s1-01-live-proof-not-run -->

<!-- omni-outbox-settled: s5-04-acceptance-not-run-here -->

## s5-04-acceptance-not-run-here — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-09-26T05:16:51Z
- Channel: feature pull request #73
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/73#issuecomment-5843460219
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-09-25
- Slice: s5
- Wave: 4
- Stays here: a one-off gate for this feature (a person runs the acceptance before shipping), not a lasting rule; laws.source is none

### The answer, as it was given

```text
go with recommendation
```

### The item, as it was raised

```text
---
id: s5-04-acceptance-not-run-here
prd: 71
slice: s5
rank: high
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

This slice was to be accepted by a person answering real questions on the live page, in both themes and with the network off, with screenshots. None of that could be run here, so can the slice go in before a person runs it?

## The decision, in plain words

Everything that can be tested without the live page is built and tested, and the checks a person must run are listed step by step. The feature is not shipped until a person has run them and they pass.

## The intro, for fun

The switch is wired, labelled and tested on a bench, but never yet on the wall.

## The punchline, for fun

The bench says it works; the wall still gets the final word.

## The options, in plain words

A. Merge the slice, and have a person run the acceptance before the feature ships, the option built.
B. Hold this slice unmerged until a person has run the acceptance.
C. Send the feature back to design until the live proof has been run.

## What I had to decide

The plan's done-when for s5 ends: "The manual acceptance is recorded in the sub-PR with screenshots: a `/omni:brainstorm` question answered on the page in light and in dark theme; a multi-select and an Other answer received exactly; with the network off, the same question shows as the terminal prompt, and its answer appears in the page's history tagged `terminal`; after `/omni:ask off`, the page shows "session closed"." In this container there is no Google sign-in, no live Supabase, no route to the deployed app (the egress proxy refuses `*.vercel.app`), and driving an interactive `claude` session was refused by the session's permission policy for an earlier slice. The first scenario is also the live proof s1 could not run (item `s1-01-live-proof-not-run`): that a hook's `updatedInput.answers` answers `AskUserQuestion` with no terminal prompt.

## What I did meanwhile

No screenshot exists, and none of the four scenarios was run. What was run instead: `kit/bin/ask.test.mjs` runs `omni ask on`, a `pre` hook answered through that session, and `omni ask off` against `kit/test/fake-ask-server.mjs`, and runs the CLI as a process with a temporary HOME. The built bundle, copied into a scratch checkout as `.omni-loop/bin/omni.mjs`, was run the same way: `ask status` prints `off`; `ask on` signed out exits 1 naming `omni signin`; signed in it prints the link; the `pre` hook returns the fake's answer; a second `on` closes the first session; `ask off` closes the second and the `prompt` hook goes quiet; `git status` stays clean; `ask.url: null` makes `ask on` exit 1 with the one-line reason. To run the acceptance: deploy the feature branch with its two migrations applied; check `ask.url` in `.omni-loop/config.yml` against the app's real address (item `s5-01-where-this-repository-asks`); load the plugin from this branch; `omni signin`; `/omni:ask on` and open the link; run `/omni:brainstorm` and answer on the page in light theme, then in dark; answer a multi-select and an Other; while a question waits on the page, cut the network (it shows in the terminal), restore it, answer in the terminal, and check the page's history shows it tagged terminal; `/omni:ask off`, and check the page says "session closed". Screenshot each step into the feature PR.

## What it costs to change later

If the live run fails, the fix lands in the hooks, the page or the contract, and the PRD may go back to design as its spec says; nothing stored in a repository depends on it. Shipping without the run would put an unproven answer path in front of every person who turns the mode on.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a hook's answer reaches Claude in a live interactive session without the terminal prompt showing, the assumption the spec names as load-bearing.
- (author) Whether the production sign-in accepts the page's return addresses, and whether the two ask migrations are applied to the production database.

```

<!-- /omni-outbox-settled: s5-04-acceptance-not-run-here -->
