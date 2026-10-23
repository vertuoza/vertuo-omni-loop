# The Omni Loop kit

The `omni` CLI (`kit/bin/`, shipped bundled as `kit/dist/omni.mjs`, which `pnpm kit:build` rebuilds)
and the `omni` plugin for Claude Code (`kit/plugin/`: its skills and hooks). A repository installs
both to run the Omni Loop; everything specific to that repository is read from its
`.omni-loop/config.yml`.

**Installing.** A laptop needs Node 22 or later, git, gh signed in (for what the loop writes on
GitHub: comments, labels, pull requests) and Claude Code signed in, then
`omni` once: `npm install -g github:vertuoza/vertuo-omni-loop` (check it with `omni --version`).
The global `omni` is the same bundle: inside a repository that has the kit it runs that
repository's own `.omni-loop/bin/omni.mjs`, and outside one only `init`, `help` and `--version`
run. In a repository, `omni init` does the rest: it switches to `chore/install-omni-loop`, writes
the kit under `.omni-loop/` (a fresh config with `ask.url` and `dossier.enabled: true`), commits
only its own files, pushes and opens the install pull request, installs the `omni` plugin, and
offers sign-in; a step it cannot do prints the lines to type instead. What is left is the GitHub
App link it prints and merging the pull request. The full walk-through is the Getting Started
guide, `docs/guide/install.md`.

**Reading the loop needs a sign-in, not `gh`.** The commands that decide what the loop plans or runs
next read its state (a repository's changes, a change's review, its comments and issues) from the
Omni page at `ask.url`, never through `gh`: `omni board`, `omni next`, `omni care`'s reads,
`omni roadmap`'s gate, `omni statusline --refresh`, `omni dossier`'s issue title and
`omni flow check merge`. So they run in any coding agent that has the kit and HTTPS, a Claude Code
cloud session included, with no `gh` signed in. They need a sign-in: `omni signin` once per
computer, or the kit token `OMNI_TOKEN` (`omni setup-token`) where no one can sign in. The page reads
each repository with its GitHub App, so the repository must be in your workspace and the app
installed on it. A read that cannot be made prints one line and exits `1`: `no sign-in (omni
signin)`, `unreachable` (no answer within 15 seconds), `refused (403)` (the repository is not in
your workspace), `refused (424)` (the app cannot read it, with the link that installs it),
`refused (429)` (GitHub's budget for it is spent, with when it refills) or `refused (404): this
Omni page cannot read the loop yet`. The skills treat each line as held, not failed. Writes (comments,
labels, `omni care reply`, creating, readying or merging pull requests), git, and the setup and
maintenance commands (`init`, `update`, `version`, `credits`, `harvest`, `targets`) still use `gh`.

**Self-hosting the Omni page.** The kit depends on the loop's read contract (`GET
<ask.url>/api/loop/changes`, `/changes/<n>`, `/comments`, `/issues` and `/issues/<n>`, whose shapes
`kit/lib/loop-reads/contract.ts` holds), never on omni-loop.xyz. A team that runs its own Omni page
sets `ask.url` in `.omni-loop/config.yml` to that page's address (`ask: { url:
https://omni.example.com }`), signs in to it with `omni signin`, and every read goes there. A page
older than the contract answers `refused (404): this Omni page cannot read the loop yet`: update it.

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

**Signing in from any machine.** `omni signin` (and `omni setup-token`, which makes a kit token for a
cloud session's `OMNI_TOKEN`) finishes one of two ways. On a laptop it opens the Omni page in the
browser, which comes back to the terminal on `127.0.0.1`, and prints a device link under it as a
fallback: `Browser didn't open, or it's on another machine? <link>  (code <c>)`; whichever comes back
first wins. In a remote session (a Claude Code cloud session, SSH, a Codespace: `CLAUDE_CODE_REMOTE`,
`SSH_CONNECTION`, `SSH_TTY` or `CODESPACES` set), or on Linux with no display, it takes the device
flow: it prints `Sign in at <ask.url>/ask/device?user_code=<c>`, opens no browser, and waits up to 10
minutes while the person opens the link in any browser, checks that the page shows the same code and
signs in; nothing is pasted back. `--device` and `--loopback` force one flow or the other. An Omni page
without the device sign-in says so and the browser on this machine takes over. `omni setup-token`
then prints the token, its expiry and the line to paste it by, and keeps it nowhere.

**Runners** (PRD 1830) run the `/omni:` lines people send from the Omni app with Send to terminal,
on a machine set up for it, with no one at a terminal. Start one with
`omni runner --name <name> --repos <dir> [--slots 4] [--timeout 3h] [--keep-logs 14]
[--max-memory 85] [--min-disk 10] [--max-load 1.5]`:

- **What it needs:** a sign-in (the kit token `OMNI_TOKEN`, or `omni signin` once), the git checkouts
  it may work in right under `--repos` (each known by its `origin`, `owner/name`, and in the
  workspace), Claude Code installed and signed in, and tmux. It refuses to start, in one line, when
  `claude` is missing or signed out. It opens no port: it asks the Omni page for work. On a headless
  server signed in with `claude setup-token`, export the token it prints as `CLAUDE_CODE_OAUTH_TOKEN`
  before `omni runner`, and every job gets it (PRD 1894); unset, jobs use Claude's stored sign-in.
- **What it does:** it registers under `--name` and shows on the page's Runners page, online, busy or
  offline; a workspace owner gives it to a fleet there. It runs at most `--slots` jobs at once (8 at
  most). Each job runs in a worktree `~/wt/<repo>-job-<id>` on branch `agent/job-<id>` from the
  default branch, after `pnpm install --frozen-lockfile` when there is a lockfile, in the tmux session
  `job-<id>` (attach to it over SSH to watch), logged to `~/logs/job-<id>.log`. The line goes to
  `claude --dangerously-skip-permissions -p` from a file, never through a shell. Every 5 seconds it
  sends the page the log's tail; at the end, done with the last pull request of the job's repository
  the run printed, or failed with its exit code.
- **What it cleans up** (PRD 1911): when a job ends, its worktree goes, its branch `agent/job-<id>`
  too unless it was pushed (it has an upstream, or `origin` has a branch of that name), and
  `git worktree prune` runs in its checkout. Once it starts, then every hour, it sweeps what jobs no
  longer running left: their `~/wt/<repo>-job-<id>` folders, their unpushed `agent/job-*` branches,
  and their `~/logs/job-<id>.*` files older than `--keep-logs` days (a whole number of 1 or more,
  14 unless given), then prints one line, like
  `swept: 3 worktrees, 6 branches, 12 log files · 412 MB freed`, or nothing when nothing went. It
  never touches `~/logs/runner.log`, another folder or file, or another branch.
- **The plugin** (PRD 2100): a job's skills come from the Omni plugin installed for the runner's
  user, so the runner keeps it current. Once a job's worktree is made, before Claude starts, it reads
  the plugin's version from `claude plugin list --json` (the user's own entry, the oldest if there
  are several) and the omni the job's repository pins (the version its `.omni-loop/bin/omni.mjs`
  carries; a repository with no bin pins none, and nothing is checked). A plugin as new, or newer,
  starts nothing and calls nothing. An older one is updated with `claude plugin marketplace update
  omni-loop` then `claude plugin update omni@omni-loop`, one update at a time across every slot and
  the sweep, then read again. Still older, the job fails before Claude starts with
  `omni plugin v<x> is older than <owner/repo>'s omni v<y>: claude plugin update failed: <its last
  line>`; not installed, with `the omni plugin is not installed: claude plugin install
  omni@omni-loop`. A list that does not read lets the job run, and its log's first line says
  `omni plugin version not read: <why>`. The sweep updates the plugin at start and every hour, and
  the runner prints a line only when the version changed, `omni plugin v<x> → v<y>`, or the update
  failed, `omni plugin update failed: <its last line>`. A running session keeps the skills it
  loaded: Claude Code keeps each plugin version in its own folder. The runner's own code does not
  update itself: `git pull` in the checkout it starts from, then restart `omni runner`.
- **When its machine is under pressure** (PRD 2102): every 15 seconds it samples its machine and
  sends the page its CPU, load, memory and disk. It pauses when memory used is above `--max-memory`
  percent (1 to 100, 85 unless given), disk free below `--min-disk` GB (0 or more, 10 unless given),
  or the 1-minute load above `--max-load` times its cores (above 0, 1.5 unless given). Paused, it
  prints `paused: <reason>` (`paused: memory 91%`) and takes no new job: a slot already waiting runs
  the job it gets, and a running job is never touched. After two quiet samples in a row it prints
  `resumed` and takes jobs again. The page shows the reason and the limits. `--max-memory 100` and
  `--min-disk 0` switch those two limits off. A limit out of range is refused before it starts.
- **Which lines:** only `/omni:yolo`, `yolo-fix`, `pr-care`, `do-work`, `wave`, `bug-fix`,
  `mega-bug-fix`, `visual-fix`, `plan`, `pitch` and `prove`, with arguments of letters, digits, spaces
  and `._/:#-`, the whole line 200 characters at most. The runner checks the line again before it runs
  it, whatever the page sent.
- **Who sent it:** a job runs under the runner owner's GitHub and Claude accounts, with
  `OMNI_SENT_BY` and `OMNI_RUNNER` set, and `/omni:pr` writes
  `Sent from the Omni app by @<login> on runner <name>` in the pull requests it opens. A job an API
  key sent (PRD 2433) has `OMNI_SENT_BY_KEY`, the key's name, in place of `OMNI_SENT_BY`, and its
  line reads `Sent through the Omni API by API key <name> on runner <name>`: it names the key and
  never the person who made it.
- **A job's own variables** (PRD 2175): every job's session also gets `OMNI_JOB` (the job's id),
  `OMNI_RUNNER` (the runner's name, sender or not) and `OMNI_UNATTENDED=1`, so a claim the job makes
  names it in its status comment, `- job: <id> · runner <name>`, and no skill waits on a question.
- **A job that runs as a GitHub App** (PRD 2433): the runner registers with `githubApp: true`, and a
  job the page hands over with a `github` grant (the app's installation token, its login and its
  email) starts as that app, not as the owner's GitHub account. Its session gets `OMNI_GITHUB_APP`
  (the app's login), the app as the author and the committer of every commit
  (`GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL`), a git
  credential helper and an `insteadOf` that send every `git@github.com:` and `ssh://git@github.com/`
  remote over HTTPS with the token (set through `GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_<n>` and
  `GIT_CONFIG_VALUE_<n>`, so no git file changes), and a `gh` first on `PATH`, written under
  `~/.config/omni/runner/bin`, that runs the real `gh` with the token as `GH_TOKEN` and answers
  `gh auth token` with it. The token is never in the job's environment: the runner keeps it in
  `~/logs/job-<id>.github`, readable by its owner alone, and the helper and the `gh` read it through
  `omni runner github-token` (`--git get` is git's credential helper call). That command prints the
  token inside a job of this runner and nowhere else, and one line with exit 1 otherwise. Every kit
  command that calls `gh` inside such a job uses the job's token and never runs `gh auth token`, and
  every line, log tail and report the runner sends reads `***` for every token the job had, past
  ones too. The file goes once the job is reported. A job with no `github` starts exactly as before.
  A job whose token cannot be kept on this machine ends `failed`, `github app: <why>`, before Claude
  starts: it never runs as a person.
- **When a job dies holding claims** (PRD 2175): once a job ends, done, failed, timed out or
  cancelled, the runner releases the claims it still holds, with `gh`, signed in on the box: every
  open draft pull request of the job's repository that carries `labels.inProgress` and whose status
  comment names `job: <id>` loses `labels.inProgress`, gains `labels.released` (`omni:released`
  unless set), and gets one comment: `Released: runner job <id> on <runner> ended (<reason>) while
  it held this claim…`. A claim naming another job, or none, is never touched. The board reads a
  released claim as `claimed-stale` at once, so the next run takes it over. The sweep does the same,
  reason `runner lost`, for a job a runner that died or restarted left behind. The job's row on the
  Runners page lists what was released, `Released #<n>, …`, or why it could not be:
  `Could not release this job's claims: <why>`. **Create the `omni:released` label** in every
  repository a runner works in (`labels.autoCreate` does not make it): without it, the runner still
  takes `labels.inProgress` off and says so, and the board falls back to the quiet rule
  (`limits.claimDeadMinutes`, 240 minutes).
- **Queueing from a service:** a service holding a kit token (`omk_…`, made with `omni setup-token`)
  exchanges it at `POST /api/ask/token` for an access token, keeps that until its `expires_at`, and
  sends it as `Authorization: Bearer <access token>` to `POST /api/runners/jobs`, with the body
  `{"line": "/omni:bug-fix <issue url>", "repo": "<owner/name>", "target": {"kind": "any"}}`. The
  header wins: a request that carries one is judged by it alone, never by a browser session. It
  answers 200 with the job (`sentBy` is the token's person); 401 for a missing, bad or expired
  token; 403 when the caller is not a member of the workspace that owns the repository, or no
  workspace owns it, or the target is not theirs to send to; 400 for a line off the list or a
  malformed body. The kit token itself is never sent to this route.
- **When things go wrong:** the page unreachable, it tries again after 5 s, doubling up to 60 s, and
  its jobs keep running; a refused sign-in stops it with `no sign-in (omni setup-token)`; a job past
  `--timeout` is stopped and marked failed, reason `timeout`; a cancel from the page stops the job
  within a few seconds. Ctrl-C stops taking jobs and waits for the running ones. A job is never run
  again by itself: Send again on the Runners page does.

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

**The band** (the HUD) shows what the session is on in up to three rows above the prompt: a loop or
roadmap it drives on top, with the roadmap's merged count; then the PRD, bug or visual fix it works
on, with its stage and the slices being built (or, while a loop runs, the step it is doing); then
links to open with one click: the PRD's page, its feature PR and its phase-0 PR while open, a fix's
page and PR, the roadmap's page. It hides itself while the session is on nothing. It is the
`omni-hud` plugin of the kit's marketplace, beside `omni`: `omni init` adds
`"omni-hud@omni-loop": true` to `enabledPlugins` in the committed `.claude/settings.json`, by the same
rules as the status line (the file created when missing, every other key kept, a value set by
anyone else never touched). Typing `/omni-hud` hides the band for you, in this and later sessions,
and typing it again shows it; setting the line to `false` removes it for the repository, and the
status line stays. The band and the status line's second line only draw `omni now`, which any agent
or person can run: it prints what the session is on (the headline, the work and its stage, what is
being done now, and the links), `--json` prints the same as `{ "headline", "work", "doing" }`, with
each one `null` when there is nothing. It reads files only, never the network, and always exits `0`.

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

**Answers** take the outbox's questions through three doors, the terminal, the PRD's Outbox tab on
the Omni page and the feature pull request, and every one ends as the person's own reply on the
feature pull request, in the grammar `omni replies` reads (ADR-0052). The switch is
`answers: { enabled: true }` in the config: `true` by default, and `omni init` writes it into every
new config. `omni answers ask <prd> --pr <n> [--json]` prints the open `human-action` and `high`
questions in the pull request's numbering, in batches of at most four, human action first (mediums
are never asked: they are already adopted), and exits `1` with one line when nothing is open or the
switch is off. `omni answers post --prd <n> --pr <n> --answers <file> [--print]` reads the picks
from a JSON file (`[{ "number": 1, "pick": "A" }, { "number": 2, "pick": "B", "reason": "…" }]`;
`done`, `not-done` with a reason, or `prose` with its `text`), writes the reply with the one reply
writer the Omni page also uses, posts it and prints its link; `--print` posts nothing, and a refused
pick or a failed post exits `1` (a failed post prints the reply, to paste). A reason becomes one
line of at most 500 characters, with no outbox marker. **The end of `/omni:yolo`:** when its gate
ends red and the switch is on, it first writes everything it writes today (the outbox comment, the
draft PR, the status comment), then asks one question: *Answer here now*, *Answered on the Omni page
or on the pull request — carry on*, or *Later — stop here*. Answering asks through
`AskUserQuestion` and posts with `omni answers post`; answering or carrying on then follows
`/omni:yolo-fix` steps 2 to 7 in the same run, so one command can go from a PRD to a pull request
ready for review. An unattended yolo now waits at that question: `answers.enabled: false` restores
the old ending. With the switch on and `ask.url` set, the outbox comment also carries a line linking
the PRD's Outbox tab, `<ask.url>/prd/at/<owner>/<repo>/<n>`.

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

**Landings** let a PRD reach the default branch in several ordered pull requests, so that what
must be deployed apart (a database migration, a contract step) ships alone. A plan opts in with a
`landing` column in its slice table and an optional `## Landings` table (number, kebab-case name,
`merge when`); `omni plan check` counts waves within each landing, refuses landing numbers with a
gap, a slice blocked by a slice of another landing, and a `## Landings` table that does not match the
slice table. A plan without the column has one landing and is built as it always was. A repository
makes the cut a rule with `landings: { alone: [<regex>, …] }` in its config (empty by default,
validated like `risk.storedShape`): a slice whose territory touches a path one pattern matches must
touch nothing else, and a landing holding such a slice holds only such slices. The back-end, for
instance, lists its migrations directories there (`^kernel-migrations/database/migrations/` and
`/db/migrations/`), so a migration always travels in a landing of its own.

**Inline waves** (issue 1722) build a small plan with no sub-PR per slice. `wave: { inlineBelow: <n> }`
in the config (`0` by default, which changes nothing) makes `/omni:wave` build a PRD whose plan has
fewer than `n` slices (the current landing's, for a PRD of several landings) on its feature branch
itself: one slice after the other, each by `/omni:do-work --inline`, with no claim, no slice branch
and no sub-PR. A built slice's last commit carries the trailer line `Omni-Slice: <id>`; `omni board`
reads a slice with no pull request and such a commit on `<remote>/<feature branch>` as `merged`
(`inlineSlicesIn`, `boardFor`'s `inlineDone`) and prints `inline` in its `--json` (`inlineWave`):
`true` only when `wave.inlineBelow` is set, the plan is small enough, no slice lands in another
repository, and no slice has a pull request, so a PRD that began with sub-PRs finishes with them.
The git read runs only when `wave.inlineBelow` is above `0`, in `omni board`, `omni next` and the
status line's board refresh.

**Opening pull requests through the repository's skill.** `pr: { openWith: <skill> }` in the
config (`null` by default, which keeps the kit's `gh pr create`) names a slash skill of the
repository that `/omni:pr` opens every feature, landing and standalone pull request with, so the
repository's own conventions (its template, its title, its advisory review) apply to the loop's pull
requests. The skill is run with `--base <branch> --draft --non-interactive --prd <owner/repo>#<n>`,
plus `--landing <n>/<N>` for a PRD of more than one landing and `--issue #<n>` when there is one,
and prints the pull request's URL as its last line; `/omni:pr` then puts its own lines (the link
line, the slices, the landings overview, the acceptance) above what the skill wrote, and the footer
last. Sub-PRs never go through it. In target mode the target's own `pr.openWith` decides, and the
skill runs in the target's clone. The back-end sets it to `/create-pr`.

**Repository flow** is where a repository says how the loop differs on it, in a `flow` section of the
config (none by default, which changes nothing): **rules** the CLI checks, **areas** that give a part
of the code its own rules, and **hooks**, Markdown files an agent follows at a named point of a
skill. None of it is code. `flow.rules.plan` (`slice: { alone, maxFiles }`, `wave: first`,
`blocks: all`, `landing: alone`) is graded by `omni plan check` on each slice's territory;
`flow.rules.subPr` (`merge`, `requireChecks`, `approval: person`, `territory: report | block`,
`maxOpen`) by `omni flow check merge --pr <n>`, which prints `ok` and the one merge command
`/omni:wave` runs, or a `not ok` line per reason. `flow.areas.<name>` holds `paths` (regular
expressions; a path belongs to the first area that matches, else to the default area, the root of
`flow`), its own `rules` and `hooks`, an optional `knowledge` domain and `inherit` (true by default:
limits keep the strictest value, `requireChecks` is the union). `flow.hooks` and each area's `hooks`
map a point of the catalog (`kit/lib/flow/points.ts`: `plan.slice`, `plan.done`, `do-work.start`,
`do-work.test`, `do-work.review`, `do-work.ready`, `pr.open`, `wave.merge`, `yolo.ready`) to
`{ before, after, replace }` hook paths, a bare path being `after`. Every skill the catalog lists
runs `omni flow show <point>` there and follows each `before`, then the kit's step or the `replace`
hook, then each `after`, and hands the hook's output to `omni flow verdict <point> --from <file>`;
a hook ends with `omni-hook <point>: pass` or `… fail <why>`, and a missing verdict fails. `replace`
is allowed only at `do-work.test`, `pr.open` and `wave.merge`, and swaps the act, never a guard
(ADR-0069). `omni flow show` alone prints what the repository changes from the kit's defaults, area
by area; `--path <p>` one path's area with its rules and hooks; `--repo <target>` a target's flow,
from the copy `/omni:mega-invade` keeps at `repos/<name>/flow/` in the knowledge folder. `omni check
config` refuses a pattern that does not compile, an unknown point, a `replace` the catalog does not
allow, a hook path that is absolute, holds `..`, is a URL, is missing, is over `limits.hookMaxBytes`
(20480 by default) or sits under `.claude/` without `{ path, alias: claude }`, and `flow.on`,
reserved for events. **The aliases:** `landings.alone` reads as one more area, after every named
one, with `landing: alone`; `pr.openWith` reads as the default area's `pr.open` `replace` hook,
marked `alias: claude`. The walk-through is `docs/guide/flow.md`.

**The knowledge graph** is the knowledge registers read as one map: `omni kb graph` prints a summary
(a line per domain with its principles, rules, invariants, laws and proposals, then the principles
nothing serves and the rules and invariants that serve no principle), and `omni kb graph --json` the
whole graph as one JSON document (`version: 1`, `repo`, `domains`, `entries`, `links`, `loose`,
`unserved`). Each link is `serves` (a rule or an invariant to the principle its `Serves:` line
names) or `cites` (an entry to another whose id its statement or `Why:` names). It is built by the
same parser every other command reads the registers with, so an agent can ask what serves a
principle, or what a domain holds, in one call. A repository without a knowledge folder prints an
empty graph.

`omni kb graph <id>` prints the neighbourhood of one entry: one line per node it touches, through
the edges `serves` (up and down), `enforced-by`, `governs`, `points-to`, `cites`, `sibling`,
`screen`, `same-prd` and `uses-term`, at most 6 lines per edge kind, and a last line saying whether
the product's Legal and Glossary are cached. `omni kb graph --paths <file>…` prints one such block
per entry whose `Governs:` matches the files (laws first, then rules, in register order), the files
read as `omni kb laws --paths` reads them. `--depth 2` or `3` walks that many hops between entries,
indented two spaces per hop, each node printed once; leaves (tests, paths, schemas, screens,
decision records, terms) are never walked, and `--depth` is 1 by default and at most 3. `--json`
prints the neighbourhood as one versioned document (`version: 1`, `shape: "neighbourhood"`, `repo`,
`start`, `depth`, `product`, `nodes`, `edges`), never cut. An id that names no entry exits 1;
`--depth` outside 1 to 3, or `--paths` with an id or with no file, exits 2 with the usage line.
Nothing here calls the network: the product's cache is read from its file only.

`omni kb graph --product <key> <id> [--depth <1-3>] [--json]` (PRD 1798) asks the Omni page for the
neighbourhood of one node in a product's knowledge graph, across every repository of the product, as
you, with `GET /api/products/<key>/knowledge/graph`. It prints one header line per repository
(`<repo> @<commit> · pushed <time> by @<login>`, or `<repo> · never pushed`), the neighbourhood as
`omni kb graph <id>` prints it with each repository node's short name before its id, and the last
line `product knowledge: server (<key>).`; `--json` prints the answer as the server sent it. It
exits 1 with one line for no `ask.url`, no sign-in, an unreachable server or a refusal (an unknown
id, a product you are not in), and exits 2 with the usage line for a `--depth` outside 1 to 3.

`omni kb graph push` (PRD 1798) sends the whole repository's graph to the Omni page: every node and
edge the neighbourhood is built from, as one object (`version: 1`, `shape: "repository"`, `nodes`,
`edges`; no `start`, `depth` or `hop`, and no node of the product's own), with the repository's slug
and its `HEAD` commit, to `POST /api/knowledge/graphs`. It first refreshes the product knowledge
cache, signs in as every push does (`omni signin`, or `OMNI_TOKEN`), and prints
`pushed <slug>@<commit> · <n> nodes, <m> edges` and a line `in products: <key> · see <link>` per
product the repository serves. It exits 1 with one line, sending nothing, for a knowledge folder with
uncommitted changes, and also for no `ask.url`, no sign-in, an unreachable server or a refusal.

**Laws and their tests** (PRD 1342) apply only where `laws.source` is `knowledge`. A rule or an
invariant's `Enforced by:` names a test path, `unenforced`, or `pending #<n>`: a law judged worth a
test before it had one, whose **law issue** `#<n>` is labelled `labels.law` (default `omni:law`,
which `omni init` creates). The classifier's reply carries `worthALaw` for every rule and invariant,
and the harvest (`omni harvest`, and the app's) takes one of three paths for each: a test the feature
changed becomes its `Enforced by:`; no test and not worth a law keeps it out of the registers, in its
PRD's `settled.md` as `stays-here` with the note `not worth a law (<decided by> <score>)`; no test and
worth a law writes it `pending #<n>` and opens its law issue. `omni decide law-worth` asks Jev's
`law-worth` decision with the terminal's sign-in, and its answer replaces the classifier's when the
workspace has put the decision On and Jev answers above its floor. **`omni knowledge judge`** is the
sweep a repository runs once (it needs `OPENROUTER_API_KEY`, and exits `2` without it, writing
nothing): every `unenforced` rule and invariant is asked "worth a law?", the model first, then
`omni decide law-worth`; a yes opens its law issue through `gh` and becomes `pending #<n>`, a no
leaves its register for its PRD's `settled.md` and the report names every entry that cited it; once
every one is judged it sets `laws.requireProof: true` in the config. `omni knowledge judge <id>`
judges that one law alone, the same way. It writes the working tree and commits nothing: a person opens the knowledge PR. With **`laws.requireProof: true`** (default
`false`), `omni check knowledge` refuses a confirmed rule or invariant whose `Enforced by:` is
`unenforced`; proposed entries and a plan repository's imported copies are not held to it.
**`/omni:enforce <issue>`** writes a law's test, proves it (red with the law broken by the smallest
change, green with the code restored, the break never committed), rewrites `pending #<n>` to the
test's path on `branches.law` (default `test/law-{id}`) and opens one signed PR into the default
branch that closes the issue; a test that cannot go red stops it with a comment on the issue and the
law left `pending`. **The four law rules** of the outbox gate, `law-proof`, `law-text`,
`test-removed` and `law-demoted` (a law's test path turned back to `pending` or `unenforced`, or a
law gone from the registers, read against the knowledge folder at the range's base), are accounted
only by `item <id>` naming an item ranked `high` or above: `spec <where>` is refused for them, and
a `medium` item leaves the change unaccounted. `/omni:bug-fix` and `/omni:visual-fix` raise those
items in a small `outbox/` of the fix's folder when their range touches a law, and `omni bug` and
`omni visual` name what it needs.

`/omni:bug-fix` also films every bug (PRDs 1972 and 2100): it keeps the reproduction's red and green
output (or, for a component bug in a repository with Storybook, the story before and after) and makes
a before/after GIF with `omni bug film`. Two outputs make two 640×360 cards, drawn by the kit's own code
with no ffmpeg, the same bytes every run; two clips go through ffmpeg. It stores the run with
`omni proof push --kind bug`, which prints the bug page's link, the GIF's stable link, and for a
component bug one stable link per clip (`before.webm`, then `after.webm`), and opens the pull request
with a `## Proof` section showing the bug before and after the fix, and a `Clips: [before](…) ·
[after](…)` line for a component bug. Clips that cannot be filmed or stitched fall back to the GIF of
the two outputs, with `Storybook not filmed - <reason>` under it. A GIF that cannot be made at all
opens the pull request as a draft whose `## Proof` reads `GIF not produced - <reason>`.
`/omni:mega-bug-fix` leaves `## Proof` out.

**`omni bug <n>`** also checks the pull request's body, because the pinned CLI is the one piece an
old plugin cannot skip. The skill writes the body to a file and runs `omni bug <n> --body-file <file>`
until it prints `ok`, then opens the pull request with that same file; without the flag, `omni bug`
reads the open pull request of the current branch through `gh`, and with neither it prints `not ok` and
the way to proceed. A `## Proof` passes with an `https://` image and its `- **Before the fix**` and
`- **After the fix**` lines, or with `GIF not produced - <reason>`; a not-produced proof on a pull
request that is not a draft is refused. A record with a `## Fixes` section is not checked. A pinned
omni that does not know `--body-file` exits 2, and the skill runs `omni bug <n>` without it.

When the reproduction already passes before any fix, `/omni:bug-fix` and `/omni:mega-bug-fix` look for
the merged pull request that fixed the bug. Only a candidate proven red at its merge's first parent and
green at its merge gets a `Fixed by #<n>` (or `Fixed by <PR URL>`) line on the issue; the others are
`Maybe: #<n>` lines, and the issue is never closed.
