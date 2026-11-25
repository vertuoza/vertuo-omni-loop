---
name: tech-review
description: Grills the coding side of a PRD's plan with any member, whether or not a Tech Approval was requested, as long as the plan is not approved, then changes only the coding parts and records what was settled — refuses, in one line, a PRD with no plan, an approved PRD or Tech Approval, a merged sub-PR, a person whose GitHub login cannot be read, or a run under OMNI_UNATTENDED; reads the spec, the plan, the Technical tab, the playbook's architecture, testing, conventions and ci forms, the laws its files touch and the code before it asks; shows the choices already made; asks one question at a time, each with a recommended answer and why; applies the answers only to the spec's Conventions, Test seams and Risks and the technical side of Solution and Decisions, the before/after page's Technical tab, and the plan's slices, territories, blockers and waves, and grades the plan again with omni plan check; records each settled question under "### Tech review" in the spec's Decisions; sends a question only the PM can settle to the PRD's issue as a comment naming the author; pushes as one signed docs(prd) commit and /omni:dossier-push, and ends on the page's link. With <key>-<n> --mission <m>, the line a mission's Architect is sent on a runner, it runs unattended, asks nobody, changes only the plan's coding parts as a new plan version on the product PRD's page, writes nothing in the repository, and ends on the omni tech record line. Gives no approval, merges nothing. Triggers on "tech review PRD 2608", "review the coding side of this plan", "/omni:tech-review 2608".
---

# Tech review: the coding side of a plan, grilled with an engineer before it is approved

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your agent adds, if it
adds one (in Claude: the `Co-Authored-By` line its session gives), then the line `omni sign trailer`
prints as the message's last line, with no blank line between them. Every comment it posts and every
line it records says it was written by an agent and names the person who answered, never in that
person's name. A command that prints nothing means signing is off here: add nothing.

A PM who finishes a brainstorm may ask one workspace member for a **Tech Approval**: a second
approval, given before the product's approvers are asked. This skill is that member's side of it. It
covers **coding only**; product decisions stay the PM's. It changes the plan and the technical parts
of the spec with the person, and it has no way to give the approval: only the person a request names
presses **Give Tech Approval**, on the PRD's page.

A tech review needs no request: any member may run it on a plan that is not approved yet, whoever a
request names, or with none at all (bug #2992). A review is not an approval: with a request, the
named person still gives it; with none, nobody waits on one.

## Never

- **It never gives the Tech Approval,** and never runs a command that gives or withdraws one. It ends
  on the page's link, where the person a request names presses the button.
- **It changes only what the table in step 4 lists as changeable.** Everything else is the PM's.
- **It never merges,** marks a pull request ready, or answers an outbox item.
- **It asks nothing a file or the code already answers,** and never the same thing twice.
- **It holds no secret.** No key, token, password or personal data goes in a spec, a comment or a commit.

## Input

`<n>`: the number of a PRD whose plan is not approved yet, run by any member, with or without a Tech
Approval request. With none, say that this skill takes one, and stop.

`<key>-<n> --mission <m>`: a product PRD and the mission whose fleet's Architect reviews it, the line
a mission sends on a runner (PRD omni-loop-26). It runs as **For a mission's Architect** says.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Keep the JSON;
`<remote>` is `repo.remote`, and `branches.feature` gives the PRD's branch.

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs session start`. Its
rules bind every step below. Each `omni kb show <form>` prints one form of the repository's
playbook, section by section: a section left blank prints the kit default, and a `[hole]` is a
question for a person, never a reason to stop.

## 1. Refuse, in one line

Check each of these before anything is read or written. The first that holds prints its line,
`tech-review: <why>`, and the skill stops, writing nothing:

| it refuses | because |
|---|---|
| `OMNI_UNATTENDED` is set and the line carries no `--mission` | a grill needs a person: it asks nothing on a runner, and a runner runs it for a mission's Architect only |
| `--mission` without `OMNI_UNATTENDED` | the line is a mission's Architect's, sent on a runner: at a terminal, run `/omni:tech-review <n>` |
| `--mission` with a PRD that is not a product PRD (`<key>-<n>`) | a mission's Architect reviews the product PRDs its PM wrote, on their pages |
| the PRD has no `plan.md` (`omni prd <n>` lists its files) | there is no plan to review: run `/omni:plan <n>` first |
| the PRD is approved: `omni approval <n> --json` prints `"state":"approved"`, or its `tech` state is `approved` | the plan is approved: a tech review comes before it |
| no login can be read from `gh api user --jq .login` | each settled question records who answered it; the login is read from GitHub before anything is asked, and the agent never takes the person's word for who they are |
| a sub-PR of the PRD is already merged (`omni board <n>`) | the build has started; a tech review comes before it |

Under `--mission` the table's other rows are read as **For a mission's Architect** says. Check the refusals in this order: the runner first, so that nothing is read on one. A `voided` state
is not approved: the plan may be reviewed again. A request that names someone else refuses nothing:
anyone may review, and the review tells the named person what was settled.

## 2. Read before you ask

Check out the PRD's feature branch (`<remote>/<feature branch>`) in this worktree, and read, in full:

- the spec and the plan, and the before/after page's **Technical** tab;
- `omni kb show architecture`, `omni kb show testing`, `omni kb show conventions` and
  `omni kb show ci`;
- the laws the plan's territories touch: `omni kb laws --slice <n> <id>` for each slice;
- the code the plan builds on: the files its territories name, and the patterns beside them.

What the code or a playbook form answers is not asked.

## 3. Show the choices already made

Print one short list, in two groups, before the first question:

- **Architecture:** the approach, the data shape, the contracts, the deploy order, the risks.
- **Harness:** the test seams, the levels of test, the slices and their order.

One line each, taken from the spec and the plan as they stand, nothing added.

## 4. Grill, one question at a time

Ask with the tool your agent has for asking (in Claude: `AskUserQuestion`). One question at a time.
Each question comes with a **recommended answer and why**, and follows a decision to what depends on
it. It asks only what the PRD leaves open or looks wrong against the code and the forms, never the
same thing twice, and stops when the reviewer says enough.

**What the reviewer may and may not change**

| the reviewer may change | the reviewer may not change |
|---|---|
| the spec's **Conventions**, **Test seams** and **Risks**, and the technical side of **Solution** and **Decisions** | **Problem**, **User stories**, **Scope**, **Acceptance criteria** |
| the before/after page's **Technical** tab | its **Functional & design** tab |
| the plan: its slices, territories, blockers and waves | the `proof` and `e2e` front matter |

A question only the PM can settle (scope, a user story, an acceptance criterion, the proof video, the
e2e choice) is not asked of the reviewer and not answered by the agent: it goes to the PRD's issue
(step 6), and the skill changes nothing about it.

## 5. Apply, grade, record

For each answer that changes something, edit only the files in the table's left column, then:

1. Grade the plan again: `omni plan check <n>`. Fix until it is green.
2. Record each settled question in the spec's **Decisions**, under a `### Tech review` heading
   (made on the first answer, kept below the existing decisions). One entry per question: the
   question, the answer, what changed, and who answered it (the reviewer's login, written as
   `answered by <login>, recorded by an agent`).

A question the reviewer answers with "keep it as it is" is recorded too, with `what changed: nothing`.

## 6. Send product questions back

A question only the PM can settle becomes one comment on the PRD's issue, naming the PRD's author
(`gh issue comment <issue> --body-file <file>`; the issue number is the PRD's). The comment says what
was found, why only the author can settle it, and that it was written by an agent on the reviewer's
tech review. Write the body to a scratch file outside the repository. Post it once per
question. The spec, the plan and the page stay as they are for it.

## 7. Push, never approve

1. `omni check inbox` until it is green.
2. Commit the changed files as one signed commit titled `docs(prd): tech review <topic>`, on the
   feature branch, and push it to `<remote>`. Write the message to a scratch file and commit with
   `git commit -F <file>`.
3. Run `/omni:dossier-push <n>`, so that each change reaches the PRD's page as a new version.
4. End on the PRD's page: `omni dossier link <n>`. Say, in one line, who presses the **Give Tech
   Approval** button there: the reviewer, when the request names them (a push after it voids it); the
   person the request names, when it names someone else; and, with no request, that any member may
   press **Request a Tech Approval** there to name one.

Nothing was changed, and nothing to push: end on the link the same way.

## For a mission's Architect

`/omni:tech-review <key>-<n> --mission <m>` is the line a mission at Works alone sends its fleet's
Architect on a runner, for each product PRD its PM wrote, once the PM approved its plan (PRD
omni-loop-26, "4. The Architect reviews it, every time"). A runner refuses it on any other job, and
nobody sends it by hand. The steps above run with these differences.

- **Asks nobody.** `OMNI_UNATTENDED` is set. Step 3 shows its list to nobody, and step 4 asks no
  question: each point it would ask is answered from the spec, the plan, the forms and the code,
  with the most reversible answer. A point it settles is a line of `settled`. A point only a person
  can settle (the scope, a user story, an acceptance criterion, the proof, the e2e choice, or a
  coding choice the code and the forms do not settle) is a line of `open`, and changes nothing.
- **Where the PRD stands.** In place of step 1's PRD rows (the login, the board and the approval
  read a repository's PRD, and the fleet's Architect signs, never a person):
  `node .omni-loop/bin/omni.mjs prd <key>-<n>`. A `state:` other than `inbox` (`drifted`,
  `unreachable`) prints its line and stops, with no record.
- **Read before you decide.** In place of step 2's checkout: `node .omni-loop/bin/omni.mjs dossier get <key>-<n> spec`,
  then `dossier get <key>-<n> plan` and `dossier get <key>-<n> before-after` (its **Technical** tab),
  each printing a scratch file's path and its sha256. When `dossier get <key>-<n> plan` prints no
  file, stop in one line, `tech-review: <key>-<n> has no plan on its page`, with no record. Then
  `omni kb show architecture`, `omni kb show testing`, `omni kb show conventions` and
  `omni kb show ci`, `node .omni-loop/bin/omni.mjs kb laws --paths <file>…` with each slice's
  territory (`kb laws --slice` reads a repository's PRD only), and the code the territories name, in
  this checkout.
- **Changes only the plan's coding parts.** Its slices, territories, blockers and waves, in
  `plan.md` in a folder of a scratch folder (`mktemp -d`, outside the repository), `<prd folder>`,
  pushed with `node .omni-loop/bin/omni.mjs dossier push <key>-<n> --from <prd folder>` as a new plan
  version on the PRD's page. A plan that did not change adds no version. This run never changes the
  spec, the before/after page or the voice: none of them is in the folder, and no `### Tech review`
  is written, since the record carries what was settled. `omni plan check` reads a repository's PRD
  only: it is not run. Steps 6 and 7 do not run: no commit, no branch, no pull request, no issue
  comment, nothing in the repository.
- **The reviewed version.** After the push, `node .omni-loop/bin/omni.mjs dossier get <key>-<n> plan`
  again: the sha256 it prints is the record's `plan`, the version pushed, or the one read when
  nothing changed.
- **It never gives the Tech Approval.** The Omni app gives it from the record, as the service,
  signed as the fleet's Architect, when the record is `approved` on the PRD's latest plan version.
- **The record line,** the run's last output, one line exactly:

  ```
  omni tech: {"v":1,"prd":"<key>-<n>","plan":"<sha256>","settled":["…"],"open":["…"],"outcome":"approved|escalated"}
  ```

  `outcome` is one of the two: `approved` only when `open` is empty, `escalated` otherwise. The open
  points go to the mission's PM first (bug #3286): write each one so the PM can act on it, what to
  confirm or change and where. The PM answers them in a new version, which this review reads again;
  a person gets the PRD only once the rounds are spent, each open point shown on the mission. At most 10 points in each list,
  each one line of at most 300 characters. The Omni app reads it from the job's log, and only it: a
  line it cannot read, or none, is recorded as escalated, never as approved. The scratch folder is
  deleted when the skill ends.
