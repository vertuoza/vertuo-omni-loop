---
name: terraform
description: Fill a repository's knowledge forms (the playbook) from what the repository can prove — survey it read-only, point at the pages that already answer a form, fill the rest from evidence with every command run green, leave an honest TODO(human) question where proof is missing, propose the config the survey learned — and end with one docs-only pull request a person merges. With --refresh it redoes only the forms that went stale or are still blank. Never rewrites a section a person wrote, never merges. Triggers on "terraform this repository", "fill the forms", "fill the playbook", "refresh the playbook", "/omni:terraform".
---

# Terraform: fill the forms from evidence

The playbook holds one **form** per question an agent asks while delivering: how to set up, test and
verify, how CI works, what a pull request looks like, where the decision records live. `omni kb init`
lays the forms down blank, and a blank section reads as the kit's default. This skill fills them
with what only this repository knows, in seven steps, and ends at a review gate: one docs-only pull
request that a person reads, answers and merges.

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your session requires,
then the line `omni sign trailer` prints, directly under it so both stay in the trailer block. Every
pull request or issue it opens ends its body with the line `omni sign footer` prints, as a paragraph
of its own just above your session's own attribution lines, and a body it rewrites keeps that line.
Comments are never signed. A command that prints nothing means signing is off here: add nothing.

**Evidence or nothing.** A section says only what a file in the tree shows, every command it names
ran green first, and whatever the evidence cannot show becomes a question for a person. A wrong
claim is worse than an honest hole.

## Input

| input | notes |
|---|---|
| none | fill every form: the first run, or a run after a large change |
| `--refresh` | redo only the forms `omni kb status` reports stale or blank (see **--refresh**) |

## A form, read and written

The skills never read a form's file: they call `omni kb show <form>`, which resolves each section
from three layers, top wins, and labels where it came from: a pointer (`[→ <path>]`), then the
repository's section (`[repo]`, `[repo · by human]`, `[repo · verified <date>]`), then the kit
default (`[kit default]`; `[hole]` when the section holds only questions). You write the middle
layer, and the pointers. The kit defaults stay in the kit: never copy their text into a form.

A form file, as this skill leaves it:

```markdown
---
form: testing
form-version: 1
state: filled
points-to: null
evidence:
  - <path>@<first 7 hex of git hash-object>
terraformed: <YYYY-MM-DD>
---

# Testing

Use this page when adding, changing, or choosing tests.

## Commands
<!-- slot: commands · required · by: terraform · verified: <YYYY-MM-DD> -->
| What | Command |
|---|---|
| everything | `<a command that ran green>` |

## Where tests live
<!-- slot: layout · required · by: terraform -->
<what the tree shows>

## Choosing the level
<!-- slot: levels · optional -->

## Never
<!-- slot: never · required · by: human -->
<a person's text: never rewritten>

## Test data
<!-- slot: data · optional -->
TODO(human): <a question a person can answer in one line>
```

- **Front matter:** exactly `form`, `form-version`, `state` (`blank`, `filled` or `pointer`),
  `points-to` (a path on a pointer form, `null` otherwise), `evidence` (a list, `[]` when empty),
  `terraformed` (a date, or `null`), and, on a pointer form only, an optional `index`. No other key:
  `omni check kb` fails on one. Keep `form` and `form-version` as `omni kb init` wrote them.
- **Title and opener** stay as written: the `#` title, then the "Use this page when …" line.
- **Slots** keep the template's headings, ids, `required` or `optional`, and order. Never add,
  rename, reorder or drop one. A marker gains ` · by: terraform` when you write the section, then
  ` · verified: <date>` when it names a command: in that order.
- **A body** is one of four things: repository text; a single `See: <path>[#anchor]` line; empty;
  or `TODO(human): <question>` lines. Text beside a question reads as text, and the question is still
  counted.

## Whose section it is

A section is this skill's to write only when it is **empty**, holds **nothing but `TODO(human)`
lines**, or its marker says **`by: terraform`**. Every other section is a person's: `by: human`, and
also text or a `See:` line whose marker has no `by:`. **Never rewrite a `by: human` section**, nor
any other section that is a person's, on any run, with or without `--refresh`: not its body, not its
marker, and never by turning its form into a pointer. When the evidence contradicts one, keep it as
written and say so under **Reviewer focus** in the pull request.

## Step 0: installed, on its branch, the forms laid down

1. Run `node .omni-loop/bin/omni.mjs config`. If it fails, stop and say so in one line: the
   repository is not installed, and the kit's one-line install, `omni init`, comes first (it writes
   the config, the bin and the blank forms); then run `/omni:terraform` again. Keep the JSON; later
   steps read `repo.*`, `branches.terraform`, `worktrees`, `paths.*`, `commands.*` and `ci.*` from
   it. `<remote>` below is `repo.remote`, `<terraform branch>` is `branches.terraform`, and `<today>`
   is `date -u +%F`.
2. **The branch.** `git fetch <remote>`, then look for a pull request an earlier run left open:
   `gh pr list --head <terraform branch> --base <repo.defaultBranch> --state open --json number,url`.
   - **One is open:** continue it, so there is still one pull request:
     `git worktree add -B <terraform branch> <worktrees>/terraform <remote>/<terraform branch>`.
   - **None is open:** start from today's default branch, whatever a merged or closed run left
     under that name:
     `git worktree add -B <terraform branch> <worktrees>/terraform <remote>/<repo.defaultBranch>`.

   Every step below works in that worktree. Never commit on the default branch.
3. Run `node .omni-loop/bin/omni.mjs kb init`, for a repository installed before the forms existed.
   It writes every missing form blank from the kit's template (the decisions form as a pointer when
   `paths.adr` is outside the front door's `adr/`, the glossary form as one when `paths.glossary` is
   set), the front door's `README.md` (the front door is the parent of `paths.playbook`), and the
   three empty `product/` registers when the front door holds the registers and they are missing.
   It prints one `wrote <path>` line per file,
   then `kb init — wrote <n> file(s); <m> already there, left as they were.` It never changes a file
   that exists.
4. Run `node .omni-loop/bin/omni.mjs kb status --json` and keep it: the map, derived every time.

   ```text
   { frontDoor, forms: [{ form, kind, file, state, source, sections: [{ slot, source }],
     questions: [{ slot, question }], stale: [{ path, hash, now }] }] }
   ```

   `kind` is `core` or `extended`; `state` is the form's own (`blank`, `filled`, `pointer`), or
   `invalid` when its file does not parse; `source` is `repo`, `pointer` or `kit`; `stale` lists each
   evidence file that is gone (`now: null`) or changed since it was recorded. `file` is each form's
   path: read it from here, never build it. An `invalid` form: run
   `node .omni-loop/bin/omni.mjs check kb`, which names the fault, and fix only that (the front matter
   or a marker), keeping every body as written.

With `--refresh`, pick the forms now (see **--refresh**); the steps below run on those alone.

## 1. Survey, read-only

Read everything a form could be filled from. This step writes nothing and runs nothing but reads.

- **The tree:** `git ls-files`, so ignored and generated files (dependencies, build output) never
  count as evidence.
- **Every Markdown page:** `git ls-files '*.md' '*.mdx'`; read each page's first `#` heading, and in
  full every page whose name or heading answers a form's question. **Candidate pages are found by
  name, anywhere in the tree, never at a fixed path:** a folder named `adr`, `adrs` or `decisions`
  holds decision records; a page named or titled like a glossary, a contributing guide, a testing or
  release guide answers that form.
- **What each form reads:**

  | Form | Its question | What answers it |
  |---|---|---|
  | briefing | What costs the most when broken? | the "never" lines of `CLAUDE.md` or `AGENTS.md`, the README's warnings, git hooks |
  | setup | How do I run it locally? | engines, version files (`.nvmrc`, `.tool-versions`), the lockfile, the README, compose files, example env files |
  | architecture | Where may code go, and what may depend on what? | workspace globs, the folder tree, lint and dependency rules, `CLAUDE.md` or `AGENTS.md` |
  | testing | How do I test? | the test runner's config, test scripts, test file globs, CI test jobs |
  | verification | What must be green before a pull request, and before a push? | the preflight, lint and typecheck scripts, git hooks, staged-file linters |
  | ci | How does CI work, and what does a red check mean? | the CI workflow files and their triggers, jobs and checks, the required checks, an aggregate job, checks an app posts |
  | pull-requests | What does a pull request look like here? | a pull request template, labels, `CODEOWNERS`, commit lint config |
  | decisions | Where are the decision records, and how is a new one written? | a folder named `adr`, `adrs` or `decisions` |
  | definition-of-done | When is the work done? | the template's checkboxes, a contributing guide |
  | conventions | Naming, formatting, commit shape? | formatter and linter config, commit lint config, `git log --format=%s -n 50` |
  | releasing | What does a merge publish? | release and deploy workflows, changesets, tags |
  | bug-fixing | How does a bug become a pull request? | issue templates, bug labels |
  | glossary | Which words mean what? | a glossary page (pointer only) |

  A template, `CODEOWNERS` or a hooks folder is found by its name, in any of the places the tool
  that reads it looks, and in any letter case.
- **From GitHub, read-only:** `gh label list --json name,description`; the checks the default
  branch requires, from its rulesets (`gh api "repos/$REPO/rules/branches/<repo.defaultBranch>"`) and
  its protection (`gh api "repos/$REPO/branches/<repo.defaultBranch>/protection/required_status_checks"`),
  where `REPO` is `repo.slug` (`{owner}/{repo}` when it prints null). A 403 or 404 means none, or
  none you may read: the gating section asks.
- **What each form says today:** `node .omni-loop/bin/omni.mjs kb show <form>` for every form. A
  blank form shows the kit default of each section; a section whose kit default is already true here
  needs nothing from you.

Note, per form: the page that answers it (if any), each fact with the file it came from, each
command to run, and each question left.

## 2. Point before writing

A page that already answers a question is pointed at, never copied, so it keeps one source.

- **A page answers the whole form:** the form becomes a pointer: `state: pointer`,
  `points-to: <the page>`, or a folder with `index: <the page to read first>` when it has one;
  `evidence:` the page (or the index) at its hash; `terraformed: <today>`. Its body is the title and
  the opener alone: a pointer form holds no sections.

  ```markdown
  ---
  form: decisions
  form-version: 1
  state: pointer
  points-to: <the folder>
  index: <the page to read first in it>
  evidence:
    - <the index page>@<hex>
  terraformed: <YYYY-MM-DD>
  ---

  # Decision records

  Use this page when recording a decision about how this repository is built, or looking one up.
  ```

- **A page answers one section:** its body is one line, `See: <path>` or `See: <path>#<anchor>`,
  the anchor as GitHub derives it from the heading, and its marker says `by: terraform`. The page
  goes under `evidence:`.
- **The decisions form:** records in a folder outside the front door's `adr/` make it a pointer to
  that folder, and step 5 proposes `paths.adr`. Records in the front door's `adr/` keep it a form:
  the kit default already names the folder, so fill only what differs, such as a record format of
  their own.
- **The glossary form** is only ever a pointer: to a glossary page when the tree has one (step 5
  proposes `paths.glossary`), else it stays blank.
- A form holding a person's section is never made a pointer: point its other sections one by one.
- A pointer names a tracked repository path, never a URL. `omni check kb` fails on a path that does
  not exist.

## 3. Fill from evidence

- **Only what differs from the kit default.** What `omni kb show <form>` already prints as the kit
  default is not written again: that section stays empty, and a kit upgrade keeps improving it.
- **Evidence.** Every file a filled or pointed section was written from is listed under
  `evidence:`, as `<path>@<hex>`: the path from the repository's root, and the first 7 hex of its
  `git hash-object`. Files only, never a folder, and never a file this pull request changes (a form,
  the config), whose hash would be stale on merge.

  ```bash
  printf '  - %s@%s\n' "<path>" "$(git hash-object -- "<path>" | cut -c1-7)"
  ```

- **Commands.** Every command a section names runs once, from the worktree's root, before it is
  written, and is written only when it exits `0`. That section's marker then carries
  `verified: <today>`. A command that fails is not written: step 4 asks about it, and step 5 may
  propose another. Install the dependencies the way the setup form says before the first test.
  - Run only commands that check or build: install, build, test, lint, typecheck, the preflight.
    Never run one that deploys, publishes, releases, migrates a shared database or writes to a shared
    environment. Such a command is never written as verified: point at where it is defined
    (`See: <the workflow file>`), or ask.
  - A command that changes tracked files (a formatter, a code generator) leaves the tree as it found
    it: before you go on, `git status --porcelain` shows only the files this run wrote;
    `git restore <path>` the rest.
  - A command that runs longer than a few minutes runs in the background (Bash
    `run_in_background: true`); act when it wakes you.
- **Front matter.** A form whose sections hold any text, `See:` line or question is
  `state: filled`, with `terraformed: <today>`. A form left wholly empty stays `state: blank`,
  `evidence: []`, `terraformed: null`.
- **Core forms:** each required slot of a core form ends filled, pointed or holding a question.
  An optional slot, or any slot of an extended form, stays empty when the kit default is true here.
- **After each form,** run `node .omni-loop/bin/omni.mjs kb show <form>`: every section carries the
  label you meant, and no `warning:` line reaches stderr.

## 4. Leave holes

What the evidence cannot show becomes a question, never a guess.

- One `TODO(human): <question>` line per question, in the section it belongs to. Its marker gains no
  `by:`: the person who answers it marks it `by: human`.
- A section holding only questions reads `[hole]`: the kit default applies meanwhile, so a hole never
  blocks delivery. A section may hold proven text and a question side by side; it then reads as the
  repository's text, and the question still counts.
- A question says what you read and what you could not tell, so a person answers it in one line:
  "TODO(human): no workflow runs the tests on a pull request. Is that intended?"
- A command that did not run green is a question naming the command and how it failed.

## 5. Propose config, as a diff

`omni init` already detected `commands.*`. Run each command the config sets (as in step 3), and
propose a change only for a key that is `null` or does not run green; an empty `commands.checks`
counts as unset. Then the keys the survey can settle:

| key | proposed when |
|---|---|
| `commands.test`, `commands.preflight`, `commands.preflightFull` | unset or red: the command the evidence shows, once it ran green |
| `commands.checks` | empty: the checks CI gates on (lint, typecheck…) that run green here and the preflight does not already run |
| `paths.adr` | the decision records live in a folder outside the front door's `adr/` |
| `paths.glossary` | the tree holds a glossary page |
| `paths.context` | its list names a missing file, or misses a `CLAUDE.md` or `AGENTS.md` the tree holds: the files that exist, `[]` when none |
| `ci.aggregateCheck` | one check gates a merge for the others: a required check, or the job every other job feeds |

Nothing else in the config is proposed. A command for which nothing runs green keeps its value, and
the verification form asks. Edit the config file (`.omni-loop/config.yml`), then run
`node .omni-loop/bin/omni.mjs config`: it must still print. The config change is **its own commit**,
so the pull request's diff is the proposal and a person can drop it alone. A key that turns
`omni check all` red is left out, and named in the body.

## 6. One docs-only pull request

1. **Docs-only.** `git diff --name-only <remote>/<repo.defaultBranch>...HEAD` names only files
   under the front door and the config file. Anything else leaves the branch.
2. **Checks.** `node .omni-loop/bin/omni.mjs check kb` exits `0`: no error, and one warning per
   question (a blank required slot of a core form would warn too, and should not remain). Fix every
   error it names. Then `node .omni-loop/bin/omni.mjs check all`, green.
3. **Commits,** Conventional Commits, each ending with the co-author trailer your session requires,
   then the `omni sign trailer` line:
   the forms as `docs(knowledge): fill the playbook forms from evidence` (with `--refresh`:
   `docs(knowledge): refresh the stale playbook forms`), the config as
   `chore(config): <what the survey learned>`.
4. **Push:** `git push -u <remote> <terraform branch>`. When step 0 started from the default branch
   over an older branch of that name, add `--force-with-lease`; never force a branch whose pull
   request is open.
5. **Open it through `/omni:pr`'s lifecycle, as a standalone PR:** base `repo.defaultBranch`, head
   the terraform branch, no kind label, a Conventional Commits title
   (`docs(knowledge): terraform the playbook forms`). When a run continues an open pull request,
   rewrite its body instead. The body starts with these lines, above the repository's pull request
   template when it has one (fill it with the same evidence), else followed by Summary, Verified,
   Risk and rollback, and Reviewer focus; either way it ends with the `omni sign footer` line:

   ````markdown
   ## Forms

   ```text
   <the output of omni kb status>
   ```

   ## Open questions

   - [ ] `<form>#<slot>` — <question> (`<file>`)

   ## Config

   - `<key>`: `<old>` → `<new>`, because <the file that shows it>
   ````

   **Every hole is a checkbox**, one per entry in `questions` of
   `node .omni-loop/bin/omni.mjs kb status --json`, never typed from memory; "none" when there are
   none. Say how to answer one: replace the `TODO(human)` line with the answer, add ` · by: human` to
   the section's marker, and tick the box. **Verified** lists each command run and its result, and
   the `omni check kb` and `omni check all` lines. **Reviewer focus** names the claims most worth
   checking, and every person's section the evidence contradicts.
6. `/omni:pr` watches it to green. **A person merges it.** Never merge it, and never push to the
   default branch.

## --refresh

`/omni:terraform --refresh` **redoes only the forms `omni kb status` reports stale or blank**: in
the map from step 0, a form whose `state` is `blank`, or whose `stale` list is not empty. Every
other form is left as it is, whatever the survey finds.

- For each form picked, steps 1 to 4 run on its question alone, and write only the sections this
  skill owns (**Whose section it is**). A `by: human` section is never rewritten.
- Its `evidence:` is rewritten: the files its sections were written from, hashed again. A file that
  is gone leaves the list (`omni check kb` fails on it), and what it proved is proved again or asked.
- Step 5 proposes only what a redone form's evidence changed. Step 6 is unchanged: the same branch,
  one pull request.
- Nothing stale and nothing blank: say so, and open nothing.

## Hand off

Report the pull request, the `omni kb status` map, the number of open questions, the config keys
proposed, each command run with its result, and every check that ran or did not.

## Guardrails

- Evidence or nothing: no claim without its file, no command that did not run green, no guess where
  a question belongs.
- Writes only under the front door and the config file: never a `CLAUDE.md`, a README, a workflow or
  source code.
- Never rewrites a `by: human` section, nor any section a person wrote.
- Never copies a kit default into a form, and never copies a page a pointer can name.
- Never merges, never pushes to the default branch, never adds `labels.outboxGo`.
