# Settled outbox items — PRD 100

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-migration-after-ask-mode -->

## s1-01-migration-after-ask-mode — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-migration-after-ask-mode
prd: 100
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Two projects change the game's database at the same time: workspaces, and the ask mode. In which order should their changes apply?

## The decision, in plain words

The workspaces change is dated after the ask mode's, so it applies last whichever ships first. If the ask mode ships first, the workspaces change stops with an error instead of quietly removing the ask mode's access rules, and the workspaces branch rewrites those rules for membership before it ships.

## The intro, for fun

Two database changes walk into production. Only one of them can go first.

## The punchline, for fun

We picked the polite one: it waits its turn, and it complains loudly if pushed.

## The options, in plain words

A. Date the workspaces change after the ask mode's, and let it stop loudly if the ask mode landed first. This is what was built.
B. Date it today, before the ask mode's, so the ask mode must be re-dated and rewritten if it ships second.
C. Have the workspaces change remove the ask mode's access rules by force when they exist, and rebuild them for membership in the same change.

## What I had to decide

The migration's timestamp. PRD #71 (ask-mode, `feat/ask-mode`) adds `20260926090000_ask_sessions.sql` and `20260926100000_ask_cli_codes.sql`, whose policies call `is_crew()`, which this migration drops. `supabase db push` refuses a local migration dated before the last one applied to production, so a workspaces migration dated today (`20260925…`) would be refused outright if #71 shipped first.

## What I did meanwhile

Named it `supabase/migrations/20260926120000_workspaces.sql`, after both of #71's. `drop function public.is_crew()` carries no `cascade`: if #71 has shipped first, the drop fails on #71's policies and the deploy stops, rather than silently dropping #71's row-level security. The spec's Risks already say #71 must move to `is_member()`; whichever PRD ships second merges `main` and does that rewrite.

## What it costs to change later

Renaming one file before the feature PR merges. Once production has applied it, the name is history.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- which of #71 and #100 ships first is not decided anywhere (author)

```

<!-- /omni-outbox-settled: s1-01-migration-after-ask-mode -->

<!-- omni-outbox-settled: s1-02-theme-colours-lowercase -->

## s1-02-theme-colours-lowercase — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-theme-colours-lowercase
prd: 100
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Should a workspace's colours be accepted only in lowercase, as the fleets' colours are, or in any case?

## The decision, in plain words

Only lowercase six-digit colours are accepted, the same rule the fleet colours already follow. A browser's colour picker gives colours in that form.

## The intro, for fun

Is a colour written in capital letters shouting, or just very excited about purple?

## The punchline, for fun

The database decided it is shouting, and asked for its indoor voice.

## The options, in plain words

A. Lowercase only, like the fleet colours. This is what was built.
B. Any case, turned into lowercase when it is stored.
C. Any case, stored exactly as typed.

## What I had to decide

`valid_theme()` checks each value against `^#[0-9a-f]{6}$`, as `teams_color_hex` does. The spec writes `#rrggbb` but does not say whether `#A45CFF` passes. s6's zod schema must apply the same rule, since its `theme.test.ts` reads the token list from this migration.

## What I did meanwhile

Lowercase only. `supabase/checks/access.sql` pins it: `{"plasma": "#A45CFF"}` is refused.

## What it costs to change later

The regex in `valid_theme()` (a forward migration that redefines it) and the matching zod rule in s6. Themes already stored stay valid either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- how PRD 3's settings page will let people type a colour, and so whether capitals will reach the database at all, is not known yet (author)

```

<!-- /omni-outbox-settled: s1-02-theme-colours-lowercase -->

<!-- omni-outbox-settled: s1-03-link-github-needs-a-workspace -->

## s1-03-link-github-needs-a-workspace — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-link-github-needs-a-workspace
prd: 100
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Should someone who belongs to no workspace be able to link their GitHub account?

## The decision, in plain words

No: linking answers only people who belong to at least one workspace, as it answered only Vertuoza accounts before. Its refusal no longer names Vertuoza.

## The intro, for fun

Linking GitHub without a workspace is like getting a locker key without a gym membership.

## The punchline, for fun

Harmless, maybe, but the front desk still asks which gym you are with.

## The options, in plain words

A. Refuse people who belong to no workspace, as other domains were refused before. This is what was built.
B. Answer anyone signed in; someone with no workspace simply has no player to update.

## What I had to decide

`link_github()` used to refuse any caller for whom `is_crew()` was false, with 'Sign in with your vertuoza.com account first.' The spec says what it refreshes (every player row of the caller) but not whom it refuses. It now raises 42501 for a caller with no `workspace_members` row: 'Sign in with an account of a workspace first.' The auth callback shows that message, so s5 should call `join_by_domain()` before `link_github()`; otherwise a session that predates the migration and links GitHub first is refused once.

## What I did meanwhile

Membership guard in `link_github()`; `supabase/checks/access.sql` proves an outsider with GitHub linked is refused, and a member is answered.

## What it costs to change later

One condition and one message in `link_github()`, redefined by a forward migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the order in which s5's auth callback calls join_by_domain() and link_github() is s5's to settle, and is not built yet (author)

```

<!-- /omni-outbox-settled: s1-03-link-github-needs-a-workspace -->

<!-- omni-outbox-settled: s4-01-game-scripts-refuse-stray-arguments -->

## s4-01-game-scripts-refuse-stray-arguments — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-game-scripts-refuse-stray-arguments
prd: 100
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When a game command is given something it does not understand, should it stop, or carry on as if it had not been given it?

## The decision, in plain words

It stops and says what it did not understand. Before, the polling command ignored everything it was given, so a misspelt workspace option would have quietly polled whichever workspace the setting named.

## The intro, for fun

A command that nods politely at words it does not know is how the wrong workspace gets polled.

## The punchline, for fun

Now it frowns and asks again, which is less polite and much kinder to the ledger.

## The options, in plain words

A. Stop on anything not understood, and say what it was. This is what was built.
B. Ignore what is not understood, as the commands did before, and use whichever workspace is named.
C. Warn about what is not understood, and carry on.

## What I had to decide

The spec asks every game script to take `--workspace <slug>`, falling back to `OMNI_LOOP_WORKSPACE`, and to fail loudly without one (D11), but says nothing of other arguments. `game/cli/project.mjs` read no argument at all, and `game/cli/banner.mjs` and `game/cli/export.mjs` ignored anything after their first. Once the flag exists, a misspelt `--worksapce acme` would have been ignored while `OMNI_LOOP_WORKSPACE` named another workspace, and the poll would have appended to that one.

## What I did meanwhile

`openWorkspace()` in `game/cli/workspace.mjs` parses each script's own arguments before any read: `game:project` takes none, `game:banner` exactly one PRD number, `game:export` exactly one directory, and `game:score` what `scoreArgs()` already accepted (it already refused the rest). Anything else exits 2 with the usage line, before Supabase or GitHub is called. `game/cli/scripts.test.mjs` pins it for all four scripts.

## What it costs to change later

A constant per script: the `parse` function each passes to `openWorkspace()`. Nothing stored changes, and the game workflow passes no extra argument.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether anything outside this repository runs the game scripts with arguments they used to ignore is not known (author)

```

<!-- /omni-outbox-settled: s4-01-game-scripts-refuse-stray-arguments -->
