---
prd: 1972
title: A service starts /omni:bug-fix, and every bug-fix PR shows a before/after GIF
blocked-by: none
spec: file
phase0: server
proof: video
---

# A service starts /omni:bug-fix, and every bug-fix PR shows a before/after GIF

**Date:** 2026-10-14 · **PRD:** #1972 · **After:** PRD 1830 (runners), PRD 1628 (kit tokens, ADR-0111
to ADR-0115), PRD 798 (proof videos), PRD 627 (fix dossiers) · **Touches:** the runners controller
and its test, the proof API and store and their tests, `omni proof push`, a new `omni bug film`, the
`/omni:bug-fix` and `/omni:mega-bug-fix` skills, the kit README's runner section, the guide's
use cases.

## Problem

vertuo-cleaner, Vertuoza's internal dashboard, groups production errors and opens an `omni:bug`
issue for an error group, in `vertuoza/vertuo-backend-php` for the back end or `vertuoza/vertuo-apps`
for the front end. Then it asks a person to paste `/omni:bug-fix <issue url>` into Claude Code.
Nothing starts the fix by itself: `POST /api/runners/jobs` queues a job only from a signed-in
browser (`sendJob` reads the session alone), while the runner's own routes (register, next, report)
already take the kit's sign-in.

And a bug-fix pull request carries no visual proof. Its body says "Red proven" with one failing
line; a reviewer never sees the bug, then the bug gone. Proof runs (PRD 798) exist, but only for a
PRD: `omni proof push` takes no kind, the proof API looks a dossier up as a PRD's only
(`dossierOf` reads kind `prd`), and its answer links a PRD's Proof tab.

## Solution

**1. Queue a job from a service.** `POST /api/runners/jobs` takes the kit's sign-in as the runner's
routes do: when the request carries an `Authorization` header, its caller is the Bearer access
token's person (`kitCaller`); without one, the browser's session, as today. The rest is unchanged:
the same `runnersService.send`, the same line check (`/omni:bug-fix` is a runner skill; an issue's
URL fits the arguments), the same rules (the repository in a workspace, the caller a member of it,
the target allowed). A service holds a kit token (`omk_…`) made with `omni setup-token`; it exchanges
it at `POST /api/ask/token` for an access token, keeps that until its `expires_at`, and sends:

```
POST /api/runners/jobs
Authorization: Bearer <access token>
{"line": "/omni:bug-fix https://github.com/vertuoza/vertuo-backend-php/issues/123",
 "repo": "vertuoza/vertuo-backend-php", "target": {"kind": "any"}}
→ 200 {"job": {…, "sentBy": "<the token's person>"}}
```

**2. Proof runs for bugs.** The proof API's two calls (`POST /api/proofs/uploads`, `POST /api/proofs`)
take an optional `kind`, `prd` or `bug`, `prd` when absent. The dossier is the one numbered
`(repo, number, kind)`, the bug's number being its issue's. The register call answers the bug page's
link (`/bugs/<dossier id>`) for a bug, the PRD's Proof tab for a PRD, as today. The stable link
`GET /api/proofs/<run>/preview.gif` already reads a run by its id alone, whatever its dossier's
kind. `omni proof push [--kind bug] <n> <dir>` sends the kind: its first line is the bug page's
link, its second the GIF's stable link. Without `--kind`, it sends and prints what it does today.
No migration: `proof_runs` ties a run to `dossier_id` alone, and `proof_run_add` checks membership
and files, never the dossier's kind.

**3. `omni bug film`.** A new verb makes the before/after GIF and the run's folder:

```
omni bug film <n> --before <file> --after <file> [--out <dir>]
```

- Two `.txt` files (a reproduction's output, red, then green): two cards, "Before the fix · red"
  over the red output's last 20 lines and "After the fix · green" over the green one's, each line
  cut to 100 characters, in monospace, held 3 seconds each, drawn with ffmpeg alone (its `drawtext`
  filter).
- Two `.webm` clips (a story filmed before and after): each up to 4 seconds, captioned "Before the
  fix" and "After the fix", one after the other.
- It writes, in `--out` (by default `<worktrees>/proof-bug-<n>/<YYYYMMDD-HHMMSS>/`, never inside the
  tracked tree): `preview.gif`, 640 pixels wide, 10 frames a second, looping; the two inputs, as
  `red.txt` and `green.txt`, or `before.webm` and `after.webm`; and `run.json`, which `readRun()`
  accepts: `commit` the head commit, `url` the issue's URL on GitHub, and two criteria, "Before the
  fix, the reproduction fails" and "After the fix, the reproduction passes", each `pass`, each
  naming its input (`script` for a `.txt`, `video` for a `.webm`) and noting its first failing or
  passing line.
- Exit 0 prints the folder's path, alone on its line. Exit 1: `ffmpeg not found`, or
  `ffmpeg failed: <its last line>`. Exit 2: a usage error (a missing file, a `.txt` beside a `.webm`,
  a number that is not one).

**4. `/omni:bug-fix` films every bug.** The run folder is `<worktrees>/proof-bug-<n>/<run>/`.

- **Which film.** A front-end bug that shows in one component, in a repository with Storybook, is a
  *component bug*: its reproduction is a story (written for the bug, or one that exists) and the
  test that renders it. Every other bug, back end or front end, is filmed from its reproduction's
  output.
- **Step 7, prove red:** the reproduction's red output goes to `red.txt` in the run folder. A
  component bug also starts Storybook once and films the story headless with Playwright, at
  1280×720, as `/omni:prove` films a criterion, to `before.webm`.
- **Step 8, fix:** the same reproduction, green, goes to `green.txt`; a component bug films the same
  story again, after the fix, to `after.webm`, then stops Storybook.
- **Step 12, ship:** after `git push` and `/omni:dossier-push <n> --kind bug`, run
  `omni bug film` (the two clips for a component bug, the two outputs otherwise), then
  `omni proof push --kind bug <n> <folder>`, and open the pull request with a `## Proof` section,
  right after **What was wrong**:

  ```markdown
  ## Proof

  ![Before and after the fix](<the GIF's stable link>)

  - **Before the fix** (red): `<the failing line>`
  - **After the fix** (green, `<short sha>`): `<the passing line>`
  ```

- **A story that cannot be filmed** (no Playwright, Storybook does not start, the story does not
  render): the film is made from the two outputs instead, and `## Proof` gains the line
  `Storybook not filmed - <reason>` under the GIF.
- **A GIF that cannot be made** never stops the skill: the pull request opens as a **draft**, and
  `## Proof` holds the one line `GIF not produced - <reason>`:

  | cause | reason |
  |---|---|
  | no `ffmpeg` on the PATH | `ffmpeg not found` |
  | `omni bug film` or `omni proof push --kind` exits 2 (the pinned omni does not know them) | `the pinned omni is too old: run omni update` |
  | `omni bug film` exits 1 otherwise | its line |
  | `omni proof push` exits 1 (`off`, `no sign-in (omni signin)`, `unreachable`, `none`, `refused (…)`) | `proof push: <its line>` |
  | red was not seen in this session ("Red not proven here") | `red not proven here` |

**5. `/omni:mega-bug-fix`** takes `/omni:bug-fix`'s body "from **What was wrong** on": it leaves
`## Proof` out, in one line. Filming in a target repository is a later PRD.

## Decisions

- **The cleaner signs as Pierre.** With Pierre's agreement, the cleaner keeps Pierre's own kit
  token, which Pierre creates with `omni setup-token` and the cleaner keeps in its Secret Manager.
  Every job it queues is sent by Pierre (`job.sentBy`), and every pull request those jobs open is
  in Pierre's name, as the runner on agent-box runs them (outside this PRD); no bot account.
  Getting the agreement and the token is outside this PRD, and comes before the cleaner's own
  change.
- **Exchange, then Bearer** (asked): the cleaner exchanges its `omk_` at `POST /api/ask/token` and
  sends the access token, so `sendJob` reuses `kitCaller` as it is. The kit token itself never
  reaches `/api/runners/jobs`: one sign-in path for every runner route.
- **The header wins.** A request with an `Authorization` header is judged by it alone: a bad Bearer
  is a 401 even beside a valid session, never a fall back to the session.
- **The GIF only in the pull request** (asked): a bug's proof run lives on its dossier, but the bug
  page gains no Proof tab; no screen changes. `omni proof push --kind bug` prints the bug page's
  link, without a tab.
- **A kit verb renders the GIF** (asked): `omni bug film`, the same render in every repository,
  tested in the kit, rather than ffmpeg lines the skill writes each time.
- **Before and after are steps 7 and 8**, not two commits: step 7 already runs the reproduction red
  before any fix, so its output is the "before"; the one commit of today's skill stays one.
- **A component bug is one whose reproduction is a story** (asked), in a repository with Storybook;
  Storybook only, no sign-in to a QA environment.
- **A story that will not film falls back to the test output** (asked); only a fallback that fails
  too leaves the pull request a draft.
- **A missing GIF leaves the pull request a draft** with `GIF not produced - <reason>`, the pinned
  omni too old included: a repository's skill (the plugin) moves at merge, its pinned CLI at its next
  `omni update`.
- **The voice's objection, accepted.** persona:B-E DEv: "A GIF of a terminal going green is
  decoration: the red line is already in the PR and in CI. If I have to watch an animation to review
  a PHP fix, I won't." Settled `accepted`: `## Proof` also writes the failing line and the passing
  line as text under the GIF, so a reviewer reads the proof without watching it.
- **The two addresses.** vertuo-backend-php's `ask.url` is `https://vertuo-omni-loop-galaxy.vercel.app`,
  vertuo-apps' is `https://www.omni-loop.xyz`. On 2026-10-14 both served the galaxy app at the same
  commit (`69dffde`, `GET /api/health`, uncached), and the first is the Vercel project's default
  production address (PRD 71). That both read the same workspace is proven once Pierre's token
  exists: the same `omk_` exchanged on each names the same `workspace` (acceptance criterion 3).

## User stories

- As vertuo-cleaner, I queue `/omni:bug-fix <issue url>` on the workspace's runners with Pierre's kit
  token, so a bug starts being fixed without anyone pasting a line.
- As a reviewer of a bug-fix pull request, I see the bug, then the bug gone, in one GIF at the top of
  the body, and the failing and passing lines beside it, so I trust the fix before reading the diff.
- As a reviewer, a pull request whose proof could not be made is a draft that says why, so I never
  take a missing proof for a passing one.
- As a person who runs `omni proof push` for a PRD, nothing I type or read changes.

## Scope

**In:** `sendJob` taking the kit's sign-in; `kind` on the proof API's two calls and on
`omni proof push`; `omni bug film`; `/omni:bug-fix`'s steps 7, 8 and 12 and its pull request body;
`/omni:mega-bug-fix`'s one line; the kit README's runner section (queueing from a service: the
exchange, the call, its refusals); the guide's use cases (the `## Proof` section); `kit/dist/` and
`apps/omni-app/api/` rebuilt.

**Out:** the runner unit on agent-box (`vertuoza/agent-box`); the cleaner's side
(`vertuoza/vertuo-cleaner`); `omni update` in vertuo-backend-php and vertuo-apps; Pierre's token
itself; a Proof tab on the bug page; filming in `/omni:mega-bug-fix`'s targets; a sign-in to a QA
environment; a migration.

## Test seams

Every test runs on fixtures: never GitHub, Supabase or a real ffmpeg (`omni kb show testing`).

- **The runners controller** (`apps/galaxy/src/runners/runners.controller.test.ts`, the real service
  on the in-memory store, the fake `connect`): a member's Bearer queues the job (200, `sentBy` its
  person); a non-member's Bearer is a 403; a bad Bearer is a 401, beside a valid session too; no
  header with a session is a 200, as today; a Bearer with a repository outside every workspace is a
  403.
- **The proof API** (`apps/galaxy/src/proof/api.test.ts`, `FakeProofWorld`): `kind: 'bug'` reaches
  the issue's bug dossier and answers `/bugs/<id>`; no `kind` reaches the PRD's and answers its
  Proof tab, as today; a bug without a dossier is a 404; a `kind` other than the two is a 400;
  `preview.gif` serves a bug's run.
- **`omni proof push`** (`kit/bin/commands/proof.test.ts`, through `main()` on a fixture repository,
  a stubbed fetch): `--kind bug` sends `kind` and prints the bug page's link, then the GIF's; without
  `--kind`, the requests and the output are those of today, byte for byte; `--kind visual` is a usage
  error, exit 2.
- **`omni bug film`**: the ffmpeg arguments built by a pure function, tested on text and on clips;
  the verb through `main()` with a fake process runner: its folder, its `run.json` read back by
  `readRun()`, exit 1 with `ffmpeg not found`, exit 2 for a missing file and for a `.txt` beside a
  `.webm`.
- **The skills' text** (`kit/test/plugin.test.ts`, `kit/test/skill-steps.snapshot.json`): step 7
  writes `red.txt`, step 8 `green.txt`; step 12 runs `/omni:dossier-push <n> --kind bug`, then
  `omni bug film`, then `omni proof push --kind bug`, then opens the pull request; the body has
  `## Proof` after **What was wrong**; the draft rule names `GIF not produced - `; mega-bug-fix leaves
  `## Proof` out.

## Risks

- **Everything in Pierre's name.** A leaked token acts as Pierre across the workspace (ask, dossiers,
  runners): it lives only in the cleaner's Secret Manager. It lasts 365 days at most; once expired,
  the cleaner's exchange is refused until Pierre makes another. Revoking it stops the cleaner, an
  access token already issued living up to an hour longer (ADR-0112).
- **One exchange at a time.** Concurrent exchanges of one token wait on a 30-second hold (ADR-0111):
  the cleaner keeps its access token until `expires_at` rather than exchanging one per job.
- **The plugin moves before the pinned CLI.** The marketplace serves `kit/plugin` from `main`, so the
  merge changes `/omni:bug-fix` in every repository at once, while each repository's pinned omni
  learns `omni bug film` and `--kind bug` at its next `omni update`. Until vertuo-backend-php and
  vertuo-apps update, every bug-fix pull request there opens as a draft ("the pinned omni is too
  old"). Their two updates follow this PRD's release.
- **Storybook on the runner's machine.** Starting Storybook takes time and memory, and a story may
  need what the machine lacks; the fallback to the test output keeps the GIF.
- **The GIF in GitHub.** GitHub's image proxy follows the stable link's 302 to a five-minute signed
  link, as it does for `/omni:prove`'s comments (PRD 798).
- **What merging publishes** (`omni kb show releasing`): the galaxy app's runners and proof APIs, at
  its next deploy; the kit (`kit/dist/omni.mjs`) and the plugin (`kit/plugin`); the GitHub App's
  bundle, rebuilt because `kit/lib` changes. No migration. Rolled back by reverting the feature PR: a
  bug's proof runs already stored stay on their dossiers, served by their stable links, read by
  nothing else.
- **The locked laws: none touched.** `omni kb laws` prints all twenty for every file here, none
  scoped by path. The nearest hold: BR-PRODUCT-29 and BR-PRODUCT-63, because a job queued with a kit
  token still needs its repository in the caller's workspace and the caller a member of it;
  BR-PRODUCT-94, because queuing a job answers no question; N-PRODUCT-15, because the job opens a
  pull request and never merges it; N-PRODUCT-17, because the token stays in the cleaner's secrets
  and never reaches a browser.

## Acceptance criteria

1. `POST /api/runners/jobs` with `Authorization: Bearer <access token>` exchanged from a kit token of
   a member of the repository's workspace, and the line `/omni:bug-fix <issue url>` with target
   `any`, answers 200 with the job, its `sentBy` the token's person.
2. The same call with a token of someone who is not a member of that workspace answers 403; with a
   bad or expired Bearer, 401, a valid session beside it included; without the header, a signed-in
   browser queues a job as today.
3. One kit token exchanged at `POST /api/ask/token` on `https://vertuo-omni-loop-galaxy.vercel.app`
   and on `https://www.omni-loop.xyz` names the same `workspace` (checked once Pierre's token
   exists).
4. `omni proof push --kind bug <issue> <dir>` stores the run on the issue's bug dossier and prints the
   bug page's link, then `<origin>/api/proofs/<run>/preview.gif`, which answers a 302 to the GIF.
5. `omni proof push <n> <dir>`, without `--kind`, sends and prints exactly what it does before this
   PRD, the PRD's Proof tab first.
6. `omni bug film <n> --before red.txt --after green.txt` writes a folder holding `preview.gif`, the
   two outputs and a `run.json` that `omni proof push` accepts; with two `.webm` clips, it stitches
   them; without ffmpeg, it exits 1 with `ffmpeg not found`.
7. A `/omni:bug-fix` run on a back-end bug, in a repository whose pinned omni carries this PRD, ends
   with a pull request whose body's `## Proof` shows the before/after GIF and the failing and passing
   lines.
8. A `/omni:bug-fix` run whose GIF cannot be made (no ffmpeg, a pinned omni too old, a proof push
   refused) opens its pull request as a draft whose `## Proof` reads `GIF not produced - <reason>`.
9. A component bug's pull request shows its story before and after; a story that cannot be filmed
   gives the test output's GIF and the line `Storybook not filmed - <reason>`.
10. A `/omni:mega-bug-fix` pull request's body has no `## Proof` section.
