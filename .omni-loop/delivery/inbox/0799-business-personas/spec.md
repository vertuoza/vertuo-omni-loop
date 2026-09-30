---
prd: 799
title: Personas
blocked-by: none
spec: file
---

# Personas

**Date:** 2026-09-30 · **PRD:** #799 · **From:** concept #746, area `customer-voice`, first of its two
PRDs (this one: the personas; the next: the voice in `/omni:brainstorm` and `/omni:think-big` that
speaks through them)
**Touches:**
- `supabase/migrations/` (one new file), `supabase/checks/personas.sql` (new), a step for it in
  `.github/workflows/supabase.yml`
- `packages/design/src/` (a persona sprite family)
- `apps/galaxy/src/business/` (the Personas section and its drawer)
- `apps/galaxy/src/business-api/`, `apps/galaxy/app/api/business/route.ts` (`personas` in the read)
- `kit/bin/commands/business.mjs`, `kit/bin/business.test.mjs`, `kit/dist/omni.mjs`
- `scripts/personas-import.mjs` (new)

## Problem

The business store (PRD 748) and its drafting (PRD 774) tell agents *what* the business is: an
offering, a size, a trade, a region, rivals. They do not tell anyone *who* the customer is as a
person. A brainstorm designs for "2–50-person builders", never for the plumber who runs five
plumbers and does his quotes at night on his phone, nor for his office manager, nor for the
accountant who only sees the month-end export.

Concept #746 crowned a customer's voice in the room. The person asked that the voice speak through
**personas**: a small cast per product, some excited, most neutral, one skeptical, each with a face,
a line on who they are and a line on how they use the product, that the team can shape and reuse.
Those personas come first; the voice that speaks through them is the next PRD.

## Solution

**The store.** Each product (PRD 748) holds any number of **personas**. A persona has:
- a **name** (1 to 40 characters);
- a **stance**: `excited`, `neutral` or `skeptical`;
- a **trade**, from one generic list;
- an **avatar**: preset numbers into that trade's sprite variations;
- **who**: who they are (at most 400 characters), for example "Plumber, runs his own company of 5
  plumbers, about €500k a year";
- **usage**: how they use the product (at most 400 characters), for example "Mostly the quotes and
  the dashboard".

Any member reads and writes the personas of their workspace. Nothing is seeded: a new workspace has
none.

**The sprites.** `packages/design` gains a persona family built with the sprite forge
(`forge.mjs`), in the arcade look of the heroes. Each trade has one base body with its own prop.
The trades are builder, plumber, heating engineer, electrician, carpenter, roofer, painter, site
foreman, office manager, accountant, doctor, nurse, shopkeeper, driver and developer. Every
variation is a ramp swap or a small overlay on that body: skin (6), hair style (6), hair colour (4),
outfit colour (4) and accessory (none, cap, glasses, helmet). That gives more than a hundred
variations per trade, with no new art for each. An avatar is stored as
`{ "v": 1, "skin", "hair", "hairColor", "outfit", "accessory" }` beside the trade, and the database
checks the same ranges.

**Settings › Business › Personas** (direction A of the brainstorm, the card grid). Below the
business sentence and its claims, a **Personas** section:
- a header with the count and **+ Add a persona**;
- one card per persona: portrait, name, trade, stance chip, then "who" and "uses";
- empty: "No personas yet — agents carry on", with + Add a persona;
- with two products or more, each product tab has its own personas; with one, the word "product"
  never shows (PRD 748).

**The drawer.** Adding or editing opens a drawer with the name, the stance (three chips), the trade
(a select), who, usage, and the portrait picker: 24 variations of the trade, **Shuffle** for 24
more, the chosen one outlined. A new persona starts on a variation picked at random for its trade.
Delete removes it at once and offers **Undo** for 5 seconds. There is no confirmation dialog.

**The read.** `GET /api/business` and `omni business show --json` gain
`personas: [{ "name", "stance", "trade", "who", "usage" }]` for the repository's product, oldest
first; `[]` when there are none. `omni business show` prints one line per persona under the
claims. Nothing else in the contract changes.

**The import.** `scripts/personas-import.mjs <workspace-id> <file.json>` reads a JSON array of
personas (with the product name each belongs to), checks every row as the database does, and prints
what it would add. `--write` adds them, all or none, as the service role. It never deletes or
changes an existing persona. After merge, Vertuoza's first five are written with the person in a
file kept outside the repository, and imported once.

## Decisions

Settled with the person during the brainstorm:

1. **Personas, not a nameless voice.** The customer's voice will speak through personas the team
   can shape and reuse. This PRD builds the personas; the voice is the next PRD of area
   `customer-voice`.
2. **Any number per product.** Five is how Vertuoza starts (one excited, three neutral, one
   skeptical), not a rule.
3. **Each persona has a stance** (`excited`, `neutral`, `skeptical`), **who they are** and **how they
   use the product**.
4. **Avatars are sprites picked from many generated variations per trade** (doctor, builder,
   plumber, heating engineer, electrician, …), auto-picked at first and changeable.
5. **Only Vertuoza's workspace is pre-filled, by a one-off import after merge.** No Vertuoza text in
   the code, and every other workspace starts empty.
6. **No AI generation of personas in this PRD.** A generator needs a brief to fit the business; it is
   a later version.
7. **The look is direction A, the card grid,** with a drawer holding the portrait picker.

Made in this spec, recorded here:

8. **Personas belong to a product,** as offering, size, trade and rival claims do. A repository reads
   its product's personas.
9. **Personas are not claims.** They have no source, state or receipt: they are the team's own
   picture of its customers, edited directly.
10. **The trade list is generic and lives in `packages/design`,** the same for every workspace.
    Adding a trade later is adding a body, not a migration: the database checks that the trade is
    a short lower-case word, and the page shows only trades it can draw.
11. **The read's `state` stays decided by claims only.** A workspace with personas but no confirmed
    claim reads `none`, and still returns its personas.
12. **Writes go through security-definer RPCs** refusing `42501` (not a member), `P0002` (gone) and
    `22023` (invalid, the field in `hint`), as in PRD 748.

## User stories

1. As a member, I add a persona in one drawer: a name, a stance, a trade, two lines, and a portrait
   I pick from the trade's variations or shuffle.
2. As a member, I see the cast of a product at a glance, as cards, and edit any of them.
3. As a member of a workspace with two products, I give each product its own personas.
4. As a member, I delete a persona by mistake and press Undo.
5. As an agent, I read a repository's personas with `omni business show --json`, and I find `[]`
   when there are none.
6. As the person setting up Vertuoza, I import its first five personas from a file once, after a dry
   run shows what will be added.

## Scope

**In:**
- the `personas` table, `valid_persona_avatar()`, the RPCs, and `supabase/checks/personas.sql` with
  its CI step;
- the persona sprite family in `packages/design`;
- the Personas section, its empty state, its drawer and the portrait picker, at 393px too, and in
  demo mode with sample personas that name no real company;
- `personas` in `GET /api/business` and `omni business show [--json]`;
- `scripts/personas-import.mjs`.

**Out:**
- the voice in `/omni:brainstorm` and `/omni:think-big`, "Save as a claim?" and gap questions (the
  next PRD);
- generating personas with AI;
- AI-painted or uploaded portraits;
- Vertuoza's personas themselves (imported after merge, never committed).

## Test seams

Tests follow `omni kb show testing`: beside the code, run by `pnpm test`, never calling GitHub or
Supabase.

- **SQL** (`supabase/checks/personas.sql`, in `business.sql`'s `raise exception 'FAIL: …'` style):
  a member adds, edits and deletes; a member of another workspace and a signed-out caller
  are refused (`42501`); a bad stance, an empty name, a text over 400 characters and an avatar out of
  range are refused (`22023`); a persona follows its product; `business_for_repo` returns the
  product's personas and `[]` without.
- **Design** (`packages/design`): every trade renders at every accessory; two different avatars give
  two different grids; the same avatar always gives the same grid; the ranges match the database's.
- **Galaxy:** render tests for the empty section, the card grid, the drawer and its picker, two
  products, 393px and demo mode; the reducer for add, edit, delete and Undo; the store's RPC calls and
  refusals.
- **API and kit:** `GET /api/business` carries `personas`; `kit/bin/business.test.mjs` checks
  `--json`'s `personas` and the printed lines against the fake server.
- **Import script:** a dry run writes nothing; one bad row refuses the whole file; `--write` adds
  every row once.

## Risks

- **What a merge publishes** (`omni kb show releasing`): the migration goes to the production
  Supabase project through the Supabase workflow's deploy; the page ships with galaxy; the `personas`
  field reaches every install of `omni` through the next `chore(release)`.
- **Migration order:** check the latest migration on `main` right before merging, and date this one
  after it (the lesson of #771).
- **Rollback:** revert the PR, then a follow-up migration drops `personas`, its functions and
  `valid_persona_avatar()`. Nothing else reads them.
- **The import runs as the service role,** so a wrong workspace id writes to the wrong workspace; the
  dry run prints the workspace's name before anything is written.
- **Privacy:** personas are workspace data, read only by its members; a persona describes a type of
  customer, and the page's hint says not to write a real customer's name.
- **Not proven by CI:** the portraits' look in a browser, light and dark, and Vertuoza's import.
  Owed after merge by a person.

## Acceptance criteria

1. On a workspace with no persona, Settings › Business shows the Personas section with "No personas
   yet — agents carry on" and + Add a persona.
2. + Add a persona opens the drawer; saving a name, a stance, a trade, who, usage and a portrait adds
   a card showing all of them.
3. The portrait picker shows 24 variations of the chosen trade; Shuffle shows 24 others; a new
   persona starts on a random variation of its trade.
4. Editing a persona changes its card; deleting it removes the card and Undo within 5 seconds brings
   it back.
5. With two products, each product tab shows its own personas; with one, no text says "product".
6. A member of another workspace, or a signed-out caller, cannot read or write the personas, and a bad
   stance, name, text or avatar is refused (the SQL check proves it).
7. Every trade draws at every accessory, and the same avatar always draws the same portrait.
8. `omni business show --json` returns `personas` for the repository's product (`[]` without), and
   `omni business show` prints one line per persona.
9. `scripts/personas-import.mjs` prints what it would add without `--write`, adds every row with it,
   and refuses the whole file when one row is invalid.
10. The Personas section works at 393px and in demo mode.
