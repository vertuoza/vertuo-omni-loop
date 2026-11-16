---
name: committee
description: The fleet's committee, at a mission's level `alone` — decides whether PRD n, waiting for approval on its page, is approved by the fleet instead of a person. Reads the escalation list by code first with omni committee check (a PRD approved by its phase-0 PR, a locked law, a Legal entry, a migration that drops or rewrites data all go to a person, no member running); then the PM, the Architect and the Reviewer, each as its own agent and model, read the spec, the plan and the before/after with no other member's verdict in front of them and answer yes, no or unsure in one sentence; the hero whose job wrote the PRD sits out. Records the decision with omni committee record, whose last line the App reads back to approve the PRD in the fleet's name or send it to a person with the verdicts. Never approves on the page, never merges, asks nothing, writes no file of the repository. A mission sends it on a runner. Triggers on "the committee approves PRD 2896", "/omni:committee 2896 --approve".
---

# Committee: the fleet approves a mission's PRD, or a person does

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

A mission whose level is `alone` (PRD 2896) has its fleet's committee decide what a person would
otherwise approve. The PM chairs; the Architect and the Reviewer sit on it. **Every member who sits
must answer `yes`:** three, or two when the hero whose job wrote the PRD sits out. Anything else goes
to a person, with the verdicts. The escalation list is read by code before any member runs, so the
members' judgement only meets what it lets through.

This skill decides nothing itself: it runs the members and records what they answered. The App
records the decision as the service, from this job's last line, and decides again from it: a line
written any other way is never carried.

**Signing.** It makes no commit and opens no pull request, issue or comment. Each verdict is signed
by its role and `agent` in the record, never in a person's name (L-AIACT-1).

**It asks nothing,** on a runner (`OMNI_UNATTENDED` set) or in a terminal: a member that cannot
decide answers `unsure`, and the PRD goes to a person.

## Never

- **It never approves on the page**, never merges, and never applies a label: the App approves in
  the fleet's name once it reads a carried record.
- **It never lets the author vote:** the hero `--author` names sits out, its verdict never asked.
- **No member reads another's verdict:** each runs alone, on the files only.
- **It writes nothing in the repository:** no commit, no push, no edit of the PRD's folder.
- **It holds no secret:** no key, token, personal data or log excerpt goes in a sentence (L-GDPR-2).

## Input

`<n> --approve`, and `--author <role>` (`pm`, `architect` or `reviewer`) when a hero of the fleet
wrote the PRD. With no `--approve`, say that this skill takes `<n> --approve`, and stop.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Keep the JSON:
`<remote>` is `repo.remote`, and `<feature branch>` is `branches.feature` with `{topic}` filled by
the PRD folder's topic.

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs session start`. Its
rules bind every step below.

**Every stop** ends the run on one line, `committee: <why>`, its last: the mission reads no record,
and the PRD goes to a person.

## 1. Find the PRD's files

1. `git fetch <remote>`. When `<remote>/<feature branch>` exists, check it out in a worktree of
   its own, under `worktrees`: `git worktree add --detach <path> <remote>/<feature branch>`. Every
   step below runs there; with no feature branch, it runs in this checkout.
2. `node .omni-loop/bin/omni.mjs prd <n>`. A `repos:` line, or no folder: stop with
   `committee: PRD <n> has no folder here to read`.

## 2. The escalation list, before any member runs

`node .omni-loop/bin/omni.mjs committee check <n> --approve [--author <role>] --json`. Keep its
`read` (each file with its hash), its `sitting` (each member with its agent and model) and its
`escalations`.

When `escalations` is not empty, **no member runs**: write `{ "verdicts": [] }` to a scratch file
outside the repository and go to step 4. The PRD goes to a person whatever a member would say.

## 3. Each member, alone

For each member of `sitting`, in order, start one sub-agent of its agent and model (in Claude, the
Agent tool with that model), never two at once, and give it only:

- its role: `You are the <role> of a Virtual Fleet's committee`, the spec, the plan and the
  before/after files `read` names, to read whole;
- what it decides: `Would you approve this PRD to be built as written, with no person reading it
  first? Answer yes, no or unsure, and say why in one sentence of at most 200 characters.`;
- what it answers: one JSON object, `{ "answer": "yes" | "no" | "unsure", "sentence": "…" }`, and
  nothing else.

Never pass it another member's verdict, this skill's own view, or the escalation list. Keep each
answer as `{ "role": "<role>", "answer": …, "sentence": … }`:

| the sub-agent | its verdict |
|---|---|
| answered the object | as answered |
| failed, or answered anything else | `failed`, its sentence `Its agent failed: <the first line of why>` |
| gave nothing within 20 minutes | `timeout`, its sentence `No verdict within 20 minutes.` |

Write `{ "verdicts": [<each verdict>] }` to a scratch file outside the repository.

## 4. Record it

`node .omni-loop/bin/omni.mjs committee record <n> --approve --file <votes> [--author <role>]`,
printing each line it prints. It decides (escalated by rule first, by vote second) and ends on its
record line, `omni committee: {…}`, which the App reads.

- Exit `1` (the votes are refused): rewrite each verdict that does not read as `failed`, its
  sentence `Its verdict did not read.`, and run it again once.
- Exit `2`: stop with `committee: <its line>`.

Remove the worktree when there is one (`git worktree remove <path>`), then end the run on the record
line, exactly as it printed: the mission reads the last one the log holds.
