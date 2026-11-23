---
name: mission-retro
description: Writes a mission's retro at a milestone, on a runner and never by hand — when a roadmap of the mission's scope is delivered, or the mission is, it reads the mission's events, repairs, PRDs, outbox items, verdicts and jobs for that milestone only, writes what went well and what to change (1 to 5 sentences each, every sentence citing an event, a PRD, a pull request or a repair) checked by the kit, commits and pushes nothing at any level (the mission's page keeps the retro and its items), and ends on one record line, omni retro, whose file is null. Never changes a rule, a law or a form, never pauses the mission, never sends a repair, never touches the default branch, never merges. Triggers on "/omni:mission-retro --mission <m> --milestone <roadmap n | mission>" sent by a mission.
---

# Mission retro: what went well, what to change, at a milestone

A mission's supervisor sends this skill on a runner when a roadmap of the mission's scope is delivered
(every PRD of it merged or on the mission branch), and once more when the mission is delivered (PRD
3065). It writes the retro, keeps it, and ends on **one record line** the App reads back from the
job's log, as it reads a repair's record line. It never asks a person, never merges, never touches the
default branch, and **never pauses anything or sends a repair**.

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**No commit.** This skill makes no commit, push, branch or pull request, at any level: the mission's
page is the record of its retros (PRD 3194).

## Input

| input | example | what it is |
|---|---|---|
| `--mission <m>` | `--mission 12` | the mission whose milestone was reached |
| `--milestone <k>` | `--milestone 2950` or `--milestone mission` | a roadmap's number, or `mission` for the delivered mission |

Both are required: with one missing, or a milestone that is neither a number nor `mission`, print
`mission-retro needs --mission and --milestone <roadmap n | mission>` and stop, with no record line.
Run by a person in a terminal (`OMNI_UNATTENDED` unset), say that a mission sends this skill on a
runner, and stop.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, stop and say so in one line: the Omni Loop kit
kit is not installed in this repository. Then print the briefing,
`node .omni-loop/bin/omni.mjs session start`: its rules bind every step below. Then read the mission
from its page: `node .omni-loop/bin/omni.mjs mission get <m>` writes its brief and retros as plain
files and prints their folder. When it prints `mission <m> not read: <why>` or `no mission #<m> on
the page` and exits 1, stop on that line: write no retro and print no record line. Read the mission's
level from the `mission.md` it wrote.

## 1. Read, for this milestone only

Read the mission's own record and nothing else: its events, its repairs and their retros, the plans,
outbox items and the Reviewer and QA verdicts of the PRDs of the milestone (the PRDs of roadmap `<k>`,
or every PRD of the mission for `mission`), and the jobs' durations and tokens. Never read another
mission's work, another workspace's, or a log in full: a log is evidence you read, never a text you
copy.

## 2. The retro

Write it to a scratch file outside the repository, as JSON checked by the kit's `MissionRetroSchema`
(`kit/lib/mission/retro.ts`):

```json
{
  "wentWell": [{ "text": "<one sentence>", "cites": [{ "kind": "event | prd | pr | repair", "ref": <number> }] }],
  "toChange": [{ "text": "<one sentence>", "cites": [{ "kind": "prd", "ref": <number> }] }]
}
```

Rules: each side holds 1 to 5 sentences; every sentence is one line, of one thought, and cites at
least one event, PRD, pull request or repair of the mission, or the kit refuses it, naming the
sentence. Never a log excerpt, a credential, a login, an email or a person's words.

## 3. Items: a rule, a law or a form that looks wrong

When the retro finds a rule, a law or a playbook form wrong, it **never changes it**. It proposes the
change as a mission item, always high, checked by `MissionItemSchema` (`kit/lib/mission/item.ts`):

```json
{
  "target": { "kind": "rule | law", "id": "<id>" } | { "kind": "form", "form": "<form>", "section": "<section>" },
  "wording": "<the wording it proposes>",
  "evidence": [{ "text": "<one sentence>", "cites": [{ "kind": "prd", "ref": <number> }] }]
}
```

An item has a target, a wording and cited evidence (1 to 5 sentences), or it is not written. A retro
with nothing to propose has `"items": []`. An item never pauses the mission and never holds its pull
request; a member answers it on the mission page, and a person applies an adopted change.

## 4. Keep it

Commit nothing and push nothing, at `with-you`, `own-branch` and `alone` alike: the mission's page
keeps the retro and its items, and the record line below is how it reads them. Write `"file": null`.
Never write a file of the retro into the repository.

Never edit a rule, a law, a form, a decision record or any file of the knowledge or the playbook.

## 5. The record line

The last output of the skill is one line, with no text after it:

```
omni retro: {"v":1,"mission":<m>,"milestone":"<roadmap n | mission>","retro":{…},"file":null,"items":[…]}
```

`retro` is step 2's JSON, `items` step 3's list, `file` always `null`.
Print the JSON on one line, after the kit's schemas accept it. A line the App cannot read is
recorded as `Retro skipped: <why>`, never as done, so never print a partial one.

## Never

- Never ask a person.
- Never commit, push, merge or touch the default branch.
- Never change a rule, a law or a playbook form: propose it as an item.
- Never pause the mission and never send a repair.
- Never put a log excerpt, a credential or a person's words in the retro, an item or the record.
- Never print a second record line after the first, nor any text after it.
