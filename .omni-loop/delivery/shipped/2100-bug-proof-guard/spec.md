---
prd: 2100
title: Every bug-fix PR carries its proof, and a stale plugin cannot skip it
blocked-by: none
spec: file
phase0: server
---

# Every bug-fix PR carries its proof, and a stale plugin cannot skip it

**Date:** 2026-10-16 · **PRD:** #2100 · **After:** PRD 1972 (bug-fix proof GIF, #1973), PRD 1830
(runners), PRD 798 (proof runs), PRD 1118 (multi-repo bug records) · **Touches:** `omni bug film`
and a GIF encoder of the kit's own, `omni bug <n>`, `omni proof push`, the proof API's serving
routes, `omni runner`, the `/omni:bug-fix` and `/omni:mega-bug-fix` skills, the guide's use cases
and runners pages, the kit README.

## Problem

PRD 1972 shipped on 2026-10-15: every bug-fix pull request opens with a `## Proof` section holding a
before/after GIF, or as a draft saying `GIF not produced - <reason>`. The next morning,
demo-org/nimbus-backend-php#6720, opened by a runner job on 2026-10-16 at 09:53Z, has no `## Proof`
section and is not a draft. Its body follows `/omni:bug-fix` as it read before #1973.

- **A stale plugin.** The release after #1973 is v0.0.426, which both target repositories pin: their
  `omni` knows `omni bug film`. The skill was old. Skills come from the Omni Claude Code plugin,
  updated per machine with `claude plugin update omni@omni-loop`. The runner on agent-box ran an old
  copy. `omni runner` starts `claude -p` for each job and never looks at the plugin
  (`kit/lib/runner/job.ts`). Nothing compares the plugin's version with the CLI's: `omni sync`
  compares each with the latest release, and its blue "Setting up" state hides even that.
- **Nothing enforces the proof.** `omni bug 6719` printed `ok`. It checks the fix record and the
  commits, never the pull request's body. It runs at step 12.2, before the pull request exists.
- **ffmpeg on every machine.** The red/green GIF of a back-end or page bug is two text cards that
  ffmpeg draws with `drawtext`. That needs ffmpeg, libfreetype and fontconfig on whatever machine
  runs the job. A missing ffmpeg leaves the pull request a draft, though the proof is only text.
- **A component bug's clips are invisible.** The filmed GIF is all a reviewer gets: the two clips
  are uploaded to the proof run, but nothing links them.
- **A bug fixed before the fix.** When the reproduction passes before any fix (stop rule 3),
  `/omni:bug-fix` comments with "the two readings" and stops. In demo-org/nimbus-apps#791, Omni found
  that #749 had already fixed the bug, but wrote it as prose. nimbus-cleaner cannot follow the fix to
  its release and verdict. It reads a merged pull request named by a `Fixed by #<n>` or
  `Fixed by <PR URL>` line at the start of a comment line (its branch `omni-fixed-by`).

## Solution

### 1. The proof, by bug

A **component bug** keeps PRD 1972's rule: a front-end bug that shows in one component, in a
repository with Storybook, whose reproduction is a story. Every other bug, back end or front end, is
proven by its reproduction's output.

- **A component bug: its film, and links to its clips.** Steps 7 and 8 film the story before and
  after, headless with Playwright at 1280×720, as `before.webm` and `after.webm`. `omni bug film`
  turns them into the captioned GIF with ffmpeg. Nothing changes there. What is new comes after
  `omni proof push --kind bug <n> <folder>`. It prints the bug page's link and the GIF's stable link,
  as today, then one line per clip of the run: `<origin>/api/proofs/<run>/before.webm`, then
  `<origin>/api/proofs/<run>/after.webm`. `## Proof` gains a line under the GIF:
  `Clips: [before](<link>) · [after](<link>)`.
- **The clips' stable links.** `GET /api/proofs/<run>/<clip>` serves `before.webm` or `after.webm`
  of a run that holds that file. It works as `GET /api/proofs/<run>/preview.gif` does:
  - it needs no sign-in, because the run's id is an unguessable UUID;
  - it answers a 302 to a five-minute signed link, with `no-store`;
  - any other name answers a 404, and so does a run without that file. `red.txt` and `green.txt` are
    never served.
- **Every other bug: the red/green GIF, drawn by the kit.** The command stays
  `omni bug film <n> --before red.txt --after green.txt [--out <dir>]`. It now draws the GIF in the
  kit's own code, with no ffmpeg:
  - **Frames.** Two frames of 640×360 each, the red card then the green card, each held 3 seconds,
    looping forever.
  - **Cards.** Each card has a title band: "Before the fix · red" on red, "After the fix · green" on
    green. Below the band, up to 20 lines of the output in light grey on `#111111`. The first failing
    line (red card) or the first passing line (green card) is drawn in red or green.
  - **Text.**
    - ANSI escape sequences are dropped, then carriage returns.
    - A tab becomes two spaces, and each line is cut to 100 characters.
    - The 20 lines are the last 20. When the highlighted line sits above them, the window starts two
      lines above it, so a vitest or PHPUnit assertion stays in view.
  - **Font.** A public-domain fixed bitmap font, X11 misc-fixed 6×13, embedded in the kit. It covers
    ASCII and the marks test runners print (✓ ✗ × ❯ › · • → ─ │); any other character is drawn as `?`.
    The titles are drawn at twice its size.
  - **Encoding.** A GIF89a encoder of the kit's own: one global palette of at most 8 colours, LZW,
    and the looping extension. The same inputs give the same bytes.
  - **What stays.** The folder is as today: `preview.gif`, `red.txt`, `green.txt` and a `run.json`
    that `readRun()` accepts. So `omni proof push --kind bug`, the bucket and the stable link are
    unchanged.
- **The fallback.** Sometimes the clips do not make a GIF: the story does not film, ffmpeg is
  missing, or ffmpeg fails. Then the GIF is made from the two outputs instead. That always works now,
  since the text GIF needs no ffmpeg. `## Proof` gains `Storybook not filmed - <reason>` under it,
  the reason being the clips' failure (`ffmpeg not found` included).
- **Exits.** `omni bug film` with two `.txt` exits 0, printing the folder, or 2 on a usage error. It
  exits 1 only for a folder it cannot write (`could not write <path>`). With two `.webm`, it exits as
  today.
- **When the pull request is a draft.** It opens as a draft, with `## Proof` holding the one line
  `GIF not produced - <reason>`, only when:
  - red was not proven in this session (`red not proven here`);
  - the pinned omni is too old (`the pinned omni is too old: run omni update`);
  - `omni bug film` fails otherwise (its line);
  - `omni proof push` fails (`proof push: <its line>`).

  The `ffmpeg not found` row leaves the reason table: on the text path it cannot happen any more.

### 2. `omni bug <n>` checks the pull request's body

The pinned CLI is the one piece a stale plugin cannot skip, so it refuses a body with no proof.

- **Where the body comes from,** in this order:
  1. `--body-file <file>`: the body the skill is about to open.
  2. Otherwise, the open pull request whose head is the current branch, read with
     `gh pr view --json body,isDraft,state,number`.
  3. Neither: one `not ok` line that says how to proceed:
     `- no pull request body to check: make the GIF (omni bug film <n> --before <red> --after <green>,
     then omni proof push --kind bug <n> <folder>), write the body with its ## Proof section to a file,
     and rerun omni bug <n> --body-file <file>; with no GIF, ## Proof is the line
     GIF not produced - <reason> and the pull request opens as a draft`.
- **A `## Proof` that passes** holds either of these:
  - a markdown image whose link starts with `https://`, a line starting `- **Before the fix**` and a
    line starting `- **After the fix**`;
  - the line `GIF not produced - <reason>`, with a reason that is not empty.
- **The faults,** one `- ` line each:
  - `no ## Proof section`;
  - `## Proof has no image and no "GIF not produced - <reason>" line`;
  - `## Proof's image has no "Before the fix" or "After the fix" line`;
  - when the body was read from an open pull request: `the proof was not produced but #<pr> is not a
    draft: gh pr ready <pr> --undo`.
- **Exempt.** A record with a `## Fixes` section (PRD 1118) is not checked for a proof: that is the
  record PR of `/omni:mega-bug-fix`, whose fixes live in other repositories.
- **The rest of the verdict is unchanged.** One folder, a complete `bug.md`, a reproduction the range
  changes, signed commits, laws answered. A proof fault is one more `- ` line.
- **The trap for a stale plugin.** Its step 12.2 calls `omni bug <n>` with no body before any pull
  request exists. Once its repository pins this omni, it reads the `not ok` line above, and the skill
  already says to rerun until `ok`.
- **`/omni:bug-fix` step 12, in its new order:**
  1. commit;
  2. push the fix branch;
  3. `/omni:dossier-push <n> --kind bug`;
  4. `omni bug film`, then `omni proof push --kind bug`;
  5. write the pull request's body to a file;
  6. `omni bug <n> --body-file <file>`, until `ok`;
  7. open the pull request with `--body-file <file>`, a draft when no GIF was made.

  A pinned omni that refuses `--body-file` (exit 2, a repository not yet updated) gets
  `omni bug <n>` without it. The skill then carries on, the body being checked by its own template
  as today.

### 3. `omni runner` keeps the plugin current

- **Before each job.** Once the job's worktree is made and before its session starts
  (`kit/lib/runner/runner.ts`, `runJob`), the runner compares two versions:
  - the installed `omni@omni-loop` plugin's version, read from `claude plugin list --json` as
    `omni sync` reads it (`kit/lib/sync/setup.ts`);
  - the job repository's pinned omni, the version its `.omni-loop/bin/omni.mjs` carries
    (`kit/lib/sync/kit.ts`).
- **A plugin older than the pinned omni** is updated with `updatePlugin()`, which runs
  `claude plugin marketplace update omni-loop`, then `claude plugin update omni@omni-loop`
  (`kit/lib/update/plugin.ts`). One update runs at a time, across every slot and the sweep, and the
  version is read again after it.
- **Still older after the update:** the job fails before Claude starts, with the reason
  `omni plugin v<x> is older than <owner/repo>'s omni v<y>: claude plugin update failed: <its last
  line>`.
- **A plugin not installed** fails the job with
  `the omni plugin is not installed: claude plugin install omni@omni-loop`.
- **A plugin as new as the pinned omni, or newer:** nothing happens, with no network call.
- **A `claude plugin list` that does not read** (a timeout, unreadable output): the job runs, and its
  log's first line says `omni plugin version not read: <why>`.
- **Once an hour.** The runner's sweep also runs `updatePlugin()`, first at start, then hourly, so the
  plugin follows the latest release even when no repository needs it. It prints a line only when the
  version changes (`omni plugin v<x> → v<y>`) or the update fails (`omni plugin update failed: <its
  last line>`).
- **Documentation.** `docs/guide/runners.md` and the kit README's runner section say it. Their
  "Update it" step names the runner's own update: `git pull` in the start checkout, then restart
  `omni runner`.

### 4. Stop rule 3 names the fix

When the reproduction passes before any fix, `/omni:bug-fix` step 7 looks for the merged pull request
that fixed the bug before it comments.

- **Candidates:** the pull requests merged since the bug was first seen that touch the reproduction's
  files or the files its error trace names. The skill finds them with `git log --merges -- <files>`
  and `gh pr list --state merged --search <terms>`.
- **Proven:** a candidate is proven when the reproduction is red at its merge commit's first parent
  and green at its merge commit, run in the pull request's own repository.
- **The comment,** with the reproduction's command and the two commits:

  ```markdown
  The reproduction passes before any fix: the bug is already gone.

  Fixed by #749

  Red at a1b2c3d (before #749), green at e4f5a6b: `vendor/bin/phpunit --filter InvoiceTest`
  ```

  - `Fixed by #<n>` names a pull request of the issue's repository. `Fixed by <PR URL>` names one
    elsewhere: an issue of `/omni:mega-bug-fix` lives in the plan repository, its fix in a target.
  - The line starts at the start of its line, alone on it, and is written once.
- **No proven candidate:** no line starts with `Fixed by`. Each candidate gets a `Maybe: #<n>` line,
  and the two readings stay (the reproduction misses the bug, or the bug is already gone). A person
  decides.
- **The skill never closes the issue.** `/omni:mega-bug-fix`'s stop rule 3 writes the same comment,
  in the plan repository.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | kit CLI | `omni bug <n> --body-file <file>` | no written convention: follows `kit/bin/commands/ask.ts:21` (`--file <file>`), named as `gh pr create --body-file` names the same file |
| vertuo-omni-loop | kit lib | `kit/lib/image/gif.ts`, `kit/lib/image/font.ts` | no written convention: follows `kit/lib/pitch/ffmpeg.ts` (one module per concern under `kit/lib/<area>/`) |
| vertuo-omni-loop | galaxy route | `apps/galaxy/app/api/proofs/[run]/[clip]/route.ts` | no written convention: follows `apps/galaxy/app/api/proofs/[run]/preview.gif/route.ts` |
| vertuo-omni-loop | skill text | `GIF not produced - <reason>`, `Storybook not filmed - <reason>` | kept as `kit/plugin/skills/bug-fix/SKILL.md:427-429` writes them |
| vertuo-omni-loop | runner reason | `omni plugin v<x> is older than <owner/repo>'s omni v<y>: …` | no written convention: follows the reasons of `kit/lib/runner/runner.ts:334-337` |
| nimbus-cleaner | issue comment | `Fixed by #<n>`, `Fixed by <PR URL>` | nimbus-cleaner's reader, branch `omni-fixed-by` (outside this repository) |

## Decisions

- **The proof, by bug** (asked). The brief that opened this brainstorm asked for one still image for
  every bug: no GIF, no video, Storybook dropped. When the design was shown, persona:F-E Developer
  objected: "For a component bug, a log going green does not prove the component renders; that is the
  bug that reaches production unseen." Nicolas settled it: a component bug keeps its video, every
  other bug the red/green GIF. Objection settled `accepted`.
- **What "component bug" means** (asked): PRD 1972's rule, unchanged. A bug that shows in a page,
  not one component, is proven by its output.
- **Clips as a GIF, with links** (asked). GitHub plays no outside video in a pull request's body, so
  the two clips stay a GIF in the body, and the `Clips:` line links each clip.
- **The red/green GIF stays animated** (asked): two cards, 3 seconds each, rather than one still
  image. Drawn by the kit, it costs nothing more.
- **A GIF of the kit's own, same name** (asked). The file keeps the name `preview.gif`, so the bucket,
  the proof API and the stable link are unchanged, with no migration, and ffmpeg leaves the text
  path. Two other options were rejected:
  - a PNG, which needs a migration of the bucket's types, the proof API's list, a new route and a
    deploy;
  - ffmpeg with one frame, which still needs ffmpeg and fontconfig on every runner.
- **One PRD, four slices** (asked). All four come from #6720 and each is small.
- **`omni bug` reads the body** (asked). The check reads `--body-file`, else the branch's open pull
  request through `gh`, else refuses with the way to proceed. That refusal is the trap for a stale
  plugin, which never passes the flag.
- **A `## Fixes` record is exempt** (taken alone). The record PR of `/omni:mega-bug-fix` carries no
  proof, and its target pull requests are unchanged by this PRD.
- **The runner updates, then refuses** (asked). It updates when the plugin is older than the
  repository's pinned omni, and once an hour. It refuses the job when an update leaves the plugin
  older.
- **An unreadable plugin list lets the job run** (taken alone, the most reversible): it says so in the
  job's log. Refusing would stop every job on a `claude plugin list` failure that the plugin's age
  did not cause.
- **`Fixed by` only on proof** (asked): red at the merge's first parent, green at the merge.
  Otherwise the comment writes `Maybe:` lines, which nimbus-cleaner does not read.
- **`omni proof push` prints the clip links** (taken alone), rather than the skill building them from
  the GIF's link: the URL's shape stays the server's.
- **The window keeps the highlighted line in view** (taken alone, shown in the design and not
  objected to). The last 20 lines of a vitest failure are its summary, and its assertion sits above.
- **No proof video** (asked): nothing here is seen in a browser beyond the clip route.
- **Outside this PRD, today.** Pierre runs `claude plugin update omni@omni-loop` on agent-box, which
  mends #6720's cause before any of this ships.

## User stories

- As a reviewer of a back-end bug fix, I see the red card then the green card at the top of the pull
  request, the failing and passing lines highlighted, whatever machine opened it.
- As a reviewer of a component bug fix, I see the filmed GIF and can open each clip at full size.
- As a reviewer, I never get a bug-fix pull request without a `## Proof` section, even from a machine
  whose plugin is old: `omni bug` refuses it until the proof is there or the pull request is a draft
  that says why.
- As Pierre, who runs the runner on agent-box, I never have to remember to update the plugin: the
  runner does it before a job needs it, and refuses the job when it cannot.
- As nimbus-cleaner, I read `Fixed by #<n>` on an issue whose bug was already fixed, and follow that
  pull request to its release and verdict.

## Scope

**In:**
- **The kit's GIF:** the encoder, the font, the layout, and `omni bug film`'s text path.
- **The CLI:** `omni bug <n> --body-file` and the open-PR read; the clip links in `omni proof push`;
  `omni runner`'s plugin check and its hourly update.
- **galaxy:** the clip route and the proof API function behind it.
- **The skills:** `/omni:bug-fix` steps 7, 8 and 12, its reason table, `## Proof` and stop rule 3;
  `/omni:mega-bug-fix`'s stop rule 3 line.
- **Docs and builds:** the guide's use cases and runners pages, the kit README, the help entries,
  `kit/porting/plugin--bug-fix.md`; `kit/dist/` and `apps/omni-app/api/` rebuilt.

**Out:**
- **Other people's systems:**
  - agent-box's unit and its `git pull` (Pierre);
  - `omni update` in nimbus-backend-php and nimbus-apps, which follows this PRD's release;
  - nimbus-cleaner's reader (its branch `omni-fixed-by`).
- **Later or not at all:**
  - a GIF in `/omni:mega-bug-fix`'s target pull requests;
  - a Proof tab on the bug page;
  - a GitHub App check on bug-fix pull requests, a later PRD if the CLI's check is not enough;
  - a PNG;
  - filming a page bug.

## Test seams

Every test runs on fixtures: never GitHub, Supabase, a real ffmpeg or a real `claude`
(`omni kb show testing`). The mutation floors in `mutation/floor.json` hold.

- **The encoder** (`kit/lib/image/gif.test.ts`, a pure module):
  - a 4×2 image encodes to known bytes;
  - a decoder written in the test reads back every pixel of a two-frame image, its 300-hundredths
    delays and its looping extension;
  - more than 8 colours is refused.
- **The layout** (`kit/lib/bug/film.test.ts`):
  - ANSI sequences and carriage returns are dropped, tabs become two spaces, lines are cut at 100;
  - the window holds the last 20 lines, or starts two lines above a highlighted line that sits higher;
  - the highlighted line's pixels are red on the red card and green on the green card;
  - a character outside the font is drawn as `?`;
  - the clips' ffmpeg arguments are those of today.
- **`omni bug film`** (`kit/bin/bug.test.ts`, through `main()` on a fixture repository, a fake exec):
  - two `.txt` write `preview.gif`, `red.txt`, `green.txt` and a `run.json` that `readRun` accepts,
    with no ffmpeg call recorded;
  - the same inputs twice give the same bytes;
  - two `.webm` still call ffmpeg, and `ffmpeg not found` still exits 1.
- **`omni bug <n>`** (`kit/bin/bug.test.ts`):
  - with `--body-file`: a body with the image and both lines, and one with
    `GIF not produced - ffmpeg not found`, each print `ok`;
  - with `--body-file`: no `## Proof`, an image without its lines, and an empty reason each print
    `not ok` with their line;
  - a `## Fixes` record passes with no `## Proof`;
  - with no flag: the fake `gh` answers an open pull request's body and it is checked; no open pull
    request prints the way to proceed; a not-produced proof on a pull request that is not a draft
    prints its line.
- **`omni proof push`** (`kit/bin/commands/proof.test.ts`, a stubbed fetch): a run with clips prints
  the bug page, the GIF, then the two clip links; a run of text prints as today, byte for byte.
- **The clip route** (`apps/galaxy/src/proof/api.test.ts`, `FakeProofWorld`):
  - `before.webm` of a run that holds it answers a 302 with `no-store`;
  - a run without it, `red.txt`, and a name outside the two each answer a 404;
  - an id that is not a UUID answers a 404.
- **The runner** (`kit/bin/commands/runner.test.ts` and `kit/lib/runner/*.test.ts`, a fake exec):
  - a plugin older than the job's pinned omni is updated once, even with two slots starting together;
  - one still older after the update fails the job with its reason, and `claude` is never started;
  - a plugin not installed fails the job with its line;
  - an equal or newer plugin starts no update;
  - an unreadable list runs the job with the log line;
  - the sweep updates hourly and prints only on a change or a failure.
- **The skill's text** (`kit/test/bug-fix-proof.test.ts`):
  - step 12 runs `omni bug <n> --body-file` before the pull request opens, with the fallback when the
    flag is refused;
  - `## Proof` has the `Clips:` line, and the reason table has no `ffmpeg not found` row;
  - stop rule 3 writes `Fixed by #<n>` only for a proven candidate, red at the merge's first parent
    and green at the merge, and `Maybe:` otherwise.

## Risks

- **The plugin moves before the pinned CLI, again.** The merge changes `/omni:bug-fix` in every
  repository at once, and each repository's omni learns `--body-file` and the kit's GIF at its next
  `omni update`. Until then, the skill falls back to `omni bug <n>` without the flag, and the text GIF
  still needs ffmpeg there. The check catches a stale plugin only in a repository that pins this
  omni.
- **The runner itself must update.** agent-box runs `omni runner` from its start checkout: the check
  works there only after Pierre's `git pull` and a restart.
- **Updating the plugin under running jobs.** Claude Code keeps each plugin version in its own cache
  folder (`~/.claude/plugins/cache/omni-loop/omni/<version>/`), so a running session keeps the skills
  it loaded. The build proves it on a machine before the runner relies on it. If it does not hold,
  the update waits until no job is running.
- **`gh` in `omni bug`.** It is the command's first read of GitHub. A machine without `gh`, or
  without a sign-in, reads no pull request: the check then asks for `--body-file`.
- **Public clip links.** A clip link opens without a sign-in, like the GIF's. The run's id is an
  unguessable UUID, the signed link lasts five minutes, and a clip shows a Storybook story, not
  customer data.
- **What merging publishes** (`omni kb show releasing`):
  - the galaxy app's new clip route, at its next deploy;
  - the kit (`kit/dist/omni.mjs`) and the plugin (`kit/plugin`);
  - the GitHub App's bundle, rebuilt because `kit/lib` changes.

  No migration. Rolled back by reverting the feature PR. Proof runs already stored stay served by
  their links.
- **The locked laws.** `omni kb laws` prints all twenty for every file here, none scoped by path.
  - **The skill edits.** These sit where `kit/test/plugin.test.ts` proves three laws. Their proofs
    stay as they are, and this PRD's skill text is tested in `kit/test/bug-fix-proof.test.ts`, never
    beside them:
    - BR-PRODUCT-3: an agent could wave its own work through the gate with no person answering the
      open questions. Changing it needs @pierrederval to approve the pull request on GitHub.
    - BR-PRODUCT-5: a person could merge work whose open decisions nobody answered. Changing it needs
      @pierrederval to approve the pull request on GitHub.
    - N-PRODUCT-15: unreviewed work reaches every user, and nobody chose to ship it. Changing it needs
      @pierrederval to approve the pull request on GitHub.
  - **Why these and the nearest others hold:**
    - BR-PRODUCT-5 keeps the draft rule: a proof not produced still opens a draft.
    - N-PRODUCT-15 holds because the runner updates a plugin and never merges.
    - N-PRODUCT-17 holds because the clip route hands out a signed link and no secret.
    - N-PRODUCT-14 holds because `omni bug` still compares with the base branch.

## Acceptance criteria

1. On a machine with no ffmpeg, `omni bug film 12 --before red.txt --after green.txt` exits 0 and
   writes `preview.gif`. It is a looping GIF of two 640×360 frames, the red card then the green card,
   each held 3 seconds, with the first failing line drawn in red on the first and the first passing
   line in green on the second.
2. Run twice on the same two files, `omni bug film` writes the same `preview.gif`, byte for byte.
3. With two `.webm` and no ffmpeg, `omni bug film` exits 1 with `ffmpeg not found`. `/omni:bug-fix`
   then makes the GIF from `red.txt` and `green.txt`, and its `## Proof` says
   `Storybook not filmed - ffmpeg not found`.
4. `omni proof push --kind bug` of a run with clips prints the bug page's link, the GIF's link, then
   one link per clip. Each clip link answers a 302 to a signed link, and any other name under the run
   answers a 404.
5. `omni bug <n> --body-file <file>` prints `ok` for a body whose `## Proof` holds the image and its
   two lines, or the line `GIF not produced - <reason>`. It prints `not ok` and names the fault for
   any other body.
6. `omni bug <n>` with no flag and no open pull request on the branch prints `not ok` with the line
   that says how to proceed. With an open pull request that is not a draft and whose proof was not
   produced, it prints `not ok` asking for a draft.
7. A record with a `## Fixes` section passes `omni bug <n>` with no `## Proof`.
8. A runner job for a repository pinning omni v0.0.N, on a machine whose plugin is older, runs
   `claude plugin update omni@omni-loop` once before Claude starts. If the plugin is still older, the
   job fails with `omni plugin v<x> is older than <owner/repo>'s omni v0.0.N: …`, and Claude never
   starts.
9. A runner updates the plugin at start and once an hour, and prints a line only on a change or a
   failure.
10. When a reproduction passes before any fix, `/omni:bug-fix`'s issue comment has a line starting
    `Fixed by #<n>` (or `Fixed by <PR URL>`) only for a pull request proven red at its merge's first
    parent and green at its merge. Otherwise no line starts with `Fixed by`.
11. `/omni:bug-fix` step 12 runs `omni bug <n> --body-file <file>` before it opens the pull request
    with that same file. With a pinned omni that refuses the flag, it runs `omni bug <n>` and carries
    on.
