# Settled outbox items — PRD 2537

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-claude-limit-recordings -->

## s1-01-claude-limit-recordings — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-claude-limit-recordings
prd: 2537
slice: s1
rank: medium
bears-on: none
raised: 2026-10-28
wave: 1
---

## The question, in plain words

How does the runner know that Claude ran out of its plan, and how full its memory of the job is, when nobody on the team has caught a real run hitting its limit yet?

## The decision, in plain words

We taught the runner the shapes Claude's own program says it prints, wrote sample runs in those shapes, and count a model's memory as 200,000 words-pieces, or a million when its name says so.

## The intro, for fun

Nobody wants to burn a whole plan just to see what the wall looks like.

## The punchline, for fun

So we drew the wall from the blueprints and will check it when we bump into it.

## The options, in plain words

A. Keep the drawn recordings and the 200,000 or 1,000,000 window, the option built.
B. Catch a real limit run and a real warning run on the runner box, and replace the drawn recordings before s3 and s8 merge.
C. Read the window from each account's own context setting only, with no default, so a planned context handoff never fires on a guess.

## What I had to decide

Whether the sample runs that teach the runner Claude's limit and its pressure readings may stay drawn from the program's documented shapes, or must be replaced by runs caught on a real runner before the turnover slices rely on them.

## What I did meanwhile

The recordings in kit/lib/runner/fixtures/claude/ follow the stream-json shapes of Claude Code 2.1 (the rate_limit_event's rate_limit_info, the synthetic rate_limit message, an is_error result); the context window is 200,000 tokens, 1,000,000 for a model whose name ends in [1m], and the context counts the last message's input, cache and output tokens.

## What it costs to change later

Replacing a recording is a file swap and a test run; the window is one constant that s8's contextWindow setting overrides per account.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) no real run at Claude's usage limit was captured: running claude from the slice's agent was refused, and no runner log on this machine holds one
- whether a real limit run carries a rejected rate_limit_event before its result, or only the words
- (author) whether the context should count the last message's output tokens, which the next turn reads back

```

<!-- /omni-outbox-settled: s1-01-claude-limit-recordings -->

<!-- omni-outbox-settled: s1-02-claude-check-own-secret -->

## s1-02-claude-check-own-secret — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-claude-check-own-secret
prd: 2537
slice: s1
rank: medium
bears-on: none
raised: 2026-10-28
wave: 1
---

## The question, in plain words

Before a job starts on a Claude account that carries its own sign-in key, how does the runner know the key still works?

## The decision, in plain words

It only checks that Claude is installed and that the key is not empty: a key that no longer works shows up as a failed job, not as an account marked unusable beforehand.

## The intro, for fun

A key on the hook looks the same whether it opens the door or not.

## The punchline, for fun

We only find out by turning it, so the runner turns it on the first job.

## The options, in plain words

A. Check the key is there and not blank, the option built.
B. Prove the key with one short call to Claude when the runner starts, and mark the account not signed in when it fails.

## What I had to decide

Whether a direct Claude account with its own key is checked only for an installed Claude and a key that is not blank, or by a call that proves the key, which costs a request each time the runner starts.

## What I did meanwhile

The check runs claude --version for every account; an account with no key of its own also runs claude auth status, as the runner does today; an account with a key passes unless the key is blank, which reads not signed in.

## What it costs to change later

One branch in the check of the claude adapter.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether claude auth status reports the key a run is given in its variables rather than the machine's own sign-in; it was not tried, so it is not relied on

```

<!-- /omni-outbox-settled: s1-02-claude-check-own-secret -->

<!-- omni-outbox-settled: s3-01-outside-territory -->

## s3-01-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-28
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-outside-territory
prd: 2537
slice: s3
rank: medium
bears-on: none
raised: 2026-10-28
wave: 3
---

## The question, in plain words

For a job's parts to reach the Runners page, the runner itself had to read them and send them, which lives in files the plan gave to other slices. Should this slice have touched them?

## The decision, in plain words

We made the four small changes the turnover cannot work without, outside the slice's own files: the runner sends the parts and masks every account's secret, the job command hands the job its accounts, the record of which accounts are out is read again at each look so both programs see it, and the weekly clean-up also removes the parts file and the handoff note with the job's log.

## The intro, for fun

The plan drew a fence, and the parts had to climb over it to reach the page.

## The punchline, for fun

We climbed four times, small steps, and wrote each one down.

## The options, in plain words

A. A. Keep the four changes as built, each with its test.
B. B. Move the runner's reporting and the job command's wiring to s6, leaving s3's turnover running on the machine with nothing sent until s6 merges.
C. C. Keep the reporting but drop the sweep and book changes, and open a bug for each.

## What I had to decide

Whether the four changes outside the territory stand: kit/lib/runner/runner.ts (parts in every report, refused once means sent again without and never after, turnover's reason on a failed job, every account's secret masked), kit/bin/commands/runner.ts (omni runner job --account passes the file's accounts as its turnover), kit/lib/runner/accounts.ts (the account book reads accounts-state.json at every look and before every mark, so the runner sees an account the job's process marked out and neither drops the other's mark) and kit/lib/runner/sweep.ts (a job file with two extensions, job-<id>.parts.json and job-<id>.handoff.md, is swept with the log, as L-GDPR-4 asks of the note).

## What I did meanwhile

Built all four with tests beside each (runner.test.ts, kit/bin/commands/runner.test.ts, accounts.test.ts, sweep.test.ts). No sibling of wave 3 owns runner.ts, accounts.ts or sweep.ts; s4 also edits kit/bin/commands/runner.ts, in another function (t3-signin), so the merge should be clean.

## What it costs to change later

Each change is a few lines and a test: undoing one is a revert of that hunk. Undoing the runner's part would leave the parts on the machine only; undoing the book's reread would let the runner start a job on an account a job just marked out, which then turns over at once.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- s6 (wave 4) owns runner.ts next and builds the pause on the same book: it may prefer to read the accounts' states another way. (author)
- Whether the plan should have listed runner.ts and the job command in s3's territory, or a later slice should carry the reporting. (author)

```

<!-- /omni-outbox-settled: s3-01-outside-territory -->

<!-- omni-outbox-settled: s3-02-how-a-part-reads -->

## s3-02-how-a-part-reads — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-28
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-how-a-part-reads
prd: 2537
slice: s3
rank: medium
bears-on: none
raised: 2026-10-28
wave: 3
---

## The question, in plain words

The design says how a job's parts read on the Runners page and why a job fails when it runs out of accounts, but not every word: what time zone, what a part that ended on its context says when no percent is known, and what the failure says when the job changed account too often.

## The decision, in plain words

Times read in UTC, as the rest of the app gives them; a part that ended on its context reads context full, and one on a usage warning reads usage warning, until a later slice adds the percent; the agent and model sit after the tokens beside the status; and a job that changed account three times fails saying no tokens left, then that it changed account three times, the most a job may.

## The intro, for fun

Every part of a job got a name tag, and someone had to pick the font.

## The punchline, for fun

We picked the plainest one and left room for the percent to join later.

## The options, in plain words

A. A. Keep the words as built: UTC, context full and usage warning until a percent exists, the agent after the tokens, the cap named after no tokens left.
B. B. Show the reader's own time zone, and the agent right after the status.
C. C. Give the cap a reason of its own that does not start with no tokens left.

## What I had to decide

The words of a part's line and of the cap's failure: `HH:MM` in UTC (title: `<account> out until HH:MM UTC`, `(guessed)` when the agent named no reset); `usage limit`, `usage warning`, `context full`, `done`, `failed` for the end, the spec's `usage <n> %` and `context <n> %` waiting for a percent the part does not carry yet (s8); the agent and model after the tokens, so the running row still reads `Running 12 min 1.5M tokens`; the cap's reason `no tokens left: the job changed account 3 times, the most a job may`, which starts as the done-when's `no tokens left:` while naming the cap, as the spec's Caps section asks.

## What I did meanwhile

Built them in apps/galaxy/src/runners/page/parts.ts and kit/lib/runner/turnover.ts, with tests of each word. A direct Claude part names its model only when its transcripts can be read; otherwise the line names the account alone.

## What it costs to change later

Each is a constant or one line in parts.ts or turnover.ts; nothing is stored in these words, so changing one changes every row at once.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the page should show the reader's own time zone instead of UTC. (author)
- The part has no usage or context percent yet: s8 adds the planned handoffs and may add the field. (author)
- A direct Claude part whose transcripts cannot be read names no model, though its stream named one: the adapter's usage reads the model only with the tokens. (author)

```

<!-- /omni-outbox-settled: s3-02-how-a-part-reads -->

<!-- omni-outbox-settled: s4-01-t3-instance-from-the-file -->

## s4-01-t3-instance-from-the-file — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-28
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-t3-instance-from-the-file
prd: 2537
slice: s4
rank: medium
bears-on: none
raised: 2026-10-28
wave: 3
---

## The question, in plain words

The runner hands each agent an account with its name, model and secret, but not the T3 instance it runs on. How should the T3 agent learn the instance?

## The decision, in plain words

The T3 agent looks the account up again in the accounts file on the machine, by its name, and reads its instance there.

## The intro, for fun

An account walks into a runner with a name, a model and a secret, and forgets to say where it lives.

## The punchline, for fun

So the agent checks the address book again.

## The options, in plain words

A. The T3 agent reads the account's instance from the accounts file, by the account's name (built).
B. The account every agent is handed carries its instance, so no agent reads the file again.

## What I had to decide

`AgentAccount` (`kit/lib/runner/agents/agent.ts`) carries `id`, `model` and `secret` only, and `agentAccountOf` (`kit/lib/runner/accounts.ts`) builds it; both are outside s4's territory. The `t3` agent (`agents/t3.ts`) resolves an account's instance by reading `~/.config/omni/accounts.yml` again under the home it is built with (`homedir()` unless given), or through an injected `instanceOf`. `runner.ts`'s `takeAccount` builds agents with `{ projects, exec }` only, so its check reads the file under `homedir()`, which is the runner's home in practice. Option B adds an optional `instance` to `AgentAccount`, set in `agentAccountOf`; s8 (wave 4) touches `accounts.ts` and could take it.

## What I did meanwhile

Built A, with an injected `instanceOf` in the tests; `omni runner job` hands the t3 agent the home it reads the file from.

## What it costs to change later

One optional field and one line in two files, and the lookup in `t3.ts` removed: no stored shape, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person wants the agent's account to carry its instance now rather than in s8 (author)

```

<!-- /omni-outbox-settled: s4-01-t3-instance-from-the-file -->

<!-- omni-outbox-settled: s4-02-opencode-store-not-read-yet -->

## s4-02-opencode-store-not-read-yet — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-28
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-opencode-store-not-read-yet
prd: 2537
slice: s4
rank: medium
bears-on: none
raised: 2026-10-28
wave: 3
---

## The question, in plain words

For an OpenCode account run through T3, where should the runner read the steps, the tokens and how full the context is?

## The decision, in plain words

For now an OpenCode run shows the messages T3 reports as its steps, and counts no tokens and no context: the runner does not read OpenCode's own session store yet.

## The intro, for fun

OpenCode keeps a diary, but nobody here has seen what its pages look like yet.

## The punchline, for fun

So the runner reads the postcards T3 forwards instead.

## The options, in plain words

A. Show T3's messages as an OpenCode run's steps and count no tokens until a recording of OpenCode's store exists (built).
B. Read OpenCode's session store now, from its documented layout, with no recording.
C. Record an OpenCode run on the laptop first, then read its store in a slice of its own.

## What I had to decide

s4's done-when asks for OpenCode's session store. Neither T3 0.1.3's source nor the laptop trial's recordings show its layout (recent OpenCode versions moved it from JSON files under `~/.local/share/opencode/storage` to a SQLite database), so any reader would be a guess with no recording to test it on. `t3-run` prints the new assistant messages of `t3 thread show` for an instance that is not Claude, the `t3` agent turns them into `›` step lines, and its `usage()` and context are `null` for it.

## What I did meanwhile

An OpenCode job runs, its log shows T3's messages, its report carries no tokens (null, never 0), and it reads no context pressure, so it hands off at the wall only.

## What it costs to change later

A reader module and a recording of the store; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The layout of OpenCode's session store in the version the runner's machine runs (author)

```

<!-- /omni-outbox-settled: s4-02-opencode-store-not-read-yet -->

<!-- omni-outbox-settled: s4-03-t3-limit-from-its-words -->

## s4-03-t3-limit-from-its-words — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-28
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-t3-limit-from-its-words
prd: 2537
slice: s4
rank: medium
bears-on: none
raised: 2026-10-28
wave: 3
---

## The question, in plain words

T3 knows when a run hit its account's usage limit, but its command line only passes on the error message. How should the runner tell a limit from a crash?

## The decision, in plain words

The runner reads T3's error words: a usage or rate limit message is a limit, and its reset is counted from the wait the message names, or guessed when it names none. T3's own folder is taken to be the usual one in the home.

## The intro, for fun

T3 knows exactly why a run stopped; it just only says so in a sentence.

## The punchline, for fun

The runner has learnt to read between the lines.

## The options, in plain words

A. Read the limit from T3's error words, and T3's files from the usual folder (built).
B. Read the limit from T3's own database on the machine.
C. Ask T3 to add the failure class and its reset to its JSON output, and read the words until then.

## What I had to decide

T3 0.1.3 keeps a failure class (`usage_limit`) and a reset time for each failed run, but `t3 thread start --wait --json` and `t3 thread show --json` give only the status and the error message (`apps/server/src/mcp/OrchestratorMcpService.ts` renders an error item as `failure.message`). The `t3` agent's `limit()` matches `usage limit reached`, `rate limit reached` and `hit your limit`, and reads `resets in 2h 30m` or `resets in 1d 3h` from the run's end time; none named, the reset is `null` and the runner's one-hour guess applies. Its reads of T3's own files assume `~/.t3`: `T3CODE_HOME` is not read, since the environment is read in `kit/lib/env/read.ts` only, outside this slice.

## What I did meanwhile

A limit T3 words differently reads as a crash: the job fails as today and no other account takes over, which the spec's risks already accept.

## What it costs to change later

A regular expression and a constant; reading a failure class later replaces them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether T3 will give the failure class and reset in its JSON output (author)
- Whether any runner's machine sets T3CODE_HOME (author)

```

<!-- /omni-outbox-settled: s4-03-t3-limit-from-its-words -->

<!-- omni-outbox-settled: s4-04-t3-signin-built-from-source -->

## s4-04-t3-signin-built-from-source — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-28
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-04-t3-signin-built-from-source
prd: 2537
slice: s4
rank: medium
bears-on: none
raised: 2026-10-28
wave: 3
---

## The question, in plain words

The sign-in to T3 and the stop of a running thread were built from T3's source code, not tried on a running T3. Should they ship before someone tries them on the machine?

## The decision, in plain words

They ship, tested against T3's exchanges as its source defines them. The first real try is the person's, with the sign-in command on the laptop; until it works, accounts simply hand off at their wall.

## The intro, for fun

The runner learnt T3's secret handshake from the manual, not from a real handshake.

## The punchline, for fun

The first date on the laptop will tell.

## The options, in plain words

A. Ship the sign-in and the stop as built from T3's source, tested on recordings made from it (built).
B. Hold them until a recording from a running T3 replaces the built ones.

## What I had to decide

The laptop trial recorded `thread start` and `thread show`, not the OAuth sign-in nor an MCP stop. `kit/lib/runner/t3-mcp.ts` follows T3 0.1.3's `apps/server/src/auth/McpOAuth.ts` and `mcpOAuthHttp.ts`: a public client registered at `/oauth/mcp/register`, Full access approved at `/oauth/mcp/decision` with a pairing code from `t3 auth pairing create --json`, PKCE S256, a form-encoded exchange at `/oauth/mcp/token`, a 30-day credential; then `initialize`, `notifications/initialized` and `tools/call t3_thread_interrupt` on `/mcp`. The fixtures `oauth-*.json`, `pairing-create.json` and `mcp-*.sse` are built from that source, not recorded. T3 issues no refresh token: after 30 days the account reads `T3 sign-in missing: planned handoffs off` until `omni runner t3-signin` runs again.

## What I did meanwhile

A sign-in that fails breaks nothing: `interrupt()` is `null`, the account hands off at its wall only, and the runner says so when it starts.

## What it costs to change later

Refreshing a recording and adjusting one exchange.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether T3's decision endpoint takes a pairing code with no browser session in practice (author)

```

<!-- /omni-outbox-settled: s4-04-t3-signin-built-from-source -->

<!-- omni-outbox-settled: s4-05-t3-project-per-run -->

## s4-05-t3-project-per-run — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-28
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-05-t3-project-per-run
prd: 2537
slice: s4
rank: medium
bears-on: none
raised: 2026-10-28
wave: 3
---

## The question, in plain words

The design says the job's worktree stays a T3 project until the job ends, but a T3 run only knows when it ends itself. When should the project go?

## The decision, in plain words

Each T3 run removes the project when it ends, except a run stopped to be resumed for its note; a later run in the same worktree adds it again. A run waits for its end through T3's own wait, the only way T3 gives the error back.

## The intro, for fun

Every run tidies its desk when it leaves, unless it is only stepping out for a minute.

## The punchline, for fun

The one sent home mid-shift leaves its coffee cup behind.

## The options, in plain words

A. Remove the project at the end of each run, unless the run was stopped to be resumed (built).
B. Remove it when the job ends, from the runner's clean-up, so a killed job leaves nothing in T3.

## What I had to decide

`omni runner t3-run` is one process per run (`job.ts` starts one per run); the job's end is `runner.ts`'s, outside this slice. `t3 project remove --force` deletes the thread too, so a resume after it would fail: a run that ended `interrupted` keeps the project, and the resumed run removes it. The spec's `thread start … --json` followed by `thread show` every 5 s is kept with `--wait` added, since `thread show` carries no error and only the waiting call prints `{status, reply, error}`; `thread list --project <worktree>` finds the thread's id while it runs.

## What I did meanwhile

A run the runner kills (timeout, cancel) leaves its project and thread in T3; the waiting `t3` call ends on its own when the thread does.

## What it costs to change later

Moving the removal into the runner's clean-up: a few lines in `runner.ts`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How often the runner kills a T3 run (a timeout, a cancel) and leaves its project behind (author)

```

<!-- /omni-outbox-settled: s4-05-t3-project-per-run -->

<!-- omni-outbox-settled: s5-01-skills-folder-and-version -->

## s5-01-skills-folder-and-version — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-28
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-skills-folder-and-version
prd: 2537
slice: s5
rank: medium
bears-on: none
raised: 2026-10-28
wave: 3
---

## The question, in plain words

Where exactly does a Codex or OpenCode instance keep the skills it reads, and which version of the kit's skills does the runner write there, when the runner's own kit and the repository's pinned kit may differ?

## The decision, in plain words

The runner puts the skills in each agent's own skills folder, and writes the ones from its own kit only when that kit is as new as the repository's. An older runner kit makes the account read as having no skills rather than write old ones.

## The intro, for fun

A skill is only useful if the agent can find it, and only safe if it never lands in the pull request.

## The punchline, for fun

So the skills move into the agent's house, and the repository's door stays shut.

## The options, in plain words

A. The runner's kit writes its own skills when it is as new as the repository's pin, the option built.
B. The runner runs the repository's own kit to write the skills, so the version always matches the pin exactly.
C. The runner writes the skills of whichever kit is newest it can find, with no check.

## What I had to decide

How to honour "at the repository's pinned version" when the runner holds only its own kit's skills, and which folders the two agents read.

## What I did meanwhile

Built A, the way the Claude plugin is kept (a plugin as new or newer is accepted). The folders were taken from the spec, not from a real Codex or OpenCode install, so they are one function to correct.

## What it costs to change later

Option B is a different source of the skills text; the folder rules are one function, `instanceSkillsDir`, and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) no Codex or OpenCode install was available to confirm the folders they list skills from
- whether a newer runner kit's skills may differ from the repository's pin in a way that breaks a job

```

<!-- /omni-outbox-settled: s5-01-skills-folder-and-version -->

<!-- omni-outbox-settled: s8-01-budget-counts-this-job -->

## s8-01-budget-counts-this-job — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-28
- Slice: s8
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-01-budget-counts-this-job
prd: 2537
slice: s8
rank: medium
bears-on: none
raised: 2026-10-28
wave: 4
---

## The question, in plain words

An account can be given a daily budget of tokens. Which tokens count against it, and when does a new day start?

## The decision, in plain words

Only the tokens the account spent on the current job count, the fresh ones read and written, not the ones reread from its cache. Once they reach the budget the job moves to the next account, and this one rests until midnight, world time.

## The intro, for fun

A budget is a promise you make to your wallet before breakfast.

## The punchline, for fun

For now the wallet only checks the job in front of it.

## The options, in plain words

A. Count this job's input and output tokens on the account, out until midnight UTC, the option built.
B. Keep a count per account per day across every job, beside the account states, so two jobs in a day share one budget.
C. Count every token, cache reads included.

## What I had to decide

What the daily budget of an account in accounts.yml counts: this job's input and output tokens on that account (cache reads aside), against the budget, the account then out until the next midnight UTC; or a count kept across every job of the day.

## What I did meanwhile

kit/lib/runner/job.ts sums the input and output tokens of the job's parts on that account plus the running part, read through the agent's usage; plannedHandoff in kit/lib/runner/turnover.ts hands off on usage once the sum reaches the budget, out until the next 00:00 UTC. Nothing is kept across jobs.

## What it costs to change later

A count across jobs is a small file beside accounts-state.json and one more read before each check; the rule of which tokens count is one function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec says tokens a day but not which of the four counts, nor whose day: no register, glossary or playbook entry settles it
- through T3 an OpenCode instance gives no tokens yet (s4 reads only Claude transcripts), so its budget cannot trip until its session store is read

```

<!-- /omni-outbox-settled: s8-01-budget-counts-this-job -->

<!-- omni-outbox-settled: s8-02-planned-handoff-nobody-left -->

## s8-02-planned-handoff-nobody-left — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-28
- Slice: s8
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-02-planned-handoff-nobody-left
prd: 2537
slice: s8
rank: medium
bears-on: none
raised: 2026-10-28
wave: 4
---

## The question, in plain words

When an account nears its usage limit but no other account can take the job over, should the runner still stop the job, or let it run until the account really runs out?

## The decision, in plain words

As the spec says, the runner stops the job and marks it failed with no tokens left, even though the account still had some work in it.

## The intro, for fun

Leaving the party early only helps if someone is there to drive you home.

## The punchline, for fun

Right now we leave anyway and wait on the curb.

## The options, in plain words

A. Stop the run and fail the job naming no tokens left, the option built, as the spec reads.
B. Leave the run going when no account can take it over or the cap is reached, so it works until its wall and only fails there.

## What I had to decide

Whether a planned usage handoff with no account to take over (or past the three account changes) stops the run and fails the job, or lets the run go on until its wall.

## What I did meanwhile

usageHandoff in kit/lib/runner/job.ts marks the account out until the reset the pressure named, finds no next account, and fails the job with no tokens left: every account is out until <reset>, the run already stopped and no note written. A runner with a single account in its file is hit by this on Claude's first allowed_warning.

## What it costs to change later

Letting the run go on is a check before the stop: the next account looked up first, the run left alone when there is none. One function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec's handoff section says none left ends the job failed, but does not say whether that holds for a planned handoff, which could still have worked until the wall

```

<!-- /omni-outbox-settled: s8-02-planned-handoff-nobody-left -->

<!-- omni-outbox-settled: s8-03-instance-skills-folder -->

## s8-03-instance-skills-folder — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-28
- Slice: s8
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-03-instance-skills-folder
prd: 2537
slice: s8
rank: medium
bears-on: none
raised: 2026-10-28
wave: 4
---

## The question, in plain words

Before a Codex or OpenCode account works on a job, the runner puts the kit's skills in that account's own folder. Which folder is it, and what happens when the skills cannot be put there?

## The decision, in plain words

The runner uses the folder the account's settings in T3 name, else the agent's usual folder in the home. When the skills cannot be written, that account is passed over and the next one takes the job, as if it were busy.

## The intro, for fun

Every new player needs the rulebook before joining the game.

## The punchline, for fun

No rulebook, no seat: the next player sits down instead.

## The options, in plain words

A. Use the home folder T3's settings name for the instance, else the agent's default folder, and pass an account without skills over, the option built.
B. Fail the job at once when its first account cannot have the skills, naming why.
C. Read the folder from the accounts file instead, a field of the account, and refuse a Codex or OpenCode account without it.

## What I had to decide

Where a T3 Codex or OpenCode instance's skills go (its config.homePath in T3's settings.json, else ~/.codex or ~/.config/opencode), and whether an instance that cannot have them hands the job to the next account or fails it.
Decided by: Jev (hardToRevert 0.50) · agent said false

## What I did meanwhile

turnoverOf in kit/lib/runner/turnover.ts reads providerInstances.<id>.config.homePath from ~/.t3/userdata/settings.json and calls prepareInstanceSkills (plugin.ts, s5) before every part on a non-Claude instance; job.ts passes over an account it answers unusable for, at the start (no part, no account change counted) and at a turnover, and fails the job only when no account is left.

## What it costs to change later

The folder rule is one function; failing instead of passing over is one branch.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the T3 0.1.3 recordings show config.homePath only on a Claude instance: whether T3 names a Codex instance's CODEX_HOME the same way is not recorded
- an account found without skills is not marked unusable in the runner's account states, so the health report does not read no skills for it yet (s6's ground)

```

<!-- /omni-outbox-settled: s8-03-instance-skills-folder -->
