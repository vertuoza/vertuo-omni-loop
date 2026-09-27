---
prd: 216
title: PRD dossiers — every PRD's artifacts and answered questions, versioned and shareable in the galaxy
blocked-by: [144]
spec: file
---

# PRD dossiers: every PRD's artifacts and answered questions, versioned and shareable in the galaxy

**Date:** 2026-09-27 · **PRD:** #216 · **Touches:** `kit/` (a command, two skills, the brainstorm
and plan skills, the config), `apps/galaxy` (a contract, two pages, the planet's tabs),
`supabase/`, `game/` (the fallback), ADR-0002 · **Blocked by:** #144 (Question history). Its
`claude_session_id` on ask sessions, its `prd` on rounds and its workspace-wide read are what link a
PRD to the questions that shaped it.

## Problem

A PRD is the loop's most important artifact, and outside git it has nowhere to live.

- **The before/after page cannot be opened by the people it is for.** It is a file in the
  repository: GitHub shows it as raw HTML, and a product owner has to clone the branch to see the
  mockups. The brainstorm skill forbids a claude.ai artifact, because that is private to its author.
- **Nothing shows how the PRD was shaped.** The questions the brainstorm asked, and the answers that
  decided the design, are nowhere near the spec. PRD 144 keeps questions for good, but a brainstorm
  asks its questions *before* the PRD issue and the feature branch exist. PRD 144 derives a round's
  `prd` from the branch, so every brainstorm question is stored with no PRD.
- **Only the last version survives in view.** A spec is reviewed and changed, a before/after page is
  redrawn, a plan is repaired. Git keeps every version, but nobody who is not an engineer can find
  one.
- **The galaxy knows nothing of it.** A PRD's planet shows its zones, its Entropy and its log, but
  not the spec it is building, the page it promised, or the decisions behind it.

## Solution

The galaxy keeps one **dossier** per PRD: its artifacts, every version of each, the repositories
involved, and the questions that shaped it. The dossier exists from the minute a brainstorm starts,
and is filled automatically.

### The flow

```
/omni:brainstorm
 step 0  /omni:dossier-open "<idea>"  → a draft dossier (no number yet), linked to this Claude session
 step 1  questions (ask mode on)      → attach to the draft as they are asked
 step 7  /omni:dossier-push <n>       → the draft becomes PRD #n; spec.md and before-after.html go up (v1)
 step 8  /omni:plan → dossier-push    → plan.md goes up
 step 9  phase-0 → dossier-push       → a new version only where a file changed

the fallback, every 15 minutes (the game workflow, each repository's default branch)
         <delivery>/inbox/* and shipped/*  → finds or creates each PRD's dossier,
                                             adds a version where a file's content differs
```

- **The kit uploads** with the terminal's sign-in (PRD 71's `omni signin`), whenever the
  repository's switch is on and the computer is signed in. Ask mode does not need to be on.
- **The fallback reads GitHub.** It catches a PRD brainstormed with no sign-in, an edit that reaches
  the default branch later (the phase-0 merge, a `yolo-fix`, the shipped folder), and every PRD that
  existed before this one: on its first run, every PRD already shipped gets a dossier.

### The switch

`.omni-loop/config.yml` takes `dossier: { enabled: <boolean> }`. The kit's default is `false`, so a
repository opts in, and this repository sets `true`. The switch is on only when `dossier.enabled` is
`true` and `ask.url` is set. When it is off:

- `omni dossier open` and `omni dossier push` print `off`, call nothing, and exit 1.
- The fallback skips the repository.
- Every dossier already stored stays readable. Turning the switch back on picks up where it left
  off: the fallback's next run adds whatever changed while it was off.

### A dossier

- **Its key** is *workspace + home repository + PRD number*. The home repository (`owner/name`) is
  the one whose issue the PRD is, which is the repository the brainstorm runs in. A **draft** has no
  number yet.
- **Its workspace** is the one PRD 144's `ask_session_workspace(owner, repo)` gives: the caller's
  workspace whose `github_org` owns the home repository, else the one they joined first. The
  fallback's is the workspace it runs for.
- **Its repositories:** the home repository, plus the repository of every question attached to it,
  plus, for a PRD of the workspace's plan repository, its planet's regions (the ledger's
  `REGION_SURVEYED` events, each as `<github_org>/<region>`). Filtering by a repository matches any
  of these.
- **Its artifacts:** `spec.md`, `plan.md` and `before-after.html` from the PRD's folder. Each upload
  of a file is a **version**, stored whole with its SHA-256 hash, its size, its source (`kit` or
  `github`), and who uploaded it (kit) or the commit it was read at (github).
- **A version is added only when its hash differs from the latest version of the same kind.** The
  same content sent twice, by the kit or the fallback, adds nothing. Content that goes back to an
  earlier state is still a new version. The hash is computed by the galaxy, never taken from the
  request.
- **Nothing is overwritten.** A version is never edited. The opener may delete a draft (a spike, an
  idea dropped); nobody deletes a numbered dossier.

### Which questions belong to a dossier

Two rules, both applied when the galaxy reads, so no question is copied or rewritten:

1. **Asked during the brainstorm.** A round whose ask session's `claude_session_id` is the
   dossier's, asked after the dossier was opened and before that Claude session opened another
   dossier.
2. **Asked during delivery.** A round whose `prd` is the dossier's number and whose ask session's
   `repo` is the home repository (PRD 144 records both), such as a question `/omni:do-work` asked on
   a slice branch.

Each round shows which rule brought it: **brainstorm** or **delivery**. A round matched by both is
shown once, as brainstorm. Rounds follow PRD 144's access rules: a member of the workspace reads
them.

### The kit

`omni dossier`, one command with three verbs. Every call has PRD 71's 5-second limit and one token
refresh, reuses ask mode's sign-in (`~/.config/omni/credentials.json`), and never blocks:

| exit | meaning |
|---|---|
| `0` | done: prints the dossier's link, and for `push` the versions added (`added: spec v2 · unchanged: before-after, plan`) |
| `1` | skipped, with one line naming why: `off`, `no sign-in (omni signin)`, `unreachable`, `refused (<status>)`, or `too large: <file>` |
| `2` | the kit is not installed here, or its config does not read |

- **`omni dossier open "<title>"`** opens a draft for this repository. It sends the Claude session id
  read from `CLAUDE_CODE_SESSION_ID` when that is set, and records the draft in the main checkout's
  `.omni-loop/local/dossiers.json`. The main checkout is found through
  `git rev-parse --git-common-dir`, so the brainstorm's worktree reads the same file. Each entry is
  `{ id, url, claudeSessionId, prd: null, openedAt }`.
- **`omni dossier push <n>`** reads PRD n's folder (inbox or shipped) and sends whichever of the three
  files exist, with the title from the spec's front matter. The draft it numbers is the recorded,
  unnumbered entry whose `claudeSessionId` is this terminal's, or else the only unnumbered entry.
  With several and no session id, it numbers none, and the push finds or creates PRD n's dossier by
  its key. After a push, the entry records `prd: n`. It works from any checkout and at any time,
  draft or no draft.
- **`omni dossier status`** prints `on` with the switch's source, or `off` with the reason.
- A file over 512 KiB is not sent: the line names it, and the others still go up.
- **What leaves the machine:** the three files (which are headed for GitHub anyway), the repository's
  name, the PRD number, the title and the Claude session id. No transcript text (ADR-0002).
- `kit/lib/dossier/` holds the pure parts: reading and hashing the folder, the local file, and
  choosing the draft. The HTTP client takes `fetch` injected, as ask mode's does (N-PRODUCT-1). The
  kit never names the galaxy (`kit/test/no-game-words.test.mjs`): its skills and lines say "the
  Omni page".

### Two small skills

Each wraps one verb and says how to report each exit code, and none of them stops the skill that
follows it. They are separate so that each step can be changed on its own.

| skill | runs | followed by |
|---|---|---|
| `/omni:dossier-open` | `omni dossier open "<one line of the idea>"`, and prints the link as "follow along at …" | `/omni:brainstorm`, at step 0, after the briefing |
| `/omni:dossier-push <n>` | `omni dossier push <n>`, and prints the link and the versions added | `/omni:brainstorm` at step 7 (after the push) and step 9 (after the phase-0 push); `/omni:plan` after it pushes `plan.md` |

On exit 1 or 2 each prints the line as is, and the calling skill carries on. The brainstorm's and
the plan's changes are recorded in their porting notes (`kit/porting/plugin--brainstorm.md`,
`plugin--plan.md`).

### The contract

ADR-0002's contract section adds two calls, both with the bearer token. An older kit makes neither
and keeps working. A server without them answers 404, which the kit reports as `refused (404)`.

- `POST /api/dossiers` `{ title, repo, claudeSessionId? }` → `201 { id, url }`.
- `POST /api/dossiers/push` `{ repo, prd, title, draftId?, artifacts: [{ kind, content }] }` →
  `200 { id, url, added: [{ kind, version }], unchanged: [kind] }`. It finds the dossier (the draft
  named, else the one keyed by `repo` + `prd`, else a new one), numbers a draft, adds versions, and
  answers with every kind it received. When the draft is numbered to a key the fallback already
  created, the draft is merged into that dossier: its versions, its Claude session id and its opener
  move over, and the draft is removed. The body is capped at 2 MiB and each artifact at 512 KiB
  (413). Refusals follow ADR-0029: 400, 401, 403 (not a member of the workspace), 404, 413 and 503.

### Data

One migration, after PRD 144's:

```sql
create table public.dossiers (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces on delete cascade,
  home_repo         text not null,                -- owner/name
  prd               integer check (prd > 0),      -- null while a draft
  title             text not null check (length(title) between 1 and 200),
  opened_by         uuid references auth.users on delete set null,  -- null: the fallback created it
  claude_session_id text,
  created_at        timestamptz not null default now(),
  numbered_at       timestamptz,
  unique (workspace_id, home_repo, prd)
);

create table public.dossier_versions (
  id          uuid primary key default gen_random_uuid(),
  dossier_id  uuid not null references public.dossiers on delete cascade,
  kind        text not null check (kind in ('spec', 'plan', 'before-after')),
  content     text not null,
  sha256      text not null,
  bytes       integer not null check (bytes between 0 and 524288),
  source      text not null check (source in ('kit', 'github')),
  uploaded_by uuid references auth.users on delete set null,
  commit_sha  text,                               -- github: the default branch's head when read
  git_blob    text,                               -- github: the file's blob hash
  created_at  timestamptz not null default now()
);
```

- Writes go through two security-definer functions, `dossier_open()` and `dossier_push()`, which
  check that the caller is a member of the workspace. Adding a version takes a lock on the dossier,
  so two pushes at once cannot both add one. The service role (the fallback) calls the same
  version rule.
- A member of the workspace reads a dossier and its versions (`is_member(workspace_id)`); anyone
  else reads nothing. The opener deletes their own draft (`prd is null`). There is no other update
  or delete. Grants are per column, after revoking everything, as the workspaces migration does.
- A security-invoker function `dossier_rounds(dossier)` returns the rounds of the two rules, each
  with its rule, so PRD 144's access rules still decide what a caller reads. Another,
  `dossier_list()`, returns each dossier of the caller's workspaces with its repositories, its
  latest version of each kind, its question counts and its last activity.

### The pages

Plain web pages like `/ask` and `/knowledge`, with the Google sign-in, their own callback route, and
light, dark and system themes. A member of the workspace reads them; anyone else gets not found.

- **`/prd`: the history.** Every dossier of the caller's workspaces, newest activity first (the
  latest version or question). Filters: repository (any of a dossier's repositories), draft or PRD,
  and a search over titles. Each row shows `#n` or DRAFT, the title, its repository chips, which
  artifacts it has and how many versions, and questions answered out of asked.
- **`/prd/<id>`: the page to share.** The header shows `PRD #n` or DRAFT, the title, the repository
  chips, who opened it and when, and **Copy link**. Four tabs:
  - **Before/after**, rendered in a sandbox (below).
  - **Spec** and **Plan**, rendered from markdown with raw HTML off, and the front matter shown as a
    line above the body.
  - **Questions**: each round's question, options, answer, who answered and after how long, its
    category (PRD 144), and brainstorm or delivery.
  - Each artifact tab has a **version picker**, newest first, where each entry names its version,
    date and source: *v3 · 27 Sep · Pierre (kit)* or *v4 · 28 Sep · commit a1b2c3d (github)*.
    An artifact with no version yet says so.
- **The before/after page is sandboxed.** It is served from `/prd/<id>/v/<version>/page` with
  `Content-Security-Policy: sandbox allow-scripts; default-src 'none'; style-src 'unsafe-inline';
  script-src 'unsafe-inline'; img-src data:; font-src data:` and `X-Content-Type-Options: nosniff`,
  and shown in an `<iframe sandbox="allow-scripts">`. It runs in an anonymous origin with no cookies
  and no network, even when the route is opened on its own.

### The planet's DOSSIER tab

The planet screen gets a fifth tab, after LOG: `STATUS · ZONES · ENTROPY · LOG · DOSSIER`.

- **It shows** each artifact with its latest version and date, `n asked · n answered`, and the last
  three answered questions, question and answer, each cut to one line.
- **`[START] OPEN`** opens `/prd/<id>` in a new browser tab. A tap on the hint does the same. The
  tabs still turn with ◀ ▶ and A.
- **A planet with no dossier** shows `NO DOSSIER YET`. When the read fails, the tab shows
  `DOSSIERS OUT OF REACH` and the rest of the planet is unchanged, as XP does.
- **The planet's dossier** is the one whose home repository is `<github_org>/<plan_repo>` and whose
  number is the planet's PRD. It is read on its own in `arcadeFor`, after the galaxy, as XP and
  scores are.
- **It has a tall layout too**, dropping nothing (the README's rule). The demo world and the
  single-file artifact get demo dossiers; in the artifact, which has no server, the tab shows them
  without the OPEN hint.

### The fallback

A new script, `pnpm game:dossiers`, runs in the game workflow's `ledger` job after `game:project`,
with the same GitHub token and service role:

1. For each repository of the workspace's sectors, and its plan repository, it reads
   `.omni-loop/config.yml` on the default branch. It skips a repository with no config or with the
   switch off, and takes `paths.delivery` (default `.omni-loop/delivery`).
2. One tree call on the default branch lists every `<delivery>/{inbox,shipped}/<nnnn>-<topic>/`
   file among `spec.md`, `plan.md` and `before-after.html`, with its blob hash.
3. It fetches only the blobs whose hash that dossier has not stored for that kind, finds or creates
   the dossier (`<github_org>/<repo>`, `nnnn`, the title from the spec's front matter or else the
   topic), and adds versions by the same rule, with source `github` and the branch head's commit.
4. A folder whose name does not parse, a file over 512 KiB, and a repository that cannot be read
   are skipped and logged. Nothing fails the job.

## Decisions

1. **One dossier per PRD, keyed by workspace, home repository and number.** It is a draft until its
   issue exists. A PRD belongs to the workspace, and its repositories are derived: the home
   repository, its questions' repositories and its planet's regions.
2. **The kit uploads whenever it is signed in; the fallback reads GitHub.** Ask mode's on/off governs
   questions only. The artifacts go to GitHub anyway, so uploading them early publishes nothing new.
3. **One switch, `dossier.enabled`, off by default in the kit and on in this repository.** The kit
   and the fallback both obey it. A per-person switch is not part of this PRD.
4. **One small skill per step.** `/omni:dossier-open` and `/omni:dossier-push` each wrap one verb,
   and the brainstorm and the plan follow them, so each step can change without touching the others.
5. **Questions are linked when read, never copied.** Brainstorm rounds link by the Claude session,
   delivery rounds by `prd` and repository. PRD 144's tables and access rules are unchanged.
6. **The Claude session id comes from `CLAUDE_CODE_SESSION_ID`.** Without it, brainstorm questions
   do not attach and everything else works. The local file still lets the push number the draft.
7. **Versions are whole files, deduplicated against the latest,** hashed by the galaxy. There is no
   diff.
8. **Artifacts live in Postgres rows, not in a storage bucket.** They are text of at most 512 KiB,
   read under the same row-level security as everything else. The repository uses no bucket today.
9. **The before/after page runs sandboxed** on its own route with a sandbox CSP, never inline on the
   galaxy's origin.
10. **Markdown is rendered with `markdown-it`, `html: false`.** It is one small dependency: the
    galaxy has no renderer today.
11. **The fallback lives in the game workflow.** It already holds the GitHub token and the service
    role. Removing the game removes the fallback, and the kit's uploads keep working.
12. **The planet links out.** The DOSSIER tab summarises and START opens the page: reading a spec in
    pixel type would help nobody. This is the first scene that opens a URL.

## User stories

- As a PM, I start `/omni:brainstorm` and get a link before the first question. I send it to the
  product owner, who watches the draft fill with the questions and my answers.
- As a product owner, I open the PRD's link from Slack and see the before/after page rendered, with
  no clone and no GitHub, and the questions that led to it.
- As an engineer, I open PRD 144's planet, turn to DOSSIER, see the spec is at v3 and eleven of twelve
  questions are answered, and press START to read them.
- As anyone in the workspace, I open `/prd`, filter on `vertuoza/vertuo-omni-loop`, and find every
  PRD that touched it, including one whose home is another repository.
- As a reviewer, I pick v1 of the spec on `/prd/<id>` and read what the PRD said before its review.
- As a repository owner, I set `dossier.enabled: false`, and nothing more is uploaded from my
  repository.

## Scope

**In:**
- The switch.
- `omni dossier` and its two skills, followed by the brainstorm and the plan.
- The contract's two calls and ADR-0002's contract section.
- The migration, its functions and its access checks.
- `/prd` and `/prd/<id>`, with the sandboxed before/after route.
- The planet's DOSSIER tab, with its demo data.
- The fallback script and its step in the game workflow.
- The kit README's and the galaxy README's lines.

**Out:**
- A diff between versions.
- Comments on a dossier.
- A link for someone outside the workspace.
- Slack.
- Editing an artifact in the galaxy.
- A per-person switch.
- Reading feature branches in the fallback.
- Deleting a numbered dossier.
- Declaring a PRD's repositories in its spec (`omni check inbox` allows no such field).
- Attaching other files of the folder (outbox, retro).

## Test seams

No test calls Supabase, GitHub or the network, apart from the `supabase` workflow's local stack
(`omni kb show testing`).

- **The kit's pure parts** (`kit/lib/dossier/*.test.mjs`):
  - Reading a folder: the three kinds, their hashes and sizes, a missing file, a file over 512 KiB,
    and the title from the front matter.
  - Choosing the draft: by session id, the only unnumbered one, several with none, one already
    numbered for another PRD.
  - The local file: half-written, missing, or the wrong shape reads as empty, and the main checkout
    is found from a worktree.
- **The switch** (`kit/lib/config.test.mjs`): `dossier.enabled` defaults to `false`, `true` with
  `ask.url: null` reads as off, and a non-boolean is refused.
- **The command** (`kit/bin/dossier.test.mjs`, through `main()` on a fixture repository against
  `kit/test/fake-ask-server.mjs`, extended with the two calls):
  - `open` then `push`, and a second identical push adds nothing.
  - `off` makes no call.
  - No sign-in, a 401 after one refresh, an unreachable server and a 413 each exit 1 with their
    line, within the time limit.
  - The session id is sent when `CLAUDE_CODE_SESSION_ID` is set and omitted when it is not.
- **The skills** (`kit/test/plugin.test.mjs`): the two skills parse and name only `omni dossier`,
  the brainstorm and the plan follow them, and `no-game-words` stays green.
- **The API** (`apps/galaxy/src/dossier/api.test.ts`, fake store, the `world()` pattern of
  `src/ask/api.test.ts`):
  - Open, and push with and without a draft.
  - Numbering, and merging a draft into a dossier the fallback created.
  - Deduplication against the latest version, and the hash computed from the content.
  - The 2 MiB body and 512 KiB artifact caps, refusals for a non-member, and a malformed body (400).
- **The access rules** (`supabase/checks/dossiers.sql`, run by the `supabase` workflow on an empty
  database):
  - A member reads, and a member of another workspace reads nothing.
  - Versions cannot be updated or deleted.
  - Only the opener deletes a draft, and nobody deletes a numbered dossier.
  - `dossier_push()` refuses a non-member, and adds nothing for an unchanged file.
  - `dossier_rounds()` returns brainstorm and delivery rounds by the two rules, and nothing a caller
    could not read.
- **The pages** (component tests):
  - `/prd` filters by repository, so a dossier with three repositories shows under each, and by
    draft or PRD, and searches titles.
  - `/prd/<id>` shows its tabs, the version picker, an artifact with no version yet, and questions
    marked brainstorm and delivery.
  - The iframe carries `sandbox="allow-scripts"`, and the route answers with the CSP and `nosniff`
    headers.
  - Markdown with raw HTML renders it as text.
- **The planet** (`scenes/planet.test.ts`, `grid.test.ts`): the DOSSIER tab in the wide and tall
  grids, with a dossier, with none, and with the read failed. The START hint is absent in the
  artifact.
- **The fallback** (`game/dossiers/*.test.mjs`, `gh` outputs as fixtures):
  - A tree listing, where only changed blobs are fetched.
  - A repository with the switch off, or with no config, is skipped.
  - A malformed folder and an oversized file are skipped.
  - A second run with no change adds nothing.

## Risks

- **What merging publishes** (`omni kb show releasing`):
  - A migration on the production Supabase project, through the `supabase` workflow's `deploy` job.
  - The kit, through `kit/dist/omni.mjs` and the plugin marketplace.
  - The galaxy's pages and planet tab.
  - A new step in the game workflow.
- **Rollback:**
  - `dossier.enabled: false` stops every upload from a repository at once.
  - The migration only adds tables and functions. A follow-up migration drops them, and the
    backup the game workflow exports keeps the rest.
  - An older kit makes neither call, and a newer kit against an older galaxy gets `refused (404)`
    and carries on.
- **The fallback runs only while the game workflow is switched on** (`GAME_ENABLED`). Until then, only
  the kit's uploads fill dossiers.
- **The Claude session id depends on Claude Code.** `CLAUDE_CODE_SESSION_ID` is what links a
  brainstorm's questions, and it must equal the hook input's `session_id`, which PRD 144 stores. The
  last slice checks this by hand. A runtime without it leaves brainstorm questions unlinked, never
  failed.
- **A before/after page is HTML someone else's Claude wrote.** It is sandboxed with no cookies and no
  network, but it can still show anything inside its frame.
- **Blocked by PRD 144.** The linking needs its `claude_session_id`, `prd`, workspace and
  member read. This PRD is built on the default branch once #147 has merged.

## Acceptance criteria

No acceptance harness in this repository (`acceptance.enabled` is false). Each criterion becomes an
ordinary test, or a manual step recorded with screenshots in the last slice's sub-PR.

1. With the switch on and a sign-in, `/omni:brainstorm` prints a dossier link before its first
   question. The link opens a DRAFT titled with the idea.
2. With ask mode on, each question answered during that brainstorm appears on the draft's Questions
   tab, marked brainstorm, with its answer and who answered.
3. After step 7 the dossier reads `PRD #n`, and Before/after and Spec show v1.
4. After `/omni:plan`, Plan shows v1.
5. A phase-0 push with nothing changed adds no version. A changed spec pushed again shows v2, and v1
   stays readable from the picker.
6. A question asked later on the feature branch or a slice branch of PRD n appears on the Questions
   tab, marked delivery.
7. Any member of the workspace opens the link. An account of another workspace gets not found.
8. `/prd` lists the workspace's dossiers, newest activity first. Filtering by a repository shows
   every dossier whose repositories include it: a PRD whose planet has regions in three repositories
   shows under each.
9. PRD n's planet has a DOSSIER tab with its artifacts, question counts and last three answers, and
   START opens `/prd/<id>`. A planet without a dossier says `NO DOSSIER YET`. The tab fits the wide
   and tall grids.
10. With `dossier.enabled: false`, or `ask.url: null`, `omni dossier open` and `push` print `off` and
    call nothing, and the brainstorm and the plan carry on. The fallback skips the repository, and
    stored dossiers stay readable.
11. With no sign-in, the page unreachable, or a file over 512 KiB, the command exits 1 with one line
    naming why (and the file), within 15 seconds, and the skill carries on.
12. After one fallback run with the switch on, every PRD folder on the default branch of each sector
    repository has a dossier with its files as versions (source `github`, with the commit). A second
    run with no change adds nothing, and a file changed on the default branch adds one version.
13. The before/after page renders inside a sandboxed frame, and its route answers with the sandbox
    CSP header. A script in the page cannot read the galaxy's cookies or reach the network.
14. The opener can delete a draft, nobody can delete a numbered dossier, and no version can be
    edited.
15. Without `CLAUDE_CODE_SESSION_ID`, the draft still opens and is numbered by the push, and only
    delivery questions attach.
