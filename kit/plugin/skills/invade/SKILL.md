---
name: invade
description: Set up a repository's knowledge base from what the repository can prove — explore it read-only in four facets (its domains, the truth it writes down, the truth its code enforces, its decisions and words), show one map and take every answer in one message, then write proposed register entries (an index entry pointing at each rule a page already states, a drafted entry for each truth only the code enforces), fill the playbook forms from evidence with every command run green, leave an honest TODO(human) question where proof is missing, propose the config the exploration learned — and end with one docs-only pull request a person merges. Every entry it writes is proposed, never a law until a person confirms it. With --refresh it redoes only what went stale. Never rewrites what a person wrote, never merges. Triggers on "invade this repository", "set up the knowledge base", "fill the forms", "fill the playbook", "refresh the playbook", "/omni:invade".
---

# Invade: explore a repository, set up its knowledge base

The knowledge base has two halves. The **registers** hold what is true about the product:
principles (`P-`), business rules (`BR-`) and invariants (`N-`), each with an id the loop cites. The
**playbook** holds one **form** per question an agent asks while delivering: how to set up, test and
verify, how CI works, what a pull request looks like, where the decision records live. `omni kb init`
lays the forms down blank and the registers empty; a blank section reads as the kit default, and an
empty register binds nothing. This skill fills both with what only this repository knows, and ends
at a review gate: one docs-only pull request that a person reads, answers and merges.

In order: step 0; **explore** (1); show **one map** and wait for the answer (2); **write the
registers** (3); fill the playbook — point before writing (4), fill from evidence (5), leave holes
(6); **propose config** (7); **one pull request** (8).

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your session requires,
then the line `omni sign trailer` prints as the message's last line, with no blank line between
them. Every pull request or issue it opens ends its body with the line `omni sign footer` prints, as
a paragraph of its own just above your session's own attribution lines, and a body it rewrites keeps
that line. Comments are never signed. A command that prints nothing means signing is off here: add
nothing.

**Evidence or nothing.** A section or an entry says only what a file in the tree shows, every command
it names ran green first, and whatever the evidence cannot show becomes a question for a person. A
wrong claim is worse than an honest hole.

**Proposed, never a law.** Every register entry this skill writes carries `Proposed: invade <today>`.
A proposed entry resolves (an outbox item may name it in `bearsOn`), but it floors nothing and never
stops a slice. It becomes a law only when a person deletes its `Proposed:` line (and, on a principle,
adds `Decided:`). Merging this skill's pull request confirms nothing.

## Input

| input | notes |
|---|---|
| none | explore everything, write the registers and fill every form: the first run, or a run after a large change |
| `--refresh` | re-run only the facets whose sources changed, and redo only the forms `omni kb status` reports stale or blank (see **--refresh**) |

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
invaded: <YYYY-MM-DD>
---

# Testing

Use this page when adding, changing, or choosing tests.

## Commands
<!-- slot: commands · required · by: invade · verified: <YYYY-MM-DD> -->
| What | Command |
|---|---|
| everything | `<a command that ran green>` |

## Where tests live
<!-- slot: layout · required · by: invade -->
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
  `invaded` (a date, or `null`), and, on a pointer form only, an optional `index`. No other key:
  `omni check kb` fails on one. Keep `form` and `form-version` as `omni kb init` wrote them.
- **Title and opener** stay as written: the `#` title, then the "Use this page when …" line.
- **Slots** keep the template's headings, ids, `required` or `optional`, and order. Never add,
  rename, reorder or drop one. A marker gains ` · by: invade` when you write the section, then
  ` · verified: <date>` when it names a command: in that order.
- **A body** is one of four things: repository text; a single `See: <path>[#anchor]` line; empty;
  or `TODO(human): <question>` lines. Text beside a question reads as text, and the question is still
  counted.

## A register entry, read and written

The registers live under `paths.knowledge`: `product/`, one `domains/<domain>/` folder per domain
(its **code** is the folder name uppercased, hyphens removed: `agent-session` is `AGENTSESSION`), and
`cross-domain/<a>--<b>.md`. Each product and domain folder holds `principles.md`, `rules.md` and
`invariants.md`; a domain folder also a `README.md` with a `Glossary term:` line. An entry is a
`## <id>` heading, a one-line statement, then its field lines. Read one with
`node .omni-loop/bin/omni.mjs knowledge <id>`; never parse the files yourself.

Two kinds of entry come out of this skill, and both are proposed:

- **An index entry** points at a rule, principle or invariant a page in the repository already
  states. Its statement is one line; `Source: <path>#<anchor>` names the heading the rule sits under,
  the anchor as GitHub derives it. The page stays the full text, and the entry is only the id the
  loop cites: never copy the page's prose into the register.
- **A drafted entry** states a truth the code enforces and no page states. An invariant, or a rule
  (with the principle it serves when none fits), each with `Enforced by: <the file that proves it>`.
  Its `Source:` is that file too. A drafted principle's `Why:` says what in the code suggests it.

```markdown
## BR-QUOTE-1
A quote expires 30 days after it is sent.
Serves: P-QUOTE-1
Source: handbook/business-rules.md#quote-expiry
Enforced by: tests/Quote/ExpiryTest.php
Stated: <today>
Proposed: invade <today>
```

- **The lines each kind needs**, as `omni check knowledge` grades them: a principle `Why:` and
  `Source:`, never `Enforced by:` (a proposed principle goes without `Decided:`); a rule one
  `Serves:` naming a principle that exists, `Source:`, `Enforced by:` and `Stated: <today>`; an
  invariant the same without `Serves:`. A rule an index entry points at that nothing in the code
  proves says `Enforced by: unenforced`: an honest gap, never an invented file.
- **Every entry** ends with `Proposed: invade <today>`.
- **Ids number on** from the highest id of that kind and code already in the file: after
  `BR-QUOTE-3`, the next is `BR-QUOTE-4`, never a reused or a skipped number.
- **Never a duplicate:** an entry that says what one already in the registers says is not written.
- **Never a person's entry:** an entry without a `Proposed: invade` line was confirmed or written by
  a person. Never change it, on any run: not its statement, not a field, not its id.

## Whose section it is

A section is this skill's to write only when it is **empty**, holds **nothing but `TODO(human)`
lines**, or its marker says **`by: invade`**. Every other section is a person's: `by: human`, and
also text or a `See:` line whose marker has no `by:`. **Never rewrite a `by: human` section**, nor
any other section that is a person's, on any run, with or without `--refresh`: not its body, not its
marker, and never by turning its form into a pointer. When the evidence contradicts one, keep it as
written and say so under **Reviewer focus** in the pull request.

The same holds for the registers: an entry is this skill's only while it carries
`Proposed: invade`; every other entry is a person's (see **A register entry, read and written**).

## Step 0: installed, on its branch, the forms laid down

1. Run `node .omni-loop/bin/omni.mjs config`. If it fails, stop and say so in one line: the
   repository is not installed, and the kit's one-line install, `omni init`, comes first (it writes
   the config, the bin and the blank forms); then run `/omni:invade` again. Keep the JSON; later
   steps read `repo.*`, `branches.invade`, `worktrees`, `paths.*`, `commands.*`, `ci.*` and
   `laws.source` from it. `<remote>` below is `repo.remote`, `<invade branch>` is `branches.invade`, and `<today>`
   is `date -u +%F`.
2. **The branch.** `git fetch <remote>`, then look for a pull request an earlier run left open:
   `gh pr list --head <invade branch> --base <repo.defaultBranch> --state open --json number,url`.
   - **One is open:** continue it, so there is still one pull request:
     `git worktree add -B <invade branch> <worktrees>/invade <remote>/<invade branch>`.
   - **None is open:** start from today's default branch, whatever a merged or closed run left
     under that name:
     `git worktree add -B <invade branch> <worktrees>/invade <remote>/<repo.defaultBranch>`.

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
     questions: [{ slot, question }], stale: [{ path, hash, now }] }],
     registers: [{ folder, laws, proposals }] }
   ```

   `kind` is `core` or `extended`; `state` is the form's own (`blank`, `filled`, `pointer`), or
   `invalid` when its file does not parse; `source` is `repo`, `pointer` or `kit`; `stale` lists each
   evidence file that is gone (`now: null`) or changed since it was recorded. `file` is each form's
   path: read it from here, never build it. An `invalid` form: run
   `node .omni-loop/bin/omni.mjs check kb`, which names the fault, and fix only that (the front matter
   or a marker), keeping every body as written. `registers` counts, per register folder, the
   entries that are laws and the ones still proposed.

With `--refresh`, pick the facets and the forms now (see **--refresh**); the steps below run on
those alone.

## 1. Explore: four facets, read-only

Four read-only subagents run at once, one per **facet**. Each reads, writes nothing, runs nothing but
reads, and returns a **short report** (what it found, each item with the file that shows it, and what
it could not tell), never file dumps. Give each its facet below, `repo.*` and `paths.*` from the
config, and these rules:

- **The tree** is `git ls-files`, so ignored and generated files (dependencies, build output) never
  count as evidence.
- **Pages are found by name and by content, anywhere in the tree, never at a fixed path:**
  `git ls-files '*.md' '*.mdx'`, each page's first `#` heading, and in full every page whose name,
  heading or text answers the facet's question.
- Nothing under `paths.knowledge` is a finding: it is what this run writes.

The facets:

1. **Domains.** The repository's domains and their boundaries: workspace packages, modules, bounded
   contexts, top-level source folders, the names the code and the README give its parts. Report each
   domain with its folder name (lowercase, hyphenated), the code it would get, and the paths it owns.
   Each becomes a proposed `domains/<domain>/` folder; what belongs to no one domain goes to
   `product/`.
2. **Written truth.** Every page that states a principle, a business rule or an invariant: rule
   pages, specs, READMEs, domain docs. Report each statement in one line, its kind, its domain, and
   the page and heading it sits under, as `<path>#<anchor>`.
3. **Enforced truth.** What the code proves: tests whose names state a rule, database constraints
   and migrations, schemas, validation, types that refuse a state. Report each truth in one line, its
   kind, its domain and the file that enforces it, and which written-truth statement it proves when
   the report can tell.
4. **Decisions and words.** Decision-record folders (`adr`, `adrs` or `decisions`, found by name),
   glossaries, agent context files (`CLAUDE.md`, `AGENTS.md`, `CONTEXT.md`), and everything the
   playbook forms read: this facet is also the playbook survey. A page named or titled like a
   glossary, a contributing guide, a testing or release guide answers that form.

**What each form reads** (facet 4):

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
that reads it looks, and in any letter case. Facet 4 also reads:

- **From GitHub, read-only:** `gh label list --json name,description`; the checks the default
  branch requires, from its rulesets (`gh api "repos/$REPO/rules/branches/<repo.defaultBranch>"`) and
  its protection (`gh api "repos/$REPO/branches/<repo.defaultBranch>/protection/required_status_checks"`),
  where `REPO` is `repo.slug` (`{owner}/{repo}` when it prints null). A 403 or 404 means none, or
  none you may read: the gating section asks.
- **What each form says today:** `node .omni-loop/bin/omni.mjs kb show <form>` for every form. A
  blank form shows the kit default of each section; a section whose kit default is already true here
  needs nothing from you.

Its report notes, per form: the page that answers it (if any), each fact with the file it came
from, each command to run, and each question left.

## 2. The map: one checkpoint

The one place this skill asks. From the four reports, print **one map** in chat: the domains; every
source found (each truth page, the decision-record folder, each form's page), each with its default;
and how many register entries each would produce. Then ask, as **one numbered list**:

| # | the question | its default |
|---|---|---|
| each **domain** | keep, rename or drop | keep, under the name the domains facet reported |
| each **truth page** | **index** it (one index entry per statement it holds) or **context only** (added to `paths.context`, no ids) | index |
| the **decision-record folder**, when it is outside the front door's `adr/` | **point** at it (`paths.adr` names it, the decisions form is a pointer) or **repatriate** it (copied into the front door's `adr/`, `paths.adr` left there, the originals never deleted) | point |
| **drafting from code** | on (one drafted entry per truth the code enforces and no page states) or off | on |

Say under each default what it produces ("index: 12 entries in `domains/quote/rules.md`"), so a
person sees the size of the proposal before anything is written.

The person answers in **one message**. **Nothing is written before that answer:** no register, no
form, no config. A reply that changes a default is taken as said; an item the reply does not mention
takes its default. A reply that is not an answer (a question back, "wait") is answered in one line and
the list asked again; nothing else happens meanwhile.

## 3. Write the registers

From the map as answered (see **A register entry, read and written** for the shape of each entry):

1. **Folders.** Each kept domain gets `domains/<domain>/` with its three layer files and a
   `README.md`: a `#` title, a `Glossary term: <the domain's word>` line (a word the glossary holds,
   when `paths.glossary` is set), and an `## Owning libraries` list of the paths the domains facet
   gave it. `product/` already exists (`omni kb init` wrote it). A domain renamed takes the new
   name; a domain dropped gets no folder, and its truths go to `product/`.
2. **Index entries.** One per principle, rule or invariant stated in each page answered **index**,
   in its domain's folder, with `Source: <path>#<anchor>`. A rule the enforced-truth facet ties to a
   file carries it as `Enforced by:`; else `Enforced by: unenforced`. A rule no principle fits gets
   one, proposed too, whose `Why:` says which page suggests it.
3. **Drafted entries,** only when drafting is on: one per truth the code enforces that no page
   states, an invariant or a rule with `Enforced by: <the file>`, plus the principle it serves when
   none fits. A drafted principle's `Why:` says what in the code suggests it.
4. **Every entry:** `Stated: <today>` where its kind needs one, and `Proposed: invade <today>`; ids
   numbering on from the file's highest; never a duplicate of an entry already there; never a change
   to an entry a person wrote.
5. **Decision records repatriated:** copy each file of the folder into the front door's `adr/`, keeping
   its name and text. Never delete, move or edit an original: that is outside the front door and a
   person's call.
6. **Check:** `node .omni-loop/bin/omni.mjs check knowledge` exits `0`: no error, and one warning per
   proposed entry. Fix every error it names in the entries this run wrote: a `Source:` whose file or
   anchor does not exist, an id out of shape, a rule serving a principle that is not there. An entry
   that cannot be made honest is left out and named under **Reviewer focus**.

Commit the registers as their own commit, so a person can drop them alone:
`docs(knowledge): propose register entries from the repository`.

## 4. Point before writing

A page that already answers a question is pointed at, never copied, so it keeps one source.

- **A page answers the whole form:** the form becomes a pointer: `state: pointer`,
  `points-to: <the page>`, or a folder with `index: <the page to read first>` when it has one;
  `evidence:` the page (or the index) at its hash; `invaded: <today>`. Its body is the title and
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
  invaded: <YYYY-MM-DD>
  ---

  # Decision records

  Use this page when recording a decision about how this repository is built, or looking one up.
  ```

- **A page answers one section:** its body is one line, `See: <path>` or `See: <path>#<anchor>`,
  the anchor as GitHub derives it from the heading, and its marker says `by: invade`. The page
  goes under `evidence:`.
- **The decisions form** follows the map. Records in a folder outside the front door's `adr/`,
  answered **point**, make it a pointer to that folder, and step 7 proposes `paths.adr`. Answered
  **repatriate**, or already in the front door's `adr/`, the records are there, so it stays a form:
  the kit default already names the folder, so fill only what differs, such as a record format of
  their own.
- **The glossary form** is only ever a pointer: to a glossary page when the tree has one (step 7
  proposes `paths.glossary`), else it stays blank.
- A form holding a person's section is never made a pointer: point its other sections one by one.
- A pointer names a tracked repository path, never a URL. `omni check kb` fails on a path that does
  not exist.

## 5. Fill from evidence

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
  `verified: <today>`. A command that fails is not written: step 6 asks about it, and step 7 may
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
  `state: filled`, with `invaded: <today>`. A form left wholly empty stays `state: blank`,
  `evidence: []`, `invaded: null`.
- **Core forms:** each required slot of a core form ends filled, pointed or holding a question.
  An optional slot, or any slot of an extended form, stays empty when the kit default is true here.
- **After each form,** run `node .omni-loop/bin/omni.mjs kb show <form>`: every section carries the
  label you meant, and no `warning:` line reaches stderr.

## 6. Leave holes

What the evidence cannot show becomes a question, never a guess.

- One `TODO(human): <question>` line per question, in the section it belongs to. Its marker gains no
  `by:`: the person who answers it marks it `by: human`.
- A section holding only questions reads `[hole]`: the kit default applies meanwhile, so a hole never
  blocks delivery. A section may hold proven text and a question side by side; it then reads as the
  repository's text, and the question still counts.
- A question says what you read and what you could not tell, so a person answers it in one line:
  "TODO(human): no workflow runs the tests on a pull request. Is that intended?"
- A command that did not run green is a question naming the command and how it failed.

## 7. Propose config, as a diff

`omni init` already detected `commands.*`. Run each command the config sets (as in step 5), and
propose a change only for a key that is `null` or does not run green; an empty `commands.checks`
counts as unset. Then the keys the exploration and the map settle:

| key | proposed when |
|---|---|
| `commands.test`, `commands.preflight`, `commands.preflightFull` | unset or red: the command the evidence shows, once it ran green |
| `commands.checks` | empty: the checks CI gates on (lint, typecheck…) that run green here and the preflight does not already run |
| `paths.adr` | from the map: the folder the decision records live in, when it was answered **point**; left on the front door's `adr/` when it was answered **repatriate** |
| `paths.glossary` | the tree holds a glossary page |
| `paths.context` | its list names a missing file, misses a `CLAUDE.md` or `AGENTS.md` the tree holds, or misses a page the map answered **context only**: the files that exist, `[]` when none |
| `laws.source` | `knowledge`, whenever the registers hold at least one entry. Safe while every entry is proposed, since a proposed entry floors nothing; each confirmation then takes effect at once |
| `ci.aggregateCheck` | one check gates a merge for the others: a required check, or the job every other job feeds |
| `proof.url` | Playwright is among the dependencies and the repository has a preview deploy: `github-deployment` when its pull requests carry GitHub deployments (a Vercel project does), a fixed URL only when the evidence names one |
| `proof.setup` | `proof.url` is proposed: `omni proof session` when the app signs in through the same server as `ask.url`, else the tests' own sign-in helper when they have one, as the command that writes a Playwright storageState to `PROOF_STORAGE_STATE` |

`proof.bypassEnv` is proposed by its name only, the environment variable a person fills, never its value.
Nothing else in the config is proposed. A command for which nothing runs green keeps its value, and
the verification form asks. Edit the config file (`.omni-loop/config.yml`), then run
`node .omni-loop/bin/omni.mjs config`: it must still print. The config change is **its own commit**,
so the pull request's diff is the proposal and a person can drop it alone. A key that turns
`omni check all` red is left out, and named in the body.

## 8. One docs-only pull request

1. **Docs-only.** `git diff --name-only <remote>/<repo.defaultBranch>...HEAD` names only files
   under the front door (the registers, the forms, repatriated records) and the config file.
   Anything else leaves the branch.
2. **Checks,** all green before the pull request is opened (warnings allowed):
   `node .omni-loop/bin/omni.mjs check knowledge` exits `0`, with one warning per proposed entry;
   `node .omni-loop/bin/omni.mjs check kb` exits `0`: no error, and one warning per question (a blank
   required slot of a core form would warn too, and should not remain). Fix every error either
   names. Then `node .omni-loop/bin/omni.mjs check all`, green.
3. **Commits,** Conventional Commits, each ending with the co-author trailer your session requires,
   then the `omni sign trailer` line:
   the registers as step 3 names them, the forms as
   `docs(knowledge): fill the playbook forms from evidence` (with `--refresh`:
   `docs(knowledge): refresh the stale playbook forms`), the config as
   `chore(config): <what the exploration learned>`.
4. **Push:** `git push -u <remote> <invade branch>`. When step 0 started from the default branch
   over an older branch of that name, add `--force-with-lease`; never force a branch whose pull
   request is open.
5. **Open it through `/omni:pr`'s lifecycle, as a standalone PR:** base `repo.defaultBranch`, head
   the invade branch, no kind label, a Conventional Commits title
   (`docs(knowledge): invade — set up the knowledge base`). When a run continues an open pull
   request, rewrite its body instead. The body starts with these lines, above the repository's pull
   request template when it has one (fill it with the same evidence), else followed by Summary,
   Verified, Risk and rollback, and Reviewer focus; either way it ends with the `omni sign footer`
   line:

   ````markdown
   ## Map, as answered

   1. domain `<name>`: kept | renamed `<new>` | dropped
   2. `<page>`: indexed | context only
   3. `<decision-record folder>`: pointed | repatriated
   4. drafting from code: on | off

   ## Proposed entries

   | Register file | Proposed |
   |---|---|
   | `<path>` | <n> |

   None is a law yet. To confirm one, delete its `Proposed:` line (on a principle, also add a
   `Decided:` line saying who decided it and when), in this pull request or any later one. Merging
   confirms nothing.

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

`/omni:invade --refresh` redoes only what changed since the last invade.

- **The last invade** is the newest commit on `<remote>/<repo.defaultBranch>` that touched the front
  door with `invade` in its subject:
  `git log -1 --format=%H --grep=invade <remote>/<repo.defaultBranch> -- <the front door>`.
  None found: there is nothing to refresh from; run `/omni:invade` without `--refresh`.
- **Facets.** `git diff --name-only <that commit> <remote>/<repo.defaultBranch>` lists what changed.
  Re-run only the facets whose sources are in it: **domains** when a top-level folder, a workspace
  package or a manifest was added, removed or renamed; **written truth** when a Markdown page
  changed; **enforced truth** when a test, a schema, a migration or a file an `Enforced by:` line
  names changed; **decisions and words** when a record, a glossary, a context file or a form's
  evidence changed. No facet re-runs: no map is asked, and no register is touched.
- **The map** (step 2) holds only what the re-run facets found that the registers and the config do
  not already say: a new domain, a new page, a new truth. Nothing new: no question is asked.
- **Registers** (step 3): only new entries, numbered on from each file's highest, and the proposed
  entries this skill wrote whose `Source:` or `Enforced by:` changed or is gone, fixed or removed.
  **A confirmed entry is never touched** (one without a `Proposed:` line): when the evidence now
  contradicts it, keep it as written and say so under **Reviewer focus**.
- **Forms:** only the forms `omni kb status` reports stale or blank: in the map from step 0, a form
  whose `state` is `blank`, or whose `stale` list is not empty. Every other form is left as it is,
  whatever the exploration finds. For each form picked, steps 4 to 6 run on its question alone, and
  write only the sections this skill owns (**Whose section it is**). A `by: human` section is never
  rewritten. Its `evidence:` is rewritten: the files its sections were written from, hashed again. A
  file that is gone leaves the list (`omni check kb` fails on it), and what it proved is proved again
  or asked.
- Step 7 proposes only what the re-run facets and the redone forms changed. Step 8 is unchanged: the
  same branch, one pull request.
- No facet to re-run, nothing stale and nothing blank: say so, and open nothing.

## Hand off

Report the pull request, the map as answered, the proposed entries per register file, the
`omni kb status` map, the number of open questions, the config keys proposed, each command run with
its result, and every check that ran or did not.

End with one line on the business: what the repository sells, to whom and against whom is not
invade's to write. The Omni page drafts it from the repositories and the web pages a person points it
at, at Settings › Business › Draft from my repos, and every drafted claim waits for a person's ✓.

## Guardrails

- Evidence or nothing: no claim without its file, no command that did not run green, no guess where
  a question belongs.
- Asks once, at the map; writes nothing before the answer.
- Every register entry it writes is proposed: `Proposed: invade <today>`. It never removes a
  `Proposed:` line, and never touches a confirmed entry.
- Writes only under the front door and the config file: never a `CLAUDE.md`, a README, a workflow or
  source code. Repatriating decision records copies them; the originals are never deleted.
- Never rewrites a `by: human` section, nor any section a person wrote.
- Never copies a kit default into a form, and never copies a page a pointer or an index entry can
  name.
- Never merges, never pushes to the default branch, never adds `labels.outboxGo`.
