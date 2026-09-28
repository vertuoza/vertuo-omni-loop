# The Omni Loop kit

The `omni` CLI (`kit/bin/`, shipped bundled as `kit/dist/omni.mjs`, which `pnpm kit:build` rebuilds)
and the `omni` plugin for Claude Code (`kit/plugin/`: its skills and hooks). A repository installs
both to run the Omni Loop; everything specific to that repository is read from its
`.omni-loop/config.yml`.

**Updating.** Every merge to the kit's `main` cuts a release (`v0.0.1`, `v0.0.2`, …), and
`omni version` says which one a repository runs and whether a newer one exists. A repository moves
only when someone runs `omni update` in it (`--to <version>` for another release than the latest):
it opens one pull request that replaces the bin, keeps `config.yml` as it is, and creates only the
knowledge forms the repository lacks, then updates the `omni` plugin on the machine that runs it
(`claude plugin marketplace update omni-loop` and `claude plugin update omni@omni-loop`, then
`/reload-plugins`; without `claude`, it prints the two `/plugin` lines to type in Claude Code). A
repository installed before versions existed has a bin with no `update` command: run
`npx github:vertuoza/vertuo-omni-loop update` in it once, and `omni update` from then on.

**Help and status** are two read-only commands a person types, in the terminal or inside Claude.
`omni help` (also `omni --help`, `omni -h` and `/omni:help`) prints one screen: the loop's six
stages from idea to retro, its principles, the slash commands, the terminal commands and the ones
only the skills run; `omni help <name>` prints one command or skill (`board`, `yolo` or
`/omni:yolo`) with its usage, who runs it and what it does, both entries for a name that is both. It
needs no config: outside an installed repository it uses the kit's defaults. A bare `omni status`
(also `/omni:status`) prints the repository's overview, read from git only, never from GitHub: how
many PRDs have shipped, wait in the inbox, are being built in the outbox or wait for review, a bar
of delivered against in progress, and the PRDs that are yours (by `git config user.email`), each
with where it stands. It reads the default branch as last fetched, and `--fetch` fetches it first.
`omni status <prd>`, the outbox gate, is unchanged.

**Ask mode** puts the questions Claude asks through `AskUserQuestion` on a web page: sign in once per
computer with `omni signin`, then `/omni:ask on` in a checkout prints the page's link, and
`/omni:ask off` turns it off. The mode is per checkout: `on` replaces nothing, and every Claude Code
terminal open in the checkout gets a tab of its own on the one page, which goes away when that
terminal exits. It needs `ask.url` in the config (`null` by default, which leaves it off), and
whenever the page cannot answer, the question shows in the terminal as usual. The questions are
kept: the whole workspace reads them, sorted and searchable, on the page's History, and a live one
can be shared with a teammate, who answers it on its own link.

**The status line** shows two lines at the bottom of every Claude Code session opened in the
repository or one of its worktrees: the model, how full the context window is (a bar of 10 cells,
green under 50 %, yellow from 50, red from 80), the 5-hour usage and when it resets, and `ask on`
while ask mode is on; then the PRD the session works on (its branch's, else the last one a command
of the session named), with its stage and, in the outbox, the wave, the slices merged, in flight or
stuck, and the open items. `omni init` switches it on for the whole repository: it adds a
`statusLine` key to the committed `.claude/settings.json`, which runs `omni statusline` on Claude
Code's own events and every 30 seconds. It keeps every other key of the file, keeps the kit's own
line unless given `--force`, never touches a status line that is not the kit's, even with `--force`,
and leaves a file that is not valid JSON as it is. A person who wants their own line sets
`statusLine` in `.claude/settings.local.json`, which Claude Code reads first. The line never
fetches and never waits on GitHub (the slices come from a board refreshed in the background at most
once a minute), and it always exits `0`. Deleting the key switches it off.

**Dossiers** keep each PRD's `spec.md`, `plan.md` and `before-after.html` on the same page, every
version of each, with the questions that shaped it, for the whole workspace to read.
`omni dossier open "<title>"` opens a draft for an idea and prints its link;
`omni dossier push <n>` sends PRD n's files, prints the link and the versions it added, and adds a
version only where a file changed; `omni dossier status` says whether the switch is on. The switch
is `dossier: { enabled: true }` in the config (`false` by default), and it also needs `ask.url`: it
uses ask mode's sign-in, but not ask mode itself. Every call has a 5-second limit and never blocks:
anything that stops it exits `1` with one line (`off`, `no sign-in (omni signin)`, `unreachable`,
`refused (<status>)` or `too large: <file>`). Two small skills wrap it, and neither stops the skill
that runs it: `/omni:brainstorm` follows `/omni:dossier-open` before its first question and
`/omni:dossier-push` after each of its pushes, and `/omni:plan` follows `/omni:dossier-push` after
it pushes `plan.md`.

**Release notes** say, for anyone outside, what each PRD shipped: a `release.md` beside the PRD's
`spec.md`, whose front matter holds `prd` and `title` (and, on the initial release's notes only,
`version: 0.0.1`), and whose body is one paragraph of description. `omni check releases` grades
every note in the inbox and shipped folders, and `omni check all` runs it too: a title of 1 to 60
characters on one line with no final full stop and no PRD number, a description of one paragraph of
1 to 280 characters, and neither holding a link, an issue reference, a backtick or a path under the
kit's folder. Each failure names the file and the rule; a repository with no note passes. The switch
is `releaseNotes: { enabled: true }` in the config (`false` by default): once it is on, `omni ship`
refuses a PRD whose folder has no note (`no release note: <path>`) or whose note fails the check
(`release note: <rule>`). The note's voice is the optional `notes` slot of the `releasing` form, which
`omni kb show releasing` prints.

**The knowledge graph** is the knowledge registers read as one map: `omni kb graph` prints a summary
(a line per domain with its principles, rules, invariants, laws and proposals, then the principles
nothing serves and the rules and invariants that serve no principle), and `omni kb graph --json` the
whole graph as one JSON document (`version: 1`, `repo`, `domains`, `entries`, `links`, `loose`,
`unserved`). Each link is `serves` (a rule or an invariant to the principle its `Serves:` line
names) or `cites` (an entry to another whose id its statement or `Why:` names). It is built by the
same parser every other command reads the registers with, so an agent can ask what serves a
principle, or what a domain holds, in one call. A repository without a knowledge folder prints an
empty graph.
