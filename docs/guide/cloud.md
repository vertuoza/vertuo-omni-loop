---
title: Cloud sessions
description: Sign the loop in where no browser opens — Claude Code on the web or the app — with one token, made once and pasted in your cloud environment.
---

A Claude Code cloud session, on the web or in the app on your phone, starts in a fresh container
every time: no browser opens there, and no sign-in is kept. `omni signin` cannot run in it, so
without more the loop builds your PRDs while their page, their questions and their approvals go
silent.

A **token** fixes that. You make it once, on your laptop or on your profile page, and paste it in
your cloud environment as `OMNI_TOKEN`. From then on, every session started in that environment is
signed in as you, with the same rights you have on the Omni page and nothing more. Three steps,
once per cloud environment; [Install](/docs/install) on your laptop comes first.

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

In Claude Code on the web or the app, create a cloud environment, or edit the one you use, and fill
two of its settings.

- **Environment variables:** one line, `OMNI_TOKEN=omk_…`, with the token you made. Add any optional
  variable the repository's README lists under its environment variables, such as
  `OPENROUTER_API_KEY`, when you want what it turns on in the cloud too.
- **Network access:** **Custom**, allowing the host of the repository's `ask.url` (read it with
  `omni config ask.url`; for the Omni Loop's own repository it is `www.omni-loop.xyz`), and
  `openrouter.ai` too when `OPENROUTER_API_KEY` is set. Or **Full**, which allows every host.

Each session started in that environment reads the variables when it starts. A session already open
keeps what it started with: start a new one.

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

Other troubles with the sign-in are in [When something goes wrong](/docs/troubleshooting).

[Next → How the loop works](/docs/loop)
