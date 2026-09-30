---
name: prove
description: Records a PRD's acceptance criteria as evidence once its feature PR is ready — one headless Playwright clip per criterion against the PR's preview, each with a pass or fail verdict, a criterion nothing in a browser can show marked unfilmable, then sends the run to the PRD's Proof tab on the Omni page with omni proof push and posts one unsigned comment on the feature PR, a ✓, ✗ or — line per criterion and the tab's link. Stops with one line when proof.url is not configured. Never blocks — it changes no PR state, label or check. /omni:yolo follows it after ready when the spec asks for a proof video; a person may run it on any ready PRD. Triggers on "prove this PRD", "record a proof video", "film the acceptance criteria", "/omni:prove 798".
---

# Prove: film a PRD's acceptance criteria

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

A person runs it on PRD n once its feature PR is ready, or on a PRD already shipped to record it; `/omni:yolo` follows it after it marks the
PR ready when the spec says `proof: video`. It is never run by default: each run costs a model
session and a few minutes of browser time. It writes nothing in the repository's tracked tree, and
it commits nothing.

## Input

A PRD number, `<n>`. With no number, say that this skill takes one, and stop (or go back to the
skill that ran it).

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Keep the JSON;
`<remote>` is `repo.remote`, `<worktrees>` is `worktrees`, and `<feature branch>` is
`branches.feature` with `{topic}` filled by the PRD folder's topic (the folder
`node .omni-loop/bin/omni.mjs prd <n>` names is `<nnnn>-<topic>`).

## 1. Configured, or stop

Run `node .omni-loop/bin/omni.mjs config proof`. When its `url` is `null`, print this one line and
stop; the run writes nothing and posts nothing:

```text
proof is not configured here: run /omni:invade --refresh, or set proof.url in .omni-loop/config.yml
```

Then find the feature PR: `gh pr list --head <feature branch> --state open --json number,url,headRefOid,isDraft`.
A draft is proved all the same, but say in one line that it is not ready yet.

None open: the PRD may have shipped. Look for its merged one,
`gh pr list --head <feature branch> --state merged --json number,url,headRefOid`, and prove that,
saying in one line that it is already merged, so the run is a record rather than help for a review.
A merged PRD's code is on the default branch, so it is filmed on the fixed `proof.url` only: when
that is `github-deployment`, stop with
`proof.url is github-deployment: a merged PRD has no preview to film; set a fixed proof.url`.
Neither open nor merged: say `PRD <n> has no feature PR`, and stop.

## 2. The target

- **The URL.** With `proof.url: github-deployment`, it is the preview of the feature PR's head
  commit: `gh api repos/<repo.slug>/deployments?sha=<headRefOid>`, then the newest deployment's
  statuses, whose `success` status carries `environment_url`. Wait for it up to **10 minutes**,
  looking again every 20 seconds. Otherwise `proof.url` is the fixed URL itself.
- **The bypass.** When `proof.bypassEnv` names an environment variable, every request sends its value
  as the `x-vercel-protection-bypass` header (and `x-vercel-set-bypass-cookie: true`). Never print
  the value, and never write it to a file.
- **Signed in.** When `proof.setup` is set, run that command once, from the repository's root, with
  `PROOF_STORAGE_STATE=<run dir>/storage-state.json` in its environment. It writes a Playwright
  storageState file there, which every script then loads. A setup that fails stops the run with
  `proof setup failed: <its last line>`.
- **Reachable, or stop.** Fetch the URL once, with the bypass header and the storageState's cookies.
  A 401, a 403, a 5xx or a timeout of 30 seconds stops the run, with nothing posted:
  `preview not reachable: <status>` (`timeout` for a timeout).

## 3. One clip per criterion

Read the spec's **Acceptance criteria** (`omni prd <n>` names the spec). Take **at most 10**, in the
spec's order; say how many were left out when there are more. The run folder is
`<worktrees>/proof-<n>/<run>/`, `<run>` the time now as `YYYYMMDD-HHMMSS`, never inside the
repository's tracked tree. Each criterion `<k>` (1, 2…) is one of two:

- **unfilmable**: nothing a browser can observe proves it (a config key, a log line, a test's
  result, a command's exit code). Say why in one line, which becomes its note; write no script.
- **filmed**: write one Playwright script, `<k>-<slug>.spec.ts` in the run folder (`<slug>` a few
  words of the criterion, lowercase and hyphenated). It walks from the URL to what the criterion
  names and checks what it says with Playwright's own assertions, nothing more. Run it headless,
  with the repository's Playwright (`npx playwright test`), through a config written in the run
  folder: viewport and video at 1280×720 (`video: 'on'`, Playwright's `recordVideo`), the bypass
  header, the storageState when there is one, and a test timeout of `proof.maxSeconds` seconds.
  Copy its video to `<k>-<slug>.webm`. Its verdict is **pass** when the script's checks hold,
  **fail** otherwise, with the error's first line as the note. A script that cannot run at all is a
  **fail** with that first line.

The scripts are never committed: they stay beside their clips so that anyone can replay them. When
`ffmpeg` is on the PATH, the first filmed clip also gives `preview.gif`, up to 8 seconds and 640
pixels wide:

```bash
ffmpeg -y -t 8 -i <k>-<slug>.webm -vf "fps=10,scale=640:-1:flags=lanczos" -loop 0 preview.gif
```

No `ffmpeg`: no GIF, and nothing else changes.

Then write `run.json` in the run folder, exactly this shape:
`{commit, url, criteria: [{text, verdict, note?, video?, script?}]}`. `commit` is the head commit,
`url` the URL filmed, `text` the criterion as the spec words it, `verdict` one of
`pass`, `fail` or `unfilmable`, and `video` and `script` the file names in the folder of a filmed criterion.
`preview.gif` is found by its name, so `run.json` never names it.

## 4. Push

```bash
node .omni-loop/bin/omni.mjs proof push <n> <dir>
```

`<dir>` is the run folder. Exit `0` prints the Proof tab's link; keep it for the comment. Exit `1`
prints one line (`none`, `off`, `no sign-in (omni signin)`, `unreachable` or `refused (<status>)`):
print it as is, leave every file in place, and the comment says
`upload failed: rerun omni proof push <n> <dir>` instead of the link. A second line after the link,
when the push prints one, is the GIF's stable link. Never sign in for the person, and never push a
second time to get past a failure.

## 5. Comment

One comment on the feature PR, posted with `gh pr comment <feature PR> --body-file <file>`, the file
in the run folder. It is **unsigned**, like every comment of the loop:

```markdown
**Proof — <commit short sha>**

✓ <criterion text>
✗ <criterion text> — <note>
— <criterion text> — <why it is unfilmable>

[Proof tab](<the link omni proof push printed>)

![preview](<the GIF's stable link>)
```

One line per criterion in the spec's order: `✓` pass, `✗` fail with its note, `—` unfilmable.
The GIF line only when the push printed its stable link (a run with `preview.gif`). A failed push
gives the `upload failed` line in place of the link, and no GIF.

Then print the Proof tab's link and the ✓/✗/— counts, and go back to the skill that ran this one.

## Never

- **Nothing blocks.** A ✗, an unfilmable criterion, a missing GIF or a failed push never changes the
  feature PR's draft or ready state, its labels or its checks. The reviewer decides.
- Never merge, never push a branch, and never write inside the repository's tracked tree.
- Never print, log or save the bypass secret, and never commit a script or a clip.
- Never film more than 10 criteria, or a clip past `proof.maxSeconds`.
