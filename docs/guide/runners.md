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
`/omni:wave`, `/omni:bug-fix`, `/omni:mega-bug-fix`, `/omni:visual-fix`, `/omni:plan`, `/omni:pitch`,
`/omni:prove` and `/omni:retro-apply`.
Lines that need a person to talk to, such as `/omni:brainstorm`, stay in your own terminal.

### Follow it on the Runners page

The Runners page, under Dashboard in the sidebar (`/app/runners`), lists:

- **Runners:** each one's state (Online, Busy, or Offline with when it was last seen), its fleet,
  its slots in use, its repositories and its kit version. A workspace owner gives a runner to a
  fleet here.
- **Jobs:** queued and running first, then the last 50 that ended. Each shows its line, who sent it,
  where it went and its status: Queued, Running, Done with its pull request, Failed with its reason
  (`runner lost`, `timeout` or an exit code), Cancelled, or **Need human** when it stopped to ask
  you something.

Press **Terminal** on a job, or on a busy runner, to read what the job is doing, line by line, as it
happens: each step Claude takes, each command and its result. It is read-only: you watch, you do
not type.

**Cancel** stops a queued or running job within a few seconds. **Send again** queues a failed or
cancelled job once more: a job never runs again by itself.

### Answer a job that needs a human

A `/omni:bug-fix` job that reaches a decision only a person can take stops and asks. Its status
reads **Need human**, in the plasma colour and filled so it stands out, and its row has a **Need
human** button. The comment it leaves on the issue ends with a link that opens the same panel.

1. Press **Need human**, or follow the link from the issue. A panel opens over the right of the
   page (over the whole page on a phone). Its header reads `Need human · <repo> · #<issue>`, and the
   issue number links the issue on GitHub.
2. Read the short note on why the job stopped, then answer each question: pick one option, or
   several when the question says **Pick any that apply**, or write your own answer of up to 2,000
   characters.
3. Press **Send answers**. It stays off until every question has an answer. The panel closes, and a
   new job shows on the board, queued, to the same runner or fleet: it carries on from your answers
   instead of starting over. The first job reads **Done** from then on.

If nobody should answer, press **Dismiss**: the questions close, no job is queued, and the job reads
**Done**. Escape, the close button, or a click on the dimmed page closes the panel without doing
either, and the focus goes back to the button.

Anyone in the workspace may answer or dismiss, and the first to do so wins. Open a closed question
later and the panel reads **Already answered by @<login>** or **Dismissed by @<login>**, with
neither button, and nothing is queued. If Omni refuses the new job (for instance because the runner
it went to is no longer yours to send to), the panel says why in the service's own words and
nothing is stored: fix the cause, or answer again.

A job that asked and then failed or was cancelled shows no **Need human** button: there is nothing
left to resume.

### When a bug fix stops mid-way

A `/omni:mega-bug-fix` job on an issue can stop before its fix is done: a target still red after
`limits.attempts` full preflights, its PR left a draft labelled `omni:needs-fix`, or a target it
could not reach. Its hand-off then ends on the line that resumes it, `/omni:mega-bug-fix #<n>`, and
the job reads **Stopped mid-way**, in red, with **Resume**. Resume sends the job's line again. The new
run never starts over: it keeps the triage and the fix plan, picks each stuck target up on its pushed
branch with a fresh `limits.attempts`, marks its PR ready once green, then opens the record PR.
A fix that ended, or stopped for a person to decide, reads **Done** as before.

### When a job dies holding claims

A job that builds a PRD claims each slice with a draft sub-PR labelled `omni:in-progress`, whose
status comment names the job (`- job: <id> · runner <name>`). When the job ends, whatever the
reason (done, failed, timeout, cancelled, or its runner lost), the runner releases the claims it
still holds, a sub-PR already marked ready but not merged yet among them:

- each of those sub-PRs loses `omni:in-progress` and gains `omni:released`;
- each gets a comment naming the job, its runner and why it ended;
- the job's row on the Runners page says so under its status, in red: **Released #1908, #1909**,
  each number linking its sub-PR. A release that failed reads **Could not release this job's
  claims:** and why.

A sub-PR claimed by another job, or by no job, is never touched. The next run of the same line takes
a released claim over at once: send the line again and it carries on from those branches.

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
  Never restart it while a job runs: that job is marked `runner lost`. This updates the runner
  itself; its plugin takes care of itself, below.
- **The Omni plugin:** a job's skills come from the Omni plugin installed for the runner's user, so
  the runner keeps it current. Once a job's worktree is made, and before Claude starts, it compares
  the plugin's version with the omni the job's repository pins. An older plugin is updated
  (`claude plugin update omni@omni-loop`), once, however many slots start together. A plugin as new
  as the repository's omni, or newer, is left alone. At start and once an hour, the runner also
  updates the plugin, so it follows the latest release even when no repository needs it. It prints a
  line only when the plugin's version changed (from the old one to the new one) or the update
  failed (with the last line the update said). A running job keeps the skills it loaded: Claude Code
  keeps each version of the plugin in its own folder.
- **The `omni:released` label:** create it once in every repository a runner works in (GitHub ›
  Issues › Labels › New label). Without it, the runner still takes `omni:in-progress` off a dead
  job's sub-PRs and says the label is missing, and those claims are taken over after 240 quiet
  minutes instead of at once.
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
| a job Failed with a reason that says the Omni plugin is older than the omni its repository pins | the plugin on the runner is older than the omni the repository pins, and the update could not bring it up; the end of the reason says why | as the runner's user, run `claude plugin update omni@omni-loop` and read what it says, then **Send again**. Claude was never started, so the job did nothing |
| a job Failed with a reason that says the Omni plugin is not installed | Claude Code has no Omni plugin for the runner's user | install it as the runner's user, the way the [Install](/docs/install) page shows, then **Send again** |
| a job's row says **Could not release this job's claims:** and why | the runner could not reach GitHub with `gh`, or `gh` is signed out, or the `omni:released` label is missing | sign `gh` in as the runner's user (`gh auth status`), or create the label. The claims become takeable after 240 quiet minutes anyway |
| a job's log starts with a line that says the plugin's version was not read | `claude plugin list` did not answer in time or its answer was unreadable, so the plugin's age was not checked | nothing: the job ran. If it keeps showing, run `claude plugin list --json` as the runner's user |

[Next → How the loop works](/docs/loop)
