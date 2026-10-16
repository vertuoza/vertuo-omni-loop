---
prd: 2049
title: Brainstorms and plans follow each repository's written conventions
blocked-by: none
spec: file
phase0: server
---

## Problem

A brainstorm or a plan names things in the repository it changes: a table, a column, a GraphQL type
or field, a use case, a service, a repository class. Today it picks those names from the files the
design touches and from the repository's knowledge base, and never from the pages where the
repository writes its conventions down.

PRD 278 of vertuo-automation-plan shows the cost. Its plan proposed a migration adding `created_at`
and `updated_at` to vertuo-backend-php's `avancement` table. The spec had even noticed that two
conventions coexist (`updated_at` and `_updated_at`), and picked one without a source. The rule was
written all along: vertuo-backend-php's `docs/migrations.md` says the underscore prefix is the
convention for audit timestamps, its `CLAUDE.md` routes "Migration" to that page and to the
`create-migration` skill, and its kernel-migrations `CLAUDE.md` points to that skill too. A reviewer had to
correct the name in five comments on the three files of the phase-0 PR. A session opened inside vertuo-backend-php would
have read those files; `/omni:mega-brainstorm` reads only the paths the design touches and the
target's knowledge base (`kit/plugin/skills/mega-brainstorm/SKILL.md`, step 3), and `/omni:plan`
reads the plan repository's own `paths.context`, never a target's.

## Solution

**One command says where a repository writes its conventions.** `omni conventions [--root <dir>]
[--json]` reads a directory, the current repository by default or a clone with `--root`, and prints
an index of the files that hold its conventions, one line each: the path, its title (its first `#`
heading, or the file name when it has none), and the file that led to it. It reads files only: no
git, no process, no network, so it runs safely on a read-only clone, and it needs no omni config: a
directory without `.omni-loop/` is read the same way. It finds, in this order:

1. `CLAUDE.md` and `AGENTS.md` at the root, following a line that imports another file with Claude's
   `@<path>` syntax (this repository's `CLAUDE.md` is `@AGENTS.md`).
2. The files the directory's `.omni-loop/config.yml` lists under `paths.context`, when it has one.
3. The readme of `docs/`: the first of `readme.md`, `README.md` or `index.md` there, matched without
   regard to case.
4. The readme of `docs/adr/`, found the same way; without one, every `.md` file in `docs/adr/`, each
   with its title.
5. Every `.md` page that a file found in 1 to 4 links to with a relative Markdown link, one level of
   links only, and only inside the directory. A link to a file that does not exist is printed as
   `missing`; a link that leaves the directory, or points to a non-Markdown file, is left out.

Each file is printed once, in the order it was first found. The command prints no file's content:
it is an index, and the agent reads the pages that bear on its design.

**Three skills read it before they name anything.**

- `/omni:mega-brainstorm`, step 3: after cloning a target, run
  `omni conventions --root <scratch>/<name>` and read the pages the design bears on.
- `/omni:plan` in a plan repository, step 2: the same, for each target a slice may land in, on that
  target's clone.
- `/omni:brainstorm`, step 1: run `omni conventions` on the repository itself and read the pages the
  design bears on before the design is shown.

At the least, a design that adds or renames a table or a column reads the pages on the database and
its migrations, and a design that changes a GraphQL schema reads the pages on the schema. Pages on
use cases, services and the repository layer are read when the design touches those layers.

**The spec records every name it picks, with its source.** A new `## Conventions` section follows
`## Solution` (and `## Repositories`, in a plan repository): a table
`| repo | layer | name | source |`, one row per name the design picks, the source a path and line
(`avancement._created_at` ← `docs/migrations.md:207`). A name no page settles reads
`no written convention: follows <file>`, naming the neighbouring code it copies. When two
conventions coexist and no page says which one a new name follows, the brainstorm asks the person
during the design and never picks silently. A spec that names nothing writes the one line
`No name chosen.`

## Conventions

| repo | layer | name | source |
| --- | --- | --- | --- |
| vertuo-omni-loop | command | `omni conventions` | no written convention: follows the one-word verbs of `kit/bin/commands/` (`targets`, `flow`) |
| vertuo-omni-loop | module | `kit/lib/conventions/` | no written convention: follows `kit/lib/flow/`, a folder per subject |
| vertuo-omni-loop | spec section | `## Conventions` | no written convention: follows the section names of `/omni:brainstorm` step 4 |

## Decisions

- **Discovery, no new config.** The person chose that omni finds the conventions by itself, from
  `CLAUDE.md`, `AGENTS.md`, the `docs/` readme and the `docs/adr/` readme, with no key a repository
  must fill in first. `paths.context` is read because it already exists, never a new key.
- **One command, not three copies of a paragraph** (approach A of three). The rule lives in one
  tested module that the three skills run, so it cannot drift between them. The alternatives were
  the paragraph copied into each skill (no code, but three copies that drift and nothing proving the
  rule finds the right files) and approach A plus a refusal in `omni check inbox` of a spec without
  `## Conventions` (rejected for now: telling that a spec "names a column" is fragile, and the
  refusal can be added later if names still slip through).
- **One level of links.** The readmes and `CLAUDE.md` are tables of contents: one level reaches the
  pages they route to (vertuo-backend-php's "Migration → docs/migrations.md") without walking a
  whole documentation tree.
- **Skills are not read as a source in this PRD.** `.claude/skills/` is left out of the discovery:
  the person named the documentation folders and the agent files, and in vertuo-backend-php the
  rule that went wrong is in `docs/migrations.md` too. A skill a `CLAUDE.md` links to with a
  relative Markdown link is found by rule 5 all the same.
- **The priority the person gave** (the GraphQL schema, then use case and service names, then the
  repository layer, then the database) is the floor, not a mechanism: the database and the GraphQL
  schema must work; the other layers follow when their pages exist.
- **No check in `/omni:do-work`.** A slice is built in a session inside its own repository, which
  reads that repository's `CLAUDE.md` already.
- **The backend side is out of scope.** Writing vertuo-backend-php's timestamp rule into its own
  playbook is done in another session.
- **The voice.** B-E DEv (`persona:B-E DEv`) objected that a list of files proves nothing was read,
  and that a reviewer needs the line that justifies each name. Accepted: the `## Conventions`
  section cites a path and a line for every name.

## User stories

- As a reviewer of a phase-0 PR, I read in the spec where each new column or GraphQL field name
  comes from, and I no longer correct names the repository's documentation already settles.
- As the owner of a target repository, I write my conventions where I already write them (the
  `docs/` readme, `CLAUDE.md`), and the plan repository's brainstorm follows them without my
  filling in any config.
- As an agent running `/omni:mega-brainstorm`, I get one list of the pages to read for each target,
  the same list every time, instead of guessing which files hold the rules.

## Scope

In:

- `omni conventions [--root <dir>] [--json]` and its module under `kit/lib/conventions/`, its entry
  in `omni help`, and the rebuilt `kit/dist/omni.mjs`.
- The text of `/omni:mega-brainstorm` (step 3, step 5), `/omni:plan` (step 2, in a plan repository)
  and `/omni:brainstorm` (step 1, step 4): run the command, read the pages, write `## Conventions`.

Out:

- Any change in a target repository, vertuo-backend-php's playbook included.
- A new config key, and a check in `omni check inbox` or `omni plan check`.
- Reading `.claude/skills/` directly, and following links more than one level deep.
- `/omni:do-work`, `/omni:ultra-wave` and the other skills that build.

## Test seams

As `omni kb show testing` says, on fixtures, with no call to GitHub:

- **The module**, a unit test per rule on fixture directories: a `CLAUDE.md` that imports
  `@AGENTS.md`; `paths.context` read from `.omni-loop/config.yml`, and a directory with no
  `.omni-loop/` read all the same; the `docs/` readme under each of `readme.md`, `README.md` and
  `index.md`; `docs/adr/` with and without a readme; a link to a missing file printed `missing`; a
  link leaving the directory and a link to a non-Markdown file left out; a page two links away not
  printed; a file found twice printed once.
- **The command**, through `main()` on a fixture, in text and with `--json`, with `--root` on a
  directory that has no omni config, and an unreadable or missing `--root` refused with one line.
- **The regression of PRD 278**: a fixture shaped like vertuo-backend-php, whose `CLAUDE.md` routes
  "Migration" to `docs/migrations.md`; the command's output holds `docs/migrations.md`.
- **The skills**, read as text as `kit/test/brainstorm-concept.test.ts` reads the brainstorm: each of
  the three `SKILL.md` runs `omni conventions` at the step named in **Scope**, and the brainstorms
  name the `## Conventions` section; `kit/test/skill-steps.snapshot.json` is updated with them.

## Risks

- **What a merge publishes.** The kit's next release (`chore(release): v0.0.N` after the merge)
  carries the new command and the three skills' new text to every repository that updates its kit.
  Rolling back is reverting the merge: the command is new and read-only, and no other command
  depends on it.
- **A thin index.** A repository with no `docs/` readme and a short `CLAUDE.md` gets a short list,
  and its names fall back to `no written convention: follows <file>`, which is today's behaviour,
  now said out loud in the spec.
- **A long index.** A readme that links to many pages gives a long list; the agent reads only the
  pages that bear on its design, and the spec's `## Conventions` table shows which.
- **The locked laws: none touched.** `omni kb laws --paths` on the files this PRD changes prints
  every locked law, because none of them names the files it governs; the design changes none of
  them.

## Acceptance criteria

1. `omni conventions --root <dir>` on a directory shaped like vertuo-backend-php (a `CLAUDE.md`
   whose table routes "Migration" to `docs/migrations.md`, a `docs/readme.md`, a `docs/adr/`
   folder) prints `CLAUDE.md`, `docs/readme.md`, `docs/migrations.md` and the ADR index, each with
   its title and the file that led to it, and exits 0.
2. The same command on a directory with no `.omni-loop/` folder prints its index and exits 0; on a
   `--root` that does not exist it prints one line saying so and exits non-zero.
3. A link to a missing file is printed with `missing`; a link outside the directory, a link to a
   non-Markdown file and a page two links away are not printed; no file is printed twice.
4. `--json` prints the same entries as an array of `{ path, title, from, missing }`.
5. `/omni:mega-brainstorm` step 3 runs `omni conventions --root <scratch>/<name>` on each clone, and
   its step 5 writes `## Conventions` after `## Repositories`.
6. `/omni:plan`, in a plan repository, runs `omni conventions --root` on each target's clone at its
   step 2.
7. `/omni:brainstorm` runs `omni conventions` at its step 1, and its step 4 writes `## Conventions`
   after `## Solution`, with a source for every name, `no written convention: follows <file>` for a
   name no page settles, `No name chosen.` when it names nothing, and a question to the person when
   two conventions coexist with no page saying which one applies.
8. `omni help conventions` describes the command, and `kit/dist/omni.mjs` is rebuilt with it.
