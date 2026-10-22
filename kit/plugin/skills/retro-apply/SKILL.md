---
name: retro-apply
description: Settles every kept lesson of a retro PR on the PR's own branch, so each one ends in an outcome a person approves by merging — for each retro issue it reads the lesson and the playbook, then appends one rule to the slot it belongs in and records `became`, or records `staysHere` with the rule that already says it, or asks one question on the retro PR and records nothing; rewrites the retro PR's body with one line per lesson (the rule quoted word for word with its slot, or the reason) and a closing line for each issue; with retro.guards on, also writes the guard test, proved red then green. Refuses, in one line and writing nothing, a retro PR already merged or closed. Never merges. A runner runs it, queued by the Omni app; a person may run it in a terminal. Triggers on "settle the retro lessons", "apply the retro", "/omni:retro-apply --retro 2300".
---

# Retro apply: each kept lesson becomes a rule or says why not

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your agent adds, if it
adds one (in Claude: the `Co-Authored-By` line its session gives), then the line `omni sign trailer`
prints as the message's last line, with no blank line between them. A body it rewrites keeps the line
`omni sign footer` prints, as a paragraph of its own just above your session's own attribution lines.
Every comment it posts is signed as an agent's, never as a person's: it speaks in no person's name.
A command that prints nothing means signing is off here: add nothing.

A retro keeps a lesson only when its judge finds it new (PRD 487), and each kept lesson has a retro
issue. This skill is what turns one into a rule, or says no to it. It **settles; it never merges**:
a person merges the retro PR, and that merge applies every rule, accepts every reason and closes the
issues. Nobody else applies a lesson.

## Input

`--retro <n>`: the number of a retro PR. With none, say that this skill takes one, and stop. The
Omni app queues `/omni:retro-apply --retro <n>` for a runner and writes the same line in the retro PR's
body, so a person may run it by hand. Running it again is safe: a lesson that has an outcome is not
settled twice.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Keep the JSON;
`<remote>` is `repo.remote`. Then run `node .omni-loop/bin/omni.mjs config retro.guards` and keep what
it prints: anything but `true` means guards are off here, and step 4 writes no code.

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs session start`. Its
rules bind every step below. Each `omni kb show <form>` prints one form of the repository's
playbook, section by section: a section left blank prints the kit default, and a `[hole]` is a
question for a person, never a reason to stop.

## 1. The retro PR, open or refused

Run `gh pr view <n> --json state,headRefName,baseRefName,body,url,title`. When its `state` is
`MERGED` or `CLOSED`, print this one line, write nothing, post nothing and stop:

```text
retro-apply: retro PR #<n> is already <merged|closed>: nothing to settle.
```

Otherwise check out its branch (`headRefName`) in a worktree under `worktrees`
(`git fetch <remote>`, then `git worktree add -B <headRefName> <worktrees>/retro-apply-<n> <remote>/<headRefName>`)
and work there: the settling is commits on the retro PR's own branch, never on another one and never
on the default branch.

## 2. Its kept lessons

The PRD is the retro PR's `Refs #<prd>` line. Its folder holds `retro.json` (`omni prd <prd>` names the
folder): a kept lesson is a finding id that a run lists under `issues`, with its retro issue's number,
and its outcome is the one a run records under `outcomes` for the same id. Run
`node .omni-loop/bin/omni.mjs check retro --retro <prd>`: it names each kept lesson that has no
outcome. Those are the lessons to settle, in the order it names them. With none left, say so in one
line and go to step 5.

## 3. Settle one lesson at a time

For each lesson without an outcome, read its retro issue (`gh issue view <issue>`: what happened, why
it matters, the proposed lesson, the YAML block at the end), then every form of the playbook the
lesson could belong in (`omni kb show <form>`; `omni kb show <form> --json` lists a form's slot ids).
Then decide exactly one of the three, and only from what the playbook and the issue say:

- **Becomes.** The lesson is about how to work in this repository, and no rule states it. Pick the
  one slot it belongs in. Append one new bullet to that slot's body in its form file, in the words
  of the slot's own bullets, ending `(retro of PRD <prd>, #<issue>)`. Touch nothing else in the file.
  Then run
  `node .omni-loop/bin/omni.mjs retro outcome <prd> <finding> --became playbook/<form>#<slot>`.
- **Stays here.** A rule already states it, or the lesson is not about how to work here. Run
  `node .omni-loop/bin/omni.mjs retro outcome <prd> <finding> --stays-here '<why>'`, the reason
  citing the rule that already says it, as `playbook/<form>#<slot>` or the law's id. Write no rule.
- **Asks.** No slot fits, the lesson contradicts a written rule, or it would change a locked law (a
  law of `omni kb laws`, a product rule or an invariant: that is the knowledge harvest's ground,
  never this skill's). Record no outcome and post one question on the retro PR, in plain words, for
  a person to answer: the lesson, what stops you, and the option you would take. A question is
  asked once: when the PR already carries yours for this lesson, post nothing more. Never answer it
  yourself.

`omni retro outcome` refuses an id that does not resolve, an empty reason and a lesson that already
has an outcome, writing nothing: fix the id, or leave the lesson as it is. An outcome is never
rewritten. Commit each lesson as its own reviewable commit (the file it changed, `retro.json` and
`retro.md`), signed as above, and push the retro PR's branch to `<remote>`.

## 4. The guard, only with `retro.guards` on

Read `omni kb show testing` first. A lesson that **became** a rule and is worth a guard (a check
could have caught it) gets the test that would have caught it, where the testing form says tests live:

1. Write the test. Make the cause of the lesson present (undo the rule's fix in the code, in a
   scratch copy or with the change reverted, never committed): the test must go **red**.
2. Restore the code: the test must go **green**.
3. Commit the test alone, with what you saw red and green in the commit message.

With guards off, write no code: the retro PR stays documents only, and a lesson worth a guard names
the guard in its line of the retro PR's body, for a person to take up.

## 5. The retro PR shows each outcome

Rewrite the retro PR's body (`gh pr edit <n> --body-file <file>`, a scratch file outside the
repository), keeping everything the app wrote and keeping the `omni sign footer` line. Under each
lesson, write one line: a rule that **became** is quoted word for word with its slot
(`` `playbook/<form>#<slot>` ``), a lesson that **stays here** gives its reason, and a lesson that
**asks** says its question is open. Then one `Closes #<issue>` for each settled lesson, so that merging
applies the rule and closes the issue; none for a lesson that asks. The reviewer approves rule by rule.

Run `node .omni-loop/bin/omni.mjs check retro --retro <prd>` and
`node .omni-loop/bin/omni.mjs check all`. The first stays red while a lesson asks: that red is the gate
doing its job. Remove the worktree (`git worktree remove`) when done.

Report in a few lines: the retro PR, each lesson with its outcome (or its question), and the checks
that ran. It never merges, never marks a PR ready and never answers a question it posted.
