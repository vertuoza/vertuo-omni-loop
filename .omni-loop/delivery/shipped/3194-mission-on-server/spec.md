---
prd: 3194
title: A mission lives on the server: no docs PR, no retro commit
blocked-by: none
spec: file
phase0: server
---

## Problem

A mission already runs from the Omni page: its fleet, its Start, its supervisor, its events, its retros
at `with-you`. Yet two of its records also go through git, for no one:

- `/omni:mission` (step 4) pushes the brief to the page, then commits `mission.md` and `mission.html`
  on a `mission/<nnnn>-<slug>` branch and opens a docs PR into the default branch "a person merges
  whenever". Starting never waits for that PR, so a person reviews and merges a copy of what the page
  already holds.
- `/omni:mission-retro` commits each retro and its items on the mission branch above `with-you`,
  where the page already keeps them at `with-you`.

Four readers take the brief from the checkout, so they only work once that docs PR is merged, which
nobody waits for: `omni ready` (`missionsOfPrd`, which PRDs a mission names), the mission's PM on a
runner (`/omni:brainstorm`, `/omni:roadmap` and `/omni:mega-brainstorm` with `--mission`, which write
nothing when the folder is missing) and `/omni:mission-retro` (the mission's level).

PRD 2842 specified the docs PR (its spec, "1. … lives in two places"); this PRD changes that decision.

## Solution

A mission's record is its page, in every repository, whatever the phase-0 flag.

1. **`/omni:mission`** writes `mission.md` and `mission.html` to a scratch folder outside the
   repository, runs the word pass, then `omni mission push <n> --from <dir>`. It cuts no branch, makes
   no worktree, commits nothing and opens no pull request. Its hand-off gives the mission's page (its
   fleet's Missions tab), says that **Start** there sends the fleet to work, and names what the
   mission will wait for a person on. When the push fails (not signed in, the app unreachable, a
   refusal), the hand-off says why with its fix and the one line to run again,
   `omni mission push <n> --from <dir>`; the scratch folder is kept.
2. **`omni mission push <n> [--from <dir>]`** reads the mission's folder from `--from` when given,
   else from the repository's missions folder as today, so a brief already committed (mission #3132)
   still pushes. Its checks are unchanged: both files, the brief's schema, the size cap, nothing
   loaded from the network.
3. **`omni mission get <n> [--out <dir>]`** (new) reads the mission from its page and writes it as
   plain files: `mission.md`, `mission.html`, each retro as `retros/<k>-<milestone>.md` and each retro
   item under `outbox/`, into `--out`, by default the mission's folder under the repository's
   missions folder (`<nnnn>-<slug>`), left uncommitted. It prints the folder. This is how a
   workspace's mission stays its own as plain files (never#6).
4. **The readers read the page.** The mission's PM (`/omni:brainstorm`, `/omni:roadmap`,
   `/omni:mega-brainstorm` with `--mission <m>`) and `/omni:mission-retro` run `omni mission get <m>`
   first and read its folder. "No such folder" becomes "the page holds no mission `<m>`".
   `omni ready` asks the page which missions name the PRD in place of reading the checkout's folders.
5. **No guess when the page cannot be read.** `omni mission get` and `omni ready`'s membership print
   `mission <m> not read: <why>` (or `mission membership not read: <why>`) and exit 1: `omni ready`
   holds, never passes, and a PM or retro job stops on that line, writing no PRD and no retro.
6. **`/omni:mission-retro`** commits nothing and pushes nothing at any level, and its record line
   carries `"file": null`: the page keeps the retro and its items, as it already does at `with-you`.
7. **The app** serves two reads, as the signed-in member, so a mission of another workspace reads as
   missing:
   - `GET /api/missions/brief?repo=<owner/name>&mission=<n>` → the latest `mission-record` and
     `brief` versions, each retro and its items;
   - `GET /api/missions/of-prd?repo=<owner/name>&prd=<n>` → the numbers of the missions whose brief
     names the PRD.
8. **Words.** The help entries of `/omni:mission`, `omni mission` and `/omni:mission-retro`, and the
   guide's missions page, say the page is a mission's record and name `omni mission get`.

Nothing already committed is removed: mission #3132's folder stays where it is.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | kit | `omni mission get <n> [--out <dir>]` | no written convention: follows kit/bin/commands/mission.ts (`push`, `drop`, `overturn`) and `omni dossier get` |
| vertuo-omni-loop | kit | `--from <dir>` on `omni mission push` | no written convention: follows `omni proof push <folder>` (a folder given as a path) |
| vertuo-omni-loop | app | `GET /api/missions/brief`, `GET /api/missions/of-prd` | no written convention: follows apps/galaxy/app/api/missions/ (`drop`, `overturn`, `items`) and ADR-0095's layering |

## Decisions

- **The page is a mission's record, in every repository** (asked): no docs PR, whatever the phase-0
  flag. A mission already needs the page to run.
- **The retro lives on the page at every level** (asked, the person's first concern): the mission
  retro is never a pull request nor a commit.
- **never#6 holds through `omni mission get`** (asked): a mission's brief and retros are always one
  command away as plain files; never#6 is not reworded. Rejected: a docs PR at the mission's end, and
  amending never#6.
- **A failed push keeps the files outside the repository** (asked) and prints the rerun line; no PR
  falls back.
- **Readers hold when the page cannot be read** (the voice: persona:Lead Engineer, neutral, "If
  `omni ready` and the PM now need the page to read a mission, a runner with the app down stops cold.
  I want them to say so plainly and hold, not carry on as if the PRD were in no mission."). Settled
  `accepted`: item 5 of the Solution.
- **This changes PRD 2842's "lives in two places"**: the repository copy becomes an export, made on
  demand.

## User stories

- As a person who writes a mission, I press Start on its page and have no pull request to review or
  merge for it.
- As a member, I read every retro of a mission on its page, whatever its level, and never in a PR.
- As a mission's PM on a runner, I read the mission's brief from its page the moment it is pushed,
  not once someone merged a docs PR.
- As a workspace owner, I export a mission's brief and retros as plain files with one command.

## Scope

In: the `/omni:mission` and `/omni:mission-retro` skills; the `--mission` sections of
`/omni:brainstorm`, `/omni:roadmap` and `/omni:mega-brainstorm`; `omni mission push --from`, `omni
mission get`; `omni ready`'s membership read; the two app reads; the help entries and the guide's
missions page.

Out: the mission link (bug #3190, merged); deleting mission #3132's committed folder; the
`/omni:mega-roadmap` mission section beyond the line that names the folder (it follows `/omni:roadmap`).

## Test seams

- `apps/galaxy/src/missions`: the two reads through the controller and service on the fake store: a
  member reads the brief as pushed and its retros; another workspace's caller and a missing mission get
  404; membership lists the missions naming a PRD.
- `kit/bin`: `omni mission get` against a fake app writes the files and prints the folder; exits 1
  with `mission <m> not read: <why>` when the app is unreachable or refuses; `omni mission push --from`
  reads a folder outside the repository; `omni ready` reads membership from the fake app and holds when
  it cannot.
- The skills' text tests (`kit/plugin/skills/*.test.ts` or the kit's skill checks): `/omni:mission`
  holds no worktree, commit or PR step; `/omni:mission-retro` commits nothing at any level.
- No test calls GitHub or needs `.env.local` (testing form).

## Risks

- **What merging publishes:** the arcade (two read routes) on Vercel, and the kit (`kit/dist/`,
  rebuilt) through the next release; runners take the new kit once they update. Rollback: revert the
  feature PR; nothing is stored, migrated or deleted.
- **A runner on an older kit** still reads the checkout's folder and finds none for a new mission: its
  PM writes nothing, as today without a merged docs PR. Updating the runner's kit fixes it.
- **The Legal entries:** L-GDPR-1 (only a workspace's members read its personal data): the two reads
  run as the signed-in member under row-level security, so a mission of another workspace reads as
  missing.
- **The locked laws:**
  - N-PRODUCT-15: if broken, unreviewed work reaches every user and nobody chose to ship it. Kept: the
    change opens fewer pull requests and merges none. Changing it needs @pierrederval or @dervalp to
    approve the pull request on GitHub.
- **The business laws:** none touched.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: Writing a mission opens no pull request
  Given a person runs /omni:mission and approves its brief
  When the brief is pushed to the mission's page
  Then no branch, commit or pull request is made for it
  And the hand-off gives the mission's page and says Start sends its fleet to work
```

### AC-2 · test

```gherkin
Scenario: A failed push keeps the brief and says how to send it again
  Given the app cannot be reached
  When /omni:mission pushes the brief
  Then the brief stays in a folder outside the repository
  And the hand-off prints "omni mission push <n> --from <that folder>"
```

### AC-3 · test

```gherkin
Scenario: A mission's brief and retros come back as plain files
  Given mission 3189 on its page, with one retro
  When a member runs omni mission get 3189
  Then mission.md, mission.html and retros/mission.md are written, exactly as the page holds them
```

### AC-4 · test

```gherkin
Scenario: A reader holds when the page cannot be read
  Given the app refuses or cannot be reached
  When omni ready reads which missions name PRD 3184
  Then it prints "mission membership not read" with the reason and exits 1, never "in no mission"
```

### AC-5 · test

```gherkin
Scenario: The mission retro is never a commit
  Given a mission at level own-branch reaches a milestone
  When its retro is written
  Then nothing is committed or pushed, and its record line carries "file": null
```

### AC-6 · test

```gherkin
Scenario: Another workspace's mission reads as missing
  Given a member of another workspace
  When they read mission 3189's brief or its membership
  Then the app answers that there is no such mission
```
