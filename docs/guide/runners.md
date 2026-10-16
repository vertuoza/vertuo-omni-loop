---
title: Runners
description: Send work from the Omni page to a machine that runs it with no one at a terminal — how to use a runner, set up a new one on a Unix server, and connect it.
---

A **runner** is a machine that runs the loop for your team while nobody sits at it. Anyone in the
workspace presses **Send to terminal** beside a line such as `/omni:yolo 42` on the Omni page; a
runner picks it up, runs it in Claude Code, and opens the pull request as it would on your laptop.
The page shows each job live, with its log and its pull request.

A runner opens no port. It asks the Omni page for work, so it runs behind any firewall: a server, a
spare machine in the office, or your own laptop while it is on.

This page has three parts: using a runner someone already set up, setting up a new one on a Unix
server, and connecting it to your workspace.

## Use a runner

### Send a job

1. On the Omni page, open the PRD, the pull request or the concept you want worked on.
2. Beside the button that copies a line (**Build it** on a PRD's page, the copy buttons of the PR
   care, User voice and Pitch panes, and of a concept's page), press **Send to terminal**. It shows
   only when the workspace has a runner you may send to.
3. Pick where it runs: **Any runner**, a fleet, or one runner by name with its state. Press
   **Send**.
4. The button reads `Queued for <target>`, with a link to the job on the Runners page.

A runner takes only these lines: `/omni:yolo`, `/omni:yolo-fix`, `/omni:pr-care`, `/omni:do-work`,
`/omni:wave`, `/omni:bug-fix`, `/omni:visual-fix`, `/omni:plan`, `/omni:pitch` and `/omni:prove`.
Lines that need a person to talk to, such as `/omni:brainstorm`, stay in your own terminal.

### Follow it on the Runners page

The Runners page, under Dashboard in the sidebar (`/app/runners`), lists:

- **Runners:** each one's state (Online, Busy, or Offline with when it was last seen), its fleet,
  its slots in use, its repositories and its kit version. A workspace owner gives a runner to a
  fleet here.
- **Jobs:** queued and running first, then the last 50 that ended. Each shows its line, who sent it,
  where it went and its status: Queued, Running, Done with its pull request, Failed with its reason
  (`runner lost`, `timeout` or an exit code), or Cancelled.

Press **Terminal** on a job, or on a busy runner, to read what the job is doing, line by line, as it
happens: each step Claude takes, each command and its result. It is read-only: you watch, you do
not type.

**Cancel** stops a queued or running job within a few seconds. **Send again** queues a failed or
cancelled job once more: a job never runs again by itself.

The pull requests a job opens say who sent it: `Sent from the Omni app by @<login> on runner <name>`.
The work runs under the GitHub and Claude accounts of the person who set the runner up.

## Set up a new runner

These steps assume a Linux or macOS machine you reach over SSH, set aside for this. Give it its own
user, and keep production credentials, production databases and customer data off it: a job runs
Claude Code with no one to approve its commands.

### 1. What the machine needs

- **Node 22.18 or later** and **pnpm** (any pnpm 10 or later: it hands off to the version each
  repository pins).
- **git**, **tmux** and the **GitHub CLI** (`gh`).
- **Claude Code** (`claude`), installed for the runner's user.

Check them:

```bash terminal
node --version && pnpm --version && git --version && tmux -V && gh --version && claude --version
```

### 2. Sign in to GitHub

As the runner's user, sign the GitHub CLI in, and answer yes when it offers to sign git in with the
same account:

```bash terminal
gh auth login
```

Jobs push branches and open pull requests as this account, so use one that may do that on your
repositories, and nothing more.

### 3. Sign in to Claude

A server has no browser to keep Claude signed in, so make a long-lived token:

```bash terminal
claude setup-token
```

It prints a link to open on any computer, then a token starting with `sk-ant-oat01-`. Keep it in a
file only the runner's user reads:

```bash terminal
mkdir -p ~/.config && umask 077
printf '%s\n' '<the token>' > ~/.config/claude-oauth-token
```

The jobs use your Claude plan's limits. When the plan's weekly limit is reached, every job fails
with Claude's own message until it resets.

### 4. Clone the repositories

Clone each repository the runner may work on, side by side, under one folder:

```bash terminal
mkdir -p ~/runner-repos && cd ~/runner-repos
git clone https://github.com/<owner>/<repo>.git
```

Each one must run the loop (a `.omni-loop/` folder at its root) and belong to your workspace. The
runner knows each by its `origin`, and runs each job in a fresh worktree of it, so leave these
checkouts on their default branch and never work in them by hand.

## Connect it

### 1. Make a token for the Omni page

On your laptop, at the root of a repository that runs the loop, make a token for the runner, as for
[Cloud sessions](/docs/cloud):

```bash terminal
omni setup-token
```

Or make it on your profile page on the Omni page. It is shown once: on the runner, keep it in a file
only its user reads, `~/.config/omni/runner-token`. The runner shows on the page as yours, with your
rights in the workspace and nothing more.

### 2. Write a start script

On the runner, `~/start-runner.sh`:

```bash file=~/start-runner.sh
#!/usr/bin/env bash
set -euo pipefail
export OMNI_TOKEN="$(cat ~/.config/omni/runner-token)"
export CLAUDE_CODE_OAUTH_TOKEN="$(tr -d '\r\n' < ~/.config/claude-oauth-token)"
cd ~/runner-repos/<repo>
exec node .omni-loop/bin/omni.mjs runner --name <name> --repos ~/runner-repos --slots 2
```

- `--name` is how the runner shows on the Runners page.
- `--repos` is the folder of step 4 above.
- `--slots` is how many jobs run at once, 4 unless given, 8 at most. Each job installs and tests a
  whole repository, so count about 4 cores and 8 GB of memory per slot.
- `--timeout` stops a job that runs longer, `3h` unless given.
- `--keep-logs` is how many days the job logs are kept, 14 unless given.

Make it executable with `chmod +x ~/start-runner.sh`.

### 3. Start it

Run it in a tmux session, so it keeps running after you log out:

```bash terminal
mkdir -p ~/logs
tmux new-session -d -s runner '~/start-runner.sh 2>&1 | tee -a ~/logs/runner.log'
tail -f ~/logs/runner.log
```

It checks that `claude` is installed and signed in, then prints:

```text terminal
runner <name> registered · 2 slots · <owner>/<repo>
```

The runner now shows Online on the Runners page, and **Send to terminal** appears for everyone in
the workspace. A workspace owner can give it to a fleet there, so only that fleet's members send to
it.

### 4. Look after it

- **Watch a job from the machine:** each job runs in its own tmux session, `job-<id>`.
  `tmux attach -t job-<id>` shows it; Ctrl-b then d leaves it running.
- **Stop the runner:** `tmux attach -t runner`, then Ctrl-C. It takes no new job and waits for the
  running ones to end.
- **Update it:** stop it, `git pull` in the checkout the script starts from, and start it again.
  Never restart it while a job runs: that job is marked `runner lost`.
- **Disk:** the runner cleans up after itself. When a job ends, it removes the job's worktree and
  its unpushed branch; once at start and every hour, it removes what older jobs left and job logs
  older than `--keep-logs` days, and prints one line saying what it freed.
- **Reach it without opening a port:** the runner itself needs none. For SSH, a mesh VPN such as
  Tailscale lets you and your team reach the machine with every inbound port closed.

### When something goes wrong

| What you see | Why | What to do |
|---|---|---|
| `no sign-in (omni setup-token)` | the Omni token expired or was revoked | make a new one (step 1 of Connect it), save it, restart the runner |
| the runner refuses to start: `claude` is missing or signed out | Claude Code is not installed for this user, or the token file is wrong | check `claude --version`, and that the token file holds the `sk-ant-oat01-` token |
| `the app is unreachable (…): trying again in 5 s` | the Omni page did not answer | nothing: it tries again, up to every 60 s, and running jobs carry on |
| a job Failed with `runner lost` | the runner stopped or lost its network for over 90 s while the job ran | start the runner again, then **Send again** |
| a job Failed with `timeout` | it ran past `--timeout` | send it again, or start the runner with a longer `--timeout` |
| a job Failed with an exit code | Claude Code ended in error | press **Terminal** on the job, or read `~/logs/job-<id>.log` on the runner |

[Next → How the loop works](/docs/loop)
