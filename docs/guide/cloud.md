---
title: Cloud sessions
description: Run the loop from Claude Code on the web or the app, step by step — one token, one cloud environment, then the loop as on your laptop.
---

A Claude Code cloud session, on the web or in the app on your phone, starts in a fresh container
every time: no browser opens there, and no sign-in is kept. `omni signin` cannot run in it, so
without more the loop builds your PRDs while their page, their questions and their approvals go
silent.

A **token** fixes that. You make it once, on your laptop or on your profile page, and paste it in
your cloud environment as `OMNI_TOKEN`. From then on, every session started in that environment is
signed in as you, with the same rights you have on the Omni page and nothing more. This page walks
you through it step by step, once per cloud environment, then shows what changes when you run the loop
from there.

## Before you start

- **You are a member of the workspace** on the Omni page: you signed in there once with GitHub
  ([Install](/docs/install), step 3, or [Join a team](/docs/join)).
- **The repository runs the loop:** it has a `.omni-loop/` folder at its root.
- **Claude Code reaches it on GitHub:** in Claude Code on the web or the app, your GitHub account is
  connected and the repository shows in the list when you start a session.
- **A laptop with `omni` installed helps,** for step 1. Without one, make the token on your profile
  page instead.

## 1. Make a token

Two ways, one token. Either one makes it, shows it once, and lists it on your profile page.

**From a terminal on your laptop,** at the root of a repository that runs the loop:

```bash terminal
omni setup-token
```

It opens your browser: sign in with your GitHub account, as for `omni signin`. The terminal then
prints:

```text terminal
Make the token in your browser: <link>
omk_…
It expires on <yyyy-mm-dd>.
Paste it as OMNI_TOKEN=<token> in your cloud environment's variables.
```

Copy the line that starts with `omk_`: it is the token, and nothing shows it again. No browser
opened? Open the link of the first line by hand: the terminal waits for it all the same. The token is
named `terminal <yyyy-mm-dd>` and expires in 90 days; `--name` and `--days` change that, and `--days`
takes 30, 90 or 365:

```bash terminal
omni setup-token --name "claude cloud" --days 365
```

**From the Omni page,** with no terminal at hand: open the app, go to your own profile page
(`/app/people/<your login>`), and find **Terminal tokens**, under **Alerts**. Give the token a
**Name**, pick **Expires in** 30, 90 or 365 days, and press **Make a token**. You sign in with
GitHub, and come back to the same page with the token marked **shown once**, beside **Copy** and the
line *Paste as `OMNI_TOKEN=` in your environment.* A reload never shows it again.

**Terminal tokens** lists every live token you made, newest first: its name, `··` and its last four
characters, when it was made, when it was last used (or **Never used**) and when it expires.
**Revoke** stops one at once, after you confirm; do it as soon as a token leaks or you stop using
it. You hold at most 20 live tokens: the section says so when you reach the limit, and you revoke one
to make another. An owner of the workspace sees and revokes every member's tokens where the
workspace's links are listed, and a member who leaves the workspace loses every token they made.

Keep the token like a password: it acts as you until it expires or you revoke it. Paste it nowhere
but your cloud environment.

## 2. Set up the cloud environment

A cloud environment is the settings every session started in it gets: its network, its variables and
a setup script. Make one for the loop, or edit the one you use.

1. **Open the environment's settings.** In Claude Code on the web or the app, start a new session and
   open the cloud environment menu in the session's title bar: **New cloud environment** makes one,
   **Edit** changes the one selected.
2. **Name** it, so you pick it again: `omni loop`, for example.
3. **Network access:** a session must reach the Omni page. Allow the host of the repository's
   `ask.url` (read it with `omni config ask.url`; for the Omni Loop's own repository it is
   `www.omni-loop.xyz`), and `openrouter.ai` too when you set `OPENROUTER_API_KEY` below:
   - **Custom**, with those hosts listed one per line under **Allowed domains**, and **Also include
     default list of common package managers** ticked, so the setup script can still install.
   - Or **Full**, which allows every host.

   The default, **Trusted**, allows package registries and GitHub but not the Omni page: a session then
   stops on `OMNI_TOKEN: cannot reach <host>`. A change to network access reaches the sessions already
   open within about a minute.

   **For the whole team,** an Owner of your Claude organization can make one shared environment with
   these settings, from the **Cloud environments** page of the organization's admin settings: it then
   shows to every member under **Organization**. There is no organization-wide allowlist that applies
   to everyone's own environments. Keep `OMNI_TOKEN` out of a shared environment: every member's
   session reads its variables, and the token acts as the one who made it.
4. **Environment variables:** one line per variable, in `.env` format: `OMNI_TOKEN=omk_…`, with
   the token you made in step 1. Add any optional variable the repository's README lists under
   its environment variables, such as `OPENROUTER_API_KEY`, when you want what it turns on in the
   cloud too. Nothing for GitHub: see [What needs no setting up](#what-needs-no-setting-up).
5. **Setup script,** only for the Omni Loop's own repository: its `omni` runs the kit's source, which
   needs the repository's dependencies, so the session must install them before it starts. The
   script is one line: `pnpm install --frozen-lockfile`. Without it, `omni` and the briefing the
   session prints when it starts both stop on `Cannot find package 'yaml'`. A repository the kit was set up in carries a bundled `omni` in
   `.omni-loop/bin/` that needs nothing installed: leave its setup script as it is.
6. **Create environment** (or **Save**).

A session reads the environment's variables and runs its setup script when it starts: after changing
either, start a new session.

## 3. Check it

Start a session on the repository, and ask Claude to run:

```text agent
omni whoami
```

A cloud session has no `omni` installed globally: Claude runs the repository's own copy,
`node .omni-loop/bin/omni.mjs whoami`, which is the same command. It prints your login and the last
four characters of the token:

```text agent
<your login> (OMNI_TOKEN ··<last four>)
```

That is it. Ask mode, dossiers, approvals, `omni signin` and the status line now work as you: the
status line shows `token ··<last four>` where your laptop shows your sign-in, and `omni signin` prints
`signed in by OMNI_TOKEN as <login> — <owner/repo> goes to <workspace>` and opens no browser.

## 4. Run the loop from the session

Start a session on the repository in that environment, and work as on your laptop: type the loop's
commands, such as `/omni:status`, `/omni:brainstorm '<your idea>'` or `/omni:yolo <n>`, and answer
Claude's questions there. Ask mode, PRD pages and approvals go through the token.

**When a `/omni:` command is not found.** A cloud session may start without the `omni` plugin's
commands: Claude then says no command has that name. The skills are still there to follow. In the
Omni Loop's own repository, ask Claude to follow the skill file itself, which is the same skill:

```text agent
Follow kit/plugin/skills/brainstorm/SKILL.md for this idea: <your idea>
```

**What is slower in the cloud.** A cloud session reaches GitHub through Claude's GitHub connection,
which allows GitHub's REST API but not its GraphQL API. The `omni` commands that list pull requests
through `gh pr` stop on `HTTP 403: GitHub GraphQL is not available`: `omni board`, and the merge
gate `/omni:wave` asks (`omni flow check merge`). `/omni:yolo` still builds a PRD there: Claude reads
the waves from the plan, opens and merges each sub-PR through the GitHub connection, and checks by
hand what the board and the gate check (the base, the slice's ground, its checks). Say so when you
start, so Claude does not stop on the first 403.

## What needs no setting up

- **GitHub.** The session reaches your repositories, branches and pull requests through
  Claude's GitHub connection, not through the token: nothing to paste for it.
- **Your laptop.** A token never touches your laptop's sign-in: `omni signin` there works as it did.
  When `OMNI_TOKEN` is set, it wins over the sign-in `omni signin` keeps.
- **Several sessions at once.** Any number of sessions share one token, for as long as they run.

## When OMNI_TOKEN fails

Each failure stops the command with one line, naming the variable and never its value.

| The line | What it means | What to do |
|---|---|---|
| `OMNI_TOKEN expired on <date>: make a new one with omni setup-token` | the token passed its expiry | make a new token (step 1) and replace the variable |
| `OMNI_TOKEN was revoked: make a new one with omni setup-token` | you, or an owner of the workspace, revoked it | make a new token and replace the variable |
| `OMNI_TOKEN: <login> is no longer a member of <workspace>` | its maker left the workspace: every token they made stopped | a member of the workspace makes their own token |
| `OMNI_TOKEN is not known to <host>: make a new one with omni setup-token` | the Omni page knows no such token, or it was copied wrong | copy it again, or make a new one |
| `OMNI_TOKEN: cannot reach <host>: allow it in your environment's network access` | the environment's network access does not allow the Omni page | allow `<host>` under **Custom**, or choose **Full** (step 2), then start a new session |
| `environment: OMNI_TOKEN is not valid: it is not a kit token: make one with omni setup-token` | the value is not a token: cut short, a space too many, or something else pasted | paste the whole `omk_…` line again |
| `OMNI_TOKEN is set in this environment: revoke it on your profile page` | `omni signout` ran under a token, and deleted nothing | revoke the token under **Terminal tokens** to stop it |
| `Cannot find package 'yaml'` | the session started without the repository's dependencies (Omni Loop's own repository) | add `pnpm install --frozen-lockfile` as the environment's setup script (step 2), then start a new session |
| `HTTP 403: GitHub GraphQL is not available from Claude Code sessions` | an `omni` command listed pull requests through `gh pr`, which a cloud session cannot | nothing to fix in your settings: Claude carries on through the GitHub connection (step 4) |

Other troubles with the sign-in are in [When something goes wrong](/docs/troubleshooting).

[Next → How the loop works](/docs/loop)
