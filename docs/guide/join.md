---
title: Join a team
description: Omni Loop already runs in your GitHub organization. Nothing to set up on GitHub or in the repository; once Install has set up your laptop, your way around.
---

Your team already runs Omni Loop: someone installed the Omni Loop GitHub App on your GitHub
organization, and the repositories you will work in already hold the kit. Almost everything is done.
What is left is your laptop, the four steps of [Install](/docs/install): `omni` installed globally,
the skills in your coding agent, your sign-in, and your agent's questions on the Omni page. Do them
first, in a clone of your team's repository; this page then shows you around.

Setting the loop up on a repository yourself? After the four steps, go to
[Invade](/docs/invade) instead.

Working from a cloud session too (in Claude Code: on the web or the app)? A cloud session has no
browser to sign in with:
[Cloud sessions](/docs/cloud) signs it in as you with one token, made once.

## Is this page for you?

Open the repository you will work in on GitHub, on its default branch:

- **It has a `.omni-loop/` folder at its root.** That folder is the kit: the loop's settings for this
  repository, its own copy of the `omni` command, and what the loop knows about the repository.
- **Its pull requests carry `omni:` labels**, such as `omni:feature` or `omni:sub`, and a check named
  `outbox`. That is the loop at work.

Both true: carry on below. No `.omni-loop/` folder: the loop does not run in that repository yet;
see [A repository without the loop yet](#a-repository-without-the-loop-yet) at the end of this page.

## What is done already, and what is yours

Setting the loop up happens once per organization and once per repository. It is done, for
everyone. What is left happens once per laptop, and it is yours: the four steps of
[Install](/docs/install).

| Where | Done already, for everyone | Yours, once per laptop |
|---|---|---|
| **GitHub** | the Omni App on the organization; the loop's labels and its `outbox` check on each repository | nothing |
| **The repository** | the kit in `.omni-loop/`, merged; the knowledge base `/omni:invade` wrote; the status line | a clone, up to date, and ask mode on in it |
| **Your laptop** | nothing: nothing is shared between laptops | the four tools, `omni`, the skills in your coding agent (in Claude Code: the `omni` plugin), your sign-in |
| **The Omni page** | your organization's workspace, whose members are the organization's members | your sign-in, and a fleet if you play |

So three things are never yours to run here: **`omni init`**, **installing the GitHub App**, and
**`/omni:invade`**. They set the repository up, and that is done. Ran `omni init` by mistake? See
[When something goes wrong](/docs/troubleshooting#you-ran-omni-init-in-a-repository-that-had-the-kit).

Sign gh in with the GitHub account that is a member of your organization. The loop pushes branches
and opens pull requests as you, so that account must be able to push to the repository. When GitHub
refuses a clone or a push, ask an owner of your organization to add your account to it, or to the
team that works on the repository.

## 1. See where your team is

In your coding agent, at the root of the repository (another agent than Claude Code types the skill
in its own form: [Any coding agent](/docs/any-agent#set-up-your-agent)):

```text agent
/omni:status
```

On a repository your team has been running, it is not empty: how many PRDs have shipped, how many
wait in the inbox, are being built or wait for review, and a bar of delivered against in progress.
The PRDs listed as yours are the ones written with your git email (`git config user.email`): none yet.

In Claude Code, look at the bottom, too: two lines, the **status line**. The first shows the model,
how full the session is and your usage; the second, once a session works on a PRD, that PRD and its
stage. The repository switches it on for everyone who opens Claude Code in it; other agents show no
status line.

## 2. Join a fleet, if you play

On top of the delivery sits a game: each PRD is a planet your organization terraforms together, and
people play in **fleets**. It is optional, and it changes nothing to how the loop builds. Open the
app with **Open the app →** at the top of this page and sign in with your GitHub account: you land
on your workspace's dashboard. To play, press **Game mode** at the top right, sign in, choose your
fleet, enter a name and build your hero. From then on, your pull requests score for that fleet.

### Put your fleet's pull requests on a GitHub project board

A fleet can name a GitHub project board, and the loop then adds each pull request it opens to it.
The owner of the workspace does this once, on **Settings › Fleets**: in the fleet's form, under
**Mascot**, the **GitHub project** field takes the link of an organization project of your
workspace's organization, `https://github.com/orgs/<org>/projects/<number>`. Another organization's
project, or a user's, is refused next to the field and nothing is saved. The fleet's card then shows
`Board: <org> project <number>`.

Three things to know before you set it:

- **An org admin accepts the App's permission once.** The Omni Loop App asks for `Organization
  projects` (write). Until an organization admin accepts it on GitHub, the App cannot add cards: the
  fleet's note on its card reads `Not added: ask an org admin`, and the admin accepts it from the
  organization's **Settings**, then **GitHub Apps**. A project that does not exist reads
  `Not added: no such project`; neither is retried, and nothing is posted on the pull request.
- **Only the loop's pull requests go on the board.** A pull request the loop signs, into the default
  branch (a feature PR, a bug fix or a visual fix), is added within a minute. A sub-PR is not, so the
  board does not fill with one card per slice; nor is a pull request you open by hand. A runner's
  pull request counts for the person who sent the job. The card is only added: the board's own
  workflows move it from there.
- **Who can see it.** A public board shows its cards to anyone, as GitHub does for any public
  project. A repository with signing off adds no card, since its pull requests are not signed.

The fleet's last note, `Added #<n> · <owner>/<repo>` on success, is written on its card in muted text
with its full reason as the title. Clearing the link on the form stops any new card and clears the
note.

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
folder. Someone who administers the repository sets the loop up on it, as
[Set up a repository](/docs/install#set-up-a-repository) shows, with one difference: the App is on
your organization already, so nobody installs it again. When the App was installed for selected
repositories only, an owner of the organization adds this one to it: on GitHub, the organization's
**Settings**, then **GitHub Apps**, then **Configure** beside the Omni Loop app, and the repository
under **Repository access**.

[Next → How the loop works](/docs/loop)
