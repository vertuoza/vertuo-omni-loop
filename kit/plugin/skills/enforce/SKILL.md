---
name: enforce
description: Turns one law issue into one pull request a person merges — reads the issue and the law's entry, which waits for its test, writes the law's test where the repository's testing form says tests live, proves it by breaking the law in the code and seeing the test red, then restoring the code and seeing it green, rewrites the entry's pending line to the test's path on a law branch, and opens one signed PR into the default branch that closes the issue, its report showing the red and the green. Stops with a comment on the issue, leaving the law pending and opening no PR, when the test cannot be made to go red. Runs only where laws live in the knowledge base. Never merges. Triggers on "enforce this law", "write the law's test", "prove law 1400", "/omni:enforce".
---

# Enforce: one law issue to one pull request

A law of the knowledge base (a rule or an invariant) says what must stay true. One that was judged
worth a law before it had a test reads `Enforced by: pending #<n>`, and issue `<n>` (a **law
issue**, labelled `labels.law`) waits for its test. This skill writes that test and **proves** it:
a test that never fails when the law is broken proves nothing, so the law is broken in the code
first and the test must go red, then the code is restored and it must go green. Only then is the
entry rewritten to name the test, on one branch, in one pull request that closes the issue. It ends
at a review gate: **a person merges.**

In order: **start** (step 0); read the **issue** and its law (1); cut the **branch** (2); **write
the test** (3); **prove it** red then green (4); **name the test** in the entry (5); **ship** (6);
**hand off** (7). Announce each step in one line as you start it. **Nothing is reported as proven
that was not run.**

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your session requires,
then the line `omni sign trailer` prints as the message's last line, with no blank line between
them. Every pull request or issue it opens ends its body with the line `omni sign footer` prints, as
a paragraph of its own just above your session's own attribution lines, and a body it rewrites keeps
that line. Comments are never signed. A command that prints nothing means signing is off here: add
nothing.

## Input

| input | example | what it is |
|---|---|---|
| a law issue | `/omni:enforce 1400`, `/omni:enforce #1400`, or `/omni:enforce https://github.com/<owner>/<repo>/issues/1400` | the issue the harvest or the sweep opened for one law |

The three forms are all read as its number, `<n>`. A URL must name `repo.slug`: a URL of another
repository stops the skill with one line saying which repository it belongs to. With no input, say
that this skill takes a law issue, and stop.

## Step 0

**Start.** Run `node .omni-loop/bin/omni.mjs config`. If it fails, stop and say so in one line: the
Omni Loop kit is not installed in this repository. Keep the JSON; later steps read `repo.*`,
`branches.law`, `worktrees`, `paths.knowledge`, `labels.law`, `labels.autoCreate`,
`commands.preflight`, `commands.test` and `limits.attempts` from it. `<remote>` below is
`repo.remote`.

When `laws.source` is not `knowledge`, this repository keeps no law in its knowledge base: say so in
one line and stop, writing nothing.

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs kb show briefing`.
Its rules bind every step below. Then read `node .omni-loop/bin/omni.mjs kb show testing` (the
commands, where tests live, which level to choose, what a test must never do) and
`node .omni-loop/bin/omni.mjs kb show conventions` (naming and the shape of a commit). Each
`omni kb show <form>` prints one form of the repository's playbook, section by section: a section
the repository left blank prints the kit default, and a `[hole]` is a question for a person, never a
reason to stop. A form adds to the steps below; it never overrides this skill's rules.

## 1. Issue

Read it with `gh issue view <n> --comments`. It is a law issue when it carries `labels.law`; one
that does not stops the skill with one line saying so, writing nothing. Its body names the entry's
id (`<id>` below), its register, its statement, its source and where its test would live.

Read the entry: `node .omni-loop/bin/omni.mjs knowledge <id>`, then its register under
`paths.knowledge`, with every entry that serves it or that it serves. Its `Enforced by:` line must
read `Enforced by: pending #<n>`, naming this issue:

- **It names a path already:** the law has its test. Comment on the issue with that path, and stop.
- **It reads `unenforced`, or names another issue, or the entry is gone:** follow **The stop**,
  saying what the entry reads.

Then find **the code that keeps the law**: the files whose behaviour the statement describes. Read
them, and their tests. Name them in one line. When nothing in this repository keeps the law, follow
**The stop**.

## 2. Branch

Cut a worktree on `branches.law`, with `{id}` = `<id>`, from the default branch:

```bash
git fetch <remote>
git worktree add -b <law branch> <worktrees>/law-<id> <remote>/<repo.defaultBranch>
```

Every change below is made in this worktree. Never commit on `repo.defaultBranch`.

## 3. Write the test

Write **one** test of the law, where `omni kb show testing` says tests live, beside the code that
keeps it, at the level it picks. It asserts the statement as the law states it, in the domain's
words, and nothing more: no snapshot, no copy of today's output, no assertion the law does not ask
for. Name it after the law, and say the entry's id in its name or in a comment above it, so the next
reader finds the law from the test.

Run it alone with the command the testing form names (`commands.test` when it gives none). It must
pass on today's code: a law that is already broken here is a bug, not a missing test. Then follow
**The stop**, naming `/omni:bug-fix` in the comment.

## 4. Prove it

The test proves the law only if it fails when the law is broken.
A test that cannot go red is not a proof.

1. **Break the law** in the code that keeps it, with the **smallest change** that violates the
   statement: a condition inverted, a guard removed, a value swapped. Never touch the test to do it.
2. **Red.** Run the test alone. It must fail. Keep its failing line **verbatim**: it is the red
   evidence. Keep the break as a diff in the session's scratchpad directory, never in the
   repository, for the PR's report.
3. **Restore** the code: `git checkout -- <the files the break changed>`. `git status` shows only
   the test as changed.
4. **Green.** Run the test alone again. It must pass. Keep its passing line.

The break is **never committed**, and never pushed. When the test stays green with the law broken,
rewrite the test so it catches the break, and prove it again from item 1; each try counts as an
attempt. After `limits.attempts` tries, follow **The stop**.

## 5. Name the test

In the entry's register, rewrite its `Enforced by: pending #<n>` to the test's path, as a repository
path, and change nothing else in the entry: never its statement, its `Why` or its id. Then run:

```bash
node .omni-loop/bin/omni.mjs check knowledge
```

Fix until it passes. Then run `commands.preflight` until it is green; when it is null, say so, and
name it in the PR's **Verified** section. A red preflight that the test causes is fixed in the test,
never by weakening it to pass, and counts as an attempt.

## 6. Ship

1. **Commit** the test and the register on the law branch as `test(<scope>): law <id> — <the law,
   in a few words> (#<n>)`, with the session's co-author trailer, then the `omni sign trailer` line
   (**Signing**). The scope follows `omni kb show conventions`.
2. **Push** the law branch: `git push -u <remote> <law branch>`.
3. **Open the PR through `/omni:pr`**, as a standalone PR: base `repo.defaultBranch`, label
   `labels.law` (subject to its **Labels** rules), title the commit's subject, and this body, signed
   (**Signing**):

   ```markdown
   Closes #<n>

   ## The law

   **<id>** (`<register path>`): <the statement, as the entry states it>

   ## Proof

   - **Test:** `<the test's path>`
   - **The break:** <the smallest change that broke the law, in one sentence, and the file it was in>
   - **Red:** <the failing line, verbatim, with the law broken>
   - **Green:** <the passing line, with the code restored>

   The break was never committed: this PR adds the test and names it in the entry.

   ## Verified

   - <commands.preflight>: <green, or "none set here">
   - `omni check knowledge`: ok

   ## Risk and rollback

   A new test and one line of the register; roll back by reverting this PR, and the law reads
   `pending #<n>` again.

   <the line `omni sign footer` prints>
   ```

   `/omni:pr` watches it until it is green or stuck. A red CI run is one more attempt: back to
   step 3.

## 7. Hand off

Print, in a few lines: the issue, the PR, the law, the test, the red line and the green line, and
what was run and what was not (the preflight, `omni check knowledge`), then:

> Review the PR and merge it if the test is right.

## The stop

When the entry does not read `pending #<n>`, when nothing in this repository keeps the law, when
the law is already broken on today's code, or when the test cannot be made to go red within
`limits.attempts` tries, stop. Comment on the issue (a comment is never signed) with what is stuck,
in plain words:

```bash
gh issue comment <n> --body-file <file>
```

```markdown
`/omni:enforce` could not prove this law: <what is stuck, in one or two sentences>.

<What was tried: each test and each break, and what the test did with the law broken.>

The law still reads `pending #<n>`.<When the law is already broken: Run `/omni:bug-fix <n>` to fix it first.>
```

The entry keeps its `pending #<n>`. Open no pull request and push nothing. A worktree step 2 had
already cut stays where it is, unpushed, and the hand-off names its path and its branch.

## Never

- **Never merge.** A person merges the PR; the skill stops at the hand-off.
- **Never open a PR without the red.** The test fails with the law broken, then passes restored, or
  the skill stops.
- **Never commit the break**, and never change the law's statement, its `Why` or its id to fit the
  test.
- Never commit on `repo.defaultBranch`, and never enforce several laws in one PR.
- Never report anything as proven that was not run.
