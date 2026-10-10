# The Omni Loop kit

The `omni` CLI (`kit/bin/`, shipped bundled as `kit/dist/omni.mjs`, which `pnpm kit:build` rebuilds)
and the `omni` plugin for Claude Code (`kit/plugin/`: its skills and hooks). A repository installs
both to run the Omni Loop; everything specific to that repository is read from its
`.omni-loop/config.yml`.

**Installing.** A laptop needs Node 22 or later, git, gh signed in and Claude Code signed in, then
`omni` once: `npm install -g github:vertuoza/vertuo-omni-loop` (check it with `omni --version`).
The global `omni` is the same bundle: inside a repository that has the kit it runs that
repository's own `.omni-loop/bin/omni.mjs`, and outside one only `init`, `help` and `--version`
run. In a repository, `omni init` does the rest: it switches to `chore/install-omni-loop`, writes
the kit under `.omni-loop/` (a fresh config with `ask.url` and `dossier.enabled: true`), commits
only its own files, pushes and opens the install pull request, installs the `omni` plugin, and
offers sign-in; a step it cannot do prints the lines to type instead. What is left is the GitHub
App link it prints and merging the pull request. The full walk-through is the Getting Started
guide, `docs/guide/install.md`.

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
every one is judged it sets `laws.requireProof: true` in the config. It writes the working tree and
commits nothing: a person opens the knowledge PR. With **`laws.requireProof: true`** (default
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
