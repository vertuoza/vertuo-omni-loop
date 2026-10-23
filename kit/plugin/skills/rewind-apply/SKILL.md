---
name: rewind-apply
description: Settles one approved finding of a rewind, one that started in knowledge nobody wrote down, in this repository's own knowledge — reads the finding with omni rewind facts, then the playbook forms and the product registers it could belong in, and decides exactly one of three — proposes it (one playbook bullet ending "(rewind of PRD <prd>)", or one register entry marked as proposed by the rewind, never a law, committed on the knowledge branch and opened as one docs-only pull request into the default branch for a person to merge), already said (names the rule, writes nothing), or asks (one question, writes nothing) — and records that outcome once with omni rewind outcome, so the finding's card on the PRD's Main tab shows it. Refuses, in one line and writing nothing, a finding it cannot find, one not approved, one that already has its outcome, and one that did not start in knowledge. Writes only under the repository's own knowledge folder, never the kit, never another repository, never a locked law; never merges. A runner runs it, queued by a member's Approve on the finding's card; a person may run it in a terminal. Triggers on "settle this rewind finding", "apply the approved finding", "/omni:rewind-apply 2498 <finding>".
---

# Rewind apply: an approved lesson becomes a proposed rule, or says why not

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your agent adds, if it
adds one (in Claude: the `Co-Authored-By` line its session gives), then the line `omni sign trailer`
prints as the message's last line, with no blank line between them. The pull request it opens ends
its body with the line `omni sign footer` prints, as a paragraph of its own just above your
session's own attribution lines. Everything it writes is signed as an agent's, never as a person's:
it speaks in no person's name. A command that prints nothing means signing is off here: add nothing.

`/omni:rewind` turns a PRD that broke main into findings, and a member approves or rejects each on
the PRD's Main tab. A finding that started in **knowledge nobody wrote down**, about a playbook rule
or a product fact, is the lesson the next run needs. Approve queues this skill for it on a runner of
the workspace, sent by the member who approved. It settles that one finding in exactly one of three
outcomes and records it on the card. It **proposes; it never merges**: a person of this repository
merges or closes the pull request it opens.

## Never

- **It writes only in this repository's own knowledge,** under the folder `paths.knowledge` names:
  never the kit (its plugin, its CLI, its templates, `.omni-loop/bin/`, `.omni-loop/config.yml`),
  never another repository, never code, never a test, never the delivery folder. A lesson about Omni
  itself is an Omni-setup finding, an issue on the kit, never this skill's.
- **It never touches a locked law,** nor any rule already written: it appends one bullet or one
  entry and changes no line that was there. A register entry it adds carries
  `Proposed: rewind <YYYY-MM-DD>` and never a `Locked:` line, a `Proposed law:` line or a lock of
  any kind: only a person confirms or locks it.
- **It never merges,** approves or marks anything ready, and closes nothing: the pull request waits
  for a person of this repository.
- **An outcome is never rewritten** (BR-PRODUCT-12): it records one, once, with
  `omni rewind outcome`, and settles no finding that already has one.
- **It asks nothing under `OMNI_UNATTENDED`** (a runner), and in a terminal it asks nothing either:
  a point it cannot settle from the finding and the knowledge is the **Asks** outcome, a question
  the card shows the member, never a prompt.
- **It holds no secret.** No key, token, password or personal data goes in a rule, an entry, a
  commit, a pull request or an outcome.

## Input

`<prd> <finding>`: the number of the PRD whose rewind holds the finding, then the finding's id (the
UUID on its card). With either missing, say that this skill takes both, and stop. Approve queues
`/omni:rewind-apply <prd> <finding>` for a runner; a person may run the same line by hand. Running it
again is safe: a finding that has an outcome is not settled twice.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Keep the JSON;
`<remote>` is `repo.remote`, `<default branch>` is `repo.defaultBranch`, and `branches.knowledge`,
`paths.knowledge`, `paths.playbook` and `worktrees` are read from it.

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs session start`. Its
rules bind every step below. Each `omni kb show <form>` prints one form of the repository's
playbook, section by section: a section left blank prints the kit default, and a `[hole]` is a
question for a person, never a reason to stop.

Then make a scratch folder (`mktemp -d`), outside the repository: the pull request's body and every
note you keep go there.

## 1. The finding

Run `node .omni-loop/bin/omni.mjs rewind facts <prd> --json`. It exits 1 (signed out, refused,
unreachable): print its line as is and stop. Otherwise find, in its `findings`, the one whose `id` is
`<finding>`, and print the first of these lines that applies, write nothing and stop:

```text
rewind-apply: no finding <finding> on PRD <prd>: nothing to settle.
rewind-apply: finding <finding> is <state>, not approved: nothing to settle.
rewind-apply: finding <finding> already has its outcome: nothing to settle.
rewind-apply: finding <finding> started in <origin>, not in knowledge: nothing to settle.
```

(`already has its outcome`: its `outcome` is set.) Otherwise the lesson is its `fix`, read with its
`happened` and its `evidence` links; the fix's closing line, that an agent wrote it, is not part of
the lesson.

## 2. Where it could belong

Read only from this repository, and only what the lesson could touch:

- the playbook: `omni kb show <form>` for each form the lesson could belong in, and
  `omni kb show <form> --json` for a form's slot ids;
- the product registers under `paths.knowledge` (`product/`, and `domains/<domain>/` when the
  lesson is one domain's): their entries, and `omni knowledge <id>` for one entry in full;
- the laws it could touch: `omni kb laws --paths <file>…` for the files the evidence names, which
  prints each locked law with the people who must approve a change to it.

Then name what the lesson is: **a lesson about how to work in this repository** (a playbook rule),
or **a fact about the product** (a register entry). A lesson about a glossary term or a Legal entry
is neither: it is the product's knowledge on the Omni page, never a file here.

## 3. Decide exactly one

Decide from what the knowledge and the finding say, never from a guess:

- **Already said.** A rule already states the lesson. Write nothing and open nothing. Run
  `node .omni-loop/bin/omni.mjs rewind outcome <finding> --already '<rule>'`, the rule named as
  `playbook/<form>#<slot>` or as the register entry's id, one line.
- **Asks.** No slot or register fits, the lesson contradicts a written rule, or it would change a
  locked law (or any rule already written: this skill only appends). A lesson about a glossary term
  or a Legal entry asks too, offering to propose it on the product's Knowledge tab. Write nothing and
  open nothing. Run `node .omni-loop/bin/omni.mjs rewind outcome <finding> --asks '<question>'`: one
  question in plain words, for the member reading the card, holding the lesson, what stops you and
  the option you would take. Never answer it yourself.
- **Proposes.** No rule states it, and one slot or one register is where it belongs: step 4.

`omni rewind outcome` refuses an outcome without its value and a finding that already has one,
recording nothing: print its line and stop. An outcome is never rewritten.

## 4. Propose: one docs-only pull request

1. **The branch.** It is `branches.knowledge` with `{topic}` = `rewind-<prd>-<short>`, `<short>`
   the first eight characters of the finding's id. Run `git fetch <remote>`. When
   `gh pr list --head <branch> --state open --json number,url` names an open pull request (a run
   that stopped before it recorded its outcome), that pull request is the outcome: record it as in
   item 6 and stop, writing nothing more. Otherwise cut the branch from
   `<remote>/<default branch>` in a worktree under `worktrees`:
   `git worktree add -B <branch> <worktrees>/rewind-apply-<short> <remote>/<default branch>`, and
   work there.
2. **The rule.**
   - **A playbook bullet.** Append one new bullet to the body of the one slot it belongs in, in its
     form file under `paths.playbook`, in the words of that slot's own bullets, ending
     `(rewind of PRD <prd>)`. Touch nothing else in the file.
   - **A register entry.** Append one new entry to the register it belongs in, after its last
     entry, in the shape of that register's own entries: the next free id of that register, the
     statement in plain words, every line `omni check knowledge` asks of its kind (a rule's
     `Serves:` names a principle that exists; `Enforced by: unenforced` when no test proves it),
     `Source:` naming the rewind of PRD `<prd>` and the finding, `Stated:` today, and last
     `Proposed: rewind <YYYY-MM-DD>`, today's date. Never a `Locked:` line, never a
     `Proposed law:` line.
3. **The checks.** Run `node .omni-loop/bin/omni.mjs check knowledge` and
   `node .omni-loop/bin/omni.mjs check kb`. A violation your addition caused is fixed in your
   addition; one already on the default branch is not yours, and is named in the pull request's
   body. When your addition cannot be made green, undo it, remove the worktree and take **Asks**
   instead, the violation in the question.
4. **Only the knowledge.** `git status --porcelain` lists exactly one file, under `paths.knowledge`.
   Anything else is undone before the commit: the pull request is documents only.
5. **The pull request.** Commit that one file, signed as above, titled
   `docs(knowledge): <the rule, in a few words> (rewind of PRD <prd>)`, and push the branch to
   `<remote>`. Write the body in the scratch folder: the finding (its check, what happened, its
   evidence links), the rule added, quoted word for word with its slot (`playbook/<form>#<slot>`) or
   its register entry's id, and one line saying that `/omni:rewind-apply` proposed it from a
   member's Approve, for a person of this repository to merge or close; then the `omni sign footer`
   line. Open one docs-only pull request into the default branch:
   `gh pr create --base <default branch> --head <branch> --title '<the title>' --body-file <file>`.
6. **The outcome.** Run `node .omni-loop/bin/omni.mjs rewind outcome <finding> --pr <n>`, `<n>` the
   pull request's number. A refusal (the finding got an outcome meanwhile) records nothing: say so,
   and leave the pull request open for a person. Remove the worktree (`git worktree remove`).

## 5. Report

A few lines: the finding, its outcome (the pull request's link, the rule that already says it, or
the question), the rule quoted word for word when one was proposed, and the checks that ran. It never
merges, never marks a pull request ready, and never answers a question it asked.
