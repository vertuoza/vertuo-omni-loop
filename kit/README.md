# The Omni Loop kit

The `omni` CLI (`kit/bin/`, shipped bundled as `kit/dist/omni.mjs`, which `pnpm kit:build` rebuilds)
and the `omni` plugin for Claude Code (`kit/plugin/`: its skills and hooks). A repository installs
both to run the Omni Loop; everything specific to that repository is read from its
`.omni-loop/config.yml`.

**Ask mode** puts the questions Claude asks through `AskUserQuestion` on a web page: sign in once per
computer with `omni signin`, then `/omni:ask on` in a checkout prints the page's link, and
`/omni:ask off` turns it off. The mode is per checkout: `on` replaces nothing, and every Claude Code
terminal open in the checkout gets a tab of its own on the one page, which goes away when that
terminal exits. It needs `ask.url` in the config (`null` by default, which leaves it off), and
whenever the page cannot answer, the question shows in the terminal as usual. The questions are
kept: the whole workspace reads them, sorted and searchable, on the page's History, and a live one
can be shared with a teammate, who answers it on its own link.

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

**Answers** take the outbox's questions in three places, and every one ends as the person's own
reply on the feature pull request, in the grammar `omni replies` reads (ADR-0048). The switch is
`answers: { enabled: true }` in the config: `true` by default, and `omni init` writes it into every
new config. `omni answers ask <prd> --pr <n> [--json]` prints the open `human-action` and `high`
questions in batches of at most four, human action first (mediums are never asked: they are already
adopted), and exits `1` with one line when nothing is open or the switch is off.
`omni answers post --prd <n> --pr <n> --answers <file> [--print]` reads the picks from a JSON file
(`[{ "number": 1, "pick": "A" }, { "number": 2, "pick": "B", "reason": "…" }]`; `done`, `not-done`
with a reason, or `prose` with its `text`), writes the reply with the one reply writer the App and
the Omni page also use, posts it and prints its link; `--print` posts nothing, and a refused pick or
a failed post exits `1` (a failed post prints the reply, to paste). **The end of `/omni:yolo`:**
when every slice merged, the gate ends red and the switch is on, it first writes everything it
writes today (the outbox comment, the draft PR, the status comment), then asks one question:
*Answer here now*, *Answered in the Omni page or on the pull request — carry on*, or *Later — stop
here*. Answering asks through `AskUserQuestion` and posts with `omni answers post`; answering or
carrying on then follows `/omni:yolo-fix` steps 2 to 7 in the same run, so one command can go from a
PRD to a pull request ready for review. An unattended yolo now waits at that question:
`answers.enabled: false` restores the old ending. With the switch on and `ask.url` set, the outbox
comment also links the PRD's Outbox tab on the Omni page.

**The knowledge graph** is the knowledge registers read as one map: `omni kb graph` prints a summary
(a line per domain with its principles, rules, invariants, laws and proposals, then the principles
nothing serves and the rules and invariants that serve no principle), and `omni kb graph --json` the
whole graph as one JSON document (`version: 1`, `repo`, `domains`, `entries`, `links`, `loose`,
`unserved`). Each link is `serves` (a rule or an invariant to the principle its `Serves:` line
names) or `cites` (an entry to another whose id its statement or `Why:` names). It is built by the
same parser every other command reads the registers with, so an agent can ask what serves a
principle, or what a domain holds, in one call. A repository without a knowledge folder prints an
empty graph.
