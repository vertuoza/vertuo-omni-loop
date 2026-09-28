---
title: Install
description: omni on your laptop, then one command that installs the kit, the plugin and your sign-in; then the GitHub App.
---

Five steps, each one a single line to type or a click. They need the four tools listed under
[What you need first](/docs#what-you-need-first): Node, git, gh signed in, and Claude Code signed
in. Do the steps in order: each one needs the one before.

Each code block on these pages says where it goes, at its top right: **TERMINAL** is a terminal on
your laptop, **CODING AGENT** is Claude Code's prompt, **FILE** names the file the lines go in, and
**GITHUB COMMENT** is a reply on a pull request. A terminal command that also shows CODING AGENT
runs from Claude Code too: type it there with `!` before it (`!git pull`), and Claude Code runs it
and shows what it prints.

## 1. Install omni, once per laptop

```bash terminal
npm install -g github:vertuoza/vertuo-omni-loop
```

npm installs the `omni` command in its global folder, which is already on your PATH: no shell file
to edit, whatever shell you use. Check it, in any folder:

```bash terminal agent
omni --version
```

It prints the version you installed. Inside a repository that has the kit, `omni` always runs that
repository's own copy, so every repository keeps the version it installed. To get a newer `omni`
for installing, run the same npm line again.

When npm says `EACCES`, or the check says `command not found: omni`, see
[When something goes wrong](/docs/troubleshooting).

## 2. Run omni init in your repository

Open a terminal in a clone of your repository, on its default branch and up to date, and run:

```bash terminal
omni init
```

When it cannot find how your repository runs its tests, it asks for three commands, one at a time:
the command that runs the tests, the preflight a slice must pass before its pull request is ready,
and the full preflight run before a feature is ready. Type each one (`npm test`, `pnpm test`,
`make test`…), or press Enter to leave one empty and fill it in later in `.omni-loop/config.yml`.

Then it does the rest, one line per step:

- **The install branch.** It switches to a new branch, `chore/install-omni-loop`.
- **The kit.** It writes everything it installs under `.omni-loop/`: `config.yml`, the loop's
  settings for this repository, already pointed at the Omni Loop app; `bin/omni.mjs`, the `omni`
  command itself; and the blank knowledge forms under `knowledge/`, which the next page fills. It
  also adds the loop's status line to `.claude/settings.json`, and creates the loop's labels on
  GitHub (`omni:prd`, `omni:feature`, `omni:sub` and the others).
- **The install pull request.** It commits only the files it wrote, pushes the branch, opens the
  pull request and prints its link.
- **The plugin.** It installs the `omni` plugin in Claude Code.
- **Sign-in.** When this computer has not signed in to the Omni Loop app yet, it opens the app in
  your browser: sign in there with your GitHub account. The terminal then says which workspace this
  repository goes to, or why none does yet. The sign-in is kept on this computer, so every
  repository you run the loop in shares it.

A step it cannot do prints the exact lines to type instead, and `init` carries on: type them when
it ends. Run `omni init` again at any time: a step already done says "already" and moves on.

It ends with the steps left to you, the next two below. Two warnings it may print under
**Heads-up**:

- **An older copy of the loop already runs here:** decide which one stays before you merge.
- **Prettier or Biome checks this repository:** add `.omni-loop/bin/` to the file it names, or your
  format check rejects the kit's bundled file.

## 3. Install the GitHub App

Open the GitHub App link `omni init` printed. Pick your account or organization, choose **Only
select repositories**, pick your repository, and install. The App posts the `outbox` check on the
loop's pull requests: it goes red while a question an agent raised waits for your answer. Installing
it is also your sign-up: it makes the workspace your dossiers and ask mode land in, and the members
of the organization you picked are its members.

## 4. Merge the install pull request

Merge the pull request `omni init` opened (it printed "merge PR #" and its number) on GitHub, then
bring your default branch up to date:

```bash terminal agent
git switch main
```

```bash terminal agent
git pull
```

Use your default branch's name if it is not `main`. The loop reads `.omni-loop/` from the default
branch, so nothing below works until it is merged.

## 5. Check it in Claude Code

Start Claude Code at the root of your repository (`claude`), and type:

```text agent
/omni:help
```

It prints the loop in one screen: its stages, from an idea to a retro, and every command. The plugin
is installed. If Claude Code does not know `/omni:help`, restart it; if it still does not, type the
two `/plugin` lines `omni init` printed.

Two more checks, if you like, in a terminal at the root of your repository:

```bash terminal agent
omni config
```

It prints the loop's settings as JSON, with your repository's name under `repo`.

```bash terminal agent
omni status
```

On a new install it reads `SHIPPED 0` and `INBOX 0`, then `nothing yet: /omni:brainstorm to
start`: that is right.

[Next → Invade](/docs/invade)
