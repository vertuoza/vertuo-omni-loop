---
title: Getting started
description: What Omni Loop gives you, and what you need before you begin.
---

Omni Loop turns a product idea into shipped software on your own repository. You describe the idea
to Claude Code; it writes a PRD, plans it in thin slices, builds every slice, and opens pull
requests you review and merge. Nothing reaches your default branch unless a person merges it.

These pages take you from a blank laptop to your first PRD, in order. Follow them one after the
other: each ends with a link to the next.

## What you will have at the end

- **A repository run by the loop.** The Omni Loop kit is installed in it (a `.omni-loop/` folder),
  the `omni` plugin is installed in your Claude Code, and the loop has read your repository and
  written down what it learned, in a pull request you merged.
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

You also need:

- **A GitHub repository you administer.** The loop opens branches and pull requests in it, and you
  install a GitHub App on it. Administrator rights are what let you do both.
- **The Omni App on your account or an org of yours.** Installing the Omni Loop GitHub App is how
  you sign up: it makes a workspace for the account or the org you install it on, and the org's
  members are the workspace's members. Install it on the owner of your repository: step 3 of
  [Install](/docs/install) shows how. Any GitHub account will do, with no other sign-up.

## The pages

1. **Getting started**: this page.
2. **Install**: `omni` on your laptop, then one command that puts the kit in your repository and
   the plugin in Claude Code, and signs you in; then the GitHub App.
3. **Invade**: letting the loop read your repository and write down what it learned.
4. **Your first PRD**: from an idea to a merged feature and its release note.
5. **When something goes wrong**: the errors a first run meets, and their fix.

[Next → Install](/docs/install)
