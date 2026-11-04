---
name: tech-review
description: Grills the coding side of a PRD's plan with the one person its Tech Approval names, then changes only the coding parts and records what was settled — refuses, in one line, a PRD with no plan, no open tech request, a merged sub-PR, a person who is not the named one, or a run under OMNI_UNATTENDED; reads the spec, the plan, the Technical tab, the playbook's architecture, testing, conventions and ci forms, the laws its files touch and the code before it asks; shows the choices already made; asks one question at a time, each with a recommended answer and why; applies the answers only to the spec's Conventions, Test seams and Risks and the technical side of Solution and Decisions, the before/after page's Technical tab, and the plan's slices, territories, blockers and waves, and grades the plan again with omni plan check; records each settled question under "### Tech review" in the spec's Decisions; sends a question only the PM can settle to the PRD's issue as a comment naming the author; pushes as one signed docs(prd) commit and /omni:dossier-push, and ends on the page's link. Gives no approval, merges nothing. Triggers on "tech review PRD 2608", "review the coding side of this plan", "/omni:tech-review 2608".
---

# Tech review: the coding side of a plan, grilled with the person who must approve it

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
of the spec with the person, and it has no way to give the approval: only the person presses
**Give Tech Approval**, on the PRD's page.

## Never

- **It never gives the Tech Approval,** and never runs a command that gives or withdraws one. It ends
  on the page's link, where the named person presses the button.
- **It changes only what the table in step 4 lists as changeable.** Everything else is the PM's.
- **It never merges,** marks a pull request ready, or answers an outbox item.
- **It asks nothing a file or the code already answers,** and never the same thing twice.
- **It holds no secret.** No key, token, password or personal data goes in a spec, a comment or a commit.

## Input

`<n>`: the number of a ◆ PRD (its phase 0 is approved on the page) with an open tech request, run by
the person the request names. With none, say that this skill takes one, and stop.

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
| `OMNI_UNATTENDED` is set | a grill needs a person: it asks nothing on a runner, and a runner never runs it |
| the PRD has no `plan.md` (`omni prd <n>` lists its files) | there is no plan to review: run `/omni:plan <n>` first |
| `omni approval <n> --json` has no `tech` field, or its `state` is `approved` | there is no open tech request to answer |
| the person signed in (`omni whoami`) is not the member `tech` names | only the named person reviews it; when the email does not settle it, the agent asks the person whether they are that login, and refuses on no |
| a sub-PR of the PRD is already merged (`omni board <n>`) | the build has started; a tech review comes before it |

Check the refusals in this order: the runner first, so that nothing is read on one. A `voided` state
is an open request again: the named person reviews again.

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
   question, the answer, what changed, and who answered it (the named person's login, written as
   `answered by <login>, recorded by an agent`).

A question the reviewer answers with "keep it as it is" is recorded too, with `what changed: nothing`.

## 6. Send product questions back

A question only the PM can settle becomes one comment on the PRD's issue, naming the PRD's author
(`gh issue comment <issue> --body-file <file>`; the issue number is the PRD's). The comment says what
was found, why only the author can settle it, and that it was written by an agent on the named
person's tech review. Write the body to a scratch file outside the repository. Post it once per
question. The spec, the plan and the page stay as they are for it.

## 7. Push, never approve

1. `omni check inbox` until it is green.
2. Commit the changed files as one signed commit titled `docs(prd): tech review <topic>`, on the
   feature branch, and push it to `<remote>`. Write the message to a scratch file and commit with
   `git commit -F <file>`.
3. Run `/omni:dossier-push <n>`, so that each change reaches the PRD's page as a new version.
4. End on the PRD's page: `omni dossier link <n>`. Say, in one line, that the **Give Tech Approval**
   button there is theirs to press, and that a push after it voids it.

Nothing was changed, and nothing to push: end on the link the same way.
