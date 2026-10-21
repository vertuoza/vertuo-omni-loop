---
name: yolo-runner
description: Build a PRD on a runner instead of in this terminal — follow the PRD's queued or running job when there is one, else send `/omni:yolo <n>` to a runner of the workspace (asking once where when more than one is online), then follow the job's milestones until it ends and hand off on the ending. Never merges into the default branch. Triggers on "build it on a runner", "yolo this PRD on a runner", "send PRD 7 to a runner", "follow the runner", "/omni:yolo-runner".
---

# Yolo runner: send a PRD to a runner, follow it

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

The runner's twin of `/omni:yolo`: the build runs on a runner of the workspace, this session only
sends it and watches. It builds nothing here, commits nothing and signs nothing, so there is no
trailer or footer to add. Ctrl-C stops the following only: the job runs on.

## Input

A PRD number, in the inbox (`omni prd <n>` says `inbox`, or `approval: server unreachable`: the
runner waits for the approval itself, as `/omni:yolo` does).

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Then, before
any other step, print the briefing: `node .omni-loop/bin/omni.mjs session start`. Its rules bind
every step below. No sign-in (`omni signin`) stops the skill in one line: both commands need it.

## 1. Find the job, or send one

Look for a job of PRD n in this repository that is queued or running, one sent from the Runners page
included, and follow it rather than sending a second one. `omni runner follow <n>` reads the PRD's
newest job and prints its milestones at once; with no job it waits for one. So run it once, bounded:

```bash
timeout 20 node .omni-loop/bin/omni.mjs runner follow <n>
```

- **A milestone other than an ending** (`queued`, `claimed by <runner>`, `waiting for approval`,
  `PR: <link>`, `<k>/<total> slices merged`): the job is queued or running. Say which job you follow
  and go to step 2. Send nothing.
- **An ending** (`Waiting on answers`, `Held`, `Ready`, `Done`, `Failed: <reason>`, `Cancelled`,
  `Runner lost`): that job is over. Send a new one (below), unless the person's request was only to
  follow: then go straight to step 3 with that ending.
- **Nothing printed:** the PRD has no job. Send one.

**Send.**

1. Pick where. Read the online runners of this repository's workspace, with their fleet and free
   slots, from `omni runner list --json` when the kit has it. With **more than one** online, ask once
   where (in Claude: `AskUserQuestion`): **Any runner** first, then each fleet, then each online
   runner, each with its free slots (`<fleet> · 2 of 4 free`). Under `OMNI_UNATTENDED` ask
   nothing and send to any runner. With one runner online, or with none, or when the read fails,
   ask nothing and send to any runner; with none online, say the job waits in the queue.
2. Send it: `node .omni-loop/bin/omni.mjs runner send '/omni:yolo <n>' [--to <runner|fleet>]`
   (`--to` only when the person chose a fleet or a runner). It prints the job's id: keep it. A refusal
   (a line no runner runs, a workspace that is not yours) stops the skill with its line.

## 2. Follow it

```bash
node .omni-loop/bin/omni.mjs runner follow <n>
```

It prints one line per milestone, each once: `queued`, `claimed by <runner>`, `waiting for
approval`, each `PR: <link>`, `<k>/<total> slices merged`, then the ending with the PRD's page link.
Relay each line as it comes. It exits `0` on done, `1` on failed, cancelled or runner lost; a page it
cannot read ends it held, not failed. Never answer for a person: while the job waits for approval,
say so and that the PRD's page is where it is approved.

## 3. Hand off on the ending

Print the PRD's page beside its number: `omni dossier link <n>` (exit `0` prints the link: print
`PRD <n>: <link>`; anything else: `PRD <n>: no page yet, https://github.com/<owner>/<repo>/issues/<n>`).
Then the line of the ending reached, and end the reply with its command alone as the last line, when
it has one:

| ending | what to tell | last line |
|---|---|---|
| **Waiting on answers** | the runner left questions on the feature PR: answer them there, in a fresh session (in Claude: `/clear`) | `/omni:yolo-fix <n>` |
| **Held** | what holds it: the reason the follow printed (the page unreachable, a stuck wait, a held slice); fix that, then run it again | `/omni:yolo-runner <n>` |
| **Ready** | the feature PR is ready: review it and merge it (a person merges, never this skill) | none |
| **Done** | the job finished and left nothing waiting: say so and give the feature PR when `PR:` printed one | none |
| **Failed: `<reason>`**, **Runner lost** | the reason, and the Runners page link (`<repo.remote>`'s workspace, the page `Runners` of the Omni app) | none |
| **Cancelled** | who cancelled is on the Runners page; run it again to send a new job | `/omni:yolo-runner <n>` |

## Guardrails

- **Never send a second job** while one of the PRD is queued or running.
- **Never merge,** never mark a PR ready, never answer an outbox item: the runner's skills and the
  people do.
- **Ask at most once,** and nothing under `OMNI_UNATTENDED`.
- **A follow that cannot read the page is held, not failed:** say so, and hand off on `Held`.
