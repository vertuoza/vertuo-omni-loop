# Settled outbox items — PRD 2022

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-api-keys-count-toward-personal-limit -->

## s1-01-api-keys-count-toward-personal-limit — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-api-keys-count-toward-personal-limit
prd: 2022
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

An owner may hold at most 20 personal links and terminal tokens, and the API keys they make are counted in the same 20. Should API keys count only against the workspace's own limit of 20 keys instead?

## The decision, in plain words

We left the personal limit as it is, so the keys an owner makes still count toward their own 20 links and tokens, because changing that limit was outside this feature.

## The intro, for fun

Twenty is a lot of keys for one keyring.

## The punchline, for fun

Until the keyring is shared with the whole office.

## The options, in plain words

A. Leave the personal limit counting API keys, as built.
B. Leave API keys out of the personal limit in a follow-up migration, so only the workspace's 20 keys bound them.

## What I had to decide

Whether agent_tokens_live(), which counts a person's live tokens for the 20-per-person limit of agent links and kit tokens, should leave out the api scope.

## What I did meanwhile

Unchanged: an owner who made many API keys may hit the personal limit sooner. The spec puts any change to the agent link or kit tokens beyond the shared scope check out of scope.

## What it costs to change later

A one-line change to agent_tokens_live() in a follow-up migration, and its check.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether any owner will make enough keys to meet the personal limit (author)

```

<!-- /omni-outbox-settled: s1-01-api-keys-count-toward-personal-limit -->

<!-- omni-outbox-settled: s1-02-api-keys-check-in-ci -->

## s1-02-api-keys-check-in-ci — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-api-keys-check-in-ci
prd: 2022
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The new database check for API keys only proves something if the automatic checks run it on every change. Should this slice add it to them, though that file lies outside the ground it was given?

## The decision, in plain words

We added the check to the automatic database checks, as the team's own rule asks for every new check, and say so here because it reaches past the slice's ground.

## The intro, for fun

A test nobody runs is a very quiet test.

## The punchline, for fun

So we gave it a seat in the checks that run every time.

## The options, in plain words

A. Add the step in this slice, as the conventions form asks of the pull request that adds a check (built).
B. Leave the workflow untouched and add the step in a follow-up pull request, the check unrun until then.

## What I had to decide

Whether the slice that adds supabase/checks/api_keys.sql also adds its step to .github/workflows/supabase.yml, outside the plan's territory for s1.

## What I did meanwhile

The step is added after the runner job lines step; no other slice of PRD 2022 touches the workflow, so no sibling collides with it.

## What it costs to change later

One workflow step; removing it is one revert.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the workflow belongs to a slice territory of its own in later plans (author)

```

<!-- /omni-outbox-settled: s1-02-api-keys-check-in-ci -->

<!-- omni-outbox-settled: s1-03-api-keys-new-key-inline -->

## s1-03-api-keys-new-key-inline — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-api-keys-new-key-inline
prd: 2022
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The design of the API keys page left open how New key asks for the name and the repositories, and the page needed an answer to be built. Is a form that opens in the page, above the table, the right way?

## The decision, in plain words

New key opens a small form in the page, above the table, with the name and either all repositories or a pick among the tracked ones; Revoke asks a second time before it acts.

## The intro, for fun

Every new key needs a name before it gets a job.

## The punchline, for fun

We asked in the page, no pop-up drama.

## The options, in plain words

A. An inline form above the table, and Revoke asked twice (built).
B. A dialog for New key, and Revoke asked twice.
C. An inline form, and Revoke acting on its first click.

## What I had to decide

How New key asks for the name and the repositories on Settings › API keys: an inline form or a dialog (the api-keys draft screen's first open question), and whether Revoke asks twice.

## What I did meanwhile

An inline form above the table, All repositories picked first; Revoke shows Revoke for good and Keep on its first click. A revoked key leaves the table at once, as the plan's done-when says.

## What it costs to change later

A change of one component, ApiKeysView.tsx, and its render test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the screen owner prefers a dialog, as the draft screen leaves it open (author)

```

<!-- /omni-outbox-settled: s1-03-api-keys-new-key-inline -->

<!-- omni-outbox-settled: s1-04-api-keys-missing-from-sidebar -->

## s1-04-api-keys-missing-from-sidebar — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-api-keys-missing-from-sidebar
prd: 2022
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The new API keys page has its tab under Settings, but the side menu's Settings list still shows only the five older pages. Should the side menu list API keys too?

## The decision, in plain words

We added the tab the plan asked for and left the side menu as it is, because the menu lies outside the ground this slice was given; the page is still reached from the Settings tabs.

## The intro, for fun

The new room has a door, just not a sign in the hallway.

## The punchline, for fun

People who open Settings will still find it on the tabs.

## The options, in plain words

A. Leave the side menu as it is, the page reached from the Settings tabs (built).
B. Add API keys to the side menu's Settings list in a follow-up change.

## What I had to decide

Whether the sidebar's Settings entry (apps/galaxy/src/nav/sidebar.ts, with its tests and switch.test.ts) lists Settings › API keys beside the tab added to SETTINGS_TABS.

## What I did meanwhile

Only the Settings tabs name API keys; the menu's Settings list keeps Fleets, Repositories, Business, Products and Jev.

## What it costs to change later

One entry in sidebar.ts and three test lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the menu should list every Settings tab, or only some (author)

```

<!-- /omni-outbox-settled: s1-04-api-keys-missing-from-sidebar -->

<!-- omni-outbox-settled: s2-01-prd-list-numbers-and-drafts -->

## s2-01-prd-list-numbers-and-drafts — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-prd-list-numbers-and-drafts
prd: 2022
slice: s2
rank: medium
bears-on: none
raised: 2026-10-16
wave: 2
---

## The question, in plain words

The list of PRDs a program reads does not say whether a PRD still being written belongs in it, nor which number a product PRD carries. Should drafts show, and should a product PRD give its number on its product?

## The decision, in plain words

We list only PRDs that already have a number, so a draft still being brainstormed never shows. A product PRD gives its number on its product, and its name reads like the loop writes it, such as mobile-12.

## The intro, for fun

A draft is a PRD that has not picked its name yet.

## The punchline, for fun

We let it finish its coffee before the guest list goes out.

## The options, in plain words

A. A. List numbered PRDs only; a product PRD's number is its number on its product, as built.
B. B. List drafts too, with no number and no name until the PRD is numbered.
C. C. Keep drafts out, and give a product PRD no number, leaving its name, such as mobile-12, as the only way to tell it.

## What I had to decide

Whether GET /api/v1/prds lists draft dossiers (kind prd, no number yet), and what `number` holds for a product PRD, whose `ref` the spec gives as `<product key>-<seq>`.

## What I did meanwhile

The list keeps only numbered dossiers (`numbered_at` set, which a product PRD has from its birth). A repository PRD answers `number` = its issue and `ref` = that number. A product PRD answers `number` = its sequence on its product, `ref` = `<key>-<seq>`, `repo` and `issue` null, `stage` null. A product PRD whose product was deleted answers `ref` as the bare sequence and `product` null. The bug-fix list keeps only numbered dossiers too.

## What it costs to change later

A constant: drop the `numbered_at` filter in public-api.repository.ts and let `number` be nullable in the contract. Nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names `number` in the PRD shape without saying what it holds for a product PRD.
- (author) Whether a program wants to see PRDs still at the idea stage.

```

<!-- /omni-outbox-settled: s2-01-prd-list-numbers-and-drafts -->
