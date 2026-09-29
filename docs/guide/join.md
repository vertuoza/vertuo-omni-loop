---
title: Join a team
description: Omni Loop already runs in your GitHub organization. Nothing to install on GitHub, five steps on your laptop.
---

Your team already runs Omni Loop: someone installed the Omni Loop GitHub App on your GitHub
organization, and the repositories you will work in already hold the kit. Almost everything is done.
What is left is your laptop: four tools, the `omni` command, the Claude Code plugin, and a sign-in.
Count fifteen minutes.

Setting the loop up on a repository yourself? This page is not for you: go to
[Install](/docs/install).

## Is this page for you?

Open the repository you will work in on GitHub, on its default branch:

- **It has a `.omni-loop/` folder at its root.** That folder is the kit: the loop's settings for this
  repository, its own copy of the `omni` command, and what the loop knows about the repository.
- **Its pull requests carry `omni:` labels**, such as `omni:feature` or `omni:sub`, and a check named
  `outbox`. That is the loop at work.

Both true: carry on below. No `.omni-loop/` folder: the loop does not run in that repository yet;
see [A repository without the loop yet](#a-repository-without-the-loop-yet) at the end of this page.

## What is done already, and what is yours

The install happens once per organization and once per repository. It is done, for everyone.
What is left happens once per laptop, and it is yours.

| Where | Done already, for everyone | Yours, once per laptop |
|---|---|---|
| **GitHub** | the Omni App on the organization; the loop's labels and its `outbox` check on each repository | nothing |
| **The repository** | the kit in `.omni-loop/`, merged; the knowledge base `/omni:invade` wrote; the status line | a clone, up to date |
| **Your laptop** | nothing: nothing is shared between laptops | the four tools, `omni`, the `omni` plugin in Claude Code, your sign-in |
| **The Omni page** | your organization's workspace, whose members are the organization's members | your sign-in, and a fleet if you play |

So three things are never yours to run here: **`omni init`**, **installing the GitHub App**, and
**`/omni:invade`**. They are the install, and the install is done. Ran `omni init` by mistake? See
[When something goes wrong](/docs/troubleshooting#you-ran-omni-init-in-a-repository-that-had-the-kit).

## 1. The four tools

The same four as everyone's, listed with their checks under
[What you need first](/docs#what-you-need-first): Node 22 or later, git, gh signed in, and Claude
Code signed in.

Sign gh in with the GitHub account that is a member of your organization. The loop pushes branches
and opens pull requests as you, so that account must be able to push to the repository. When GitHub
refuses a clone or a push, ask an owner of your organization to add your account to it, or to the
team that works on the repository.

## 2. Install omni, once per laptop

```bash terminal
npm install -g github:vertuoza/vertuo-omni-loop
```

Check it, in any folder:

```bash terminal agent
omni --version
```

Inside a repository that has the kit, `omni` always runs that repository's own copy, so you run the
version your team installed, whatever version npm gave you. When npm says `EACCES`, or the check
says `command not found: omni`, see [When something goes wrong](/docs/troubleshooting).

## 3. Clone the repository

```bash terminal
gh repo clone <organization>/<repository>
cd <repository>
```

Already have a clone? Bring it up to date on its default branch instead (`git switch main`, then
`git pull`; use your default branch's name if it is not `main`). Then check that the kit is there:

```bash terminal agent
omni config
```

It prints the loop's settings for this repository as JSON, with its name under `repo`. When it says
`no Omni Loop kit here`, you are not at the root of the repository, or your checkout is not up to
date.

## 4. Install the plugin in Claude Code

Every step of the loop is a skill you type in Claude Code, such as `/omni:brainstorm`. The skills
come in a plugin, and a plugin is installed on a laptop, not in a repository: the kit your team
merged does not bring it. Two lines, in a terminal:

```bash terminal
claude plugin marketplace add vertuoza/vertuo-omni-loop
claude plugin install omni@omni-loop
```

Or, if you prefer, the same two lines typed in Claude Code:

```text agent
/plugin marketplace add vertuoza/vertuo-omni-loop
/plugin install omni@omni-loop
```

Then restart Claude Code, or type `/reload-plugins` in one that is open. Check it: start `claude` at
the root of the repository, and type:

```text agent
/omni:help
```

It prints the loop on one screen: its six stages, from an idea to a retro, and every command. The
plugin works in every repository of yours that has the kit.

## 5. Sign in to the Omni page

The Omni page is the web app beside the loop: it keeps each PRD's dossier, the questions Claude asks
you in ask mode, and your team's knowledge. Sign in to it once per laptop, from the root of the
repository:

```bash terminal agent
omni signin
```

It opens your browser: sign in with your GitHub account. The terminal then prints
`signed in as <your login>`, followed by the repository and the workspace it goes to, your
organization's. There is nothing to request: the workspace's members are the organization's
members, so being in the organization is being in the workspace. Every repository on this laptop
shares the sign-in.

When it ends on `you are not a member of <workspace>` instead, your GitHub account is not in the
organization yet: see
[When something goes wrong](/docs/troubleshooting#refused-403-you-are-not-a-member-of-workspace-which-owns-ownerrepo).
Without a sign-in the loop still builds; only the dossiers and ask mode wait for it.

## 6. See where your team is

In Claude Code, at the root of the repository:

```text agent
/omni:status
```

On a repository your team has been running, it is not empty: how many PRDs have shipped, how many
wait in the inbox, are being built or wait for review, and a bar of delivered against in progress.
The PRDs listed as yours are the ones written with your git email (`git config user.email`): none yet.

Look at the bottom of Claude Code, too: two lines, the **status line**. The first shows the model,
how full the session is and your usage; the second, once a session works on a PRD, that PRD and its
stage. The repository switches it on for everyone who opens Claude Code in it.

## 7. Join a fleet, if you play

On top of the delivery sits a game: each PRD is a planet your organization terraforms together, and
people play in **fleets**. It is optional, and it changes nothing to how the loop builds. Open the
app with **Open the app →** at the top of this page and sign in with your GitHub account: you land
on your workspace's dashboard. To play, press **Game mode** at the top right, sign in, choose your
fleet, enter a name and build your hero. From then on, your pull requests score for that fleet.

## Find your way around

Where your team's work lives, once you are set up:

- **In the app**, from its sidebar: **PRDs** lists every PRD of the workspace, with its stage and
  what to do next; **Questions** holds the questions asked in ask mode, and the ones shared with
  you; **Knowledge** maps the rules the agents follow; **Fleets** shows the teams of the game.
- **In the repository**, under `.omni-loop/`: `delivery/inbox/` holds the approved PRDs, waiting or
  being built; `delivery/shipped/` every PRD that shipped, each with its spec, its plan, its outbox
  and its release note; `knowledge/` the rules and the playbook the agents read before they build.
- **On GitHub**, by label: issues labelled `omni:prd` are the PRDs; pull requests labelled
  `omni:phase-0` wait for someone to approve a PRD, `omni:feature` are PRDs being built, `omni:sub`
  are their slices, and `omni:needs-fix` wait for a person.

## Your first day

1. **See what is in flight:** `/omni:status`, and the **PRDs** page of the app.
2. **Read the rules every agent follows here**, in a terminal at the root of the repository:

   ```bash terminal agent
   omni kb show briefing
   ```

3. **Open two or three shipped PRDs**, in `.omni-loop/delivery/shipped/`: their spec, their plan and
   their outbox show how your team works, faster than any page.
4. **Pick a small idea**, and follow [Your first PRD](/docs/first-prd). Or lend your agent to a PRD
   being built: [Use cases](/docs/use-cases#help-on-a-prd-you-do-not-own) shows how.

[How the loop works](/docs/loop) shows the whole loop in three drawings: read it before your first
PRD.

## A repository without the loop yet

Your organization has the Omni App, but the repository you want to work in has no `.omni-loop/`
folder. Someone who administers the repository installs the kit, as [Install](/docs/install) shows,
with one difference at its step 3: the App is on your organization already, so nobody installs it
again. When the App was installed for selected repositories only, an owner of the organization adds
this one to it: on GitHub, the organization's **Settings**, then **GitHub Apps**, then **Configure**
beside the Omni Loop app, and the repository under **Repository access**.

[Next → How the loop works](/docs/loop)
