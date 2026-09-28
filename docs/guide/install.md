---
title: Install
description: The tools on your laptop, the kit in your repository, the plugin in Claude Code, the GitHub App, and signing in.
---

Four things get installed: three tools on your laptop, the Omni Loop kit in your repository, the
`omni` plugin in Claude Code, and a GitHub App on your repository. Then you sign in once. Do the
steps in order: each one needs the one before.

The kit lives in the GitHub repository `vertuoza/vertuo-omni-loop`, which is private while Omni
Loop is in beta. Your GitHub account needs read access to it: ask the Omni Loop team for it with
your invite.

## 1. On your laptop

### Node 22 or later

Install Node from [nodejs.org](https://nodejs.org) (take the LTS version), then check it in a new
terminal:

```bash
node --version
```

It prints `v22` or higher. An older version cannot run the kit.

### The GitHub CLI, signed in

Install `gh` from [cli.github.com](https://cli.github.com) (on a Mac with Homebrew:
`brew install gh`), then sign in with the GitHub account that administers your repository:

```bash
gh auth login
```

Answer `GitHub.com`, then `HTTPS`, then yes to authenticating Git with your GitHub credentials, and
log in with a web browser. The kit calls `gh` to create labels and open pull requests, and Git uses
the same sign-in to fetch the kit. Check it:

```bash
gh auth status
```

It says `Logged in to github.com account <you>`.

### Claude Code

Install it with npm, which came with Node:

```bash
npm install -g @anthropic-ai/claude-code
```

Run `claude` once and sign in when it asks. Every step of the loop is a command typed inside
Claude Code.

## 2. In your repository

### Install the kit

Open a terminal in a clone of your repository, on its default branch and up to date, and start a
branch for the install:

```bash
git switch -c chore/install-omni-loop
```

Then install the kit:

```bash
npx github:vertuoza/vertuo-omni-loop init
```

npx asks `Ok to proceed? (y)` the first time: answer `y`. When it cannot find how your repository
runs its tests, it asks for three commands, one at a time: the command that runs the tests, the
preflight a slice must pass before its pull request is ready, and the full preflight run before a
feature is ready. Type each one (`npm test`, `pnpm test`, `make test`…), or press Enter to leave one
empty and fill it in later in `.omni-loop/config.yml`.

It writes everything it installs under `.omni-loop/`, and nothing anywhere else:

- `.omni-loop/config.yml`, the loop's settings for this repository;
- `.omni-loop/bin/omni.mjs`, the `omni` command itself;
- the blank knowledge forms under `.omni-loop/knowledge/`, which the next page fills.

It also creates the loop's labels on GitHub (`omni:prd`, `omni:feature`, `omni:sub` and the
others). It ends by printing the steps left to do by hand: this page walks through each of them.
When it says it could not create some labels, create them by hand at the link it prints, with the
names it lists.

Two warnings it may print under **Heads-up**:

- **An older copy of the loop already runs here:** decide which one stays before you merge.
- **Prettier or Biome checks this repository:** add `.omni-loop/bin/` to the file it names, or your
  format check rejects the kit's bundled file.

### Point the kit at the Omni Loop app

Signing in, the questions page and the PRD dossiers all go through the Omni Loop app. Open
`.omni-loop/config.yml` and add these lines at the end:

```yaml
ask:
  url: https://vertuo-omni-loop-galaxy.vercel.app
dossier:
  enabled: true
```

### Commit it and merge it

```bash
git add .omni-loop
git commit -m "chore: install the Omni Loop"
git push -u origin chore/install-omni-loop
gh pr create --fill
```

Merge that pull request on GitHub, then bring your default branch up to date (use your default
branch's name if it is not `main`):

```bash
git switch main
git pull
```

The loop reads `.omni-loop/` from the default branch, so nothing below works until it is merged.

### A shortcut for the omni command

The kit's command is the file `.omni-loop/bin/omni.mjs`, run with Node. These pages write it
`omni`. To type it that way too, add a shortcut in the terminal you work in:

```bash
alias omni='node .omni-loop/bin/omni.mjs'
```

It works from the root of your repository. Add the same line to `~/.zshrc` (or `~/.bashrc`) to keep
it in every new terminal. Without the shortcut, type `node .omni-loop/bin/omni.mjs` wherever these
pages say `omni`.

## 3. In Claude Code

Start Claude Code in your repository (`claude`), then add the kit's plugin marketplace and install
the `omni` plugin, one command at a time:

```text
/plugin marketplace add vertuoza/vertuo-omni-loop
```

```text
/plugin install omni@omni-loop
```

If Claude Code says to restart it, quit it and run `claude` again. The loop's commands now show when you type `/omni:`, such as
`/omni:help`.

## 4. On GitHub: the App

Install the `omni-loop` GitHub App on your repository:
[github.com/apps/omni-loop-invader/installations/new](https://github.com/apps/omni-loop-invader/installations/new).
Pick your account or organization, choose **Only select repositories**, pick your repository, and
install. The App posts the `outbox` check on the loop's pull requests: it goes red while a question
an agent raised waits for your answer.

## 5. Sign in, once per computer

In a terminal at the root of your repository:

```bash
omni signin
```

It opens the Omni Loop app in your browser: sign in there with the account your invite was sent to.
The terminal then prints `signed in as <your email>`. The sign-in is kept on this computer, so every
repository you run the loop in shares it. When it prints
`ask mode is not set up for this repository (ask.url)`, the `ask:` lines above are missing from
`.omni-loop/config.yml`, or not merged yet.

## Check that it worked

Three commands, at the root of your repository:

```bash
omni config
```

It prints the loop's settings as JSON, with your repository's name under `repo`. When it fails, the
kit is not installed in this checkout: see [When something goes wrong](/docs/troubleshooting).

```bash
omni help
```

It prints the loop in one screen: its stages, from an idea to a retro, and every command.

```bash
omni status
```

It prints where your repository's PRDs are. On a new install it reads `SHIPPED 0` and `INBOX 0`,
then `nothing yet: /omni:brainstorm to start`: that is right.

In Claude Code, `/omni:help` prints the same screen as `omni help`: the plugin is installed.

[Next → Invade](/docs/invade)
