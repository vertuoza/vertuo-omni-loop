---
title: When something goes wrong
description: The errors a first run meets, and their fix.
---

The errors below are the ones a first run meets. Each one shows what you see, word for word where
the kit prints it, then why it happens and how to fix it.

On this page, `omni` is short for `node .omni-loop/bin/omni.mjs`, run from the root of your
repository. The code blocks spell it out in full, so you can paste them as they are.

## `omni config` fails: the kit is not installed

Every skill starts by running `omni config`. When it fails, Claude stops at once and says in one
line that the repository is not installed. Run it yourself to see why:

```bash
node .omni-loop/bin/omni.mjs config
```

It prints the repository's settings when all is well. Otherwise, one of three things:

- **`Error: Cannot find module '…/.omni-loop/bin/omni.mjs'`**. There is no kit where you ran it.
  Either you are not at the root of the repository (run `cd` to the folder holding `.omni-loop/`,
  and open Claude Code there), or the kit is not on the branch you have checked out. The install
  pull request must be merged, and your checkout up to date:

  ```bash
  git switch main
  git pull
  ```

  If the repository has no `.omni-loop/` folder at all, install the kit: see
  [Install](/docs/install).
- **`This repository is not installed: .omni-loop/config.yml is missing.`** The folder is there,
  but its config is not. Run the install command again, from the root of the repository, then
  commit and merge what it writes:

  ```bash
  npx github:vertuoza/vertuo-omni-loop init
  ```

  The message ends with "Run `omni-loop init`": the command above is the one that does it.
- **`.omni-loop/config.yml is not a valid Omni Loop config: …`**. The file was edited by hand and
  something in it is wrong. The rest of the line names the key: fix or remove it, and run
  `omni config` again until it prints the settings.

## A missing `omni:` label

The loop marks its issues and pull requests with labels: `omni:prd`, `omni:phase-0`,
`omni:feature`, `omni:sub`, `omni:in-progress`, `omni:needs-fix`, `omni:outbox-go`, `omni:retro`
and `omni:knowledge`. The install creates them. When one is missing, the skills never create it:
they open the pull request without it and tell you, as a step for you, "create label" followed by
its name. Typed by hand, `gh` refuses with `could not add label: 'omni:prd' not found`.

Without its label, the loop cannot find its own pull requests, so fix it before you carry on. Run
the install command again, from the root of the repository: it keeps your config and creates every
label that is missing.

```bash
npx github:vertuoza/vertuo-omni-loop init
```

If it says it could not create them ("gh could not create …"), `gh` is not signed in, or your
account cannot manage labels on the repository. Create them by hand on the repository's labels
page, `https://github.com/<owner>/<repository>/labels`, with exactly the names above.

## `no sign-in (omni signin)`

You see this line when Claude opens or updates a PRD's dossier, while `/omni:brainstorm` runs. It
never stops the brainstorm: the PRD is written all the same, only without its dossier page. It means
this computer has not signed in to the Omni Loop app yet, or its sign-in has expired.

Sign in once, yourself, in a terminal at the root of the repository:

```bash
node .omni-loop/bin/omni.mjs signin
```

It opens your browser. Sign in there with the GitHub account your invite was sent to, and the
terminal prints `signed in as` followed by your email. Inside Claude Code, you can run it from the
prompt by typing `!` before it. The next dossier update goes through.

Two related lines:

- **`ask mode is not set up for this repository (ask.url)`**, from `omni signin`: the repository's
  config does not say where the Omni Loop app is. Add it to `.omni-loop/config.yml`, then commit and
  merge the change:

  ```yaml
  ask:
    url: https://vertuo-omni-loop-galaxy.vercel.app
  ```

- **`off`**, instead of a dossier link: dossiers are switched off in this repository, which is how
  a fresh install starts. Nothing is wrong. To switch them on, see "Two switches worth turning on"
  on [Your first PRD](/docs/first-prd).

## "Deployment was blocked" on Vercel

This one is only for a repository that deploys on Vercel. The Vercel check on a pull request goes
red before it builds anything, with "Deployment was blocked", and its details say the Git author
must have access to the project. Nothing is wrong with the code.

Vercel looks at the email the commits are authored with, and finds no member of its team behind
it. The loop's commits are made on your computer, with your git settings, so this happens when git
uses an email that is not the one your GitHub account on the Vercel team knows (a personal address
on a work repository, say). Check which one it uses:

```bash
git config user.email
```

Set it, for this repository only, to the email of the GitHub account that is a member of the Vercel
team:

```bash
git config user.email you@your-company.com
```

Every commit from now on carries it. For a pull request that is already red, push a new commit with
the right author, and Vercel deploys that one:

```bash
git switch <the pull request's branch>
git pull
git commit --allow-empty -m "chore: redeploy with the right author"
git push
```

## Other lines you may meet

- **`/omni:yolo` stops at once, naming uncommitted changes.** It needs a checkout with no
  uncommitted changes. Commit them, or move them elsewhere, then run it again.
- **Claude Code does not know `/omni:brainstorm`.** The `omni` plugin is not installed in this
  Claude Code: see [Install](/docs/install), then restart Claude Code.
- **`gh` asks you to run `gh auth login`.** The GitHub CLI is not signed in on this computer. Run
  `gh auth login`, then the command that failed.
- **The feature pull request has the `omni:needs-fix` label.** A slice or a check stayed red after
  three tries. Its status comment says what a person must do; do it, then run `/omni:yolo` with the
  PRD's number again.

Stuck on something this page does not list? Tell the Omni Loop team what you ran and what it
printed: every place a first run gets stuck becomes a fix to these pages.

[Next → Getting started](/docs)
