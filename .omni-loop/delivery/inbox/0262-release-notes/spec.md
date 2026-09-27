---
prd: 262
title: Release notes — every shipped PRD, versioned, on a public page
blocked-by: none
spec: file
---

# Release notes: every shipped PRD, versioned, on a public page

**Date:** 2026-09-27 · **PRD:** #262 · **Touches:** the kit (a note format, `omni check releases`,
the ship guard, a config switch, a slot of the `releasing` form, the `/omni:yolo` and
`/omni:yolo-fix` skills), `supabase/` (a table anyone may read, and its access check),
`.github/workflows/` (a sync), `apps/galaxy` (a `/releases` page, a card on `/app`, the sync
script), and a `release.md` in every shipped PRD folder. **Does not touch:** the omni-loop GitHub App,
the game, `/omni:brainstorm`, `/omni:plan`.

## Problem

Omni Loop shipped 21 PRDs between 24 and 27 September 2026, and nobody can say what they were
without reading git.

- **There is no list of what shipped.** A PRD's record is its folder under
  `.omni-loop/delivery/shipped/`, its issue and its merged feature PR. All three live in a private
  repository and are written for engineers: a spec title such as "Knowledge harvest — every merged
  PRD's decisions land in the knowledge base" says what was built, not what it is worth.
- **Nothing has a version.** Every `package.json` says `0.1.0`, there are no tags and no changelog.
  "What changed since last week?" has no answer short of `git log`.
- **Nothing is public.** Every reading page of the galaxy app asks for a Vertuoza sign-in, and
  `/app` is `noindex`. The person who wants to show Omni Loop to someone outside, press included,
  has no page to send.
- **Volume makes it worse every day.** Seven PRDs a day means any hand-written list is out of date
  the evening it is written.

## Solution

Every PRD the loop ships carries a **release note**: a catchy, value-driven title and a neutral,
factual description. The loop writes it when it ships the PRD, and the person who reviews the
feature PR approves it. When the PRD reaches `main`, a sync stamps it with a version (`0.0.1`,
`0.0.2`, …) once and for good, and a public page lists every release, week by week, newest first.
The 21 PRDs shipped so far are the initial release, `0.0.1`.

```text
/omni:yolo, gate green                feature PR                     main
  writes <folder>/release.md ──▶ the reviewer reads and ──▶ merge ──▶ releases.yml (on push)
  omni ship refuses without one    edits the copy                     │  git: when did each
                                                                      │  shipped folder reach main?
                                                                      ▼
                                           public.releases  (prd, release, released_at, title, description)
                                                                      │  anyone may read
                                                                      ▼
                                           /releases: weeks, newest first, no sign-in, indexed
```

### The note: `release.md`

A new file in the PRD's folder, beside `spec.md`, moved to `shipped/` with the rest of the folder:

```markdown
---
prd: 238
title: Jump between work and play in one tap
---
A Game mode button on every app page and an App mode switch in the arcade move you between the
reading pages and the game, with a confirmation before each switch. The app gets its own home page.
```

- **Front matter:** `prd` (the folder's number), `title`, and, only on the initial release's notes,
  `version: 0.0.1`. Nothing else. A note written at ship never carries a version: the sync gives it
  one.
- **Title:** value-driven and catchy, in sentence case, 60 characters at most, one line, no final
  full stop. No PRD or pull request number, no code, no loop jargon (product names such as "ask
  mode" are fine).
- **Description:** the body, one paragraph of one to three sentences, 280 characters at most.
  Neutral and factual, present tense: what changed, and for whom. No superlatives, no links, no
  code, no file paths, no people's names.

**`omni check releases`** grades every `release.md` in `inbox/` and `shipped/`, each failure naming
the file and the rule:

1. The front matter parses and holds exactly `prd`, `title` and, optionally, `version`.
2. `prd` is the folder's number.
3. `version`, when present, is `0.0.1`.
4. The title is 1 to 60 characters on one line, does not end with `.`, and does not match
   `PRD <digits>`.
5. The description is 1 to 280 characters, one paragraph: no blank line, no heading, no list item.
6. Neither holds a URL (`http://`, `https://`, `www.`), a `#<digit>` reference, a backtick, or a
   path under the kit's own folder (`.omni-loop/`).

`omni check all` runs it too. A repository with no `release.md` anywhere passes trivially.

### Writing it: the kit

- **The switch:** a new config section, `releaseNotes: { enabled: false }`, read like
  `dossier.enabled`. Off by default in the kit, so no other repository that runs the loop changes.
  This repository's `.omni-loop/config.yml` turns it on.
- **The voice:** the `releasing` form gets an optional slot, `## Release notes`
  (`<!-- slot: notes · optional -->`), whose kit default is the rules above with three example notes.
  `omni kb show releasing` prints it; a repository may write its own voice there.
- **`/omni:yolo`, step 5, gate green:** when `releaseNotes.enabled` is true, before `omni ship`, the
  skill writes `<folder>/release.md` from the spec and from what the feature branch actually built
  (not from the plan), following `omni kb show releasing`. It runs `omni check releases`, fixes
  until green, and commits it as `docs(release): PRD <n> release note` with the usual trailers. Then
  it ships as today.
- **`/omni:yolo-fix`, step 7, gate green:** the same, and when the rework changed what the PRD does,
  it rewrites the note that is already there.
- **The guard:** with the switch on, `planShip` refuses a PRD whose folder has no `release.md`
  (reason `no release note: <folder>/release.md`) or whose note fails the check (reason
  `release note: <the rule>`). The feature PR stays draft, as for any refusal. With the switch off,
  `omni ship` behaves exactly as today.
- **Review:** the note is part of the feature PR's diff. The person who merges it approves the copy,
  and may edit it on the branch before merging.

### Publishing it: the table, the sync and the workflow

**`public.releases`**, one row per PRD, in a new migration:

| column | type | meaning |
|---|---|---|
| `prd` | integer, primary key | the PRD number |
| `release` | integer, ≥ 1 | the patch number: the page shows `0.0.<release>` |
| `released_at` | timestamptz | when the PRD's shipped folder first reached `main` |
| `title` | text, not empty | the note's title |
| `description` | text, default `''` | the note's description |

- `release` is unique among the values above 1. Value 1 is shared by every PRD of the initial
  release.
- **Anyone may read it:** row-level security on, one select policy `using (true)` for `anon` and
  `authenticated`, and select granted to both, explicitly (revoked first, as the other migrations
  do). Nobody but the service role writes. `supabase/checks/releases.sql` proves both, and the
  `supabase` workflow's check job runs it beside the others.

**The sync,** `pnpm releases:sync` (`apps/galaxy/scripts/releases-sync.mjs`), with its rules in a
pure module the page shares (`apps/galaxy/src/releases/`). It reads this repository's shipped folders
through the kit (config, layout, the note parser) and git, reads the table, and upserts:

1. **A PRD already in the table keeps its `release` and `released_at` forever.** Only its title and
   description are refreshed from `release.md`, so a typo is fixed by a pull request.
2. **A note pinned `version: 0.0.1` gets release 1.**
3. **Every other shipped PRD with no row gets the next number,** starting at 2, in the order its
   shipped folder first reached `main`, the lower PRD number first on a tie.
4. **`released_at`** is the committer date of the first commit on `main` that holds the PRD's
   `shipped/<folder>/spec.md` (`git log --no-renames --diff-filter=A`, oldest). After a squash merge
   that is the merge time.
5. **A shipped PRD with no `release.md`** is published all the same: its spec's title, an empty
   description. It takes a real note the day someone adds one by pull request (rule 1).
6. **It never deletes a row.**

Because every number comes from `main`'s history, emptying the table and syncing again rebuilds the
same versions and dates.

**`.github/workflows/releases.yml`:**

- **Triggers:**
  - A push to `main` that touches `.omni-loop/delivery/shipped/**` (or the workflow itself).
  - A completed, successful run of the `supabase` workflow on `main`, so the first sync follows the
    migration.
  - `workflow_dispatch`, to run it by hand.
- **Checkout:** the full history (`fetch-depth: 0`).
- **Concurrency:** one run at a time (`group: releases`, `cancel-in-progress: false`).
- **Credentials:** the same Supabase URL and service key as `game.yml` (`vars.SUPABASE_PROJECT_ID`,
  `secrets.SUPABASE_SERVICE_ROLE_KEY`).
- **Off switch:** off while `SUPABASE_PROJECT_ID` is unset, like `supabase.yml`.
- **Independence:** it shares nothing with the game, so deleting `game/` leaves it working.

### Reading it: `/releases`

A new page of the galaxy app, public and indexed, on the reading pages' surface: their tokens, their
faces, light, dark and system themes, the theme script first, and the app bar (`OMNI LOOP` with the
sub-title `Releases`, the theme switch, Game mode).

```text
OMNI LOOP  Releases                                   ◐  Game mode
────────────────────────────────────────────────────────────────
What's new in Omni Loop
Every PRD the loop ships, in plain words. Newest first.

WEEK OF 28 SEP 2026
  0.0.3 · Tue 29 Sep · PRD 255
  <title>
  <description>

  0.0.2 · Mon 28 Sep · PRD 262
  <title>
  <description>

▸ WEEK OF 21 SEP 2026 · 1 release · 21 PRDs          (a <details>, once it is not among the 4 newest)
  0.0.1 · Sun 27 Sep · Initial release
  From idea to merged PR, on a loop.
  <intro>
  • <title> — <description> · PRD 3
  • …
```

- **Weeks** start on Monday, in Europe/Brussels time, newest first, headed `Week of <Monday's date>`.
  A release sits in the week of its date: its row's `released_at`, or for release 1 the latest
  `released_at` among its rows.
- **Inside a week,** releases run newest first. Each shows its version, its day, `PRD <n>` as plain
  text (never a link), its title as a heading and its description.
- **Release 1** shows `Initial release`, the headline *From idea to merged PR, on a loop.*, the
  intro below, then one line per PRD in PRD order: title, description, `PRD <n>`.
- **The four newest weeks are open.** Each older week is a native `<details>`, its summary giving the
  week, its number of releases and of PRDs. It stays one HTML page: no script, every word indexable.
- **Each release has an anchor,** its version (`/releases#0.0.3`), so one release can be shared.
- **Nothing links to GitHub:** the repository is private.
- **Public:** no sign-in, no cookie read, no `noindex`. A title (*Release notes · Omni Loop*), a
  description, a canonical address and Open Graph tags. The page is regenerated at most every
  5 minutes.
- **Its words** live in `src/releases/`: the heading, the line, the initial release's headline and
  intro, the unavailable message.
- **`/app` gets a fifth card:** **Release notes**, `/releases`, *What Omni Loop shipped, week by
  week*.
- **Modes (`src/data/mode.ts`):** with Supabase, it reads `public.releases` with the publishable key
  and no session. In demo, it renders a built-in sample. Closed (no Supabase in a deployed build), it
  shows *Release notes are unavailable right now.*
- **A failed read** never fails the build and never replaces a good page: the last good render stays
  served. A visitor who meets a failure with no good render behind it sees *Release notes are
  unavailable right now.*, with no error detail.

### The initial release, 0.0.1

**Headline:** From idea to merged PR, on a loop.

**Intro:** The first public release of Omni Loop gathers everything shipped from 24 to 27 September
2026: the kit and its Claude Code plugin, the omni-loop GitHub App, ask mode and its question
history, a knowledge base that fills itself, PRD dossiers, a design system, and the arcade that turns
delivery into a game.

Each line below becomes that PRD's `release.md`, pinned `version: 0.0.1`. A PRD that ships before
this one merges joins 0.0.1 the same way, its note written in this voice by the slice that writes
these.

| PRD | Title | Description |
|---|---|---|
| 3 | Install the delivery loop in any repository | The Omni Loop kit packages the brainstorm, build, review and ship loop as one command-line tool and one configuration folder, so any repository can run it without a hand-made copy of its own. |
| 7 | Brainstorm, build and ship with three commands | The omni plugin for Claude Code gives the loop its commands: /omni:brainstorm turns an idea into a reviewed PRD, /omni:yolo builds it in parallel slices, and /omni:yolo-fix reworks what a reviewer disagreed with. |
| 28 | Every open question, visible on the pull request | The omni-loop GitHub App adds an outbox check to every pull request. It stays red while a decision the agents took still waits for a person, so reviewers see open questions before they merge. |
| 39 | Set up Omni Loop with one line | omni init installs the loop in a repository with a single command: it writes the configuration, adds the command-line tool, creates the labels the loop uses and says what is left to connect. |
| 45 | A playbook that tells agents how your repo works | Each repository gets a playbook of short forms (how it tests, what a merge publishes, what must never break), filled from what the repository already documents. Agents read it at every step of the loop. |
| 50 | Decision reviews with a sense of humour | Every question the agents leave for a person on a pull request now opens with a short intro and ends with a punchline, so a long list of decisions reads like a conversation rather than a form. |
| 68 | Your repository's rules, found and written down | /omni:invade explores a repository and proposes its knowledge base: principles, business rules and invariants, pointing at the pages that already state them or drafted from what the code enforces. |
| 71 | Answer Claude on a page, not in a terminal | Ask mode shows the questions Claude asks during a session on a clean web page, with options and previews side by side. It is switched on per checkout, and the terminal takes over whenever the page cannot answer. |
| 72 | Every delivery comes with its own retrospective | When a PRD merges, the Omni Loop app counts what went wrong during its delivery and opens a retro pull request with findings, evidence and proposed lessons. It runs again 14 days later. |
| 82 | Every decision lands in the knowledge base | When a PRD merges, the decisions taken while building it are sorted into the knowledge base as decision records, rules or invariants, with who answered and who merged. One pull request carries them all. |
| 94 | The arcade, in your pocket | On a phone, the Omni Loop arcade appears as a handheld console with readable text and real buttons; on a computer, the screen alone fills the window. The game itself does not change. |
| 99 | Omni-man signs the loop's work | Every commit, pull request and issue the loop makes carries Omni-man's signature, and a new command, omni credits, counts his contributions across the organisation. |
| 100 | One loop, many teams | Everything the game holds now belongs to a workspace, with its own members, fleets, repositories and colours. Vertuoza is the first workspace, and others can join without seeing each other's data. |
| 141 | One look for everything Omni Loop | A single design library holds the Omni Loop logo, colours, fonts and pixel sprites. The arcade and every reading page draw from it, and a catalogue page shows each piece. |
| 142 | Every terminal gets its own tab | Ask mode keeps one session per Claude Code terminal. The page shows each terminal as a tab, so questions from sessions running side by side no longer overwrite each other. |
| 144 | No answer is ever lost again | Every question Claude asks is kept for good, with its repository, branch, PRD, cost, category and who answered. The whole workspace can browse the history, and a live question can be shared with a teammate. |
| 149 | See your knowledge base as a galaxy | Each domain of a repository's knowledge base appears as a star system of its principles, rules and invariants, in the arcade and on a plain reading page. |
| 160 | Shipping now levels you up | Every point earned by delivering also counts as experience that never resets. Levels unlock games in a new game room, starting with Entropy Invaders at the very first point. |
| 215 | A signature that links back home | Pull requests and issues made by the loop end with "Omni-man by Omni Loop ©", linking to the Omni Loop home page. The hero's name and the link are set once in the configuration. |
| 216 | Every PRD gets a home the whole team can read | Each PRD's spec, plan and before/after page are kept on the Omni page with every version, next to the questions that shaped them, for the whole workspace to read. |
| 238 | Jump between work and play in one tap | A Game mode button on every app page and an App mode switch in the arcade move you between the reading pages and the game, with a confirmation before each switch. The app gets its own home page. |

## Decisions

1. **A version is stamped once and stored, never recomputed.** The page cannot read git history on
   Vercel, and deriving numbers on every visit (from GitHub, or from the game's ledger) would tie a
   published number to whatever the source says that day. The sync stamps it once in a table.
2. **The text lives in the repository; the table is its projection.** The note is reviewed in the
   feature PR and fixed by pull request; the table only adds what the repository cannot know before
   the merge, the version and the date.
3. **No bot writes to `main`.** The sync writes to Supabase only. Only people merge into `main`.
4. **Numbers follow `main`'s history.** Order and dates come from the commit that first put a PRD's
   shipped folder on `main`, so a rebuild from an empty table gives the same result.
5. **The loop writes the note at ship, from what was built.** At brainstorm the note would describe
   intent, and the build can drift. After the merge nobody would review it. At ship, the feature PR's
   reviewer approves it.
6. **The initial release is one release with a line per PRD.** It gathers every PRD shipped before
   release notes existed, pinned `version: 0.0.1` in each note.
7. **Weeks, not days.** At about seven PRDs a day, a day section would be long and the list of days
   longer. Each entry keeps its own day, so no detail is lost.
8. **Public and indexed.** The page is a press page. It shows only versions, dates, titles and
   descriptions: no GitHub link, no names, no internal paths, which the check enforces on every note.
9. **Kit feature behind a switch, off by default.** Writing and guarding the note is generic, but no
   other repository running the loop changes until it opts in. The page and the sync are this
   repository's own.
10. **The voice is a slot of the `releasing` form, not a new form.** The rules belong beside "what a
    merge publishes", and a slot costs one template section, where a form costs a new id, template,
    check and `/omni:invade` step.
11. **A PRD merged without a note still appears,** under its spec title, so the page never hides a
    shipped PRD. The note can follow by pull request.
12. **No row is ever deleted by the sync.** Removing a published release is a person's decision,
    made in the database.
13. **`PRD <n>` is shown as plain text.** A link to GitHub would 404 for outsiders, and a link to a
    dossier asks for a sign-in.
14. **Older weeks collapse with `<details>`.** This keeps the page scannable as it grows, without a
    script and without hiding any text from search engines.

## User stories

- As the product lead, I open one link and see what Omni Loop shipped, week by week, in words a
  customer would understand, each with a version I can quote.
- As someone outside Vertuoza (press, a prospect, a partner), I read the release notes without an
  account, and share one release by its link.
- As the reviewer of a feature PR, I read the release note beside the code, and edit it before I
  merge.
- As an engineer, I never write a release note by hand nor pick a version number: the loop writes
  the note, and the sync numbers it.
- As a maintainer of another repository that runs the loop, nothing changes until I switch release
  notes on.

## Scope

**In:**
- The note format, its parser and `omni check releases` (also in `omni check all`).
- The `releaseNotes.enabled` config section, off by default, and on in this repository.
- The ship guard in `planShip`.
- The `notes` slot of the `releasing` form, with its kit default.
- The release-note step in `/omni:yolo` (step 5) and `/omni:yolo-fix` (step 7).
- A `release.md` for every PRD shipped before this one merges: the 21 above, pinned
  `version: 0.0.1`, and any that ship in between, written in the same voice.
- The migration for `public.releases` and `supabase/checks/releases.sql`, run by `supabase.yml`.
- The sync: its pure rules, `apps/galaxy/scripts/releases-sync.mjs`, the root script
  `releases:sync`, and `.github/workflows/releases.yml`.
- `/releases`, with its layout and its words; the `/app` card.
- Docs:
  - `.omni-loop/delivery/README.md` gains `release.md`.
  - The galaxy README gains the page and the sync, and its secrets table names `releases.yml`.
  - The kit's README gains the switch and the check.
  - `kit/dist/omni.mjs` is rebuilt.

**Out:**
- RSS or Atom feeds, email or Slack announcements.
- Release notes for other repositories, or a page per workspace.
- Translations.
- Links to GitHub or to dossiers.
- Search or filters.
- Editing a note from the page.
- Minor or major version bumps, git tags and GitHub Releases.
- Notes for standalone fix pull requests.
- A release view in the arcade.
- The omni-loop GitHub App, the game, and `/omni:brainstorm`.

## Test seams

No test calls GitHub, Supabase or the network (`omni kb show testing`). Tests sit beside the code:
`*.test.mjs` in `kit/`, `*.test.ts` / `*.test.mjs` under `apps/galaxy/src/`.

- **The note parser and `omni check releases`** (`kit/lib/…`, a unit test with valid and invalid
  inputs): each of the six rules fails on its own fixture and names the file and the rule. A folder
  with no note passes. `omni check all` includes the check (through `main()` on a `makeRepo()`
  fixture, as `kit/bin/kb.test.mjs`).
- **The config section:** `releaseNotes.enabled` defaults to `false` and accepts `true`. Anything
  else is refused with the key named.
- **The ship guard** (`kit/lib/delivery/ship.test.mjs`): switch on, no note → refused with
  `no release note: …`. Switch on, bad note → refused with the rule. Switch on, good note → the
  moves carry `release.md` to `shipped/`. Switch off → today's behaviour, unchanged.
- **The `releasing` form:** its template holds the optional `notes` slot. `omni kb show releasing`
  prints the kit default when the repository left it blank. `omni check kb` stays green on this
  repository.
- **The sync's rules** (pure, on in-memory fixtures):
  - Pinning gives release 1.
  - Unpinned PRDs are numbered from 2 in first-on-main order, the lower PRD number first on a tie.
  - Existing rows keep their number and date but take the new text.
  - A PRD with no note takes its spec title and an empty description.
  - No row is ever deleted.
  - Rebuilding from an empty table gives the same rows as running in steps.
- **The sync's git reading** (on a throwaway git repository built in the test, like the kit's
  fixtures):
  - The first commit that adds `shipped/<folder>/spec.md` is found through a rename from `inbox/`.
  - Its committer date is the one returned.
- **Weeks** (pure):
  - A Monday start.
  - A release at 23:30 UTC on a Sunday falls on Monday in Brussels, so in the next week.
  - Weeks run newest first, with releases newest first inside a week.
  - Release 1 is dated by its latest row.
  - The four newest weeks are open and older ones are collapsed.
- **The page** (`renderToStaticMarkup` over the page and its layout, as `src/design/page.test.ts` and
  `src/switch/render.test.ts`):
  - It renders from the sample rows.
  - It holds no `noindex`, and its metadata carries the title, description, canonical and Open Graph.
  - It imports no sign-in helper and reads no cookie.
  - It holds no `github.com` link.
  - Each release carries its anchor.
  - The closed mode shows the unavailable line.
- **`/app`:** `SECTIONS` holds five cards, the last opening `/releases`. Its page exists on disk.
- **`supabase/checks/releases.sql`:**
  - `anon` and `authenticated` can select.
  - Neither can insert, update or delete.
  - The partial unique index refuses a second PRD on the same release above 1.
- **By hand, in the last slice's sub-PR:** screenshots of `/releases` at 393×700 and 1440×900, in
  light and dark, from the demo sample.

## Risks

- **What merging publishes** (`omni kb show releasing`):
  - **The kit:** `kit/dist/omni.mjs` and the plugin get the check, the guard, the switch and the
    skill steps. The switch is off by default, so other repositories see no change until they opt
    in.
  - **The database:** a migration adds `public.releases`, applied to production by `supabase.yml`.
  - **A workflow:** `releases.yml`.
  - **The galaxy app:** `/releases` and the `/app` card, through its Vercel project.
- **The first table anyone on the internet may read.** It holds only release copy, the service role
  alone writes it, and `releases.sql` proves both in CI. The copy itself is guarded twice: the check
  refuses links, references, code and kit paths, and a person reviews every note in its feature PR.
- **Rollback:**
  - A revert of the feature PR removes the page, the guard, the skill steps and the workflow.
  - Migrations only move forward: the table stays until a new migration drops it, and nothing reads
    it once the page is gone.
  - The rows are rebuilt from `main`'s history by running the sync on an emptied table.
- **A PRD that merges between this PRD's last update from `main` and its own merge** has no note. It
  is published under its spec title, with the next number. A follow-up pull request adds its note:
  its text changes, its number stays.
- **A PRD shipped by the knowledge PR** (merged while still in `inbox/`) is dated by that knowledge
  PR's merge, not by its feature PR's. That can be hours later, but it is stable.
- **Rewriting `main`'s history** would change what a rebuild computes, never a row already stored.
- **"Version" already names a dossier's artifact versions** (`V3 · 24 SEP` on `/prd/<id>`). The
  release page always prints the full `0.0.<n>` and never "V", so the two do not read alike.
- **Supabase's Free plan pauses an idle project.** The page keeps serving its last good render, and
  the sync fails loudly in Actions until the project wakes.
- **The page is indexable once it is linked anywhere.** Everything on it is written to be public, so
  this is intended.

## Acceptance criteria

No acceptance harness in this repository (`acceptance.enabled` is false). Each criterion becomes an
ordinary test, or a manual step recorded in the last slice's sub-PR.

1. `/releases` opens with no sign-in, on a phone and on a computer, in light and dark. It shows the
   app bar (`OMNI LOOP` · Releases, the theme switch, Game mode), the heading *What's new in Omni
   Loop* and its line.
2. Releases are grouped in weeks that start on Monday in Brussels time, newest week first, each
   headed `Week of <date>`. Inside a week, releases run newest first. Each shows its version, its
   day, `PRD <n>`, its title and its description.
3. Release 0.0.1 shows *Initial release*, the headline, the intro, and one line per initial PRD in
   PRD order, each with its title, its description and `PRD <n>`.
4. The four newest weeks are open. Each older week is collapsed, and its summary gives its number of
   releases and of PRDs. Opening it shows its releases.
5. `/releases#0.0.1` scrolls to release 0.0.1.
6. The page's HTML holds no `noindex` and no link to `github.com`, and it carries a title, a
   description, a canonical address and Open Graph tags.
7. `/app` shows a fifth card, **Release notes**, which opens `/releases`.
8. `omni check releases` passes on every note this PRD adds. On a note that breaks one rule (a
   61-character title, a URL, a `#12`, a backtick, `version: 0.0.2`, a `prd` that is not the
   folder's), it fails and names the file and the rule.
9. With `releaseNotes.enabled: true`, `omni ship` refuses a PRD with no note, or with a note that
   fails the check, and names why. With the switch off, `omni ship` behaves as before.
10. `/omni:yolo` and `/omni:yolo-fix`, on a green gate with the switch on, write and commit the note
    before `omni ship`.
11. The sync, on fixtures:
    - It gives pinned notes release 1.
    - It numbers the others from 2 in first-on-main order, the lower PRD number first on a tie.
    - It keeps an existing row's number and date and refreshes its text.
    - It publishes a note-less PRD under its spec title.
    - It deletes nothing.
    - Rebuilt on an empty table, it gives the same rows.
12. `anon` can read `public.releases` and cannot write it (`supabase/checks/releases.sql`, in CI).
13. After this PRD's feature PR merges and the workflows have run, the production `/releases` shows
    0.0.1 with every initial PRD, and this PRD's own release as the next number, dated the day it
    merged (checked by hand).
