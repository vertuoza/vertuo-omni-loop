---
prd: 1990
title: omni sync says whether a checkout is in sync before anyone plans on it
blocked-by: none
spec: file
phase0: server
---

## Problem

A brainstorm, a plan and a yolo all start from the checkout a person runs them in, and the plan is
written against `main`. The product managers who run them most forget the same three things: they
are not on `main`, or their `main` has not been pulled for days; their Omni (the repository's kit,
the Claude plugin, the HUD plugin) is several releases behind; and the knowledge the agent reads is
stale. Nothing tells them. `omni version` compares the kit with its latest release only when asked;
`omni targets` and `omni kb status` find stale knowledge only when asked; nothing checks the branch,
how far behind `origin/main` it is, or whether the plugin matches the kit; and the status line and
the HUD show none of it. The agent then plans on old code with an old kit, and the mistake shows
only at review.

Two people meet it differently. **A newcomer** opens the repository and starts Omni for the first
time: the plugins are not installed and the computer has never signed in. **A daily user** has all
of it set up and forgets, one morning, to pull `main` or to update Omni.

## Solution

### 1. `omni sync`

A new command, run from anywhere in a checkout where the loop is installed. It gathers facts, turns
them into findings with one pure function, writes them to a cache, and prints them. It always exits
0; `--strict` exits 1 when the status is 🔴, for a script or a CI job that wants it. Outside a
checkout where the loop is installed it prints `sync: the loop is not installed here` and exits 0.

It prints a status line, one line per check in weight order, and a fix line:

```
🟠 Needs action · repo kit v0.0.418, latest v0.0.423
  main       🟢 on main, 2 behind (the oldest 3 h old)
  kit        🟠 repo kit v0.0.418, latest v0.0.423 → omni sync --fix
  knowledge  🟢 in sync
  page       🟢 signed in · synced 5 min ago
fix: omni sync --fix  (fast-forwards main, updates the plugins, opens the kit's update PR)
```

`--json` prints the cache's record instead (section 4). `--quiet` prints nothing and only refreshes
the cache. `--background` starts `omni sync --quiet` detached and returns at once.

### 2. The statuses

| status | words | when |
|---|---|---|
| 🔵 | `Setting up · <k> of 4` | a newcomer (section 3): a setup step is still open |
| 🔴 | `Out of sync` | a finding is red once its check's level is applied |
| 🟠 | `Needs action` | a finding is orange once its check's level is applied, none red |
| 🟢 | `In sync` | no finding is orange or red |

The **headline**, after the status's words, is the first finding of the heaviest check (the first
in `sync.order`) that holds a finding of the status's colour.

### 3. The newcomer: four setup steps

1. **The Omni plugin is installed**: `omni@omni-loop` is in what `claude plugin list` prints.
   Fix: the plugin install lines `omni init` prints today (the marketplace, then the plugin).
2. **The HUD plugin is installed**: `omni-hud@omni-loop` is in that list. Fix: the same lines for
   the HUD plugin, which the repository's `.claude/settings.json` already enables.
3. **This computer is signed in to the Omni page**: a sign-in is stored and not expired. Fix:
   `omni signin`, which the person runs.
4. **`main` is pulled**: the main check (section 5) has no red finding. Fix: `omni sync --fix`.

The marketplace and plugin names come from where `omni init` already reads them
(`MARKETPLACE` and `PLUGIN` in `kit/lib/init/steps.ts`, `HUD_PLUGIN` in `kit/lib/init/settings.ts`),
never from a second copy. When the `claude` command is not on the
PATH (another coding agent), steps 1 and 2 count as done and print `not Claude: skipped`.

A checkout is a newcomer's while its cache holds no `setupDoneAt`. The first run on which all four
steps hold writes `setupDoneAt`, and from then on that checkout is never 🔵 again: a plugin removed
later is a kit finding, a sign-in that expires later is a page finding. A person who already has
everything set up never sees 🔵: their first run records `setupDoneAt` and shows the daily status.

While 🔵, `omni sync` prints the checklist in place of the four checks, a done step with `✓` and an
open one with its fix:

```
🔵 Setting up · 2 of 4
  ✓ Omni plugin installed
  ✓ HUD plugin installed
  · Sign in to the Omni page → omni signin
  · Pull main → omni sync --fix
```

### 4. The cache

`.omni-loop/local/sync.json`, in the main checkout (as `.omni-loop/local/session.json` is, so every
worktree of a checkout reads the same one). It holds `checkedAt`, `status`, `headline`,
`setupDoneAt` (or `null`), and `findings`: one entry per check with its `check`, its `severity`
(`green`, `orange` or `red`, after its level), its `text` and its `fix` (a command, or `null`).
A cache that does not read is treated as absent and written fresh. `omni sync` owns the file: no
other command writes it.

### 5. The four checks

Each gathers facts with its own time budget; a fact it could not gather is one orange finding,
`not checked: <why>` (`offline`, `no gh`, `timed out`, `no sign-in`), never a red one.

**main** (budget: 10 s for the fetch)

- It runs `git fetch <repo.remote> <repo.defaultBranch>`, then counts the commits of
  `<remote>/<defaultBranch>` that `HEAD` does not have.
- Behind, and the oldest of those commits was committed more than `sync.mainRedAfter` ago: **red**,
  `main is <n> behind, the oldest <age> old`, fix `omni sync --fix`.
- Behind, all of them newer than that: **green**, `on main, <n> behind (the oldest <age> old)`.
  One pull each morning is the rhythm; being behind the last hours' release commits is not.
- In the main checkout on a branch other than the default branch: **orange**,
  `on <branch>: plans are made on <defaultBranch>`, fix `omni sync --fix` (switches when the tree is
  clean).
- In the main checkout, tracked files changed: **orange**, `<k> changed files on <branch>`, no fix
  (the person commits or stashes them).
- The default branch has commits `<remote>/<defaultBranch>` does not have: **orange**,
  `<defaultBranch> has <k> commits not on <remote>`, no fix.
- In a linked worktree (one a skill cut), the branch and the changed files are not judged: the
  skills cut their worktrees from a fresh `<remote>/<defaultBranch>` and own what is on them. Only
  the behind rule runs there, against `HEAD`.

**kit** (budget: 5 s per GitHub call)

- **The repository's kit**: the version its `.omni-loop/bin/omni.mjs` carries
  (`installedVersion`), or the running kit's when the bin carries none (a shim, as in the kit's own
  repository), against the kit home's latest release (`latestRelease`, as `omni version` asks it).
  Older: **orange**, `repo kit v<a>, latest v<b>`, fix `omni sync --fix` (runs `omni update`).
- **The plugins**: the versions of `omni@omni-loop` and `omni-hud@omni-loop` that
  `claude plugin list` prints, against the same latest release. Older: **orange**,
  `plugin v<a>, latest v<b>`, fix `omni sync --fix`. A plugin not installed, once `setupDoneAt` is
  written: **orange**, `<plugin> not installed`, with step 1's or step 2's fix. No `claude` command:
  this part does not run.
- **The target repositories**: in a plan repository, each target `omni targets` lists; in a
  repository the Omni page puts in a product, that product's other repositories (as the product
  targets cache holds them). For each, the version its default branch's `.omni-loop/bin/omni.mjs`
  carries, read through `gh api` (the file's `sha` first; the raw file only when the `sha` differs
  from the one cached beside its version). Older than the latest release: **orange**,
  `<owner/repo> kit v<a>, latest v<b>`, fix `omni update` in that repository (printed, never run:
  `--fix` changes nothing outside this checkout). A target without the kit is
  `<owner/repo> has no kit`, orange, no fix.

**knowledge**

- **Stale evidence**: the entries `omni kb status` reports as stale (their evidence file changed or
  is gone). Any: **orange**, `<k> playbook entries cite changed files`, fix `/omni:invade --refresh`.
- **The target copies**, in a plan repository only: what `omni targets` reports per target
  (`staleness`). `drifted`: **orange**; `stale`: **red**; each `<owner/repo> knowledge <state>`,
  fix `/omni:mega-invade --refresh`.
- **The knowledge folder**: tracked files under `paths.knowledge` changed in this checkout:
  **orange**, `<k> knowledge files changed here`, no fix. That it is behind `main` is the main
  check's finding, not a second one.

**page**

- Off (no page address, or the repository's dossier switch off): the check reads `n/a · no Omni
  page` and is green.
- No sign-in, or one that expired: **orange**, `not signed in`, fix `omni signin`.
- The constituents cache (`.omni-loop/local/constituents.json`) older than 24 hours, or the page not
  answering when `omni sync` refreshes it (`omni constituents`, its own 3 s budget): **orange**,
  `the page last synced <age> ago`, fix `omni sync --fix`.

### 6. The weights: `sync` in `.omni-loop/config.yml`

```yaml
sync:
  order: [main, kit, knowledge, page]   # the weight order, heaviest first
  levels:                               # the highest colour each check may show: red | orange | off
    main: red
    kit: orange
    knowledge: orange
    page: orange
  mainRedAfter: 24h                     # how old a missing commit of main may be before main is red
```

- A finding's colour is the lower of its own colour and its check's level: a red finding of a check
  whose level is `orange` shows orange. A check whose level is `off` gathers nothing and prints
  `off`.
- These values are the defaults: a repository without a `sync` block gets them, and `omni config
  sync` prints them.
- The config refuses, naming the key: an `order` that does not list each of the four checks exactly
  once, a name that is not one of them, a level other than `red`, `orange` or `off`, and a
  `mainRedAfter` that is not a whole number of hours written `<n>h`, with `n` from 1 to 720.
- The config `omni init` writes (`kit/lib/init/config-text.ts`) gains the block, commented, with
  these defaults.

### 7. `omni sync --fix`

It runs, in this order, each step whose finding is open and whose precondition holds, prints what it
did or why it left it, then runs the checks again and prints the new status:

1. **Switch to the default branch**: only in the main checkout, only with no tracked file changed,
   and only when the current branch has no commit that its upstream does not (nothing would be left
   behind unpushed). `git switch <defaultBranch>`.
2. **Fast-forward the default branch**: only on it, only with no tracked file changed.
   `git pull --ff-only <remote> <defaultBranch>`. It never merges, rebases or resets: a branch
   that cannot fast-forward is printed as `<defaultBranch> has diverged from <remote>: fix it by
   hand`.
3. **Update the plugins**: only when `claude` is on the PATH, as `omni update` already does
   (`kit/lib/update/plugin.ts`): the marketplace, then each installed plugin. It prints that a new
   session loads them.
4. **Update the repository's kit**: `omni update`, which opens its own update pull request (its
   own rules unchanged). Never in the kit's own repository, where the kit is built, not installed.
5. **Refresh the page's copy**: `omni constituents`.

It never runs `omni signin`, `/omni:invade` or `/omni:mega-invade`, never touches a target
repository, never pushes, and never merges.

### 8. Where the status shows

- **`omni session start`**, which every skill runs at its step 0, prints the sync block between the
  constituents and the briefing. It uses the cache when it is under 15 minutes old; otherwise it runs
  the checks, waiting at most 15 seconds, and past that prints the cache with its age
  (`checked 2 h ago`), or `sync: not checked yet` when there is none. It still exits 0 whatever
  happens.
- **The skills** (`/omni:brainstorm`, `/omni:yolo`, `/omni:mega-brainstorm`, `/omni:ultra-yolo`):
  step 0 says, in one sentence, that a status other than 🟢 is said to the person in one line, with
  its fix, and the run carries on. The skills warn; they never stop on it.
- **The status line** (`omni statusline`): line 2 starts with the badge, read from the cache only:
  `🟢 in sync`, `🟠 <headline>`, `🔴 <headline>`, `🔵 setting up <k>/4`, then ` · ` and what line 2
  says today. Too wide, the headline is cut before anything else on the line; the dot and its first
  word always stay. When the cache is older than 15 minutes, or absent, the status line starts
  `omni sync --background`, once at a time (a lock beside the cache), and draws what the cache
  holds, or no badge when there is none.
- **The HUD band** (`omni now --json`, read by the HUD plugin): a `sync` field holding the cache's
  status, headline and `checkedAt`, and the band's first row draws it as the status line does.
- **The SessionStart hook** (`kit/plugin/hooks/hooks.json`) adds `omni sync --background || true`
  beside `omni constituents`: it returns at once and never blocks the session.

### 9. The words

`omni help sync` and the help entry describe the command, its flags and its statuses; `omni help
session` names the sync block. The user guide gains a short "Before you start: omni sync" section in
`docs/guide/install.md`, and `docs/guide/troubleshooting.md` gains one line per finding with its fix.

## Decisions

- **The skills warn, never stop** (asked): a non-green status is said to the person in one line, and
  the run carries on. The person decides.
- **The weight order is main, kit, knowledge, page** (asked: "main pulled > omni update > kb invade
  sync > omni page"), and it is configurable (asked), with a level per check (assumed, shown in the
  design and approved): the order decides the headline, the level caps the colour.
- **Red for `main` only after 24 hours** (asked, the voice's objection, settled `accepted`): the goal
  is a sync each morning, not staying on the latest commit. Configurable as `sync.mainRedAfter`.
- **A newcomer gets a fourth colour, 🔵 Setting up, and a four-step checklist** (asked); once all four
  hold it is recorded and never shown again in that checkout (assumed, shown in the design).
- **`omni sync --fix` runs the safe fixes** (asked): a switch and a fast-forward on a clean tree, the
  plugin and kit updates, the page's copy; anything that could lose work is printed, never done.
- **The target repositories are the plan repository's targets and the product's other
  repositories** (asked), read through GitHub, never cloned, and never changed by `--fix`.
- **What "the knowledge is in sync" means** (asked: all four): stale evidence, the target copies,
  the knowledge folder (its lag behind `main` is the main check's), and the Omni page, the fourth
  as its own check, the lightest by default.
- **The status line and the HUD read only the cache** (assumed, shown in the design): they redraw
  every 30 seconds and must never wait on git or the network.
- **One command for every surface** (approach A, asked over extending `omni session start` and
  `omni status`, or a status the server computes): the same answer in the terminal, the HUD and the
  skills.
- **A linked worktree is judged only on the behind rule** (assumed): a skill's worktree sits on its
  own branch by design, and a "not on main" there would be noise on every wave.
- **Voice objection** (persona:Paul - Product Manager): "I want to ship fast. `main` gets a release
  commit after every merge, so I'd be red several times an hour for nothing, and I'll learn to ignore
  red." Settled `accepted`: red only once the oldest missing commit is 24 hours old.

## User stories

- As a product manager opening the repository for the first time, I see `🔵 Setting up · 2 of 4`
  with the next command to run, and once I have run them I never see it again.
- As a product manager who did not pull this morning, I see `🔴 Out of sync · main is 14 behind, the
  oldest 2 d old` on the status line before I brainstorm, run `omni sync --fix`, and see 🟢.
- As a product manager whose Omni is behind, `/omni:brainstorm` tells me so in one line at step 0,
  with the fix, and carries on.
- As a lead engineer, I set `sync.levels.kit: red` in the config and the whole team sees red until
  they update.
- As a person driving a plan repository, `omni sync` names the target whose kit or knowledge copy is
  behind.

## Scope

In: the `omni sync` command (`kit/bin/commands/sync.ts`, registered in `kit/bin/commands/index.ts`),
its library (`kit/lib/sync/`: facts, the pure status function, the cache, the fixes), the `sync`
config block, its validation (`kit/lib/config.ts`) and the config `omni init` writes, the sync block of
`omni session start`, the badge on the status line's line 2 (`kit/lib/statusline/`), the `sync`
field of `omni now --json` and the HUD band's row (`kit/plugin-hud/hooks/`), the SessionStart hook,
the step 0 sentence of the four skills named in section 8 (and their porting notes under
`kit/porting/`), the help entries, the guide's two pages, the tests, and the rebuilt
`kit/dist/omni.mjs`.

Out: any page of the Omni app or the arcade, any new endpoint, `omni version`'s and `omni targets`'
own output, `omni update`'s rules, stopping a skill on a status, changing a target repository, and
`/omni:invade` itself.

## Test seams

Following `omni kb show testing`: a pure module is unit-tested beside it, a command through `main()`
on a `makeRepo()` fixture, and no test calls GitHub or Supabase.

- **The status function** (`kit/lib/sync/status.test.ts`), on fact objects alone: each check's
  findings; the level caps a red to orange and `off` silences a check; the headline is the heaviest
  check's first finding of the status's colour, for a custom `order` too; `mainRedAfter` at 23 h 59
  and 24 h 01; a newcomer with 0 to 4 steps done, `setupDoneAt` written on the first all-done run,
  and never 🔵 after it; `not checked` is orange, never red.
- **The config** (`kit/lib/config.test.ts`): the defaults; each refusal of section 6, naming its
  key.
- **The facts**, with `git`, `gh` and `claude` replaced by fakes: behind counts and the oldest
  commit's age; the main checkout against a linked worktree; a shim bin reading the running version;
  a target's bin read by `sha`, then from the cache when the `sha` is unchanged; `claude` absent;
  `gh` timing out.
- **The command** (`kit/bin/sync.test.ts`, through `main()` on a `makeRepo()` fixture with a local
  bare remote): the printed block for each status; `--json` equal to the cache; `--strict` exit 1 on
  red only; outside an installed checkout.
- **`--fix`**, on fixture repositories with a bare remote: a fast-forward; a switch on a clean tree;
  no switch with a changed file or an unpushed commit; a diverged branch printed and untouched;
  nothing pushed.
- **`omni session start`**: the sync block from a fresh cache, from a stale one within the budget,
  and with the budget spent.
- **The status line and the HUD** (`kit/lib/statusline/render.test.ts`, the HUD's band tests): each
  badge; the cut order at narrow widths; a stale cache starts one background refresh, a held lock
  none.
- **The words**: `omni help sync` matches the command table (`kit/lib/help/entries.test.ts`).
- **The bundle** (`kit/test/dist.test.ts`): `kit/dist/omni.mjs` rebuilt.

## Risks

Merging publishes the kit (`omni kb show releasing`): the release after the merge carries
`omni sync`, the new session-start block, the status line's badge and the hook to every repository
that updates its kit, and the plugin marketplace hands out the new hook and HUD. Rollback is
reverting the merge commit: no stored shape changes outside `.omni-loop/local/` (which nothing
outside this command reads), no migration, no endpoint.

- **A slower step 0.** `omni session start` may wait up to 15 s for a refresh; the cache makes it
  instant while under 15 minutes old, and the SessionStart hook refreshes it in the background.
- **Noise taught to be ignored.** Red only after a day, and every level configurable (the
  objection above).
- **`--fix` changing a person's checkout.** It switches and fast-forwards only on a clean tree with
  nothing unpushed, never merges, rebases, resets or pushes, and prints everything it leaves.
- **GitHub's rate limit in a plan repository with many targets.** Each target costs one `gh api`
  call per refresh while its bin is unchanged; the refresh runs at most every 15 minutes.
- **A hook that fails.** The SessionStart line ends `|| true` and returns at once (N-PRODUCT-7).

The locked laws `omni kb laws` prints for the files this PRD changes; the design changes none of
them. N-PRODUCT-7 (a broken hook never blocks) and N-PRODUCT-15 (only a person merges) are the two it
bears on, and it keeps both: the hook never blocks, and `--fix` never merges or pushes. Changing any
of them needs @pierrederval to approve the pull request on GitHub.

- BR-PRODUCT-3: an agent could wave its own work through the gate with no person answering.
- BR-PRODUCT-5: a person could merge work whose open decisions nobody answered.
- BR-PRODUCT-6: a risky change nobody explained reaches the main branch unseen.
- BR-PRODUCT-12: the terminal acts on words the person no longer stands behind.
- BR-PRODUCT-28: a stranger could tie themselves to a team and see what it sees.
- BR-PRODUCT-29: a stranger could read a team's questions and answers.
- BR-PRODUCT-39: a question could leak to the wrong people, or its owner lose it.
- BR-PRODUCT-59: a member could copy the paid AI key and run up the bill.
- BR-PRODUCT-63: an agent could read another team's private work.
- BR-PRODUCT-64: a person who left the team could still read its work through an agent.
- BR-PRODUCT-94: an agent could answer a question in a person's name.
- N-PRODUCT-3: a badly ranked question slips past the person who answers it.
- N-PRODUCT-4: a change could switch its own gate off behind a green check.
- N-PRODUCT-7: a person is locked out of their own terminal by a broken hook.
- N-PRODUCT-8: questions and answers could go to a server the person never chose.
- N-PRODUCT-13: the install could overwrite a person's own settings.
- N-PRODUCT-14: a rule quietly loses its test until the server refuses the PR.
- N-PRODUCT-15: unreviewed work reaches every user with nobody choosing to ship it.
- N-PRODUCT-16: scores and history could change after the fact.
- N-PRODUCT-17: anyone opening the arcade could read a key that controls the database.

## Acceptance criteria

- `omni sync` prints a status line, one line per check in `sync.order`, and a fix line; it exits 0
  whatever it finds, and `--strict` exits 1 only when the status is 🔴.
- On the default branch, behind `<remote>/<defaultBranch>` by commits the oldest of which is more
  than 24 hours old, the status is `🔴 Out of sync` and the headline names the count and the age;
  behind only by newer commits, the main check is green.
- In the main checkout on another branch, or with tracked files changed, the main check is orange
  with its finding; in a linked worktree only the behind rule runs.
- A repository kit or plugin older than the kit's latest release is an orange kit finding naming
  both versions; a target repository's older kit is one naming the repository.
- Stale evidence, a drifted target copy and changed knowledge files are orange knowledge findings;
  a stale target copy is red before its level is applied.
- No sign-in, or a constituents cache older than 24 hours, is an orange page finding; no Omni page
  makes the check `n/a` and green.
- A fact that could not be gathered is an orange `not checked: <why>`, never red.
- `sync.order`, `sync.levels` and `sync.mainRedAfter` change the headline, the colours and the
  24 hours as section 6 says; the config refuses each invalid value naming its key; without a
  `sync` block the defaults apply.
- A checkout without `setupDoneAt` and with a setup step open shows `🔵 Setting up · <k> of 4` and
  the checklist; the first run with all four steps done writes `setupDoneAt`, and that checkout is
  never 🔵 again.
- `omni sync --fix` switches to and fast-forwards the default branch only on a clean tree with
  nothing unpushed, updates the plugins and the kit, refreshes the page's copy, prints what it left
  and why, then prints the new status; it never merges, rebases, resets, pushes or touches a target.
- `omni session start` prints the sync block between the constituents and the briefing, within
  15 seconds, and exits 0.
- The status line's second line starts with the sync badge read from the cache, and a cache older
  than 15 minutes starts one background refresh; `omni now --json` carries a `sync` field and the
  HUD band draws it.
- `/omni:brainstorm`, `/omni:yolo`, `/omni:mega-brainstorm` and `/omni:ultra-yolo` say a non-green
  status in one line at step 0 and carry on.
- `omni help sync` describes the command; `docs/guide/install.md` and
  `docs/guide/troubleshooting.md` name it.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` are green, and `kit/dist/omni.mjs` is rebuilt.
