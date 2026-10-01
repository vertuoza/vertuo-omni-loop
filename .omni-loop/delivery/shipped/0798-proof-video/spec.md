---
prd: 798
title: Proof video — record a PRD's acceptance criteria as evidence
blocked-by: none
spec: file
---

# Proof video

**Date:** 2026-09-30 · **PRD:** #798
**Touches:**
- `kit/plugin/skills/prove/SKILL.md` (new); `kit/plugin/skills/brainstorm/SKILL.md` (one question),
  `kit/plugin/skills/yolo/SKILL.md` (one hand-off step), `kit/plugin/skills/invade/SKILL.md` (step 7 rows)
- `kit/bin/commands/proof.mjs` (new), `kit/bin/commands/index.mjs`, `kit/lib/proof/` (new)
- `kit/lib/config.mjs` (the `proof` section), `kit/lib/inbox/inbox.mjs` (the `proof` field)
- `kit/lib/help/` (the new skill's help entry)
- `supabase/migrations/<ts>_proof_runs.sql` (new): the `proof_runs` table and the `proof-videos` bucket
- `apps/galaxy/app/api/proofs/` (new routes), `apps/galaxy/src/proof/` (new)
- `apps/galaxy/src/dossier/page/` (`view.ts`, `StageHeader.tsx`, a new `ProofPane.tsx`, `dossier.css`)

## Problem

A reviewer asked to merge a feature PR has no quick way to see that it works. Today someone opens
the preview, clicks through each acceptance criterion by hand, and sometimes records their screen
to upload as evidence. That takes time, gets skipped, and the video is stored somewhere different
each time. Everything needed to do it automatically already exists: the spec's acceptance
criteria, a preview deploy, Claude, and Playwright. The one thing in the way is that GitHub's API
cannot attach a video to a pull request.

## Solution

**`/omni:prove <n>`**, a new skill. A person runs it on PRD n once its feature PR is ready. It is
never run by default, because each run costs a model session and a few minutes of browser time.

1. **Configured or stop.** It reads `omni config proof`. When `proof.url` is unset, it stops with
   one line: `proof is not configured here: run /omni:invade --refresh, or set proof.url in
   .omni-loop/config.yml`.
2. **The target.** It resolves the URL. With `proof.url: github-deployment`, that is the preview
   URL of the feature PR's head commit, read from its GitHub deployment and waited on for up to
   10 minutes; otherwise `proof.url` is a fixed URL. When `proof.bypassEnv` names an environment
   variable, its value is sent as the Vercel protection-bypass header. When `proof.setup` is set,
   it runs that command once, and the command writes a Playwright storageState file to the path
   in `PROOF_STORAGE_STATE`, which every script then loads (signed in). When the page is still
   not reachable (401, 403, 5xx, a timeout), the skill stops: `preview not reachable: <status>`.
3. **One clip per criterion.** It reads the spec's **Acceptance criteria**. It takes at most 10
   criteria, in the spec's order. Each is either:
   - **unfilmable**: nothing a browser can observe (a config key, a log line, a test's result).
     Claude says why in one line, and no script is written; or
   - **filmed**: Claude writes one Playwright script (`<k>-<slug>.spec.ts`) that walks to the
     criterion and checks what it says, then runs it headless with `recordVideo` on, at
     1280×720, stopping after `proof.maxSeconds` (60 by default). The run gives one `.webm` and
     a verdict: **pass** when the script's checks hold, **fail** otherwise, with the error's first
     line kept as the note.

   The scripts and clips are written to `<worktrees>/proof-<n>/<run>/`, never inside the
   repository's tracked tree. Scripts are never committed. When `ffmpeg` is on the PATH, the
   first filmed clip also gives a `preview.gif` of up to 8 seconds, 640 pixels wide.
4. **Push.** `omni proof push <n> <dir>` sends the run to the PRD's dossier (below) and prints the
   Proof tab's link.
5. **Comment.** One unsigned comment on the feature PR, headed `Proof — <commit short sha>`:
   - one line per criterion: `✓`, `✗` or `—` (unfilmable), the criterion's text, and for ✗ its note;
   - the link to the Proof tab;
   - the GIF, embedded from its stable link, when there is one.

   A failed push leaves the files in place, and the comment says `upload failed: rerun omni proof
   push <n> <dir>`.

**Nothing blocks.** A ✗, an unfilmable criterion, a missing GIF or a failed upload never changes
the PR's draft or ready state, its labels or its checks. The reviewer decides.

**The brainstorm asks.** `/omni:brainstorm` asks, once the design is approved and only when
`proof.url` is set: *"Record a proof video once it ships?"*. A yes writes `proof: video` in the
spec's front matter. `omni check inbox` accepts an optional `proof` field whose only value is
`video`, and refuses any other value by name.

**Yolo honours it.** After it marks the feature PR ready, and only when the spec says
`proof: video`, `/omni:yolo` follows `/omni:prove <n>`. Whatever it prints, yolo's hand-off goes on.

**Invade proposes the config.** `/omni:invade` step 7 proposes `proof.url` when the repository
has Playwright among its dependencies and a preview deploy (a Vercel project, or GitHub
deployments on its PRs), and `proof.setup` when its tests already have a sign-in helper. It never
proposes `proof.bypassEnv`'s value, only its name.

**The Omni page.**
- **`omni proof push <n> <dir>`** reads `<dir>/run.json` (the criteria, verdicts, notes and file
  names the skill wrote), then:
  1. `POST /api/proofs/uploads {repo, prd, files: [{name, bytes, type}]}` → one signed upload link
     per file, under `proof-videos/<dossier id>/<run id>/<name>`. Refused: a type other than
     `video/webm`, `image/gif` or `text/plain` (the scripts), a file over 50 MB, more than 25
     files, or a PRD without a dossier;
  2. a `PUT` of each file to its link;
  3. `POST /api/proofs {repo, prd, run, commit, url, criteria: [{text, verdict, note?, video?, script?}]}`
     → `{url}`. `verdict` is `pass`, `fail` or `unfilmable`. It stores one `proof_runs` row. A
     file named in `criteria` that was not uploaded is refused.

  Both routes take the same sign-in as `omni dossier push`. `omni proof push` prints `none`,
  `off`, `no sign-in (omni signin)`, `unreachable` or `refused (<status>)` exactly as `omni dossier
  link` does, and exits `1` on any of them.
- **The Proof tab** on `/prd/<id>` appears once the dossier holds a run. It shows the newest run
  first: its commit, URL, date, and a ✓/✗/— count. Then one row per criterion: its text, verdict,
  note, a `<video>` player, and the script behind a "Script" fold. An older run is picked the way an
  older spec version is, with the version picker. The links are signed for the viewer, so the
  bucket's rules decide who can see what.
- **The GIF's stable link.** `GET /api/proofs/<run id>/preview.gif` answers with a redirect to a
  fresh signed link for 5 minutes. It is the only link that works without signing in, because
  GitHub's image proxy cannot sign in. The run id is a random UUID, and a run without a GIF
  answers 404.

## Decisions

- **Before merge, not after.** The video is recorded against the ready feature PR's preview, so it
  helps the review. Recording on production after merge is out of scope.
- **Stored on the Omni page, linked from the PR.** GitHub's API cannot attach a video. Committing
  binaries to git, or putting them in a release, was rejected.
- **Playwright written by Claude, not the Chrome plugin.** It gives a real video, runs headless,
  and can be replayed. The Chrome plugin gives only a GIF and needs a person's browser.
- **Scripts are kept beside their clips, never committed.** They can be replayed, and they add
  nothing to the repository's test suite.
- **Signed direct upload.** The video goes straight to storage, as screenshot answers do (PRD
  620). Vercel refuses request bodies over 4.5 MB, and a dossier artifact is text capped at 512 KiB.
- **Report, never block.**
- **One public GIF link.** A short, silent excerpt, reachable by its unguessable run id only; the
  full clips stay behind sign-in.
- **Limits:** 10 criteria and 25 files a run, 60 s a clip by default, 50 MB a file.

## User stories

- As a reviewer, I open the feature PR and see one ✓/✗ line per acceptance criterion and a moving
  preview, then watch any criterion's clip on the PRD page before I merge.
- As a PM, I answer "yes" in the brainstorm, and the proof is recorded without my asking again
  when the PRD is built.
- As a developer, I run `/omni:prove 798` on a ready PR that nobody flagged, and get the same result.
- As a developer, I open a failing clip's script, see what it checked, and replay it locally.
- As someone setting up a repository, `/omni:invade` proposes the `proof` config, and I only
  merge it.

## Scope

In:
- the `/omni:prove` skill and its help entry;
- `omni proof push` and the `proof` config section (`url`, `setup`, `bypassEnv`, `maxSeconds`);
- the `proof` front-matter field;
- the brainstorm question, the yolo step, and invade's two proposal rows;
- the migration, the two routes plus the GIF link, and the Proof tab.

Out:
- recording on production after merge;
- the Chrome plugin as a recorder;
- stitching clips into one video, sound, or narration;
- committing scripts as e2e tests;
- proof on visual-fix or bug-fix PRs;
- deleting old runs (they stay, like spec versions);
- `/omni:ultra-yolo` (multi-repo): it can call `/omni:prove` per repository later.

## Test seams

Following `omni kb show testing`: tests beside the code, `pnpm test` runs them all, and none of
them calls GitHub, Supabase or a browser for real.

- `kit/lib/config.test.mjs`: `proof` defaults (all null, `maxSeconds` 60), a bad `maxSeconds`
  refused.
- `kit/lib/inbox/inbox.test.mjs`: `proof: video` accepted; `proof: yes` refused, naming the field.
- `kit/lib/proof/*.test.mjs`: reading `run.json` (a verdict other than the three refused, a
  missing file refused); the push, against a fake app (uploads, then register, and each refusal
  word).
- `kit/bin/commands/proof.test.mjs`: `omni proof push` through `main()` on a fixture repository,
  its output and exit codes.
- `apps/galaxy/src/proof/*.test.ts`: both routes on the fake store (a type, size, count or
  missing-dossier refusal each gives 400, 413 or 404; a signed-out call gives 401); the GIF link
  (302, then 404 with no GIF).
- `apps/galaxy/src/dossier/page/*.test.ts`: the Proof tab hidden with no run; one row per criterion
  with its verdict; the version picker picks an older run.
- Skill text: the kit's existing help-entry test covers the new skill.
- By hand, once: `/omni:prove` on a real ready PR of this repository (see Acceptance).

## Risks

What merging publishes (`omni kb show releasing`):
- **The database:** the migration adds a `proof_runs` table and a private `proof-videos` bucket.
  Both are additive. Rollback is a new migration that drops them. Nothing else reads them.
- **The kit:** a new skill, a new command, a new optional config section and front-matter field.
  A repository that sets none of them sees no change. Rollback is reverting the merge. Specs
  already carrying `proof: video` would then be refused by `omni check inbox`, so the revert
  also removes the field from them.
- **The public GIF link** is the one thing that can be seen without signing in. If that turns
  out to be too open, rollback is to answer 404 on the route; the comments then show a broken
  image and nothing else changes.
- **Cost:** each run is a model session, capped at 10 criteria × 60 s.

## Acceptance criteria

1. On a repository without `proof.url`, `/omni:prove <n>` stops with the `proof is not configured
   here` line, and writes and posts nothing.
2. `omni check inbox` accepts a spec with `proof: video` and refuses `proof: yes`, naming the field.
3. On this repository, with `proof.url: github-deployment` set, `/omni:prove <n>` on a ready
   feature PR posts one comment with one ✓/✗/— line per acceptance criterion and a link to the
   PRD page's Proof tab.
4. The Proof tab shows a playable video for each filmed criterion, its verdict and its script, and
   is hidden on a PRD without a run.
5. A criterion whose check fails is shown ✗ with its note, and the feature PR stays ready, with the
   same labels.
6. `omni proof push` refuses a 60 MB file and a `.mp4` before uploading anything, and exits `1`
   with `refused (413)` or `refused (400)`.
7. The GIF link redirects without signing in, and a run without a GIF answers 404.
8. A brainstorm on a repository with `proof.url` set asks "Record a proof video once it ships?", and
   a yes puts `proof: video` in the spec; `/omni:yolo` on that PRD runs `/omni:prove` after
   marking the PR ready.
9. `/omni:invade` on a repository with Playwright and Vercel previews proposes `proof.url` in its
   config commit.
