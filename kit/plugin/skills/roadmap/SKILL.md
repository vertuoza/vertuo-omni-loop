---
name: roadmap
description: Turns a milestone plan into a roadmap in one sitting — reads a page, a file or pasted text, shows one map of its PRDs (each blocker with its why, each wave), its open questions and its prerequisites by category, and takes every answer in one message; then writes every PRD as /omni:brainstorm writes one (issue, inbox folder, spec with its blocked-by, before/after) with no plan, opens the roadmap issue, writes roadmap.md with its Prerequisites rows and their author cards, runs omni roadmap check and omni check inbox until green, opens one phase-0 PR for the whole roadmap, pushes it to the roadmap's page with omni roadmap push, checks the prerequisites once with omni roadmap prereqs --fix, and hands off the open ones and the /loop /omni:drive --roadmap line. In a plan repository it prints the /omni:mega-roadmap line. Writes no code, merges nothing. Triggers on "write a roadmap", "turn this plan into PRDs", "a milestone of PRDs", "/omni:roadmap".
---

# Roadmap: a milestone into PRDs, in one sitting

A **roadmap** is a milestone delivered by a set of normal-sized PRDs, ordered by their blockers. A
source in (a plan page, a file, pasted text); out come one PRD issue, inbox folder, spec and
before/after page per item that delivers something, the roadmap issue, `roadmap.md`, and
**one phase-0 PR** a person reviews and merges. Then the loop drives the whole roadmap, PRD after PRD.

It asks once. `/omni:brainstorm` holds one design conversation per PRD; a roadmap's source has
already taken those decisions, so this skill shows **one map** and takes every answer in one message,
as `/omni:mega-invade` does. Each PRD is written as `/omni:brainstorm` writes one, its steps named
below rather than copied: where the two say the same thing, that skill's words are the rule.

**Specs up front, plans just in time.** Every PRD's spec is written now; no plan is. Each PRD is
planned when the loop reaches it, against the code that exists then.

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your session requires,
then the line `omni sign trailer` prints as the message's last line, with no blank line between
them. Every pull request or issue it opens ends its body with the line `omni sign footer` prints, as
a paragraph of its own just above your session's own attribution lines, and a body it rewrites keeps
that line. Comments are never signed. A command that prints nothing means signing is off here: add
nothing.

## Input

| input | example | notes |
|---|---|---|
| a page link | `/omni:roadmap https://example.com/crew-plan` | read as it is served |
| a file in the repository | `/omni:roadmap plans/crew.md` | read from the checkout |
| pasted text | `/omni:roadmap '<the plan>'` | read as given; the roadmap has no `source` then |

`<n>` everywhere below is the roadmap's number, its issue's; `<prd>` is one PRD's number.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, stop and say so in one line: the repository
is not installed. Keep the JSON: everything `/omni:brainstorm` step 0 keeps. `<remote>` below is
`repo.remote`.

**A repository of its own only.** When the JSON has a `plan` section (its `plan.targets`), this is a
plan repository, whose roadmaps say which repository each PRD lands in: stop in exactly one line,
the source carried over, writing nothing:

```text
a plan repository: /omni:mega-roadmap <source>
```

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs kb show briefing`.
Its rules bind every step below.

## 1. Read the source

Read the whole source: the page (through whatever reads a web page in this session), the file, or
the text. Then draw from it, writing nothing yet:

- **The milestone:** one sentence of what is true once the roadmap is done, and its title. A
  product the source names, and a target date the person gave, when either is there. Never invent
  a date.
- **The PRD rows.** Each item that delivers something becomes one row: an `id` (the source's own,
  `P3.4`, or `P<k>` in the source's order), a title, and the scope one plan can carry. An item too big
  for one plan becomes several rows; an item that delivers nothing (a meeting, a decision) becomes no
  row.
- **The blockers,** each with its `why`: one line saying what the blocked row needs from the
  blocker. They are **the narrowest the source justifies**: only where the source says nothing finer
  does a row wait for every row of the previous phase. A blocker you cannot explain is not written.
- **The waves:** `1` for a row with no blocker, else one more than its highest blocker's wave.
- **The acceptance criteria:** each phase's done-when becomes the acceptance criteria of the rows
  that finish it, and each row gets the conditions its own item states.
- **The open questions,** each with the rows it blocks and the source's recommendation. Its `kind`
  is `default` when the source recommends an answer: the PRDs it blocks run on it. It is `person`
  when the source recommends nothing, or when two principles pull the answer apart: the PRDs it
  blocks park until a person answers it.
- **The prerequisites:** what has to be true on the machine, on GitHub and around the repository
  before the PRDs can be built and tested (`omni help roadmap` names the catalog). First the base
  rows every roadmap gets, blocking `all`: `base:gh-auth`, `base:node`, the repository's package
  manager (`base:pnpm`, `base:npm` or `base:yarn`, from its lockfile), `base:install` and
  `base:labels`. Then, for each PRD, what it needs that the base rows do not cover (a container, a
  private package, a secret, a service, a permission), blocking only the rows that need it: a base
  check when the catalog has one (`base:docker`, `base:registry`, `base:env-file`,
  `base:omni-signin`), else a shell command that exits 0 when it holds, else nothing. Each row's
  `category` is `local`, `access`, `permissions`, `github` or `services`, and its `who`:
  - `agent` only for a row with a base fix (`base:install`, `base:labels`, `base:env-file`): what
    stays inside the repository and can be undone;
  - `check` when something verifies it and a person fixes it;
  - `person` when nothing can verify it, so its author ticks it.

  The agent never installs software, starts or stops a system service, writes a secret, a token or a
  value it was not given, or changes anyone's access: whatever needs one of those is a `check` or
  `person` row. Every `check` and `person` row gets its **author card**, four lines for someone who
  is not technical (step 4): a base check's card starts from the kit's own card for it, adapted to
  the platform the author uses.

Read the repository's knowledge the way `/omni:brainstorm` step 1 reads it before designing: the
files in `paths.context`, the glossary at `paths.glossary` when set, the knowledge folder, and the
playbook forms. A row the code already delivers is no row; say so on the map.

## 2. The map: one checkpoint

The one place this skill asks. Print **one map** in chat:

1. The milestone, the title, the product and the target date (each marked `none` when there is none).
2. The PRD table, one row per PRD, wave by wave:

   ```text
   id     title                              blocked by   why                                  wave
   P1.1   Crew API and worker skeleton       –            –                                    1
   P3.4   Stateless think endpoint           P1.1         the endpoint is called by the worker 2
   ```

3. The open questions, each with its recommendation, the rows it blocks and its kind.
4. The prerequisites, grouped by category (`local`, `access`, `permissions`, `github`,
   `services`), one line each: its id, its need, its check, its `who` and the rows it blocks, the
   base rows first:

   ```text
   local        p1  Docker is running, for the database tests   base:docker   check   P1.1, P3.4
   permissions  p3  the preview has DATABASE_URL                 –             person  P3.4
   ```

5. **Every row `omni roadmap check` would refuse,** by its rules (`omni help roadmap` lists them): a
   cycle, a wave that does not follow its blockers, a blocker without its why, a blocker that is no
   row, a question blocking no row, and among the prerequisites an unknown category or `who`, an id
   used twice, a `blocks` naming no row, a `fix` on a row that is not `agent`. Each is named with the
   fix you propose, already applied to the table above.
6. The rows the source holds that you left out, and why.

Then ask, as **one numbered list**: the title and the milestone as drawn; each row, its blockers and
its wave; each question's kind; the prerequisites and who can do each; anything the source left unclear, with your recommendation as its
default. Say what the answer produces: "`<k>` PRD issues, `<k>` spec folders and one phase-0 PR".

The person answers in **one message**. **Nothing is written before that answer:** no issue, no
branch, no file. A reply that changes a default is taken as said; an item the reply does not mention
takes its default. A reply that is not an answer (a question back, "wait") is answered in one line
and the list asked again; nothing else happens meanwhile. After it, nothing more is asked.

The voice of `/omni:brainstorm` does not speak here, and no proof question is asked: the map is the
one checkpoint, and no `voice.json` is written.

## 3. Write every PRD

Each PRD is written as `/omni:brainstorm` writes one, from the answered map instead of a
conversation, with the differences below.

**The branch.** Everything is written in one worktree on the phase-0 branch, `branches.phase0` with
`{topic}` = `roadmap-<topic>`, `<topic>` a short kebab-case name of the milestone, cut from today's
default branch:

```bash
git fetch <remote>
git worktree add -b <phase-0 branch> <worktrees>/roadmap-<topic> <remote>/<repo.defaultBranch>
```

There is no feature branch yet: each PRD's is cut when the loop plans it.

**The issues first,** in wave order, so every blocker's number exists before the spec that names it:
for each row, `gh issue create --title "PRD: <title>" --label "<labels.prd>" --body-file <file>`, as
`/omni:brainstorm` step 2 writes it (check the label exists first, following `/omni:pr`'s **Labels**
rules), with two differences in the body: the paragraph says the PRD belongs to the roadmap, by its
title, and the **Handoff** block's next command is "the roadmap's drive line, once the phase-0 PR is
merged". The issue's number is the row's `PRD`.

**Then each folder,** `<nnnn>-<topic>` in the inbox under `paths.delivery`, as `/omni:brainstorm`
step 2 names it (the PRD's own number and topic), holding:

- `spec.md`, as `/omni:brainstorm` step 4 writes it (the same front matter, the same sections, the
  same self-review), with:
  - `blocked-by` **from the table**: the PRD numbers of the row's blockers, `[1201, 1213]`, or
    `none`. `omni roadmap check` refuses a spec whose `blocked-by` differs from its row.
  - **Decisions:** each `default` question blocking the row, as
    `<question id> — recommended default, accepted when the phase-0 PR merges: <recommendation>`;
    each `person` question blocking it, as `<question id> — waits on a person: <question>`.
  - **Acceptance criteria:** the ones step 1 drew for the row.
- `before-after.html`, as `/omni:brainstorm` step 5 writes it; the plain today-and-after page is
  enough for a PRD whose screens are not designed yet.
- Pending acceptance scenarios, only when `acceptance.enabled`, as `/omni:brainstorm` step 6.

No plan: no `plan.md` is written, and `/omni:plan` is not run.

## 4. The roadmap issue, roadmap.md and the checks

1. **The roadmap issue.** Its label is `omni:roadmap` (the kit's name for it; check it exists as
   step 3 checks `labels.prd`). `gh issue create --title "Roadmap: <title>" --label "omni:roadmap" --body-file <file>`,
   the body naming the milestone, then one line per PRD, `- #<prd> <id> <title>` wave by wave (so
   GitHub links each PRD's issue back to it), then the `omni sign footer` line. Its number is `<n>`.
2. **`roadmap.md`,** in the folder `<nnnn>-<topic>` (`<n>` zero-padded to four digits) under the
   inbox's `roadmaps/`:

   ```markdown
   ---
   roadmap: <n>
   title: <title>
   milestone: <one sentence>
   product: <a product's name>
   target: <YYYY-MM-DD>
   source: <link or path>
   ---

   ## PRDs

   | id | PRD | title | blocked by | why | wave |
   |---|---|---|---|---|---|
   | P1.1 | #1201 | Crew API and worker skeleton | – | – | 1 |

   ## Open questions

   | id | question | recommendation | blocks | kind |
   |---|---|---|---|---|
   | Q2 | … | … | P3.1, P3.2 | default |

   ## Prerequisites

   | id | category | need | check | fix | blocks | who |
   |---|---|---|---|---|---|---|
   | p1 | permissions | gh is signed in, with the right to change the repository | `base:gh-auth` | | all | check |
   | p4 | access | the libraries install from the lockfile | `base:install` | `base:install` | all | agent |
   | p6 | local | Docker is running, for the database tests | `base:docker` | | P1.1, P3.4 | check |

   ### p1

   - **Why:** The loop opens pull requests and reads issues on GitHub as you. It needs to be signed
     in, with the right to change the repository.
   - **Command:** `gh auth login --scopes repo`
   - **What it does:** Opens GitHub in your browser so you can sign the gh tool in.
   - **Who can do it:** Anyone with this laptop and a GitHub account that can write to the repository.
   ```

   `product` only when the source names one, `target` only when the person gave a date, `source`
   only when the source is a page or a file: each line is left out otherwise. A row with several
   blockers lists them comma-separated and gives one `why` that covers each. No `repos` column: that
   is a plan repository's.

   `## Prerequisites` holds the rows step 1 drew as the map's answer settled them, ids `p1`, `p2`, …
   in the map's order, the base rows first; `blocks` is `all` or the PRD row ids. Under the table,
   one `### <id>` card per `check` and `person` row (an `agent` row needs none), with exactly its
   four labelled lines: **Why:** (what breaks without it, in plain words), **Command:** (one command
   in backticks, the simplest one that works on the author's platform, the install step spelled out
   when a tool is missing), **What it does:** (one plain sentence) and **Who can do it:** (who on the
   team, not only "you"). No jargon without its meaning.
3. **Commit** the PRD folders and the roadmap folder as `docs(roadmap): <topic>`, with the co-author
   trailer, then the `omni sign trailer` line. Then run, fixing until both are green:

   ```bash
   node .omni-loop/bin/omni.mjs roadmap check <n>
   node .omni-loop/bin/omni.mjs check inbox
   ```

   A fix is a new signed commit. A fix that changes a row, a blocker or a question's kind changes
   what the person answered: say so in the hand-off.

## 5. One phase-0 PR, then the roadmap's page

The roadmap is written and checked, and not one line of source exists. One review covers it all.

1. **Prove each PRD's part,** from the worktree, for every PRD of the roadmap:

   ```bash
   node .omni-loop/bin/omni.mjs phase0 <prd>
   ```

   Each must print `docs-only: yes`, `signed: yes` (or `off`), carry the PRD's spec and before/after,
   and miss nothing but the plan: its one `not ok` is `missing: plan`, expected, because a roadmap's
   PRDs are planned when the loop reaches them. Any other fault (a source file, an unsigned commit, a
   spec or a before/after missing) is fixed on the branch, and every PRD is proved again.
2. `git push -u <remote> <phase-0 branch>`, then follow `/omni:dossier-push <prd>` from this worktree
   for each PRD: its spec and before/after become its dossier's first versions. Whatever it prints,
   carry on.
3. **Open the phase-0 PR** through `/omni:pr`'s lifecycle: base `repo.defaultBranch`, head the
   phase-0 branch, the title `docs(roadmap): <title>`, `labels.phase0` subject to **Labels**, and a
   body that starts with `prLinks.phase0` filled once for the roadmap issue and once per PRD, followed
   by Summary (the milestone), the PRDs table and the open questions as `roadmap.md` holds them,
   Verified (the `omni roadmap check`, `omni check inbox` and `omni phase0` lines), Risk and rollback,
   and Reviewer focus (each blocker's why, and each `default` question's recommendation, which merging
   accepts), and ending with the `omni sign footer` line.
4. **Push the roadmap** to its page, from the worktree:

   ```bash
   node .omni-loop/bin/omni.mjs roadmap push <n>
   ```

   Exit `0` prints the page's link. Anything else prints one line (`off`, `no sign-in (omni signin)`,
   `github unreachable`, `unreachable`, `refused (<status>)`): say it, and carry on.
5. **Check the prerequisites once,** from the worktree, now that `omni roadmap check` is green:

   ```bash
   node .omni-loop/bin/omni.mjs roadmap prereqs <n> --fix
   ```

   It runs every row on this machine, the `agent` rows' fixes once, and prints one line per row
   grouped by category: `ok`, `fixed`, `ticked`, or `waits on you` with its card's command. It sends
   the result to the roadmap's **Prerequisites** tab itself. Exit `1` means a row waits on a person,
   which is the hand-off's to report, never a fault to fix here: carry on. Keep its lines. Nothing it
   fixed is committed: an install or a copied `.env` is no part of the phase-0 PR.

**A person reviews and merges it.** Never merge it yourself.

## 6. Hand off

Report the roadmap issue, every PRD issue with its row id, the phase-0 PR, the waves, every question
with its kind, the roadmap's page (the link `omni roadmap push` printed, or its one line), and every
check that ran or did not. Then the prerequisites, as `omni roadmap prereqs` printed them: the
`waits on you` rows first, each with its need, its card's command and its **Who can do it** line,
then one line counting the others (`7 ok · 1 fixed`). Each open row holds only the PRDs it blocks
once the drive starts. Then end the reply with **What is next?**: three short numbered steps,
then the command alone on the reply's last line.

```markdown
**What is next?**

1. Review the roadmap: https://github.com/<owner>/<repo>/pull/<phase-0 PR>
   (where each PRD stands: <the roadmap's page, or the roadmap issue's link>)
2. Merge that PR. → every PRD of the roadmap moves into the inbox.
3. Once it's merged, type /clear (or open a new terminal), then run:

/loop /omni:drive --roadmap <n>
```

The drive builds every PRD whose blockers merged, planning each when it starts, and holds the others,
naming the pull request each waits on. A `person` question is answered on the roadmap's page, or
with `omni roadmap answer <n> <question> "<answer>"`.

## Guardrails

- Runs only in a repository of its own; a plan repository gets the `/omni:mega-roadmap` line.
- One map, one answer: nothing is written before it, and nothing is asked after it.
- Every PRD gets its issue, folder, spec and before/after; none gets a plan.
- Every blocker carries its why; a dependency nobody can explain is not written.
- The only fixes the agent runs are the kit's base fixes on `agent` rows: never install software,
  start a service, write a secret or change anyone's access. That is a person's, on a card.
- One roadmap, one phase-0 PR. Never merge, never add `labels.outboxGo`, never create a label
  unless `labels.autoCreate` is true, and never write a line of source.
