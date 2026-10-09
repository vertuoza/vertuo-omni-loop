---
title: When something goes wrong
description: The errors a first run meets, and their fix.
---

The errors below are the ones a first run meets. Each one shows what you see, word for word where
the kit prints it, then why it happens and how to fix it.

## `command not found: omni`

Your terminal does not know the `omni` command yet (zsh says `zsh: command not found: omni`). Step 1
of [Install](/docs/install), the npm line that installs `omni` once per laptop, has not run on this
laptop, or it failed. Run it again, and read what npm prints: its last lines say whether it
installed `omni`. When it says `EACCES`, see the entry below.

## npm says `EACCES` while installing omni

npm could not write to its global folder: on some laptops that folder belongs to the system, not to
you. Do not run the npm line with `sudo`. Follow npm's own page on it,
[Resolving EACCES permissions errors](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally),
which moves npm's global folder to one of yours (or installs Node with a version manager), then run
the npm line of [Install](/docs/install) again.

## An old `~/.local/bin/omni`

Before this version, the guide had you write a small script, `~/.local/bin/omni`, and add
`~/.local/bin` to your PATH. It is harmless: it runs your repository's own copy of the kit, as the
`omni` npm installs does. To remove it, delete the script:

```bash terminal
rm ~/.local/bin/omni
```

Then open `~/.zshrc` (or `~/.bashrc`) and delete the line
`export PATH="$HOME/.local/bin:$PATH"` if nothing else of yours lives in `~/.local/bin`. Open a new
terminal: `omni --version` now runs the one npm installed.

## `omni config` fails: the kit is not installed

Every skill starts by running `omni config`. When it fails, Claude stops at once and says in one
line that the repository is not installed. Run it yourself to see why:

```bash terminal agent
omni config
```

It prints the repository's settings when all is well. Otherwise, one of three things:

- **`omni: no Omni Loop kit here — run omni init in your repository`**
  There is no kit where you ran it. Either you are not inside the repository (`cd` into it, and
  open Claude Code at its root), or the kit is not on the branch you have checked out. The install
  pull request must be merged, and your checkout up to date:

  ```bash terminal agent
  git switch main
  git pull
  ```

  If the repository has no `.omni-loop/` folder at all, set the loop up on it: see
  [Set up a repository](/docs/install#set-up-a-repository).
- **`This repository is not installed: .omni-loop/config.yml is missing.`** The folder is there,
  but its config is not. Run `omni init` again, from the root of the repository, then merge
  the pull request it opens:

  ```bash terminal
  omni init
  ```

- **`.omni-loop/config.yml is not a valid Omni Loop config: …`**. The file was edited by hand and
  something in it is wrong. The rest of the line names the key: fix or remove it, and run
  `omni config` again until it prints the settings.

## You ran `omni init` in a repository that had the kit

`omni init` installs the loop, and the repository had it already: you joined a team that runs it,
and only your laptop needed setting up ([Install](/docs/install)). Nothing is broken. `init` kept
the repository's config and its `omni`, said `kept` beside each, and did the two things your laptop
needed: it installed the plugin and signed you in, under **On this computer**.

It also left you on a branch of its own, `chore/install-omni-loop`, and may have pushed it. Do not
type the lines it printed to finish the install pull request: there is nothing to install. Go back to
your default branch, and delete its branch:

```bash terminal agent
git switch main
git branch -D chore/install-omni-loop
```

If it printed `pushed chore/install-omni-loop`, delete the branch on GitHub too, unless a pull
request is open from it:

```bash terminal agent
git push origin --delete chore/install-omni-loop
```

If it opened a pull request, because the repository lacked a knowledge form the kit now has, close
it: `omni update` is how the repository moves to a newer kit.

## A missing `omni:` label

The loop marks its issues and pull requests with labels: `omni:prd`, `omni:phase-0`,
`omni:feature`, `omni:sub`, `omni:in-progress`, `omni:needs-fix`, `omni:outbox-go`, `omni:retro`,
`omni:knowledge` and `omni:approved`. The install creates them. When one is missing, the skills never create it:
they open the pull request without it and tell you, as a step for you, "create label" followed by
its name. Typed by hand, `gh` refuses with `could not add label: 'omni:prd' not found`.

Without its label, the loop cannot find its own pull requests, so fix it before you carry on. Run
`omni init` again, from the root of the repository: it keeps your config and creates every
label that is missing.

```bash terminal
omni init
```

If it says it could not create them ("gh could not create …"), `gh` is not signed in, or your
account cannot manage labels on the repository. Create them by hand on the repository's labels
page, `https://github.com/<owner>/<repository>/labels`, with exactly the names above.

## `no sign-in (omni signin)`

You see this line when Claude opens or updates a PRD's dossier, while `/omni:brainstorm` runs. It
never stops the brainstorm: the PRD is written all the same, only without its dossier page. It means
this computer has not signed in to the Omni Loop app yet, or its sign-in has expired.

Sign in once, yourself, in a terminal at the root of the repository:

```bash terminal agent
omni signin
```

It opens your browser. Sign in there with your GitHub account, and the terminal prints
`signed in as` followed by your GitHub login and the workspace this repository goes to. Inside
Claude Code, you can run it from the prompt by typing `!` before it. The next dossier update goes
through.

Two related lines:

- **`ask mode is not set up for this repository (ask.url)`**, from `omni signin`: the repository's
  config does not say where the Omni Loop app is: it was installed before `omni init` wrote that
  line, or the install pull request is not merged yet. Add it to `.omni-loop/config.yml`, then
  commit and merge the change:

  ```yaml file=.omni-loop/config.yml
  ask:
    url: https://www.omni-loop.xyz
  ```

- **`off`**, instead of a dossier link: dossiers are switched off in this repository. Nothing is
  wrong. `omni init` switches them on in a new install; in one made before, add these lines to
  `.omni-loop/config.yml`, then commit and merge the change:

  ```yaml file=.omni-loop/config.yml
  dossier:
    enabled: true
  ```

## Your config still names vertuo-omni-loop-galaxy.vercel.app

The Omni Loop app lives at `https://www.omni-loop.xyz`. A repository installed before it moved there
names the old address, `https://vertuo-omni-loop-galaxy.vercel.app`, as its `ask.url` in
`.omni-loop/config.yml`. Nothing is broken: the old address keeps working, with every page, sign-in,
dossiers and ask mode, and so do the links your signed pull requests and issues already carry. You
do not have to change anything.

To switch, when you want to, set `ask.url` to the new address in `.omni-loop/config.yml`, then commit
and merge the change:

```yaml file=.omni-loop/config.yml
ask:
  url: https://www.omni-loop.xyz
```

If your config also sets `signature.home`, switch it the same way, so that new signatures link to
the new address. If it does not set it, there is nothing to do: the kit's default is the new address in every kit
since the move, and `omni update` brings one to a repository whose kit is older.

```yaml file=.omni-loop/config.yml
signature:
  home: https://www.omni-loop.xyz
```

## `refused (403): you are not a member of <workspace>, which owns <owner/repo>`

You see this from `omni dossier`, and at the end of `omni signin` or `omni ask on`, in a clone of a
repository another workspace owns. A workspace owns a repository when it was made for the
repository's owner: the GitHub account or organization the Omni App is installed on. You are
signed in, but you are not a member of that workspace, so your dossiers and questions have nowhere
to go. Your sign-in stays, and the loop keeps working in the terminal.

Two ways out:

- **Join that workspace.** Ask its owner to add your GitHub account to their GitHub organization:
  the workspace's members are the organization's. Once you are in, run `omni signin` again, and it
  names the workspace.
- **Work in a repository of your own.** Install the Omni App on your own account or organization,
  as [Install the GitHub App](/docs/install#install-the-github-app) shows, and run the loop in a
  repository it owns.

## `no workspace owns <owner/repo> yet — install the Omni App: <link>`

You see this at the end of `omni signin` and of the sign-in step of `omni init`, and from
`omni dossier` and `omni ask on`. Your sign-in went through, and the line ends green. But nobody has
installed the Omni App on your repository's owner yet, and your GitHub account belongs to no
workspace, so dossiers and ask mode have nowhere to land.

Open the link it prints, and install the App on the account or organization that owns the
repository ([Install the GitHub App](/docs/install#install-the-github-app)). Then run `omni signin`
again: it names the workspace this repository goes to, and dossiers and ask mode start working.

## "Deployment was blocked" on Vercel

This one is only for a repository that deploys on Vercel. The Vercel check on a pull request goes
red before it builds anything, with "Deployment was blocked", and its details say the Git author
must have access to the project. Nothing is wrong with the code.

Vercel looks at the email the commits are authored with, and finds no member of its team behind
it. The loop's commits are made on your computer, with your git settings, so this happens when git
uses an email that is not the one your GitHub account on the Vercel team knows (a personal address
on a work repository, say). Check which one it uses:

```bash terminal agent
git config user.email
```

Set it, for this repository only, to the email of the GitHub account that is a member of the Vercel
team:

```bash terminal agent
git config user.email you@your-company.com
```

Every commit from now on carries it. For a pull request that is already red, push a new commit with
the right author, and Vercel deploys that one:

```bash terminal agent
git switch <the pull request's branch>
git pull
git commit --allow-empty -m "chore: redeploy with the right author"
git push
```

## Other lines you may meet

- **`/omni:yolo` stops at once, naming uncommitted changes.** It needs a checkout with no
  uncommitted changes. Commit them, or move them elsewhere, then run it again.
- **Claude Code does not know `/omni:brainstorm`.** The `omni` plugin is not installed in this
  Claude Code. The plugin is installed once per laptop, not per repository: see step 2 of
  [Install](/docs/install#2-load-the-skills-in-claude-code), then restart Claude Code.
- **`gh` asks you to run `gh auth login`.** The GitHub CLI is not signed in on this computer. Run
  `gh auth login`, then the command that failed.
- **The feature pull request has the `omni:needs-fix` label.** A slice or a check stayed red after
  three tries. Its status comment says what a person must do; do it, then run `/omni:yolo` with the
  PRD's number again.

Stuck on something this page does not list? Tell the Omni Loop team what you ran and what it
printed: every place a first run gets stuck becomes a fix to these pages.

[Next → Getting started](/docs)
