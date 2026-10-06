---
title: Getting started
description: What Omni Loop gives you, and what you need before you begin.
---

Omni Loop turns a product idea into shipped software on your own repository. You describe the idea
to Claude Code; it writes a PRD, plans it in thin slices, builds every slice, and opens pull
requests you review and merge. Nothing reaches your default branch unless a person merges it.

## Start with Install

Everyone starts with [Install](/docs/install): four steps, once per laptop. You install `omni`
globally, load the skills in Claude Code, sign in to the Omni page, and set up Claude's questions to
come to you there. Then, one of two ways:

- **Your team already runs the loop.** Someone installed the Omni Loop GitHub App on your GitHub
  organization, and the repository you will work in has a `.omni-loop/` folder. There is nothing to
  set up on GitHub: [Join a team](/docs/join) shows you around.
- **You are setting the loop up on a repository.** You administer the repository, and the loop
  does not run in it yet: [Set up a repository](/docs/install#set-up-a-repository), Install's last
  part, puts the kit in it, then [Invade](/docs/invade) lets the loop read it.

Either way, [How the loop works](/docs/loop) then shows the loop in three drawings, and
[Your first PRD](/docs/first-prd) takes an idea of yours all the way through it. Each page ends
with a link to the next.

## What you will have at the end

- **A laptop ready for the loop.** The `omni` command, the loop's skills in your Claude Code, your
  sign-in to the Omni page, and Claude's questions coming to you there.
- **A repository run by the loop.** The Omni Loop kit is installed in it (a `.omni-loop/` folder),
  and the loop has read your repository and written down what it learned. When you join a team,
  this is done already.
- **Your first PRD, shipped.** An idea of yours, turned into a PRD, built slice by slice, reviewed,
  merged, and listed under Release notes.

## What you need first

Four tools on the laptop you work from. These pages do not explain how to install them: each links
to its own documentation. Check each one in a terminal: when the tool is ready, its check prints a
version or a sign-in.

| Tool | What it is for | Check |
|---|---|---|
| **Node 22 or later** ([install](https://nodejs.org/en/download)) | runs the `omni` command; npm, which comes with it, installs it | `node --version` prints `v22` or higher |
| **git** ([install](https://git-scm.com/downloads)) | the loop works on branches of your repository | `git --version` |
| **gh, the GitHub CLI, signed in** ([install](https://cli.github.com)) | the loop opens pull requests and creates labels with it | `gh auth status` says `Logged in to github.com` |
| **Claude Code, signed in** ([install](https://docs.anthropic.com/en/docs/claude-code/setup)) | every step of the loop is a command you type in it, such as `/omni:brainstorm` | `claude --version` |

Sign gh in with the GitHub account that administers your repository, and answer yes when it offers
to authenticate Git with it. Run `claude` once and sign in when it asks.

Joining a team, you also need a GitHub account that is a member of your organization and can push
to the repository: that is all. Setting the loop up on a repository, you also need:

- **A GitHub repository you administer.** The loop opens branches and pull requests in it, and you
  install a GitHub App on it. Administrator rights are what let you do both.
- **The Omni App on your account or an org of yours.** Installing the Omni Loop GitHub App is how
  you sign up: it makes a workspace for the account or the org you install it on, and the org's
  members are the workspace's members. Install it on the owner of your repository:
  [Install the GitHub App](/docs/install#install-the-github-app) shows how. Any GitHub account will
  do, with no other sign-up.

## The pages

1. **Getting started**: this page.
2. **Install**: four steps on your laptop, for everyone: `omni` installed globally, the skills in
   Claude Code, your sign-in, and Claude's questions on the Omni page. Then, once per repository,
   setting the loop up on it.
3. **Join a team**: the loop already runs in your organization; your way around it.
4. **Invade**: letting the loop read your repository and write down what it learned.
5. **How the loop works**: its stages, its pull requests and its skills, in three drawings.
6. **Your first PRD**: from an idea to a merged feature and its release note.
7. **Use cases**: what to type for each thing you want to do.
8. **When something goes wrong**: the errors a first run meets, and their fix.

[Next → Install](/docs/install)
