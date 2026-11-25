---
name: repair
description: Repairs the step a mission's PRD failed on, on a runner and never by hand — reads why it failed from the failed job's log and saved work (or, with --stuck --jobs, from the last five jobs of a mission that stopped moving), writes a retro (the cause in one sentence, its class, where, the error's signature, the evidence as sentences, the proposed fix and the fingerprint) checked by the kit, then takes one way by its class. code follows /omni:bug-fix --base <mission branch> (/omni:mega-bug-fix when the PRD spans repositories); omni-loop writes the scrubbed public report into its record line and fixes nothing; flake fixes nothing, the step is sent again; person names the question. Asks nobody, merges nothing, and ends on one record line, omni repair. Triggers on "/omni:repair --mission <m> --prd <n | key-n> --job <job>" and "/omni:repair --mission <m> --stuck --jobs <j1>,…,<j5>" sent by a mission.
---

# Repair: a failed step, a retro, one way

A mission's supervisor sends this skill on a runner when a PRD's step failed (PRD 2980). It finds the
cause, writes it down, takes one way by the cause's class, and ends on **one record line** the App
reads back from the job's log, as it reads a mission PM's record line. It never asks a person (a person's decision is
the class `person`), never merges, and never touches the default branch.

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your agent adds, if it
adds one (in Claude: the `Co-Authored-By` line its session gives), then the line `omni sign trailer`
prints as the message's last line, with no blank line between them. Every pull request or issue it
opens ends its body with the line `omni sign footer` prints, as a paragraph of its own just above
your session's own attribution lines. Comments are never signed. A command that prints nothing means
signing is off here: add nothing.

## Input

| input | example | what it is |
|---|---|---|
| `--mission <m>` | `--mission 12` | the mission whose PRD failed |
| `--prd <n>` | `--prd 2950`, `--prd omni-loop-27` | the PRD whose step failed: a repository PRD's number, or a product PRD's id (`<key>-<n>`) |
| `--job <id>` | `--job 4821` | the runner job that failed: its log and saved work are what you read |

| `--stuck --jobs <j1>,…,<j5>` | `--mission 12 --stuck --jobs 4801,4802,4803,4804,4805` | a **stuck repair** (PRD 3065), in place of `--prd` and `--job`: the mission's last 5 ended jobs, in which nothing moved, whose logs, saved work and steps are what you read |

A failure repair (`--prd`, `--job`) needs all three of `--mission`, `--prd` and `--job`; a stuck repair
needs `--mission`, `--stuck` and exactly 5 job ids in `--jobs`. With the input of neither, or a mix of
both, print `repair needs --mission, --prd and --job, or --mission, --stuck and --jobs` and stop,
with no record line. Without `--stuck`, everything below is as it was. Run by a person in a terminal (`OMNI_UNATTENDED` unset), say that a mission
sends this skill on a runner, and stop.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, stop and say so in one line: the Omni Loop kit
is not installed in this repository. Keep the JSON; later steps read `repo.*`, `branches.*` and
`commands.*` from it. Then print the briefing, `node .omni-loop/bin/omni.mjs session start`: its rules
bind every step below. The mission branch is the `--base <branch>` the failed job's line carries (a mission
sends its steps as `/omni:yolo <n> --base <mission branch>`): read it from the failed job, and use it as `<mission branch>`
below. A product PRD's build (`--prd <key>-<n>`) carries `--base-of <owner/repo>=<mission branch>,…` instead: each target
repository's mission branch, the one the cause sits in being yours. A failed job that carries no `--base` (nor `--base-of`) has no
mission branch: take the `person` way, naming that. A
stuck repair reads the `--base` from the jobs it reads (any one that carries it); none carries it:
take the `person` way, naming that.

## 1. The retro

Read, on this runner, why the step failed: the failed job's log (`omni runner log <job>`), the work it
saved (its worktree, if kept), the PRD's branch and the step of its plan the job was on. Then write the
retro to a scratch file outside the repository, as JSON:

```json
{
  "cause": "<the cause, one sentence>",
  "class": "code | omni-loop | flake | person",
  "place": "<a file, a command or a skill>",
  "signature": "<the error's signature: its name and message>",
  "evidence": ["<one sentence each, never a log excerpt>"],
  "proposedFix": "<the fix that would end it>",
  "fingerprint": "<filled by step 2>"
}
```

Rules: every field is one sentence or one line; the evidence is sentences, never a log excerpt, a
path of a customer's, a credential or a person's words. The class is one of four:

- **`code`**: the work's own code is wrong (a broken test, a failing build the PRD's code caused).
- **`omni-loop`**: the kit, a skill or the runner is wrong (a crash in `omni`, a skill that refuses a
  valid input, a runner that fails a job for no cause of the work).
- **`flake`**: a timeout, a lost network or a busy service, with no change to make.
- **`person`**: only a person can decide (the bug fix's boundary is crossed, a product decision, a
  secret missing, a human action).

In the repository that holds the Omni Loop kit's own source (the one the bug report would be filed on), read `omni-loop` as
`code`: the fix is a bug fix like any other.

**A stuck repair.** Nothing failed: five jobs ended and no PRD moved to a new step, to ready, onto
the mission branch, to merged or out of its blockers. Read the five jobs (`omni runner log <job>` for
each, their saved work, the PRD and the step each was on) and find why nothing moved: a step sent
again and again, a hold nobody released, a skill that ends without its result. Write the same retro
(the cause in one sentence, its class, and the rest), so the same four classes, the same fingerprint
(step 2) and the same ways (step 3) apply. The cause sits in one PRD, or in the mission's own scope,
brief or branch. When it sits in a rule, a law or a playbook form, change nothing: the class is
`person`, and the retro's proposed fix names the change. A stuck repair spends one of the mission's
repairs whatever it finds.

## 2. The fingerprint

The fingerprint is a sha256 of the class, the place and the signature after normalising them (line
numbers, hashes, times, temporary paths and numbers inside messages dropped), written as 64 lower-case
hex characters. `kit/lib/repair/fingerprint.ts` is its one definition, and `omni` has no command for it
yet: compute it as that file says, with `sha256sum` on the normalised text, or leave `fingerprint` as a
64-character hex of your best attempt. The App never takes it on trust: it computes it again from the
retro's class, place and signature, so one cause keeps one fingerprint whatever you wrote. Say in the
hand-off that you computed it by hand.

## 3. The way, by class

- **`code`.** Follow `/omni:bug-fix` with `--base <mission branch>`, as it is written: the retro is its
  triage and its red reproduction the proof, the fix branch is cut from the mission branch and its PR
  targets it. When the PRD spans repositories (the config has a `plan` section), follow
  `/omni:mega-bug-fix` the same way, each fix into that repository's mission branch. Keep the fix PR's
  number: it is the record's `fix`. **A product PRD** (`--prd <key>-<n>`): the cause sits in one of the target
  repositories its `--base-of` names. Clone that one (`gh repo clone <owner/repo>`), follow `/omni:bug-fix --base <its
  mission branch>` there, and keep one fix: its PR's number is `fix` and its repository, `owner/name`, is the record's
  `repo`. The mission lands it only on that repository's mission branch, then builds the PRD again. A bug fix that stops (its boundary is crossed, its reproduction
  passes before any fix, its stop rule 3, 4 or 7) is not a `code` repair: rewrite the retro as class
  `person` with the stop's question as its proposed fix, and take that way.
- **`omni-loop`.** Fix nothing. Build the public report from fixed fields only and scrub it:

  The report holds fixed fields only: the kit version (`omni --version`), the command or skill that
  failed (`/omni:<skill>` or `omni <command>`, never its arguments), the class, one message and the
  fingerprint. The message is the error's message with every path, repository name, login, email, URL
  and token-shaped string removed (`kit/lib/repair/scrub.ts` is the rule); when you cannot make it clean,
  leave `report` null and say why in the retro's evidence. The App scrubs it again and files nothing it
  cannot prove clean. Never paste a path, a repository name, a login, an email, a URL or a token into
  anything public.
- **`flake`.** Fix nothing: the step is sent once more by the mission.
- **`person`.** Fix nothing: the retro's proposed fix is the question the PRD stops with.

## 4. The record line

The last output of the skill is one line, with no text after it:

```
omni repair: {"v":1,"mission":<m>,"prd":<n>,"fingerprint":"<hex>","class":"<class>","retro":{…},"fix":<pr|null>,"report":{…}|null}
```

A stuck repair's line adds `"trigger":"stuck"` and names in `"prd"` the PRD the cause sits in, or
`null` when the cause is the mission's own (its scope, its brief, its branch); a failure repair's line
has no `trigger` and always names its PRD.

`"prd"` is the PRD as `--prd` named it: a number, or a product PRD's id as a string (`"omni-loop-27"`). A product
PRD's `code` repair adds `"repo":"<owner/repo>"`, the repository its fix was opened in; any other record has no `repo`.
`fix` is the bug fix's PR number for `code`, else `null`. `report` is the scrubbed report for
`omni-loop`, else `null`. `retro` is the retro of step 1 with its fingerprint. Print the JSON on one line. A line the App cannot read counts as
a repair spent, so never print a partial one.

## Never

- Never ask a person: nothing to answer is a `person` retro, not a question.
- Never merge, and never open a pull request into the default branch.
- Never put a log excerpt, a credential or a person's words in the retro or the record.
- Never fix a class other than `code`.
- Never print a second record line after the first, nor any text after it.
