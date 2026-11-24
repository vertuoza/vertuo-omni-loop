---
name: committee
description: The fleet's committee, at a mission's level `alone` — decides whether PRD n, waiting for approval on its page, is approved by the fleet instead of a person (--approve), or whether one of its high outbox items is answered by the fleet with option A, as built, instead of a person (--item <id>). Reads the escalation list by code first with omni committee check (a human-action item; a locked law, a Legal entry, a business law an item bears on; an item's hard-to-revert score unknown or at the mission's bound; a migration that drops or rewrites data) — each case on it goes to the members, then to a person at landing, never to a person mid-mission, but a PRD approved by its phase-0 PR, which only a person merges. The PM, the Architect and the Reviewer, each as its own agent and model, read the PRD's files or the item with no other member's verdict in front of them and answer yes, no or unsure in one sentence; the hero whose job wrote the PRD or raised the item sits out. Every sitting yes carries it (on the escalation list, when it was on it); any no or unsure defers an item with option A, the most reversible, and sends a PRD to a person. Records the decision with omni committee record, whose last line the App reads back to approve the PRD or settle the item in the fleet's name, the carried and deferred ones left open for the person on the mission pull request. Never approves on the page, never settles an item itself, never merges, asks nothing, writes no file of the repository. A mission sends it on a runner. Triggers on "the committee approves PRD 2896", "/omni:committee 2896 --approve", "/omni:committee 2896 --item s3-01-keep-the-cap".
---

# Committee: the fleet decides for a mission, or a person does

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

A mission whose level is `alone` (PRD 2896) has its fleet's committee decide what a person would
otherwise decide: a PRD's approval (`--approve`), and a high outbox item's answer (`--item <id>`).
The PM chairs; the Architect and the Reviewer sit on it. **Every member who sits must answer
`yes`** for the decision to carry: three, or two when the hero whose job wrote the PRD, or raised
the item, sits out.

**The escalation list goes to the members, then to a person at landing** (PRD omni-loop-21). It is
read by code first, and a case it names no longer goes to a person mid-mission: the members decide
it, and the decision stays open for the person on the mission pull request, who agrees with it or
overturns it there. The one case still a person's at once is a PRD approved by its phase-0 pull
request, which only a person merges: it is escalated by rule, whatever the members answer.

| the vote | an item (`--item`) | a PRD (`--approve`) |
|---|---|---|
| every sitting member `yes`, the case on the list | `carried · on the escalation list` | `carried · on the escalation list` |
| every sitting member `yes`, on no line of the list | `carried` | `carried` |
| any `no` or `unsure` (a member failed or timed out counts `unsure`) | `deferred`, with option A, the most reversible: the mission carries on | `escalated`: never approved without every yes, it goes to a person |

An item is answered with **option A, what was built**, carried or deferred: a member who would
rather another option answers `no` and says which in its sentence, and the item is deferred with
option A, its sentence kept for the person at landing.

This skill decides nothing itself: it runs the members and records what they answered. The App
records the decision as the service, from this job's last line, and decides again from it: a line
written any other way is never carried. For an item, the App also settles it on the feature branch,
`answered by fleet <key>`: this skill never does.

**Signing.** It makes no commit and opens no pull request, issue or comment. Each verdict is signed
by its role and `agent` in the record, never in a person's name (L-AIACT-1).

**It asks nothing,** on a runner (`OMNI_UNATTENDED` set) or in a terminal: a member that cannot
decide answers `unsure`, and the item is deferred, or the PRD goes to a person.

## Never

- **It never approves on the page**, never settles an item, never merges, and never applies a
  label: the App acts in the fleet's name once it reads a carried record.
- **It never lets the author vote:** the hero `--author` names sits out, its verdict never asked.
- **No member reads another's verdict:** each runs alone, on the files only.
- **It writes nothing in the repository:** no commit, no push, no edit of the PRD's folder.
- **It holds no secret:** no key, token, personal data or log excerpt goes in a sentence (L-GDPR-2).

## Input

`<n> --approve`, or `<n> --item <id> [--bound <0-1>]`, `--bound` the mission's
`mandate.hardToRevert`; and `--author <role>` (`pm`, `architect` or `reviewer`) when a hero of the
fleet wrote the PRD or raised the item. With neither `--approve` nor `--item`, say that this skill
takes `<n> --approve` or `<n> --item <id>`, and stop. `<what>` below is `--approve`, or
`--item <id> [--bound <b>]` as given.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Keep the JSON:
`<remote>` is `repo.remote`, and `<feature branch>` is `branches.feature` with `{topic}` filled by
the PRD folder's topic.

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs session start`. Its
rules bind every step below.

**Every stop** ends the run on one line, `committee: <why>`, its last: the mission reads no record,
and the PRD or the item goes to a person.

## 1. Find the PRD's files

1. `git fetch <remote>`. When `<remote>/<feature branch>` exists, check it out in a worktree of
   its own, under `worktrees`: `git worktree add --detach <path> <remote>/<feature branch>`. Every
   step below runs there; with no feature branch, it runs in this checkout. An item is read on the
   feature branch only: with `--item` and no feature branch, stop with
   `committee: PRD <n> has no feature branch to read <id> on`.
2. `node .omni-loop/bin/omni.mjs prd <n>`. When it finds no folder here and prints
   `omni prd: its folder is on <remote>/<branch>: read it there.` (a PRD a mission's PM wrote lives
   on its feature branch only, bug #3236), check that branch out as step 1 does
   (`git worktree add --detach <path> <remote>/<branch>`), run every step below there, and run
   `omni prd <n>` again in it. A `repos:` line, or still no folder: stop with
   `committee: PRD <n> has no folder here to read`.

## 2. The escalation list, before any member runs

`node .omni-loop/bin/omni.mjs committee check <n> <what> [--author <role>] --json`. Keep its
`read` (each file with its hash and path), its `sitting` (each member with its agent and model) and
its `escalations`, each case of the list it is on.

When `escalations` is not empty, **the members still run** (step 3): each case goes to the members,
then to a person at landing, and step 4's record names it, so the decision is recorded `on the
escalation list`. The members never see the list.

## 3. Each member, alone

For each member of `sitting`, in order, start one sub-agent of its agent and model (in Claude, the
Agent tool with that model), never two at once, and give it only:

- its role: `You are the <role> of a AI Fleet's committee`, and the files `read` names, to
  read whole: the spec, the plan and the before/after for `--approve`; the item for `--item`, with
  the spec and the plan beside it for context;
- what it decides, for `--approve`: `Would you approve this PRD to be built as written, with no
  person reading it first? Answer yes, no or unsure, and say why in one sentence of at most 200
  characters.`; for `--item`: `Would you settle this question with option A, what was built, with
  no person answering it? Answer yes, no or unsure, and say why in one sentence of at most 200
  characters; if you would rather another option, answer no and name it.`;
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

`node .omni-loop/bin/omni.mjs committee record <n> <what> --file <votes> [--author <role>]`,
printing each line it prints. It decides (escalated by rule first, for a PRD approved by its
phase-0 pull request only; by vote second: carried, deferred or escalated, as the table above says)
and ends on its record line, `omni committee: {…}`, which the App reads.

- Exit `1` (the votes are refused): rewrite each verdict that does not read as `failed`, its
  sentence `Its verdict did not read.`, and run it again once.
- Exit `2`: stop with `committee: <its line>`.

Remove the worktree when there is one (`git worktree remove <path>`), then end the run on the record
line, exactly as it printed: the mission reads the last one the log holds.
