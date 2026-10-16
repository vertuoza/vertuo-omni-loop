---
name: mega-brainstorm
description: The brainstorm of a plan repository — turns one idea into one PRD whose plan says which slice lands in which target repository. Surveys the targets through omni targets, designs with the person (which repository does what is asked, never assumed), reads each repository the design touches from a shallow read-only clone in the scratch folder (nothing runs in it), then writes the PRD issue, the spec with its Repositories section, a before/after page grouped by repository, a multi-repository plan graded by omni plan check, the draft feature PR and one phase-0 PR with a What lands where table, all in the plan repository. Writes nothing in any target, merges nothing. With --product <key>, runs instead from any kitted checkout of a product's repository, remembers the product, and ends with a product PRD on its page, no issue and no PR. Ends with the /omni:ultra-yolo line. Triggers on "mega-brainstorm", "brainstorm across repositories", "one PRD for the back-end and the front-end", "plan this across the targets", "/omni:mega-brainstorm".
---

# Mega-brainstorm: one idea into one PRD across repositories

A **plan repository** (one `/omni:mega-invade` set up: its config has a `plan` section) holds no
product code; its **target repositories** do. This skill turns one idea into one PRD whose plan
names, for every slice, the repository it lands in: the quote-total API in the back-end, the screen
that shows it in the front-end. One spec, one plan, one draft feature PR and **one phase-0 PR**, all
in the plan repository, so the teams read the whole feature side by side before any code exists.

It follows `/omni:brainstorm` **step for step**: the same conversation, the same gate, the same
signing, the same files, the same phase-0 review. It never copies those steps: each step below
either says "as `/omni:brainstorm` step N" and adds only what differs, or is new. Read
`/omni:brainstorm` alongside it; where the two say the same thing, that skill's words are the rule.

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your agent adds, if it
adds one (in Claude: the `Co-Authored-By` line its session gives), then the line `omni sign trailer`
prints as the message's last line, with no blank line between them. Every pull request or issue it
opens ends its body with the line `omni sign footer` prints, as a paragraph of its own just above
your session's own attribution lines, and a body it rewrites keeps that line. Comments are never
signed. A command that prints nothing means signing is off here: add nothing.

**Only here, never there.** Everything this skill writes lands in the plan repository: the issue,
the branches, the files, the pull requests. It writes nothing in any target repository: no branch,
no commit, no pull request, no issue, no comment. Those come later, from `/omni:ultra-yolo`.

**Nothing runs in a clone.** A target's clone is read, never executed: no install, no build, no
test, no script, no hook, no command from its README or its package manifest. Only `git` reads it
(`ls-files`, `rev-parse`, `log`, `show`) and the file tools, as in `/omni:mega-invade`.

## Step 0

1. Run `node .omni-loop/bin/omni.mjs config`. If it fails, stop and say so in one line: the
   repository is not installed. Keep the JSON: everything `/omni:brainstorm` step 0 keeps, plus
   `plan`.
2. **A plan repository only,** unless this is a product run: with `--product <key>`, or with a
   product this checkout remembers, follow **From a product** below from here on. Otherwise, when the
   JSON has no `plan` section, stop in exactly one line:

   ```text
   not a plan repository: run /omni:mega-invade first, or /omni:brainstorm for this repository alone
   ```

3. Then the briefing (`node .omni-loop/bin/omni.mjs session start`) and `/omni:dossier-open`,
   as `/omni:brainstorm` step 0 runs them. A sync status other than 🟢 in the output's `sync` block is said to the person in one line, with its fix, and the run carries on.
4. **The scratch folder:** `mktemp -d`, outside the plan repository and outside its worktrees. Every
   clone of step 3 goes there, and the folder is deleted when the skill ends, whatever the outcome.

## From a product (`--product <key>`)

A **product PRD** (◆, PRD 1548) lives on its product on the Omni page, and in no repository: its
id is the product's key and a counter, `mobile-12`, and its spec, plan, before/after page and voice
are its dossier's versions. This run starts from any checkout of a repository the product holds that
has the kit installed, a plan repository or not, and writes nothing in any repository: no PRD issue,
no feature branch, no commit, no phase-0 PR, no feature PR and no plan PR. Everything else runs as
the steps below say, with these differences.

**Which product.** With `--product <key>`, run `node .omni-loop/bin/omni.mjs product use <key>`: it
prints `product <key> remembered in this checkout`, and every worktree of the checkout reads it from
then on. Exit 2 means the key is not one (lowercase kebab-case, as `mobile`): print its line and stop.
Without `--product`, run `node .omni-loop/bin/omni.mjs product which`: a first line
`remembered: <key>` makes this a run for the remembered product, said in one line before anything
else (`from product <key>, remembered in this checkout`). Without `--product` and with nothing
remembered, the skill runs as written, in a plan repository only (step 0).

**Step 1, the targets,** are the product's repositories. When the config has `plan.product`,
`omni targets --json` reads them, as step 1 says. Otherwise the design names them: this checkout's
repository and each one the person names, asked and never assumed, as step 2 says. The guide and the
imported copies of step 1 are read when this checkout has them.

**Step 2, the design,** asks no product question: the product is `<key>`.

**Every target is `phase0: server`.** Once the design is approved, and before step 3 clones
anything, run `node .omni-loop/bin/omni.mjs product phase0 <owner/name>…` with every repository
the design touches. It prints one line each, exit 0 only when all are on server. A target on `pr`
is refused by name, with the line as printed:

```text
<repo> is phase0: pr · switch it to server on its Omni page, or leave it out
```

Take each refused target back to step 2: the person leaves it out or switches it and asks again.
A `<repo>: its phase0 could not be read: <why>` line holds the run: print it and stop, since a
target whose flag cannot be read is never assumed to be on server.

**Steps 4 to 9: the files go to the server.** Write the PRD's files, as steps 5 and 6 and the plan
of step 8 write them, into one folder of the scratch folder, `<prd folder>`, under their own names
(`spec.md`, `plan.md`, `before-after.html`, `voice.json` when the brainstorm writes one). The
spec's front matter says `phase0: server`, and its `prd:` line is filled once the PRD has an id.

1. **Create it** once the spec and the before/after page are written:
   `node .omni-loop/bin/omni.mjs dossier push --product <key> --new --from <prd folder>`. It prints
   the new id, `<key>-<n>`, then the PRD's page link and the versions added. A refusal (no such
   product, no sign-in, the server unreachable) is printed as is, and the run stops there: nothing
   was created.
2. **Plan it** as step 8 says, writing `plan.md` into `<prd folder>`, its `## Repositories` table
   from the clones of step 3. `omni plan check` reads a repository's PRD only: the hand-off names it
   as not run.
3. **Save each edit** with `node .omni-loop/bin/omni.mjs dossier push <key>-<n> --from <prd folder>`:
   the filled `prd:` line, the plan, any change after a review. A file that did not change adds no
   version.
4. **Read it back** with `node .omni-loop/bin/omni.mjs prd <key>-<n>`: `birthplace: server` and its
   approval, pending until an approver of the product approves it on its page.

Step 4's issue, step 7's commit and `check inbox`, step 8's feature PR and step 9's phase-0 PR are
not made. The scratch folder, `<prd folder>` with it, is deleted when the skill ends, as step 0
says: the server holds every file.

**Step 10, the hand-off,** reports the PRD's id, its page (the link `dossier push` printed), the
waves the plan holds, every check that ran or did not, and each refused target. Its **What is
next?** block reads:

```markdown
**What is next?**

1. Review and approve PRD <key>-<n> on its page: <page link>
2. Once it is approved, start a fresh session (in Claude: `/clear`), or open a new terminal, then
   run:

/omni:ultra-yolo <key>-<n>
```

## 1. Survey the targets

1. Run `node .omni-loop/bin/omni.mjs targets --json` and print its rows as a table
   (`repo · role · knowledge · loop · state`). Its exit `1` is not a failure here: it means a row is
   not `ok`.
2. **Warn, never stop.** A `stale` or `drifted` target is warned about in one line each, with
   `/omni:mega-invade --sync` suggested; never run it from here. The design may still use that
   target, and step 5 writes the warning into the spec's Risks. An `unreachable` target is left out:
   it can hold no slice, and the person is told so.
3. **Read what each target is.** First the page `plan.guide` names, when it is set. Then each
   reachable target's knowledge, where its `knowledge` says it lives:
   - `own`: its knowledge base, read from its clone (step 3) once the design touches it, and until
     then from what `omni targets` and the guide say;
   - `imported`: the draft copy under `<paths.knowledge>/repos/<name>/`, `<name>` being the part of
     `repo` after the `/`;
   - `none`: the guide alone.

## 2. Design

As `/omni:brainstorm` step 1: discover the intent, write back your understanding, classify out loud
(spike, bounded, architectural), ask one question at a time, and hold **the gate**: nothing below
starts before an explicit yes. A spike ends here, as there.

One difference: **which repository does what is part of the design.** Say, for each part of the
change, which target (or the plan repository itself, for a docs change the feature needs there)
you propose it lands in, and why, and have the person confirm it. Never assume it from a role's
name. A design that touches no target is not a mega-brainstorm: say so, and suggest
`/omni:brainstorm` in the repository it touches.

**The product question,** as `/omni:brainstorm` step 1 asks it (PRD 1364), once the design is
approved: `node .omni-loop/bin/omni.mjs product which`, run in the plan repository, names the products
the plan repository is in. Only when it prints more than one, ask *"Which product is this PRD for?"*,
each product and **No product**; with one, `none` or exit 1, ask nothing. The PRD's product links every
repository its plan names to that product on the Omni page, so the answer is the product the targets
build for.

## 3. Clones: read-only, in the scratch folder

For each target repository the approved design touches, one at a time:

1. `gh repo clone <repo> <scratch>/<name> -- --depth 1 --single-branch`: a shallow clone of its
   default branch. **Nothing runs in it** (see **Nothing runs in a clone**).
2. Its head, `git -C <scratch>/<name> rev-parse HEAD`, the full 40 characters, is that
   repository's `read at` in the plan's `## Repositories` table (step 8).
3. Read the paths the design touches (`git -C <scratch>/<name> ls-files`, then the files), so every
   territory step 8 writes is a real path of that repository, and an `own` target's knowledge base
   where it lives in the clone.

A clone that fails leaves that repository out of the design: tell the person in one line, and take
the design back to step 2 for what it held. The clones stay until step 8 has written the plan, then
the scratch folder is deleted.

## 4. The PRD issue and the feature branch

As `/omni:brainstorm` steps 2 and 3, in the plan repository: the issue first (its number is the
PRD's), signed, then the feature worktree cut from the plan repository's default branch. The
issue's **Handoff** block names `/omni:ultra-yolo <n>` as its next command, once the phase-0 PR is
merged, instead of `/omni:yolo <n>`.

## 5. The spec

As `/omni:brainstorm` step 4 (the same front matter, the same sections, the same self-review and,
for an architectural design, the same written-spec review), with two additions:

- **`## Repositories`**, after `## Solution`: one paragraph per repository a slice will name, in the
  order step 8's table lists them: its role, what changes there, and which knowledge it was read from
  (its own, the imported copy, or the guide alone).
- **Risks** also names every stale or drifted copy the design relied on (step 1), and what a merge
  publishes in each target: from that target's releasing form (its own `releasing` form in the
  clone, or the imported copy's), or `unknown: no knowledge base` for a `none` target.

## 6. The before/after page

As `/omni:brainstorm` step 5, one page, **grouped by repository**: a section per repository the
design touches, each with its own today beside after, headed by the repository's name and role.
Acceptance scenarios, when `acceptance.enabled`, as `/omni:brainstorm` step 6.

## 7. Commit, check, push

As `/omni:brainstorm` step 7: commit the folder as `docs(prd): <topic>`, signed, then
`node .omni-loop/bin/omni.mjs check inbox` until green, `node .omni-loop/bin/omni.mjs prd <n>`,
push the feature branch, then `/omni:dossier-push <n>`, its first push carrying the product step 2
picked, as `node .omni-loop/bin/omni.mjs dossier push <n> --product '<name>'`, exactly as there.

## 8. Plan it

As `/omni:brainstorm` step 8: follow `/omni:plan <n>` from the feature worktree. Its paragraph
**In a plan repository** says how to fill the `repo` column and the `## Repositories` table: each
target's `read at` is the clone's head from step 3, and the plan repository's own row reads `—`.
`node .omni-loop/bin/omni.mjs plan check <n>` must be green; it prints each wave with the repository
beside each slice.

The draft feature PR opens in the plan repository. Its **Slices** checklist is grouped by
repository, a `**<name>** (<role>)` line above each group. It is the one pull request that closes the
PRD: `/omni:ultra-yolo` hangs each target's pull request on it and runs its one gate there.

**Point `plan.slice`, per repository.** `/omni:plan` runs its point `plan.slice` for each slice,
with `flow show plan.slice` and `flow verdict plan.slice` as its **Flow points** say. A slice of the
plan repository's own reads the plan repository's flow, as written. A target's slice reads **that
target's** flow, from the copy step 1 read:
`node .omni-loop/bin/omni.mjs flow show plan.slice --repo <name> --prd <n> --slice <id>`, the same
copy `omni plan check` grades its rows against. Its hooks are followed as planning guidance only:
they may reshape the slice's row, and no command they name is run (nothing runs in a clone or from a
copy; a target's hooks run only in its worktree, when `/omni:ultra-wave` builds it). A target with no
copied flow (`--repo` says so, exit 2) meets the kit's defaults: no hook.

`/omni:plan` may return `needs clarification`: stop there, as `/omni:brainstorm` step 8 does.

## 9. One mega phase-0

As `/omni:brainstorm` step 9: one ordinary phase-0 PR in the plan repository, from its phase-0
branch, graded by `node .omni-loop/bin/omni.mjs phase0 <n>` unchanged, then `/omni:dossier-push <n>`.
There is **no phase-0 PR in any target.**

Its body adds, after Summary, a **What lands where** table, so each team finds its part:

```markdown
## What lands where

| repo | role | slices | waves |
| --- | --- | --- | --- |
| <name> | <role> | s1, s4 | 1, 2 |
```

One row per `## Repositories` row, in its order: the slices whose `repo` it is, and the waves they
sit in. The body still starts with `prLinks.phase0` filled and ends with the `omni sign footer` line.

**A person reviews and merges it.** Never merge it yourself, and never mark the feature PR ready.

## 10. Hand off

As `/omni:brainstorm` step 10: report the PRD issue, the feature PR, the phase-0 PR, the waves
`omni plan check` printed and every check that ran or did not, then the same three blocks. Step 1 of
**What is next?** gives the PRD's page from `node .omni-loop/bin/omni.mjs dossier link <n>`, or,
when it prints no page, `(PRD <n> has no page yet: https://github.com/<owner>/<repo>/issues/<n>)`.

Two differences, in the third block only:

- **The command** on the reply's last line is `/omni:ultra-yolo <n>`, never `/omni:yolo <n>`: a plan
  that spans repositories is not built inside the plan repository.
- **While the kit has no ultra-yolo,** that is while `node .omni-loop/bin/omni.mjs help /omni:ultra-yolo`
  exits non-zero, the line just above the command reads:

  ```text
  ultra-yolo is not in this kit yet: the plan waits in the inbox
  ```

```markdown
**What is next?**

1. Review the PRD: https://github.com/<owner>/<repo>/pull/<phase-0 PR>
   (spec, plan and before/after side by side: <dossier link>)
2. Merge that PR. → PRD <n> moves into the inbox.
3. Once it's merged, start a fresh session (in Claude: `/clear`), or open a new terminal, then run:

ultra-yolo is not in this kit yet: the plan waits in the inbox
/omni:ultra-yolo <n>
```

## Guardrails

- Runs only in a plan repository, and writes only there: never a branch, a commit, a pull request,
  an issue or a comment in a target.
- Nothing runs in a clone; every clone lives in the scratch folder and is deleted.
- Which repository does what is asked and confirmed, never assumed.
- A stale or drifted target warns and goes into Risks; an unreachable one holds no slice.
- One idea, one PRD, one feature PR and one phase-0 PR, all in the plan repository.
- Never merge, never add `labels.outboxGo`, never create a label unless `labels.autoCreate` is true.
