# Settled outbox items — PRD 587

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-tests-outside-territory -->

## s1-01-tests-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-tests-outside-territory
prd: 587
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

Building this part meant also changing two older page tests and the list of database checks, which the plan gave to nobody. Is that fine?

## The decision, in plain words

We changed them, because the tests still expected the old stage unknown message and the new database check would otherwise never run.

## The intro, for fun

The plan drew a fence, and two old tests were standing just outside it.

## The punchline, for fun

We invited them in rather than leave them shouting about a message that no longer exists.

## The options, in plain words

A. Keep the changes in this slice, the option built.
B. Move the test and workflow changes to their own slice before the feature PR is ready.

## What I had to decide

Whether a slice may change tests and the database-check workflow outside its declared territory when its own done-when requires it.

## What I did meanwhile

render.test.ts and page.test.ts under apps/galaxy/src/dossier/page now pass stored stages, and .github/workflows/supabase.yml runs supabase/checks/prd_stages.sql.

## What it costs to change later

Reverting the three files: the old tests would fail and the new check would stop running.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a later slice planned to own these files (author)

```

<!-- /omni-outbox-settled: s1-01-tests-outside-territory -->

<!-- omni-outbox-settled: s1-02-unreadable-stages-read-syncing -->

## s1-02-unreadable-stages-read-syncing — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-unreadable-stages-read-syncing
prd: 587
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When the page cannot read a PRD's stored stages, what should it say?

## The decision, in plain words

It says Syncing, the same words as a PRD not synced yet, and logs the error for us.

## The intro, for fun

The database hiccupped, and the page had to say something polite.

## The punchline, for fun

It chose Syncing, which is technically hopeful and never rude.

## The options, in plain words

A. Show Syncing, the option built.
B. Show a separate line saying the stage could not be read, with a hint to reload.

## What I had to decide

What a PRD page shows when the read of its stored stages fails.

## What I did meanwhile

A failed read is logged and treated as no stored stage: the header reads Syncing… with nothing lit.

## What it costs to change later

One line in the route: a different word or state for a failed read.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- how often the read fails in production (author)

```

<!-- /omni-outbox-settled: s1-02-unreadable-stages-read-syncing -->

<!-- omni-outbox-settled: s2-01-sync-off-until-galaxy-address-set -->

## s2-01-sync-off-until-galaxy-address-set — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-sync-off-until-galaxy-address-set
prd: 587
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The scheduled sync needs to know where the app lives. Should it stay switched off until someone gives it that address?

## The decision, in plain words

Yes: the sync stays off until the app's address is set as a repository setting, then it runs every 15 minutes and fails loudly on a wrong secret.

## The intro, for fun

The alarm clock was ready to ring every 15 minutes, but nobody had told it which door to knock on.

## The punchline, for fun

So it sleeps politely until someone writes the address on the fridge.

## The options, in plain words

A. Keep the sync off until the app's address is set as a repository setting, the option built.
B. Write the production address in the workflow, so it runs as soon as the secret is set.

## What I had to decide

How .github/workflows/stages.yml learns galaxy's URL, and what it does before that is set. The spec names only the bearer secret.

## What I did meanwhile

The job runs only when the repository variable GALAXY_URL is set (like the releases workflow's SUPABASE_PROJECT_ID gate); it posts to that URL's /api/stages/sync and fails on any non-2xx reply. The README's deploy table lists GALAXY_URL and STAGES_SYNC_SECRET.

## What it costs to change later

One line in the workflow: hard-code the production URL instead, or gate on something else.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the production galaxy host should be written in the workflow itself instead of a variable.

```

<!-- /omni-outbox-settled: s2-01-sync-off-until-galaxy-address-set -->

<!-- omni-outbox-settled: s2-02-inbox-folder-without-phase-0-dated-at-sync -->

## s2-02-inbox-folder-without-phase-0-dated-at-sync — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-inbox-folder-without-phase-0-dated-at-sync
prd: 587
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

When a plan folder sits in the inbox but the sync cannot find the pull request that put it there, when did the plan reach the inbox?

## The decision, in plain words

We record it as reaching the inbox at the time of the sync, the same rule the spec gives for a shipped folder whose pull request is not found.

## The intro, for fun

The folder was clearly in the inbox, but nobody remembered carrying it there.

## The punchline, for fun

So we stamped today's date on it and told it to stop being mysterious.

## The options, in plain words

A. Date it at the sync's time, the option built.
B. Leave the inbox stage unrecorded until its pull request is found, so the page shows the stage before it.

## What I had to decide

The date of the inbox stage for a folder in inbox/ whose merged phase-0 PR is not among the pull requests read. The spec gives the sync-time rule only for shipped/.

## What I did meanwhile

src/stages/sync/core.ts records inbox at the sync's time for such a folder; a folder in shipped/ gets inbox only when its phase-0 PR is found. The PRD stage is recorded only from a labelled issue, never guessed from a folder.

## What it costs to change later

One line in the core; the dates already written stay, since a stage keeps its first date.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How many inbox folders in the workspaces' repositories have no phase-0 PR the sync can see.

```

<!-- /omni-outbox-settled: s2-02-inbox-folder-without-phase-0-dated-at-sync -->

<!-- omni-outbox-settled: s3-01-stage-events-default-branch-shapes -->

## s3-01-stage-events-default-branch-shapes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-stage-events-default-branch-shapes
prd: 587
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

Should the instant stage updates follow each repository's own branch naming, or is the standard naming enough?

## The decision, in plain words

The instant updates recognise only the standard branch names. A repository that renamed its branches still gets its stages, but only from the check every 15 minutes.

## The intro, for fun

A branch by any other name would still merge as sweet.

## The punchline, for fun

The quick messenger only knows the common names; the slow one knows them all.

## The options, in plain words

A. Kit default shapes in the webhook; custom-shaped repositories rely on the sync (built).
B. Read the base branch's config through the GitHub App in the webhook before matching.
C. Move the forward into an Inngest function that reads the config, then POSTs.

## What I had to decide

Whether the app should read each repository's own branch names before telling galaxy about a stage.

## What I did meanwhile

omni-app matches pull request branches against the kit's default shapes and link lines. Repositories with custom shapes get stages from the 15-minute sync only.

## What it costs to change later

Switching to the repository's own shapes means one config read from GitHub per pull request event, in the webhook or in a small Inngest function; the matcher already takes the shapes as an argument.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How many workspace repositories customise branches.* is not known (author)

```

<!-- /omni-outbox-settled: s3-01-stage-events-default-branch-shapes -->

<!-- omni-outbox-settled: s3-02-stage-event-workspace-by-owner -->

## s3-02-stage-event-workspace-by-owner — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-stage-event-workspace-by-owner
prd: 587
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

When a pull request moves a PRD, how does the app know which workspace the PRD belongs to?

## The decision, in plain words

The workspace is the one named after the repository's GitHub account, the same way questions from the terminal are placed. The message also goes to the production app unless another address is set.

## The intro, for fun

Every letter needs an address, even the ones about PRDs.

## The punchline, for fun

We looked at the name on the mailbox and knocked there.

## The options, in plain words

A. By the repository owner's GitHub org, matching how terminal questions are placed (built).
B. By the App installation id carried in the event.
C. By both: installation first, then the owner's org.

## What I had to decide

Whether stage events are placed by the repository owner's GitHub org, or by the App installation the event came from.

## What I did meanwhile

galaxy places an event in every workspace whose github_org matches the repository owner, case-insensitively; omni-app posts to GALAXY_URL, defaulting to galaxy's production host.

## What it costs to change later

Placing by installation means adding the installation id to the event and one lookup on workspaces.github_installation_id; the event shape gains a field, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A workspace whose github_org differs from the owner of an installed repository gets no instant events, only the sync (author)

```

<!-- /omni-outbox-settled: s3-02-stage-event-workspace-by-owner -->

<!-- omni-outbox-settled: s4-01-unsynced-row-no-pill -->

## s4-01-unsynced-row-no-pill — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-unsynced-row-no-pill
prd: 587
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

On the PRD list, what should a numbered PRD show before its first sync has recorded any stage?

## The decision, in plain words

It shows no stage pill and is not counted in the stage bar until the sync records a stage for it.

## The intro, for fun

Brand new PRD, freshly numbered, and the sync has not had its coffee yet.

## The punchline, for fun

For up to fifteen minutes it simply wears no badge at all.

## The options, in plain words

A. Show nothing until the first sync (built): The row has no pill and counts nowhere; the numbers always add up to what is stored.
B. Show a Syncing pill: Matches the PRD page's header; the bar still skips it.
C. Count it as PRD: A numbered PRD has an issue, so PRD is safe to assume; the count may run ahead of the database.

## What I had to decide

Whether a numbered PRD with no stored stage shows nothing, a Syncing pill, or counts as PRD on the list.

## What I did meanwhile

Such a row shows no pill and the seven counts skip it; the PRD page itself still reads Syncing.

## What it costs to change later

A constant in the list's stage rule and one test; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the spec says each row shows its current stage and says nothing of a row not synced yet (author)

```

<!-- /omni-outbox-settled: s4-01-unsynced-row-no-pill -->

<!-- omni-outbox-settled: s4-02-stage-bar-inline-style -->

## s4-02-stage-bar-inline-style — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-stage-bar-inline-style
prd: 587
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

Where should the look of the new stage bar on the PRD list be defined?

## The decision, in plain words

It reuses the pills of the PRD page and adds two small spacing and underline rules right in the list's own code, because the shared stylesheet belongs to another part of this work.

## The intro, for fun

The stage bar wanted a new outfit, but the wardrobe belonged to a sibling.

## The punchline, for fun

So it borrowed the pills and pinned two tiny notes on its own sleeve.

## The options, in plain words

A. Keep the two rules inline (built): No change outside this slice's files; the bar still looks like the page's pills.
B. Move them into the shared stylesheet: One place for every stage style; touches the file the PRD page owns.

## What I had to decide

Whether the bar's two rules (space under the bar, no underline on its links) move into the shared dossier stylesheet.

## What I did meanwhile

The bar looks like the PRD page's pill row, with the two rules written inline in the list's component.

## What it costs to change later

Moving two rules into the stylesheet in a later change; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives the stylesheet to the PRD page slice; no rule says whether a list may add styles of its own (author)

```

<!-- /omni-outbox-settled: s4-02-stage-bar-inline-style -->

<!-- omni-outbox-settled: s5-01-outbox-read-from-the-branch -->

## s5-01-outbox-read-from-the-branch — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-outbox-read-from-the-branch
prd: 587
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The terminal summary tells whether a change waits for your review from what its building branch holds, not by asking GitHub. Is that fine?

## The decision, in plain words

We read it from the branch: once the final check has filed the PRD as shipped on its building branch, the change counts as waiting for you, because that step always comes right before it is marked ready.

## The intro, for fun

The summary had to guess whether the change was ready without phoning anyone.

## The punchline, for fun

It checked whether the suitcase was packed instead.

## The options, in plain words

A. A. Read it from the branch, offline: the option built.
B. B. Ask GitHub for the feature PR's draft flag, which needs the gh command and the network on every omni status.
C. C. Ask GitHub only with --fetch, and read the branch otherwise.

## What I had to decide

Whether omni status reads the outbox stage from git (the feature branch moved the PRD folder to shipped/, which omni ship does just before the feature PR is marked ready) or from GitHub's draft flag on the feature PR.

## What I did meanwhile

kit/lib/status/facts.mjs reads `ships` per feature branch (its shipped folder holds the PRD); overview.mjs counts such a PRD as outbox, and a built feature branch or one with open items as building. omni status still never calls GitHub and only touches the network with --fetch.

## What it costs to change later

A constant: facts.mjs would add one gh pr list call and overview.mjs would read its isDraft in place of `ships`. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A feature PR marked ready by hand without omni ship reads as building here, and one returned to draft after omni ship reads as outbox

```

<!-- /omni-outbox-settled: s5-01-outbox-read-from-the-branch -->

<!-- omni-outbox-settled: s5-02-idea-and-retro-in-the-terminal -->

## s5-02-idea-and-retro-in-the-terminal — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-idea-and-retro-in-the-terminal
prd: 587
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The terminal summary now shows all seven stages, but it cannot see ideas, which live only on the Omni app. Should it say so, and count a retro once its write-up is filed?

## The decision, in plain words

It shows idea as living on the app, with no number, and counts a shipped PRD as retro once its folder holds the retro write-up.

## The intro, for fun

Seven stages walked into the terminal, and one of them had stayed home on the app.

## The punchline, for fun

So the summary left it a note instead of a number.

## The options, in plain words

A. A. Idea says it lives on the app; retro counts from the filed retro write-up: the option built.
B. B. Leave idea out of the terminal summary, showing six stages there.
C. C. Also count a retro whose pull request is open but not merged, from its branch.

## What I had to decide

How omni status shows the two stages git alone does not state: idea (a draft dossier on the Omni app) and retro (the spec says a retro PR is opened; the repository shows retro.md in a shipped folder once it merges).

## What I did meanwhile

format.mjs prints `IDEA on the app` first on the counts line; facts.mjs reads the shipped folders holding retro.md (RETRO_FILE), and overview.mjs counts them as retro, still delivered in the bar and in your shipped row.

## What it costs to change later

A constant: IDEA_COUNT in format.mjs, and RETRO_FILE or a check for an open retro branch in facts.mjs.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a retro PR still open should already count as retro in the terminal, as it does on the app

```

<!-- /omni-outbox-settled: s5-02-idea-and-retro-in-the-terminal -->

<!-- omni-outbox-settled: s5-03-status-command-test-outside-territory -->

## s5-03-status-command-test-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-status-command-test-outside-territory
prd: 587
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

Changing the words of the terminal summary meant updating the older test of the whole command, which the plan gave to nobody. Is that fine?

## The decision, in plain words

We updated it in this slice, because it pins the summary's exact lines and would fail otherwise.

## The intro, for fun

The plan fenced off the summary, and its oldest test was leaning on the gate.

## The punchline, for fun

We let it in, since it only wanted to read the new words aloud.

## The options, in plain words

A. A. Keep the test change in this slice: the option built.
B. B. Move it to a slice of its own before the feature PR is ready.

## What I had to decide

Whether s5 may change kit/bin/status.test.mjs, outside its territory, when its own done-when changes the overview's lines that test pins.

## What I did meanwhile

kit/bin/status.test.mjs expects the seven-stage count lines, building in place of outbox and PRD in place of in review in your rows, and gains two tests: a feature branch that shipped its folder counts as outbox, and a shipped folder with retro.md as retro.

## What it costs to change later

Reverting one test file, which would then fail against the new overview.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan meant another slice to own kit/bin/status.test.mjs

```

<!-- /omni-outbox-settled: s5-03-status-command-test-outside-territory -->
