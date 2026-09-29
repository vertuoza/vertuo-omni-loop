---
name: mega-invade
description: Make this repository a plan repository that knows its target repositories — survey the repositories its guide names and its config lists through gh, read-only, show one map and take every answer in one message (target or not, its role, import a knowledge base or not), import a drafted knowledge base from a shallow read-only clone of each target answered "import" (nothing runs in the clone), write the plan section of the config as its own commit, and end with one docs-only pull request a person merges. It writes only in the plan repository, never in a target. With --sync it redraws only what changed in stale imported copies and proposes own for a target that now has its own knowledge base. Never merges. Triggers on "mega-invade", "set up the plan repository", "list the target repositories", "import the back-end's knowledge", "sync the imported knowledge", "/omni:mega-invade".
---

# Mega-invade: a plan repository that knows its target repositories

A **plan repository** holds no product code: it carries the PRDs, their folders and their phase-0
pull requests, while the code's pull requests open in its **target repositories**. Its config says
which they are, in a `plan` section:

- `plan.guide`: the repository path of the page that says, in prose, which repository does what.
  It is pointed at, never copied; `null` when there is none.
- `plan.targets`: one entry per target, each with `repo` (`owner/name`), `role` (one short
  kebab-case word: `back-end`, `front-end`, `legacy`…), `knowledge` and, for an imported copy only,
  `readAt`.
- `knowledge` says where the planner reads the target's knowledge base: `own` (the target has the
  loop and a filled form: read where it lives, never copied), `imported` (a draft copy lives in this
  repository at `<paths.knowledge>/repos/<name>/`, `<name>` being the part of `repo` after the
  `/`), or `none` (the planner reads only the guide for it). `readAt` is the full 40-character commit
  of the target's default branch the copy was read at.

This skill writes that section, imports the copies a person asks for, and ends at a review gate: one
docs-only pull request a person reads and merges. `node .omni-loop/bin/omni.mjs targets` then
reports every target, and `/omni:mega-invade --sync` keeps the copies current.

In order: step 0; **survey** (1); show **one map** and wait for the answer (2); **import** (3);
**config** (4); **one pull request** (5). `--sync` runs the same steps on less (see **--sync**).

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your session requires,
then the line `omni sign trailer` prints as the message's last line, with no blank line between
them. Every pull request or issue it opens ends its body with the line `omni sign footer` prints, as
a paragraph of its own just above your session's own attribution lines, and a body it rewrites keeps
that line. Comments are never signed. A command that prints nothing means signing is off here: add
nothing.

**Only here, never there.** This skill writes only in the plan repository: under `paths.knowledge`
and the config file. It never writes in a target repository: no branch, no commit, no pull request,
no issue, no comment. A gap in a target is reported with the step a person takes there.

**Nothing runs in a clone.** A target's clone is read, never executed: no install, no build, no
test, no script, no hook, no command from its README or its package manifest. Only `git` reads it
(`ls-files`, `hash-object`, `rev-parse`, `log`) and the file tools. A command the evidence suggests
is written with a `TODO(human)` asking a person to confirm it runs.

**Proposed, never a law.** Every register entry this skill writes carries
`Proposed: mega-invade <today>`, as `/omni:invade` writes its own. An entry in a copy never binds
this repository at all: its registers never read `repos/`.

## Input

| input | notes |
|---|---|
| none | survey every candidate, ask once, import what the person answers "import", write the plan section: the first run, or a run after the guide or the targets changed |
| `--sync` | touch only `imported` targets: redraw what changed in each stale copy, propose `own` for each one that now has its own knowledge base, and show new candidates of the guide (see **--sync**) |

## Step 0: installed, on its branch

1. Run `node .omni-loop/bin/omni.mjs config`. If it fails, stop and say so in one line: the loop is
   not installed here, and `omni init` comes first; then run `/omni:mega-invade` again. Keep the
   JSON; later steps read `repo.*`, `branches.megaInvade`, `worktrees`, `paths.*` and `plan` from
   it. `<remote>` below is `repo.remote`, `<mega branch>` is `branches.megaInvade`, `<owner>` the
   part of `repo.slug` before the `/`, and `<today>` is `date -u +%F`.
2. **The branch,** as `/omni:invade` takes its own. `git fetch <remote>`, then look for a pull
   request an earlier run left open:
   `gh pr list --head <mega branch> --base <repo.defaultBranch> --state open --json number,url`.
   - **One is open:** continue it, so there is still one pull request:
     `git worktree add -B <mega branch> <worktrees>/mega-invade <remote>/<mega branch>`.
   - **None is open:** start from today's default branch:
     `git worktree add -B <mega branch> <worktrees>/mega-invade <remote>/<repo.defaultBranch>`.

   Every step below works in that worktree. Never commit on the default branch.
3. **The scratch folder:** `mktemp -d`, outside the plan repository and outside its worktrees. Every
   clone goes there, and the folder is deleted when the skill ends, whatever the outcome.

## 1. Survey: read-only, through gh

1. **The guide.** When `plan.guide` is set, read that page. When it is `null`, look for one by name
   and by content, never at a fixed path: `git ls-files '*.md' '*.mdx'`, each page's first `#`
   heading, and the page whose name, heading or text says which repository does what. Its
   `## <name>` headings are the **candidate** repositories, each as `<owner>/<name>`. A page found
   this way is proposed as `plan.guide` in step 4; none found keeps it `null`.
2. **The configured targets.** Add every repository `plan.targets` already lists. When the config
   has a `plan` section, run `node .omni-loop/bin/omni.mjs targets --json` and keep its rows
   (`[{ repo, role, knowledge, loop, state, detail }]`). Its exit `1` is not a failure here: it
   means a row is not `ok`.
3. **The new candidates,** the ones the config does not list yet, get the same readings
   `omni targets` runs, through `gh api` only, never a clone:
   - `gh api repos/<repo>`: its default branch. Any failure, a 404 included, is `unreachable`: the
     candidate stays on the map, never dropped.
   - `gh api -H 'Accept: application/vnd.github.raw' 'repos/<repo>/contents/.omni-loop/config.yml?ref=<branch>'`:
     a 404 is `not installed`.
   - installed: its kit version, from `.omni-loop/bin/omni.mjs` read the same way (`installed` when
     no version can be read), and whether it has a **filled form**: a Markdown file under its
     `paths.playbook` (from that config, `.omni-loop/knowledge/playbook` when unset) whose front
     matter says `state: filled`, listed with `gh api 'repos/<repo>/contents/<playbook>?ref=<branch>'`.

## 2. The map: one checkpoint

The one place this skill asks. Print **one map** in chat, one row per candidate, configured targets
first in config order, then the guide's new ones in its order:

```text
repo                          in config  loop           filled form  state
<owner>/<name>                own        v0.0.40        yes          ok
<owner>/<name>                —          not installed  —            (new)
```

Then ask, as **one numbered list**, one line per candidate:

| # | the question | its default |
|---|---|---|
| each candidate | **target** or **not** | target when the config lists it or the guide names it and gh reads it; not when it is `unreachable` |
| each target | its **role**: one kebab-case word | the config's role; else a word the guide's section suggests (`back-end`, `front-end`…) |
| each target **without** the loop and a filled form | **import** a knowledge base, or **none** | the config's own answer (`imported` keeps its copy); none for a new one |

A target with the loop **and** a filled form is `own` without asking: its knowledge is never copied.
Say under each default what it produces ("import: a clone of `main`, four facets, a copy in
`repos/<name>/`"), so a person sees the size of the proposal before anything is written.

The person answers in **one message**. **Nothing is written before that answer:** no copy, no config.
A reply that changes a default is taken as said; an item the reply does not mention takes its
default. A reply that is not an answer (a question back, "wait") is answered in one line and the list
asked again; nothing else happens meanwhile.

## 3. Import: one copy per target answered "import"

For each target answered **import**, one at a time:

1. **A shallow, read-only clone** of its default branch in the scratch folder:
   `gh repo clone <repo> <scratch>/<name> -- --depth 1 --single-branch`. Its head,
   `git -C <scratch>/<name> rev-parse HEAD`, is the copy's `readAt`. **Nothing runs in it** (see
   **Nothing runs in a clone**).
2. **Explore it** with `/omni:invade`'s four read-only facets (**1. Explore** there), with the clone
   as the repository: the tree is `git -C <scratch>/<name> ls-files`, the pages are found in it by
   name and by content, and facet 4's GitHub readings name the target's `repo`, never this one.
   Skip every step of invade that runs a command: a facet reports each command it finds, and never
   runs it.
3. **Write the copy** in `<paths.knowledge>/repos/<name>/`, by `/omni:invade`'s own rules (**A form,
   read and written**, **A register entry, read and written**), every answer of its map taken at its
   default (keep each domain, index each truth page, point at the decision records, drafting on):
   - **`README.md`:** a `#` title naming the target, then three lines: whose copy it is (`repo`),
     the commit it was read at (`readAt`, in full), and that it is a draft to be replaced the day the
     target installs its own knowledge base (`npx omni-loop init`, then `/omni:invade` there).
   - **The registers,** in `product/`, one `domains/<domain>/` folder per domain the facets found,
     and `cross-domain/`: an index entry pointing at each rule a page of the target already states,
     a drafted entry for each truth only its code enforces. Every entry ends with
     `Proposed: mega-invade <today>`. Its `Source:` and `Enforced by:` name a path **in the target**.
   - **The forms,** in `playbook/`: one file per form this repository's own `paths.playbook` holds,
     each with the same `form`, `form-version`, title, opener and slot markers (heading, id,
     `required` or `optional`, order) as this repository's form of that name. Never its bodies: each
     slot is written from the clone's evidence, or left empty, or holds a `TODO(human)` question.
   - **Evidence** names a path **in the target** at its blob hash in the clone, in today's shape:
     `printf '  - %s@%s\n' "<path>" "$(git -C <scratch>/<name> hash-object -- "<path>" | cut -c1-7)"`.
   - **A command** a section would name (install, test, the preflight) is written with a
     `TODO(human)` line under it asking a person to confirm it runs in the target, and its marker
     carries no `verified:`.
   - A pointer (`points-to`, `See:`) names a path of the copy itself, never a target path: a page
     that answers a form in the target is summarised with its path under `evidence:` instead.
4. **Delete the clone** once its copy is written.

Commit each copy as its own commit, so a person can drop one alone:
`docs(knowledge): import <name>'s knowledge base, read at <first 7 of readAt>`.

## 4. Config: the plan section, its own commit

Write `plan.guide` and `plan.targets` in `.omni-loop/config.yml`, as answered: every target in the
map's order, configured targets first; `knowledge` is `own`, `imported` or `none`; `readAt` only on
an `imported` one, the full commit its copy was read at. A target answered **not** leaves the list;
its copy, if it had one, is removed in the same commit. Then run `node .omni-loop/bin/omni.mjs config`:
it must still print. A refusal names the field first: fix that field.

Commit it alone, so a person can drop the config change without the copies:
`chore(config): the plan section — <n> target repositories`.

Then run `node .omni-loop/bin/omni.mjs targets`, and keep its table for the pull request: the
**readiness table**.

## 5. One docs-only pull request

1. **Docs-only.** `git diff --name-only <remote>/<repo.defaultBranch>...HEAD` names only files under
   `paths.knowledge` and the config file. Anything else leaves the branch.
2. **Checks,** all green before the pull request is opened (warnings allowed):
   `node .omni-loop/bin/omni.mjs check kb` exits `0`, checking every copy's forms and registers as it
   checks this repository's own, one warning per question and per proposed entry. Fix every error it
   names in what this run wrote. Then `node .omni-loop/bin/omni.mjs check all`, green.
3. **Commits,** Conventional Commits as steps 3 and 4 name them, each ending with the co-author
   trailer your session requires, then the `omni sign trailer` line.
4. **Push:** `git push -u <remote> <mega branch>`. When step 0 started from the default branch over
   an older branch of that name, add `--force-with-lease`; never force a branch whose pull request is
   open.
5. **Open it through `/omni:pr`'s lifecycle, as a standalone PR:** base `repo.defaultBranch`, head the
   mega branch, no kind label, the title `docs(knowledge): mega-invade — the plan repository's
   targets`. When a run continues an open pull request, rewrite its body instead. The body ends with
   the `omni sign footer` line, and holds:

   ````markdown
   ## Targets

   ```text
   <the output of omni targets>
   ```

   ## Map, as answered

   1. `<owner>/<name>`: target, `<role>`, own | imported | none — or not a target

   ## Imported copies

   | Target | Read at | Proposed entries | Open questions |
   |---|---|---|---|
   | `<owner>/<name>` | `<first 7 of readAt>` | <n> | <n> |

   None of these entries binds this repository, and none is a law in the target.

   ## Next step in each target

   - [ ] `<owner>/<name>`: in that repository, run `npx omni-loop init`, then `/omni:invade`, to give
     it its own knowledge base. Its copy here is then dropped by `/omni:mega-invade --sync`.
   ````

   **One next step per gap:** every target whose row is not `own` and `ok`, and every
   `unreachable` one (its step is to grant access, or to fix the name in the guide). "none" when
   there are none. The body also says how to take the config change alone: revert its commit.
6. `/omni:pr` watches it to green. **A person merges it.** Never merge it, and never push to the
   default branch.

## --sync

`/omni:mega-invade --sync` keeps the imported copies current. It touches only `imported` targets,
never an `own` one, and never a `none` one's knowledge.

- **Read the state:** `node .omni-loop/bin/omni.mjs targets --json`. Step 0 runs as above; a
  repository without a `plan` section has nothing to sync: say so, and run without `--sync`.
- **Each `stale` target:** a fresh shallow clone as in step 3. `gh api
  repos/<repo>/compare/<readAt>...<its default branch>` lists the files that changed. Only the forms
  whose `evidence:` names one of them, and the register entries whose `Source:` or `Enforced by:`
  names one, are redrawn, by `/omni:invade --refresh`'s rules. **A section or an entry a person wrote
  or confirmed is never rewritten** (`by: human`, or an entry without its `Proposed:` line): a
  conflict with it becomes a `TODO(human)` beside it. `readAt` moves to the clone's head, in the
  config commit. Commit each copy as `docs(knowledge): sync <name>'s knowledge base, read at <first 7>`.
- **Each `drifted` imported target that now has its own loop and a filled form:** propose switching
  it to `own` and deleting its copy, in their own commit
  (`docs(knowledge): <name> has its own knowledge base — drop its copy`).
- **The guide:** a repository it names that the config does not list shows on the map as a
  candidate, and step 2 asks about it and nothing else.
- It opens or continues the same one pull request. **Nothing stale, drifted or new:** say so, and
  open nothing.

## Hand off

Report the pull request, the map as answered, the `omni targets` table, each copy imported or synced
with its `readAt`, its proposed entries and its open questions, the next step in each target, and
every check that ran or did not.

## Guardrails

- Writes only under `paths.knowledge` and the config file of the plan repository: never in a target,
  never a `CLAUDE.md`, a README, a workflow or source code.
- Nothing runs in a clone; every clone lives in the scratch folder and is deleted.
- Asks once, at the map; writes nothing before the answer.
- A target with the loop and a filled form is `own`: never copied, never synced.
- Only a target answered "import" gets a copy, and every copy carries its `readAt`.
- Never rewrites a section or an entry a person wrote or confirmed.
- `omni targets` reports; only this skill refreshes a copy, and only in a pull request a person
  merges.
- Never merges, never pushes to the default branch, never adds `labels.outboxGo`.
