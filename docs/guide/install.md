---
title: Install
description: Four steps, once per laptop — omni installed globally, the skills in Claude Code, your sign-in, and Claude's questions on the Omni page.
---

Four steps, once per laptop, the same for everyone. When they are done:

1. **`omni` is installed globally**: the loop's command, in every terminal.
2. **The skills are loaded in Claude Code**: every `/omni:` command, such as `/omni:brainstorm`.
3. **You are signed in** to the Omni page, the web app beside the loop.
4. **Claude's questions come to you on the Omni page**, where you read and answer them.

Do them in order: each one needs the one before. They need the four tools listed under
[What you need first](/docs#what-you-need-first): Node, git, gh signed in, and Claude Code signed
in.

Each code block on these pages says where it goes, at its top right: **TERMINAL** is a terminal on
your laptop, **CODING AGENT** is Claude Code's prompt, **FILE** names the file the lines go in, and
**GITHUB COMMENT** is a reply on a pull request. A terminal command that also shows CODING AGENT
runs from Claude Code too: type it there with `!` before it (`!git pull`), and Claude Code runs it
and shows what it prints.

## 1. Install omni globally

In any folder:

```bash terminal
npm install -g github:vertuoza/vertuo-omni-loop
```

npm installs the `omni` command in its global folder, which is already on your PATH: no shell file
to edit, whatever shell you use. Check it:

```bash terminal agent
omni --version
```

It prints the version you installed. Inside a repository that has the kit, `omni` always runs that
repository's own copy, so every repository keeps the version it installed. To get a newer `omni`,
run the same npm line again.

When npm says `EACCES`, or the check says `command not found: omni`, see
[When something goes wrong](/docs/troubleshooting).

## 2. Load the skills in Claude Code

Every step of the loop is a skill you type in Claude Code, such as `/omni:brainstorm`. The skills
come in the `omni` plugin, which is installed on your laptop, not in a repository. Two lines, in any
folder:

```bash terminal
claude plugin marketplace add vertuoza/vertuo-omni-loop
```

```bash terminal
claude plugin install omni@omni-loop
```

Check it:

```bash terminal
claude plugin list
```

It lists `omni@omni-loop`. A Claude Code already open loads the skills once you type
`/reload-plugins` in it, or restart it. The same two lines also work typed in Claude Code itself:

```text agent
/plugin marketplace add vertuoza/vertuo-omni-loop
/plugin install omni@omni-loop
```

## 3. Sign in

The Omni page keeps each PRD's dossier, the questions Claude asks you, and your team's knowledge.
You sign in to it once per laptop, from the root of a repository that runs the loop: one with a
`.omni-loop/` folder, whose settings name the page.

- **Your team runs the loop already.** Clone its repository, or bring your clone up to date on its
  default branch (`git switch main`, then `git pull`).
- **No `.omni-loop/` folder in your repository yet.** Set the loop up on it first, in
  [Set up a repository](#set-up-a-repository) below, then come back here.

To clone, in the folder you keep your code in:

```bash terminal
gh repo clone <organization>/<repository>
```

```bash terminal
cd <repository>
```

Then, at the root of the repository:

```bash terminal agent
omni signin
```

It opens your browser: sign in with your GitHub account. The terminal then prints
`signed in as <your login>`, followed by the repository and the workspace it goes to. The sign-in is
kept on this laptop, so every repository you run the loop in shares it.

When it ends on `you are not a member of <workspace>` or `no workspace owns <owner/repo> yet`, see
[When something goes wrong](/docs/troubleshooting). When it says `no Omni Loop kit here`, you are
not at the root of a repository that has the kit.

## 4. Set up Claude's questions

While the loop works, Claude asks you questions: which design to keep, which option to take. Ask
mode sends them to the Omni page instead of the terminal: you read each one in full there, answer
it from any device, share it with a teammate, and find every one again later. Start Claude Code at
the root of the repository (`claude`), and type:

```text agent
/omni:ask on
```

It prints the link of your questions page: open it, and keep it open while you work. The status
line at the bottom of Claude Code now shows `ask on`. Every Claude Code open in this clone sends its
questions there, each in a tab of its own; whenever the page cannot answer, the question shows in
the terminal as it always did. Ask mode is set per clone: type `/omni:ask on` once in each clone you
work in. `/omni:ask off` turns it off.

## You are set up

Check all four in Claude Code, at the root of the repository:

```text agent
/omni:help
```

It prints the loop on one screen: its six stages, from an idea to a retro, and every command. If
Claude Code does not know `/omni:help`, step 2 has not run, or Claude Code has not reloaded since.

- **Your team runs the loop already:** [Join a team](/docs/join) shows you around it.
- **You have just set the loop up on your repository:** [Invade](/docs/invade) lets it read your
  repository, once.

## Set up a repository

Once per repository, by someone who administers it, between steps 2 and 3 above. Skip this when the
repository's default branch has a `.omni-loop/` folder: it is done, for everyone.

### Run omni init

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
  settings for this repository, already pointed at the Omni page; `bin/omni.mjs`, the `omni`
  command itself; and the blank knowledge forms under `knowledge/`, which [Invade](/docs/invade)
  fills. It also adds the loop's status line to `.claude/settings.json`, and creates the loop's
  labels on GitHub (`omni:prd`, `omni:feature`, `omni:sub` and the others).
- **The install pull request.** It commits only the files it wrote, pushes the branch, opens the
  pull request and prints its link.
- **On this computer.** The plugin of step 2 says "already". When this laptop has not signed in yet,
  it opens your browser for step 3: sign in there, and step 3 is done.

A step it cannot do prints the exact lines to type instead, and `init` carries on: type them when
it ends. Run `omni init` again at any time: a step already done says "already" and moves on.

It ends with the steps left to you, the next two below. Two warnings it may print under
**Heads-up**:

- **An older copy of the loop already runs here:** decide which one stays before you merge.
- **Prettier or Biome checks this repository:** add `.omni-loop/bin/` to the file it names, or your
  format check rejects the kit's bundled file.

### Install the GitHub App

Open the GitHub App link `omni init` printed. Pick your account or organization, choose **Only
select repositories**, pick your repository, and install. When the App is on your organization
already, for another repository, do not install it twice: add this repository to it instead, under
**Configure**, then **Repository access** (an owner of the organization can). The App posts the
`outbox` check on the loop's pull requests: it goes red while a question an agent raised waits for
your answer. Installing it is also your sign-up: it makes the workspace your dossiers and questions
land in, and the members of the organization you picked are its members.

### Merge the install pull request

Merge the pull request `omni init` opened (it printed "merge PR #" and its number) on GitHub, then
bring your default branch up to date:

```bash terminal agent
git switch main
```

```bash terminal agent
git pull
```

Use your default branch's name if it is not `main`. The loop reads `.omni-loop/` from the default
branch, so nothing works until it is merged. Then go back to [step 3](#3-sign-in), and on to step 4.

[Next → Join a team](/docs/join)
