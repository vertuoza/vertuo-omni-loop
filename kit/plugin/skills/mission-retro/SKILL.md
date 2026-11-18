---
name: mission-retro
description: Writes a mission's retro at a milestone, on a runner and never by hand — when a roadmap of the mission's scope is delivered, or the mission is, it reads the mission's events, repairs, PRDs, outbox items, verdicts and jobs for that milestone only, writes what went well and what to change (1 to 5 sentences each, every sentence citing an event, a PRD, a pull request or a repair) checked by the kit, commits it as retros/<k>-<milestone>.md and each rule-change item under outbox/ on the mission branch (above with-you; at with-you the page keeps them), and ends on one record line, omni retro. Never changes a rule, a law or a form, never pauses the mission, never sends a repair, never touches the default branch, never merges. Triggers on "/omni:mission-retro --mission <m> --milestone <roadmap n | mission>" sent by a mission.
---

# Mission retro: what went well, what to change, at a milestone

A mission's supervisor sends this skill on a runner when a roadmap of the mission's scope is delivered
(every PRD of it merged or on the mission branch), and once more when the mission is delivered (PRD
3065). It writes the retro, keeps it, and ends on **one record line** the App reads back from the
job's log, as it reads `omni repair:`. It never asks a person, never merges, never touches the
default branch, and **never pauses anything or sends a repair**.

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your agent adds, if it
adds one (in Claude: the `Co-Authored-By` line its session gives), then the line `omni sign trailer`
prints as the message's last line, with no blank line between them. Comments are never signed. A
command that prints nothing means signing is off here: add nothing.

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
is not installed in this repository. Keep the JSON; later steps read `repo.*` and `branches.*` from
it. Then print the briefing, `node .omni-loop/bin/omni.mjs session start`: its rules bind every step
below. Read the mission's folder and its level (`with-you`, `own-branch` or `alone`) from its
`mission.md`. The mission branch is the `--base <branch>` the job's line carries, or the mission's
branch (`branches.mission`); at `with-you` there is none.

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

- **Above `with-you`:** on the mission branch (never the default branch), commit the retro as
  `<mission folder>/retros/<k>-<milestone>.md` (`<k>` is the milestone as given, a roadmap number or
  `mission`): the two sides as headings, each sentence a bullet with its citations. Commit each
  item as its own file under `<mission folder>/outbox/`, beside the retro, named
  `<k>-<milestone>-<n>.md` with its target, wording and evidence. Sign each commit, push the mission
  branch, and name the retro's path as `file`. A file that already holds the same retro is kept as it
  is: running again adds no second one.
- **At `with-you`:** there is no mission branch. Commit nothing, push nothing, and write `"file": null`:
  the mission page keeps the retro and its items, and says so.

Never edit a rule, a law, a form, a decision record or any file of the knowledge or the playbook.

## 5. The record line

The last output of the skill is one line, with no text after it:

```
omni retro: {"v":1,"mission":<m>,"milestone":"<roadmap n | mission>","retro":{…},"file":"<path>"|null,"items":[…]}
```

`retro` is step 2's JSON, `items` step 3's list, `file` the path of step 4 or `null` at `with-you`.
Print the JSON on one line, after the kit's schemas accept it. A line the App cannot read is
recorded as `Retro skipped: <why>`, never as done, so never print a partial one.

## Never

- Never ask a person.
- Never merge, never touch the default branch, never open a pull request into it.
- Never change a rule, a law or a playbook form: propose it as an item.
- Never pause the mission and never send a repair.
- Never put a log excerpt, a credential or a person's words in the retro, an item or the record.
- Never print a second record line after the first, nor any text after it.
