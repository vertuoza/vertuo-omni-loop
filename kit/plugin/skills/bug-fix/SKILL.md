---
name: bug-fix
description: Takes a bug from one line, or an existing issue, to one pull request a person merges — opens (or reads) its issue, classifies it, posts a triage (domain, risk, regression), proves a reproduction red before any fix, fixes it test-first on a fix branch, adds the guard that would have caught it, runs mutation testing when the repository has it, records the fix, proves it with omni bug (its pull request body checked for its proof before the PR opens), opens the PR into the default branch and sends the record to the fix's page on the Omni page. No PRD, spec, plan, phase-0 PR, feature branch or wave, and an outbox only when the range changes a law — one high item per change, in the fix's folder, for a person to answer. Stops on a flaky check (tooling, not a bug), on a reproduction that passes before the fix (naming the merged pull request that fixed the bug, when one is proven), and hands over the /omni:brainstorm line when the fix needs a product decision, a stored shape, a shared contract or a new screen, route or API. On a runner (OMNI_UNATTENDED set) that stop first asks the person on its job, with omni runner ask, and ends on a Waiting for an answer on Omni line; --answers <job> resumes from what they answered on the Omni page, and Design it first hands over the same line. Never merges. Triggers on "fix this bug", "fix #612", "this is broken", "bug fix", "/omni:bug-fix".
---

<!-- Ported from nimbus-brain@47a1a194a:.claude/skills/nimbus-fix-bug/SKILL.md — changes in kit/porting/plugin--bug-fix.md -->

# Bug fix: one bug to one pull request

A fast lane beside the loop, not inside it. A bug something a user, a browser or an API caller can
observe gets an issue, a triage, a reproduction seen failing before the fix, one fix branch and one
pull request. There is no PRD, inbox folder, spec, plan, phase-0 PR, feature branch, wave or
outbox, except one item per change to a law the fix makes (**A change to a law**): the red
reproduction is the spec. The record is committed with the fix and sent to the
fix's own page on the Omni page, a Bug Fix. No release note and no retro follow a bug fix. It ends
at a review gate: **a person merges.**

In order: **start** (step 0); open or read the **issue** (1); **classify** (2); **triage** (3);
check the **boundary** (4, and at every step after); cut the **branch** (5); **words first** (6);
**prove red** (7); **fix** (8); **guard** (9); **mutation** (10); **record** (11), with **a change to
a law** when the range makes one; **ship** (12);
**hand off** (13). Announce each step in one line as you start it. Every step leaves something on
disk or on GitHub, so a fresh session (in Claude: `/clear`) or a crash loses nothing. **Nothing is
reported as proven that was not run.**

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your agent adds, if it
adds one (in Claude: the `Co-Authored-By` line its session gives), then the line `omni sign trailer`
prints as the message's last line, with no blank line between them. Every pull request or issue it
opens ends its body with the line `omni sign footer` prints, as a paragraph of its own just above
your session's own attribution lines, and a body it rewrites keeps that line. Comments are never
signed. A command that prints nothing means signing is off here: add nothing.

**Under `OMNI_GITHUB_APP`.** While `OMNI_GITHUB_APP` is set (a runner job that runs as an API key's own
GitHub App, PRD 2433), everything this skill writes on GitHub is that app's, and no person is named in
it: request no reviewer on any pull request, even one the `pull-requests` form names; add no assignee to
the issue or the pull request; and mention no `@login` in anything written on GitHub (an issue, a comment,
a body, a commit message). Where a step below writes `@<login>` (the `Decided in Omni by` line), write the
login with no `@`. A `CODEOWNERS` file still makes GitHub request its owners: that is the repository's own
rule, outside the job. With `OMNI_GITHUB_APP` unset, nothing here applies.

## Input

| input | example | what it is |
|---|---|---|
| a description | `/omni:bug-fix 'saving twice duplicates the row'` | the bug, in the person's words; the skill opens its issue |
| an issue | `/omni:bug-fix 612`, `/omni:bug-fix #612`, or `/omni:bug-fix https://github.com/<owner>/<repo>/issues/612` | an issue that already reports the bug; the skill uses it as it is |
| `--answers <job>` | `/omni:bug-fix #612 --answers 4821` | a resume (PRD 2255): a person answered on the Omni page the questions job `<job>` asked at a stop for a decision; see **Resuming with answers** |

The three issue forms are all read as its number, `<n>`. An issue URL must name `repo.slug`: a URL
of another repository stops the skill with one line saying which repository it belongs to, since
the fix branch and the PR live here. With no input, say that this skill takes a description of the
bug or an issue, and stop. `--answers <job>` goes with an issue, the one the job stopped on: given
alone, say that a resume needs its issue, and stop.

## Step 0

**Start.** Run `node .omni-loop/bin/omni.mjs config`. If it fails, stop and say so in one line: the
Omni Loop kit is not installed in this repository. Keep the JSON; later steps read `repo.*`,
`branches.fix`, `worktrees`, `paths.delivery`, `paths.glossary`, `paths.knowledge`,
`paths.context`, `labels.bug`, `labels.regression`, `labels.riskCritical`, `labels.riskHigh`,
`labels.riskMedium`, `labels.riskLow`, `labels.needsFix`, `labels.autoCreate`, `risk.storedShape`,
`risk.sharedContract`, `acceptance.*`, `commands.preflight`, `commands.mutation` and
`limits.attempts` from it. `<remote>` below is `repo.remote`.

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs session start`.
Its rules bind every step below. Then read `node .omni-loop/bin/omni.mjs kb show bug-fixing` (the
risk levels, the regression evidence and the guard question steps 3 and 9 use) and
`node .omni-loop/bin/omni.mjs kb show testing` (the level a reproduction is written at, step 7).
Each `omni kb show <form>` prints one form of the repository's playbook, section by section: a
section the repository left blank prints the kit default, and a `[hole]` is a question for a person,
never a reason to stop. The `bug-fixing` form adds to the steps below; it never overrides them.

## 1. Issue

Labels follow `/omni:pr`'s **Labels** rules: a missing label is created only when
`labels.autoCreate` is true, and a label that cannot be added is said in the triage comment (step 3),
never a reason to stop.

- **With a description:** open the issue, labelled `labels.bug`, signed (**Signing**):

  ```bash
  gh issue create --title "Bug: <line>" --label "<labels.bug>" --body-file <file>
  ```

  ```markdown
  <the line, as the person wrote it>

  A bug fix: `/omni:bug-fix` triages it, proves a reproduction red, fixes it, and opens one pull
  request that closes this issue.

  <the line `omni sign footer` prints>
  ```

- **With an issue** (`<n>`, `#<n>` or its URL): read it with `gh issue view <n> --comments`, and
  follow every CI run it links (`gh run view <id> --log-failed`). Use it as it is. When it does not
  carry `labels.bug`, add it (`gh issue edit <n> --add-label "<labels.bug>"`).

`<n>` below is the issue's number, `<nnnn>` is `<n>` zero-padded to four digits, and `<slug>` is a
short kebab-case name of the bug.

## 2. Classify

A bug is something a user, a browser or an API caller can observe. A flaky test, a CI timeout or a
slow job is **tooling**, not a bug: post the triage comment (step 3) with only
`- **Kind:** tooling — not a behaviour bug` and one sentence why, and stop (stop rule 1).

## 3. Triage

Establish, with evidence you can cite, the risk levels and the regression evidence being the ones
`omni kb show bug-fixing` defines:

- **Domain:** the knowledge area or code area that owns the behaviour.
- **Risk:** `critical`, `high`, `medium` or `low`, and one sentence: who is hurt, how, workaround or
  not.
- **Regression:** `yes` only with evidence: the culprit PR or commit (`git log <green>..<red>` on
  `<remote>/<repo.defaultBranch>`, then read the suspect diff), a green run followed by a red one, a
  release range, or the report saying when it last worked. Otherwise: new bug — no evidence this ever
  worked. A release range is `<previous tag>..<tag> (first seen <time> UTC, none before)`, when the
  first occurrence follows that release and none came before it; the suspect diff is read with
  `git log <previous tag>..<tag>`.
- **Production:** only when the report comes from production. The first occurrence is read from the
  report's source, with its time zone (the error tracker's own first-seen time), never from the
  issue's date, and written in UTC. Match it against releases: `gh release list --json
  tagName,publishedAt`, and the repository's GitHub deployments (`gh api
  repos/<repo.slug>/deployments`) when it has them. The deployed version is the last one published, or
  deployed, before it. When the tracker gives the stack unminified, cite its top frame as
  `<file>:<line>`.

**Ask Jev about the risk.** Once you have set the risk level and its sentence yourself, and before
you post the comment, write the bug's state to a scratch file (never in the repository):
`{ "title": "<the issue's title>", "body": "<the issue's body>", "reproduction": "<the
reproduction's path, or null>", "domain": "<the domain>", "risk": "<your one sentence>" }`. Then
run:

```bash
node .omni-loop/bin/omni.mjs decide bug-risk --state-file <state file> --old <your level> --ref "<repo.slug>#<n>"
```

It always exits 0. When it prints `unset`, keep your own level and change nothing: the step is as it
was. When it prints `<level> <confidence>` (`high 0.82`), the workspace has put this decision On and
Jev's level counts, even against yours: it is the level of the Risk line and of the risk label below,
and the Risk line ends with ` (Jev, <confidence>)`. Jev answers the level only: Kind, Domain,
Regression and the Risk line's sentence stay yours.

The triage is posted in this step, at once, with `- **Reproduction:** pending` and
`- **Branch:** pending`: neither exists yet, and every stop after this step leaves a triage on the
issue. Steps 5 and 7 fill those two lines, edited in place by its marker.

Post **one** comment on the issue (a comment is never signed), found by its marker and edited in
place on a rerun:

```bash
gh api repos/<repo.slug>/issues/<n>/comments --paginate \
  -q '.[] | select(.body | startswith("<!-- omni-bug:triage -->")) | .id'
gh issue comment <n> --body-file <file>                                          # no id: a new comment
gh api -X PATCH repos/<repo.slug>/issues/comments/<id> -F body=@<file>           # an id: edit it
```

```markdown
<!-- omni-bug:triage -->

## Triage

- **Kind:** behaviour bug
- **Domain:** <the knowledge area or code area that owns the behaviour>
- **Risk:** <critical | high | medium | low> — <who is hurt, how, workaround or not>[ (Jev, <confidence>)]
- **Regression:** yes — <culprit PR or commit | green run → red run | the report's "last worked">
  | <previous tag>..<tag> (first seen <time> UTC, none before) | new bug — no evidence this ever worked
- **Production:** <deployed version> · first seen <YYYY-MM-DD HH:MM> UTC (<source>) · <count> occurrences
- **Reproduction:** pending
- **Branch:** pending
```

The **Production** line is there only when the report comes from production.

Then label the issue with the label of the risk that counted, Jev's or yours (`labels.riskCritical`, `labels.riskHigh`,
`labels.riskMedium` or `labels.riskLow`) and, for a regression only, `labels.regression`:
`gh issue edit <n> --add-label "<risk label>[,<labels.regression>]"`. A label that could not be
added is one more line in the comment.

## 4. The boundary

Checked here, and at every step after. A bug fix restores behaviour the product already meant to
have. It crosses the line when:

- **the right behaviour is not already settled**: no spec, knowledge register, doc or plain intent
  says what should happen, so fixing it needs a product decision;
- **the fix touches a path in `risk.storedShape` or `risk.sharedContract`**: a stored shape or an
  interface others depend on;
- **the fix needs a new screen, route or API.**

Size alone is not the test: a fix across several files is still a bug fix when none of the three
holds.

**The stop.** Crossing the line, here or at any later step, stops the skill (stop rule 4). Comment on
the issue with what crossed it, in plain words, and the command to run instead:

```bash
gh issue comment <n> --body-file <file>
```

```markdown
This is more than a bug fix: <what crossed the line, in one or two sentences>.

Run this instead, to design it first:

`/omni:brainstorm <the issue's line>`
```

Then stop. Open no pull request. A reproduction already written is kept (**A stop keeps the
reproduction**, step 7): it is committed alone on the fix branch and the branch is pushed, and the
comment links the branch and names the reproduction's path. A worktree step 5 had already cut stays
where it is, never deleted, and the hand-off names its path and its branch.

On a runner, with `OMNI_UNATTENDED` set, ask the person on the job before this comment goes up:
**Asking on a runner**, below. Anywhere else, this is the stop.

## 5. Branch

Cut a worktree on `branches.fix`, with `{topic}` = `<n>-<slug>`, from the default branch:

```bash
git fetch <remote>
git worktree add -b <fix branch> <worktrees>/<n>-<slug> <remote>/<repo.defaultBranch>
```

Every change below is made in this worktree. Never commit on `repo.defaultBranch`.

Edit the triage comment in place, found by its marker `<!-- omni-bug:triage -->` (step 3's
`gh api` lookup, then its `PATCH`): its `- **Branch:**` line becomes `- **Branch:** `<fix branch>``.

## 6. Words first

List the nouns and verbs the reproduction needs. Read `node .omni-loop/bin/omni.mjs kb glossary` for
them: where a term is in both it and `paths.glossary`, the page wins. When `paths.glossary` is set,
each is in it; a missing term is added there, in the section that owns it, in the same commit as the
reproduction. With no glossary, the words come from `paths.knowledge` and `paths.context`. An offline
or product-less read prints its copy or one line, and the skill carries on with what it has. A term that cannot be
defined without inventing product behaviour stops the skill with a question to the person, naming
the term (stop rule 2).

## 7. Prove red

Write the reproduction, in the domain's words:

- an acceptance scenario under `acceptance.dir` when `acceptance.enabled` is true and the harness
  (`acceptance.run`) can observe the bug;
- otherwise an ordinary test, at the level `omni kb show testing` picks.

Run it **before any fix**:

- **It fails:** keep the failing line verbatim; it is the red evidence. Edit the triage comment in
  place, found by its marker `<!-- omni-bug:triage -->`: its `- **Reproduction:**` line becomes the
  reproduction's path.
- **It passes:** it has three readings, in this order: **it misses the bug**, **the bug is already
  gone**, or **this level cannot see it**. The third applies when the evidence points at what only
  the build changes: an error in production that the source cannot produce (a module's shape,
  CommonJS/ESM interop, server-side rendering, minification, a production-only environment value),
  or a regression range that changes the toolchain (the bundler, the package's `"type"`, the
  framework). Under the first two, stop (stop rule 3): first look for the merged pull request that
  already fixed the bug (**Who fixed it**, below), then comment on the issue; a person decides. Under
  the third, move up a level, below.
- **It cannot run in this session** (a harness or a service the session lacks): the evidence is the
  sentence `Red not proven here — <why>; CI is the proof`, and the skill carries on.

**Move up to the smoke level.** Under the third reading, write the reproduction as one more case of
what `commands.smoke` checks (the failing route added to the routes it loads, or the equivalent), then
run `setup`, then `commands.smoke`, before any fix. `commands.smoke` builds what the repository ships
to production, then runs checks against the built output. It is the only way to the build level: never
run a build script or a probe of your own.

- **Smoke fails:** its failing line is the red (the record's level is `smoke`), and steps 8 onward run
  as today, with `commands.smoke` green as the proof the fix works, beside the preflight.
- **Smoke passes too:** stop rule 3, with **Who fixed it**. A unit-level pass alone never reaches stop
  rule 3 while the third reading applies; a smoke-level pass does.
- **Smoke is set but cannot run in this session** (a browser or a tool the session lacks): push the
  reproduction alone on the draft PR; the red is the CI run of `commands.smoke` on it, when the
  repository's CI runs it (a workflow under `.github/workflows/` holds the command's text). When it
  does not, stop rule 7.
- **`commands.smoke` is null:** stop rule 7.

**A stop keeps the reproduction.** At stop rules 3, 4 and 7, commit the reproduction alone on the fix
branch and push the branch (`git push -u <remote> <fix branch>`). The stop's comment links the branch
and names the reproduction's path. Stop rule 7 also opens the fix PR as a draft, labelled
`labels.needsFix` (`gh pr create --draft --label "<labels.needsFix>"`), its body saying it stopped and
why. When the triage's risk is `critical`, the stop's comment starts with `> [!CAUTION]` then
`> critical — nothing is fixed.`, mentions nobody, and the hand-off prints that line first; the issue
keeps `labels.riskCritical`.

**Stop rule 7's comment** names the suspect (`<file>:<line>`), the triage's **Production** line, the
exact YAML to commit in `.omni-loop/config.yml` (`commands.smoke: <a command that builds and checks the
route>`), and the command that reruns the fix.

**Film it.** The run folder is `<worktrees>/proof-bug-<n>/<run>/` (`<worktrees>` is
`node .omni-loop/bin/omni.mjs config worktrees`, `<run>` is `<YYYYMMDD-HHMMSS>`), outside the tracked
tree. The red output goes to `red.txt` in it. A *component bug* (a front-end bug that shows in one
component, in a repository with Storybook, whose reproduction is a story and the test that renders
it) also starts Storybook once and films the story headless with Playwright, at 1280×720, as
`/omni:prove` films a criterion, to `before.webm`. Every other bug is filmed from its reproduction's
output. A story that cannot be filmed (no Playwright, Storybook does not start, the story does not
render) is no stop: keep the reason for step 12 and go on with the outputs alone.

**Who fixed it.** Only when the reproduction passed (stop rule 3): the bug may be gone because a
merged pull request fixed it since it was first seen. Look before commenting.

- **Candidates:** the pull requests merged since the bug was first seen (the issue's date, or the
  report's "last worked") that touch the reproduction's files or the files its error trace names. Find
  them with `git log --merges -- <files>` and
  `gh pr list --state merged --search "<terms from the issue's line>" --json number,url,mergeCommit`.
- **Proven:** a candidate is proven only when you ran the reproduction, in this repository, and it is
  **red at its merge commit's first parent** and **green at its merge commit**. Run it on each commit
  in a detached worktree (`git worktree add --detach <worktrees>/<n>-probe <commit>`, the
  reproduction's files copied in, removed once it has run), the way step 7 ran it, and never edit the
  reproduction to turn it red or green. A candidate you could not run at both commits is not proven.
- **The comment** goes on the issue (`gh issue comment <n> --body-file <file>`, as step 4's stop
  does). For a proven candidate it names it and the two commits, with the reproduction's command:

  ```markdown
  The reproduction passes before any fix: the bug is already gone.

  Fixed by #<n>

  Red at <short sha> (before #<n>), green at <short sha>: `<the reproduction's command>`
  ```

  `Fixed by #<n>` names a pull request of this repository, `Fixed by <PR URL>` one elsewhere. The line
  starts its line, stands alone on it and is written once, for the one proven candidate (the earlier
  merge, when two qualify; the other becomes a `Maybe:` line).
- **The hand-off's line** (PRD 2425): for that one proven candidate, the hand-off (step 13) carries
  `Fixed by: <PR URL>` too, the proven pull request's full link on a line of its own, right after the
  `Outcome:` line (**The outcome line**), whichever repository it is in. That is the only place the
  hand-off writes it.
- **No proven candidate:** no line starts with `Fixed by`, in the comment or in the hand-off. Each
  candidate gets a `Maybe: #<n>` line and the comment keeps the two readings, the reproduction misses
  the bug or the bug is already gone:

  ```markdown
  The reproduction passes before any fix: it misses the bug, or the bug is already gone.

  Maybe: #<n>
  ```

- **The skill never closes the issue.** A person decides, and the skill stops there.

## 8. Fix

Before changing a line, when `laws.source` is `knowledge`, read the knowledge the fix touches, never
the whole folder: run `node .omni-loop/bin/omni.mjs kb laws --paths <file>…` on the files the fix
will change. Under **Applies here** it prints each law (one plain line, with who must approve a
change to it), rule and decision record that reaches those files, by its `Governs:` line, its
domain or its layers, each line saying why; under **Global**, what nothing narrows, the Legal
entries included; then it counts the locked laws of other areas. The fix keeps each entry it
prints true. A fix
that would change a locked law follows **A change to a law**, and its PR waits for that person.

Test-first, the smallest change that turns the reproduction green, in the repository's own patterns
(`node .omni-loop/bin/omni.mjs kb show conventions`). Where the cause is unit-testable, write the
failing unit test first, watch it fail, then make it pass. **Never edit the reproduction to make it
pass.** Then run `commands.preflight` until it is green; when it is null, say so, and name it in the
PR's **Verified** section. Each red run of the fix counts as an attempt (stop rule 5).

**Film the fix.** The same reproduction, green, goes to `green.txt` in the run folder of step 7. A
component bug films the same story again, after the fix, to `after.webm`, then stops Storybook.

## 9. Guard

Answer in one sentence: which cheap check would have caught this before it shipped? When one is
guard-sized (a check script, a lint rule, a unit test), add it with its own test, and confirm it
fails on the default branch's version of the offending code and passes on the fix branch. Otherwise
the guard line is `Guard: none — <reason>`.

**A bug proven red at the smoke level.** The case the reproduction added to `commands.smoke` is the
guard. Check, read-only, whether the repository's CI runs `commands.smoke` (the command's text in a
workflow under `.github/workflows/`):

- **It does:** `Guard: <the case> in commands.smoke, run by CI`.
- **It does not:** `Guard: none — <repository>'s CI does not run commands.smoke`, and the PR body and a
  comment on the issue name the CI step to add.

The skill never edits CI: a repository's workflows are a person's to change.

## 10. Mutation

- **`commands.mutation` set:** commit first (it reads committed changes), run it, and read what
  survives inside the lines the fix changed. Survivors there: strengthen the test once and rerun
  once. Its last line is the mutation evidence.
- **`commands.mutation` null:** the line is `Mutation: not set here`.
- **It cannot run at all:** the line is `Mutation: not run — <its last error line>`, without a
  retry.

## 11. Record

Write `<paths.delivery>/bugs/<nnnn>-<slug>/bug.md`, the only file in that folder. It is what the
future Bugs view reads:

```markdown
# Bug <n>: <the line>

## Triage

- **Domain:** <…>
- **Risk:** <level> — <sentence>
- **Regression:** <yes — evidence | new bug — no evidence this ever worked>

## Reproduction

- **File:** `<repository path of the test or scenario>`
- **Level:** <unit | acceptance | smoke>
- **Red:** <the failing line, verbatim | Red not proven here — <why>; CI is the proof>

## Fix

<What was wrong and what changed, in two or three sentences.>

## Guard

<What it is and what it catches | none — <reason>>

## Mutation

<The last line | not set here | not run — <why>>
```

## A change to a law

Only when `laws.source` is `knowledge`; otherwise skip this section. A law is a locked rule or
invariant of the knowledge base: one a CODEOWNER locked with a `Locked:` line. Every rule and
invariant, locked or not, is proven by the test its `Enforced by:` line names, and a fix may change
one only with a person's answer. Step 12's `node .omni-loop/bin/omni.mjs bug <n>` names each
change to a rule or a law the range makes, one `not ok` line each, by its rule:

| rule | the range |
|---|---|
| `law-proof` | changes a file a rule's or a law's `Enforced by:` names |
| `law-text` | rewords, adds or removes a rule, a law or a domain contract in a register |
| `test-removed` | deletes a test, a law's among them |
| `law-demoted` | turns an `Enforced by:` path back to `pending` or `unenforced`, or removes the entry |
| `briefing-text` | changes the briefing (`<paths.playbook>/briefing.md`), its `points-to` file or a file one of its `See:` lines names |

**A locked law asks more.** Changing one (its text, its `Locked:` line, or the test that proves it)
also keeps the pull request's outbox check red under `law-locked`, until a CODEOWNER of the law's
files approves the pull request on GitHub. No item, label or trailer clears it. Say so in the PR's
body in one plain sentence (what breaks, and who gets hurt), and name the person
`omni kb laws --paths` printed for that law.

Each line reads `- <path> (<rule>): a change to a law needs an item ranked high in
<folder>/outbox/ and an account naming it in <folder>/outbox/accounts/.`

First ask whether the fix needs that change. When it does not, undo it and rerun: that is the most
reversible answer. When it does, keep it and raise it for a person, in the fix's folder
(`<paths.delivery>/bugs/<nnnn>-<slug>/`), under `outbox/`: **one item per change**, never two changes in one item.

1. **The items.** `omni item new` writes a PRD's items only, so write each by hand as
   `outbox/s1-<k>-<slug>.md`, in the shape every outbox item takes, `<k>` counting `01`, `02` … in
   the order the lines came:

   ```markdown
   ---
   id: s1-<k>-<slug>
   prd: <n>
   slice: s1
   rank: high
   bears-on: <law id>
   raised: <YYYY-MM-DD>
   wave: 1
   ---

   ## The question, in plain words

   <one or two sentences a business person reads: what the fix changes about the rule, and why>

   ## The decision, in plain words

   <what this fix did, in the same plain words>

   ## The intro, for fun

   <one sentence, at most 120 characters, about the question, never about a person>

   ## The punchline, for fun

   <one sentence, at most 120 characters, following the intro>

   ## The options, in plain words

   A. <what the fix did> (built).
   B. <keep the law as it was, and what the fix then does instead>

   ## What I had to decide

   <the law, its id, and the change the range makes to it>

   ## What I did meanwhile

   <what the branch holds now>

   ## What it costs to change later

   <what undoing it takes>

   ## What I could not know

   <what the knowledge, the issue and the code do not settle, each line marked (author)>
   ```

   The plain-words fields name no path, no code and no id. `<law id>` is the law's register id,
   the one `omni knowledge <id>` explains. Never invent a rationale: a gap goes in the last
   section, marked `(author)`.
2. **The account.** Write `outbox/accounts/s1.md` in the same folder, naming each change once per
   rule, as a line of `omni bug <n>` names it:

   ```markdown
   ---
   prd: <n>
   slice: s1
   graded: <YYYY-MM-DD>
   ---

   ## Risky changes

   - `<path>`
     <rule>
     item s1-<k>-<slug>
   ```

3. **Commit** the items and the account on the fix branch, signed (**Signing**), and rerun
   `omni bug <n>` until it prints `ok`: an open item is not a failure there.

On the pull request, the outbox check posts each item and stays red until a person answers it,
through the same replies as a feature PR's outbox: a person answers, never this skill. That red is
not an attempt at the fix. The PR's body and the hand-off name each item and the law it bears on.

## 12. Ship

1. **Commit** on the fix branch as `fix(<scope>): <what the user gets back> (#<n>)`, with the
   session's co-author trailer, then the `omni sign trailer` line (**Signing**). The scope follows
   `omni kb show conventions`.
2. **Push** the fix branch: `git push -u <remote> <fix branch>`.
3. **Send the record to its page:** follow `/omni:dossier-push <n> --kind bug`, and carry on
   whatever it prints. Keep the link it printed for the hand-off.
4. **Film it:** run `node .omni-loop/bin/omni.mjs bug film <n> --before <red file> --after <green file>
   --out <run folder>` (the two clips, `before.webm` and `after.webm`, for a component bug; `red.txt`
   and `green.txt` otherwise), then
   `node .omni-loop/bin/omni.mjs proof push --kind bug <n> <folder>`. The second prints the bug page's
   link, then the GIF's stable link: keep that second line. A component bug's run prints two more
   lines, the `before.webm` link then the `after.webm` link: keep both for the `Clips:` line (a pinned
   omni that prints none leaves that line out).

   **Clips that fail make the GIF of the two outputs.** A story that could not be filmed (step 7 kept
   the reason), or two clips that `omni bug film` exits 1 on (`ffmpeg not found`, or
   `ffmpeg failed: <its last line>`), are no reason for a draft: the GIF of the two outputs needs no
   ffmpeg. Run `omni bug film <n> --before <red file> --after <green file> --out <run folder>` on
   `red.txt` and `green.txt` instead, push that run as above, leave out the `Clips:` line, and write
   `Storybook not filmed - <reason>` under the GIF, the reason being the story's or the clips' own line
   (`ffmpeg not found` included).

   A GIF that cannot be made at all never stops the skill either: the PR opens as a **draft**, its
   `## Proof` holds the one line `GIF not produced - <reason>`, and the reason is the row's:

   | cause | reason |
   |---|---|
   | `omni bug film` or `omni proof push --kind` exits 2 (the pinned omni does not know them) | `the pinned omni is too old: run omni update` |
   | `omni bug film` exits 1 otherwise | its line |
   | `omni proof push` exits 1 (`off`, `no sign-in (omni signin)`, `unreachable`, `none`, `refused (…)`) | `proof push: <its line>` |
   | red was not seen in this session (`Red not proven here`) | `red not proven here` |

5. **Write the body** of the pull request, shaped as below, to a file outside the repository
   (`mktemp`), ending with the `omni sign footer` line (**Signing**). This one file is checked, then
   opened.
6. **Prove it:** `node .omni-loop/bin/omni.mjs bug <n> --body-file <file>`. Run it until it prints
   `ok`:

   | exit | what you do |
   |---|---|
   | `0` | `ok`: carry on. |
   | `1` | `not ok`, one line per failed check. A proof line (`no ## Proof section`, `## Proof has no image and no "GIF not produced - <reason>" line`, `## Proof's image has no "Before the fix" or "After the fix" line`) is mended in the body file: no commit. Any other (a second folder, a missing or empty section, a risk outside the four levels, a reproduction the branch does not change, an empty red line, an unsigned commit) is fixed on the branch: commit, push again, and send the record again when it changed. A line naming `law-proof`, `law-text`, `test-removed`, `law-demoted` or `briefing-text` follows **A change to a law**. Then rerun. |
   | `2` | A pinned omni that does not know the flag prints `omni bug: unknown flag --body-file.`: run `node .omni-loop/bin/omni.mjs bug <n>` without it, carry on with its answer, and say in the hand-off that the pinned omni did not check the body (`omni update` fixes it). Any other exit 2 (the kit is not installed here, its config does not read, `--base` does not resolve, the file cannot be read): say so and stop. |

7. **Open the PR through `/omni:pr`**, as a standalone PR (a draft when no GIF was made), only once
   `omni bug <n> --body-file <file>` printed `ok` (or the pinned omni refused the flag, above): base
   `repo.defaultBranch`, label `labels.bug` (subject to its **Labels** rules), title the commit's
   subject, and **that same file** as its body, signed (**Signing**): `gh pr create --body-file <file>`,
   at point `pr.open` as `/omni:pr` says. The body's shape:

   ```markdown
   Closes #<n>

   ## What was wrong

   <what the user saw, and why, in plain words; the files touched>

   ## Proof

   ![Before and after the fix](<the GIF's stable link>)

   Clips: [before](<the before.webm link>) · [after](<the after.webm link>)

   - **Before the fix** (red): `<the failing line>`
   - **After the fix** (green, `<short sha>`): `<the passing line>`

   ## Bug

   - **Issue:** #<n>
   - **Triage:** <domain> · <risk> · <regression — <evidence> | new bug — no evidence it ever worked>
   - **Red proven:** <the failing line | Red not proven here — <why>; CI is the proof>
   - **Guard:** <what it is and what it catches | none — <reason>>
   - **Mutation:** <the last line | not set here | not run — <why>>
   - **Record:** `<paths.delivery>/bugs/<nnnn>-<slug>/bug.md`
   - **Laws:** <none | each item of **A change to a law**, its id and the law it bears on, for a
     person to answer on this PR>

   ## Verified

   - <commands.preflight>: <green, or "none set here">
   - `omni bug <n> --body-file <file>`: ok
   - <what was run and seen green, and what was not>

   ## Risk and rollback

   <what else shares the changed code>; roll back by reverting this PR.

   <the line `omni sign footer` prints>
   ```

   The `Clips:` line is for a component bug whose clips were filmed: any other body leaves it out.
   When the clips were not filmed, `## Proof` gains `Storybook not filmed - <reason>` under the GIF
   instead. When no GIF was made, `## Proof` is the one line `GIF not produced - <reason>`.

   The record line is a repository path, never a URL. `/omni:pr` watches it until it is green or
   stuck. A red CI run is one more attempt at the fix: back to step 8.

## 13. Hand off

Print, in a few lines: the issue, the PR, the fix's page beside it, what was proven and what was
not (the red line, the preflight, the `omni bug` line, the guard, the mutation line), each item a
change to a law raised and the law it bears on, then the line `Outcome: pr-opened` (**The outcome
line**), then:

> Review the PR and merge it if it is right.

The fix's page is the link step 12's push printed. When the push was skipped, run
`node .omni-loop/bin/omni.mjs dossier link <n> --kind bug`; when it prints `none` or cannot reach the
app, say the fix has no page yet and give its issue, `https://github.com/<repo.slug>/issues/<n>`.

**A person merges.** After a stop, the hand-off is the issue, the comment the stop posted (and the
`/omni:brainstorm` line, after **The stop**), the worktree left behind, when there is one, and the
`Outcome:` line the stop rule names (**The outcome line**).

## Asking on a runner

At **The stop** of step 4, and only there (PRD 2255): when `OMNI_UNATTENDED` is set (a runner job, with
nobody to read a comment) and there is an issue, ask the person on the job before the stop comment goes
up. Run by a person in a terminal, `OMNI_UNATTENDED` is not set, and **The stop** is exactly as step 4
says.

**The questions.** Write them to a scratch file, never in the repository: 1 to 4 questions in the shape
`omni ask question --file` reads, each with a `header`, a `question`, a `multiSelect` and 2 to 4 options.
An option is one way to fix it that you found: its `label` names the fix, its `description` says in one
line what it changes. **The last option of every question is `Design it first`**, described `Stop here and
brainstorm the behaviour`. The Omni page adds the free answer itself. Write the **lead** to a second
scratch file: one paragraph saying why the fix stopped, in the words of the stop comment.

**Ask.** Run
`node .omni-loop/bin/omni.mjs runner ask --file <questions file> --issue <n> --lead <lead file>`, where
`--issue <n>` is the issue the fix stopped on. It reads `OMNI_JOB`, which the runner gives each job,
checks the questions against that shape, stores them on the job and, on exit 0, prints the line the
comment ends on. Only exit 0 asked.

**The stop comment.** On exit 0, post the comment of **The stop**, found by its first line and edited in
place on a rerun (it always points at the question that waits now), with its last line the line
`omni runner ask` printed, word for word, in place of the `/omni:brainstorm` line:

```markdown
<!-- omni-bug:need-human -->

This is more than a bug fix: <what crossed the line, in one or two sentences>.

Waiting for an answer on Omni: <the Runners page link, with ?answer=<job>>
```

Then end with exit 0: open no pull request and push nothing, as for any stop. The hand-off carries
`Outcome: need-human` (stop rule 4 on a runner). The job reads Done on the runner and **Need human** on
the Omni page.

**When it does not go through.** On any other exit (an Omni app without the route, a refusal, no
sign-in, a questions file it rejects), post today's stop comment, with the `/omni:brainstorm` line, and
end as **The stop** says, with `Outcome: needs-brainstorm`. The hand-off says the one line
`omni runner ask` printed.

## Resuming with answers

Only with `--answers <job>` (PRD 2255): the run resumes one that stopped at step 4 and asked on its job
`<job>`, and a person answered on the Omni page. Run step 0, then:

**Read the answers.** Run `node .omni-loop/bin/omni.mjs runner answers <job>`. It prints the job's row as
one line of JSON: its `questions`, its `answers` (each question's text to its answer: an option's label,
the labels of a multi-select, or the person's own words) and `byLogin`, the login of whoever answered.
When it exits 1, or the row holds no answers, stop with the line it printed and touch nothing: no
comment, no branch, no push (stop rule 6, `Outcome: blocked`).

**Say what was decided.** Post on the issue one comment, found by its first line and the line
`Job <job>`, and edited in place on a rerun. A decision of another job is a comment of its own:

```markdown
<!-- omni-bug:decision -->

Decided in Omni by @<login>

Job <job>

**<the question's header>** — <the question>
<the answer>
```

One `**<the question's header>**` block per question, in the order they were asked.

**Carry on.** Go on from step 3, the triage, with the answers as the behaviour wanted: they settle the
decision the stop named, and that one only, so step 4 does not stop on it again. A line crossed for any
other reason, at step 4 or after, is a new stop. The reproduction, the fix, the guard and the pull
request run as written, and a person merges the pull request.

**Design it first.** When an answer is `Design it first`, stop as step 4 does: post the stop comment with
the `/omni:brainstorm` line, open no pull request, push nothing, and end with exit 0, the hand-off
carrying `Outcome: needs-brainstorm`.

**Another decision.** When the fix meets another decision, it asks again, as **Asking on a runner**: this
resume is a job of its own, and gets its own **Need human**. It asks nothing it was already told.

## The outcome line

Every end of the skill, the pull request or any stop, writes one line to the hand-off that says how the
run ended (PRD 2425), `Outcome: <word>`. A runner reads it from the job's log and the Omni page shows
it. The line is plain text that starts its line and stands alone on it: no bullet, no quote, no bold, no
code span. It is written once, before the hand-off's closing line, and its word is the end the run took,
never another.

| The word | The run ended |
|---|---|
| `pr-opened` | at step 12 with the pull request open: step 13's hand-off |
| `already-fixed` | at stop rule 3: the reproduction passes before the fix |
| `need-human` | at stop rule 2, or at stop rule 4 on a runner whose `omni runner ask` exited 0 |
| `needs-brainstorm` | at stop rule 4 anywhere else, or on an answer `Design it first` |
| `not-a-bug` | at stop rule 1 |
| `stuck` | at stop rule 5 |
| `blocked` | at stop rule 6 or 7 |

Stop rule 3 adds one line after it, `Fixed by: <PR URL>`, and only for a pull request **Who fixed it**
has proven: its full link, whichever repository it is in, on a line of its own. A `Maybe:` candidate
never gets one, nor does any other end, and a run that proved none writes none.

## Stop rules

Written verbatim, so they are never argued away. Each ends on the word its hand-off's `Outcome:` line
carries (**The outcome line**):

1. Not a behaviour bug: triage comment `Kind: tooling`, stop: `Outcome: not-a-bug`.
2. A term cannot be defined without inventing behaviour: stop and ask: `Outcome: need-human`.
3. The reproduction passes before the fix (a unit-level pass alone never reaches this rule while the third reading applies): stop, comment on the issue, with `Fixed by #<n>` (or `Fixed by <PR URL>`) only for a pull request proven red at its merge's first parent and green at its merge (**Who fixed it**), else `Maybe:` lines. Never close the issue. The hand-off: `Outcome: already-fixed`, then `Fixed by: <PR URL>` for that proven pull request only.
4. The boundary is crossed: stop, comment with the `/omni:brainstorm` line (on a runner, ask first: **Asking on a runner**): `Outcome: needs-brainstorm`, or `Outcome: need-human` on a runner whose `omni runner ask` exited 0.
5. `limits.attempts` red attempts at the fix, or at CI on the PR: the PR stays draft, labelled
   `labels.needsFix`, with a comment saying what is stuck, and the issue gets a comment linking it:
   `Outcome: stuck`.
6. `--answers <job>` whose answers `omni runner answers` cannot read, or reads empty: stop with its
   line and touch nothing: `Outcome: blocked`.
7. The bug lives in the build and the repository commits no `commands.smoke` it can run: stop, keep the reproduction, comment on the issue with the suspect, the production evidence and the line to commit. Never fix without red. `Outcome: blocked`.

For rules 3, 4 and 7, the reproduction is committed alone on the fix branch and the branch is pushed
(step 7, **A stop keeps the reproduction**).

For rule 5 with a PR already open: `gh pr ready <pr> --undo`, add `labels.needsFix`
(`gh pr edit <pr> --add-label "<labels.needsFix>"`), comment on the PR with what is stuck, and
comment on the issue with the PR's link.

## Never

- **Never merge.** A person merges the PR; the skill stops at the hand-off.
- **Never fix before red.** The reproduction runs, and fails, before any fix, or says it could not
  run.
- **Never edit the reproduction to make it pass.**
- **Never delete the reproduction, its branch or its worktree on a stop.**
- **Never edit a repository's CI workflows**, and never run a build script or a probe of your own:
  the build level is reached only through `commands.smoke`.
- **Never open the PR before `omni bug <n> --body-file` printed `ok`**, unless the pinned omni refused the flag.
- **Never write a `Fixed by` line for a pull request that is not proven**, and never close the issue.
- **Never write two `Outcome:` lines**, nor one for an end the run did not take, nor a hand-off
  `Fixed by` line for a pull request that is not proven.
- **Never cross the boundary** to finish a fix: stop, and hand over the `/omni:brainstorm` line.
- **Never ask on a job unless `OMNI_UNATTENDED` is set**: a person in a terminal gets the stop as it is.
  Never carry on from answers that could not be read, and never read the answers as a leave to merge.
- Never commit on `repo.defaultBranch`.
- Never report anything as proven that was not run.
- Never open a PRD, an inbox folder, a plan or an outbox item for a bug fix, save the items
  **A change to a law** asks for, and never batch several bugs into one PR.
- Never answer an item of the fix's outbox: a person does.
