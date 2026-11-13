---
prd: 2779
title: Personas any product can describe
blocked-by: none
spec: file
phase0: server
areas: [product-knowledge]
---

## Problem

A product's personas say who agents picture when they design. Three things stop a team from
describing anyone outside construction:

1. **The trade list is narrow.** The persona drawer offers fifteen trades, mostly construction ones
   (builder, plumber, driver…). A product read by journalists, materials suppliers, economists,
   bankers, marketers or data analysts saves those personas under a trade that is wrong, and the
   agents that read them picture the wrong person. The database already takes any lower-case word;
   the page offers no way to type one, and a trade with no portrait art draws no portrait.
2. **The stances are a fixed word list nobody can see.** A persona is `excited`, `neutral` or
   `skeptical`. A team that says "enthusiastic" has to guess the mapping, and a skill has no place to
   read the three words from before it proposes one.
3. **Nothing writes a persona from the terminal.** `omni business show` reads them, and
   `omni kb glossary`, `omni kb legal` and `omni constituents` add or edit their items, but a persona
   is only ever written on the page. An agent asked to fix a persona cannot.

## Solution

**Trades.** The pick list grows from fifteen to twenty-one trades, each with its own 32×32 bust and
prop in `@omni/design`: journalist (notebook), supplier (brick pallet), economist (rising chart),
finance (bank card), marketing (megaphone), data analyst (laptop with a bar chart). Their ids are
`journalist`, `supplier`, `economist`, `finance`, `marketing` and `data analyst`. An **Other…** entry
at the end of the drawer's Trade select opens a text field: an Other trade is lower-case letters,
single spaces or hyphens between words, at most 40 characters (`credit risk analyst`). A trade with
no art of its own is drawn with one new **generic** bust, with the same skin, hair, hair colour,
outfit and accessory presets as every trade, so the portrait picker works on it unchanged.

**Stance.** `excited` is renamed `enthusiastic` everywhere: the stored personas (moved by the
migration), the database's rule, the page's chip ("Enthusiastic"), the business read, the CLI and
`voice.json`. Writers that still send `excited` (an older kit, an older skill) are accepted and
stored as `enthusiastic`. Any other stance is refused with the list, `enthusiastic, neutral or
skeptical`.

**Old kits keep reading.** A kit from before this PRD refuses the whole business read when one
persona has a stance it does not know, and so loses its personas, glossary and Legal entries. The
read therefore sends `enthusiastic` only to a kit that asks for it: `GET /api/business?…&stances=2`.
Without `stances=2`, every `enthusiastic` persona is sent as `excited`, and nothing else in the reply
changes. This kit sends `stances=2` and reads both words.

**The terminal.**

```text
omni business persona add --name <text> --stance <stance> --trade <trade> --who <text> --usage <text> [--product <name>] [--json]
omni business persona edit "<name>" [--name <text>] [--stance <stance>] [--trade <trade>] [--who <text>] [--usage <text>] [--product <name>] [--json]
```

Both send `POST /api/knowledge/changes` with a new kind, `persona`, as the signed-in member (the
route glossary and Legal entries use). An add gets a random portrait for its trade; an edit keeps
the portrait (its numbers are valid for every trade) and changes only the fields it names. An edit
finds the persona by its name in the product. Personas have no owner, so a member's change is always
`applied`. Success prints `added persona:<name> · <url>` or `edited persona:<name> · <url>`, the url
the persona's page on the Knowledge tab; `--json` prints the route's answer. No remove: deleting
stays on the page.

**History.** Every change to a persona is recorded in the product's knowledge history
(`product_knowledge_events`), as Legal and Glossary changes are (BL-PRODUCTKNOWLEDGE-2): the
events take a kind `persona` and a `persona_id`, as PRD 2583 added `domains`. `persona_add` appends
`added` (after: the persona's fields), `persona_edit` appends `edited` (before and after),
`persona_delete` appends `removed` (before), and `persona_restore` (Undo) appends a new action,
`restored` (after), each with `changed_by` the caller, in the same transaction as the change. The
migration's rename appends one `edited` event per persona it moves, `changed_by` null, so the history
still shows that it said `excited`. The fields recorded are name, stance, trade, avatar, who and
usage. The page's History of a persona stays as it is; the record is readable by the workspace's
members, as the rest of the history is.

**The skill.** `/omni:knowledge-add` gets a Persona row: one persona per Yes, shown whole first
(name, stance, trade, who, usage, add or edit), every field the person did not give asked for and
never filled in.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | db | `persona_find` | no written convention: follows `persona_of` ← supabase/migrations/20261022090000_personas.sql:142 |
| vertuo-omni-loop | db | `<date>_open_personas.sql` | conventions › A migration stays the newest ← AGENTS.md, `node scripts/migration-order.ts` |
| vertuo-omni-loop | api | kind `persona` | follows `ChangeHeadSchema` ← apps/galaxy/src/knowledge-api/knowledge-api.contract.ts:97 |
| vertuo-omni-loop | api | query `stances=2` | no written convention: follows the read's own query `repo` ← apps/galaxy/src/business-api/read.ts:131 |
| vertuo-omni-loop | cli | `omni business persona add\|edit` | follows `omni business claim add` ← kit/bin/commands/business.ts:38 and `omni kb glossary add\|edit` ← kit/bin/kb-write.ts:1 |
| vertuo-omni-loop | ui | trade ids `journalist` … `data analyst` | follows `TRADE_LABELS` ← packages/design/src/personas.ts:25 |
| vertuo-omni-loop | ui | `GENERIC_TRADE` bust | no written convention: follows `TRADES` ← packages/design/src/personas.ts:200 |

## Decisions

1. **Trades: a longer list plus Other… free text**, not a workspace-managed trade list (the person's
   answer). No new table.
2. **Each new trade has its own art; an Other trade uses one generic bust** (the person's answer).
3. **`excited` is renamed `enthusiastic`**, not aliased and not only documented (the person's
   answer). Writers sending `excited` keep working.
4. **The read keeps old kits whole** with `stances=2`: without it, `enthusiastic` reads `excited`.
5. **The trade rule loosens** from `^[a-z]+$` to `^[a-z]+([ -][a-z]+)*$`, at most 40 characters, in
   the database and the page alike, so `data analyst` is one trade.
6. **CLI name:** `omni business persona`, as the person asked, beside `omni business claim`, not under
   `omni kb`. The write goes through `/api/knowledge/changes` like the Knowledge tab's other items.
7. **Edit by name.** No persona with that name: 404 `no persona named "<name>" in <product>`. Two
   live personas with that name: 409 `several personas are named "<name>": edit it on the Knowledge
   tab`. Names stay non-unique; the page is unchanged.
8. **Always applied.** Personas have no owner or delegate today; the database's member check decides
   who may, as it does on the page.
9. **The voice's objection** (persona:F-E Developer: renaming a stored stance can break a runner in
   production) was **accepted**: the design adds `stances=2` and a test that reads the new reply with
   the business reader as shipped in v0.0.613.
10. **Persona changes are recorded** (the PRD page's business-law judge, BL-PRODUCTKNOWLEDGE-2,
    agreed by the person): the spec first left personas out of the history because the law names
    Legal and Glossary only; the judge read the law as covering every knowledge entry agents follow,
    and the spec now meets it rather than amending it. A person's change carries its `changed_by`;
    the migration's rename is recorded with `changed_by` null, the one change no person made.

## User stories

- As a member describing a product read by economists, I pick **Economist** in the drawer and its
  portrait shows a person with a chart.
- As a member whose customer fits no trade, I pick **Other…**, type `credit risk analyst`, and the
  persona is drawn with the generic portrait and listed under that trade.
- As a member, I see the stance chip **Enthusiastic** on a persona that read "Excited" before.
- As an agent, I run `omni business persona edit "Sam" --trade journalist --stance enthusiastic`
  and read `edited persona:Sam · <url>`; `omni business show` then prints Sam as an enthusiastic
  journalist.
- As an agent, I run `omni business persona add` with a stance the product does not know, and the
  usage error lists `enthusiastic, neutral, skeptical`.
- As a person in `/omni:knowledge-add`, I say "add a persona: Ada, a skeptical data analyst", am asked
  for who and usage, see the persona whole, answer Yes, and read `added persona:Ada · <url>`.
- As a runner on an older kit, I keep reading the business, personas included, after the rename.

## Scope

In:

- one migration: stance rows and rule, the trade rule, `persona_fields()` taking `excited`,
  `persona_find()`, the history (`product_knowledge_events` kind `persona`, `persona_id`, action
  `restored`, an event from each persona function and from the rename); `supabase/database.types.ts`
  regenerated; `supabase/checks/personas.sql`;
- `@omni/design`: six trades with their busts and props, the generic bust, `personaGrid()` drawing
  any valid trade (a listed one with its art, any other with the generic bust);
- the page: the Knowledge tab's persona drawer and list (and the Business screen's section, which
  shares the model), Other… with its live check, the Enthusiastic chip;
- `GET /api/business`: `stances=2`;
- `POST /api/knowledge/changes`: kind `persona`, add and edit;
- the kit: `omni business persona add|edit`, `omni business show` reading both words and sending
  `stances=2`, `voice.json` and the dossier's Voice tab reading both words, `omni help` entries,
  `scripts/personas-import.ts`;
- `/omni:knowledge-add`: the Persona row, and the brainstorm and think-big skills' word for the stance.

Out:

- a workspace-managed trade list; removing a persona from the terminal; unique persona names;
- showing a persona's recorded history on its page (it keeps today's added and changed lines);
- changing any product's personas: a person does that, after this ships, with `/omni:knowledge-add`.

## Test seams

Following `omni kb show testing`: no test calls GitHub or Supabase; the database is proven in
`supabase/checks/`.

- **Database** (`supabase/checks/personas.sql`, realistic rows): the migration moves an `excited` row
  to `enthusiastic`; `persona_add` and `persona_edit` store `enthusiastic` for `excited` and refuse
  `angry` with `Stance: enthusiastic, neutral or skeptical.`; trade takes `data analyst` and
  `credit-risk analyst` and refuses `Data`, ` analyst`, `analyst-`, `a  b` and 41 letters;
  `persona_find` with none, one and two of a name; a member of another workspace is refused; add,
  edit, delete and restore each append one event of kind `persona` with the right action, before,
  after and `changed_by`, and a refused change appends none; the rename appends one `edited` event
  per moved persona with `changed_by` null; a member of another workspace reads none of them.
- **Design** (`packages/design/src/personas.test.ts`): each of the twenty-one trades and the generic
  bust draws for every avatar in the ranges; every listed id passes the database's trade rule (the
  same regex, exported once).
- **API** (`knowledge-api.controller.test.ts`, the service's tests, a fake repository): add and edit
  of kind `persona`; edit changes only the fields sent; a random avatar on add, the avatar kept on
  edit; 404, 409 (two of a name, or several products and none named), 422 with the database's words,
  401.
- **Read** (`apps/galaxy/src/business-api/api.test.ts`): with and without `stances=2`.
- **Old kit** (`kit/bin/commands/business-compat.test.ts`): `kit/bin/commands/business.ts` as shipped
  in v0.0.613, kept as a fixture, parses the reply sent without `stances=2` (an enthusiastic persona,
  an Other trade) and keeps every persona.
- **Terminal** (`kit/bin/commands/business.test.ts`, through `main()` with a fake fetch): the two
  verbs' lines and `--json`, `--product`, exit 2 for a missing flag, an edit with no field or an
  unknown stance (its line listing the three), exit 1 for a refusal, a sign-out or an unreachable
  page; `show` reads `excited` and `enthusiastic`.
- **Voice** (`kit/lib/voice/voice.test.ts`): both words read; every `voice.json` in the repository
  still passes `omni check inbox`.
- **Page** (component tests): the drawer's Other… and its field with the live check; a card with an
  Other trade and the generic portrait; the chip reads Enthusiastic.
- **Skill**: the kit's skill tests see the Persona row in `/omni:knowledge-add`.

## Risks

**What merging publishes.** A database migration (run by the supabase workflow on merge), the
galaxy app (Vercel), the kit's next release. Rollback: the app and the kit roll back by redeploy and
release; the migration is rolled back by a new migration that moves `enthusiastic` back to
`excited` and restores the two rules (a free trade with a space would then have to be renamed
first, so the rollback migration refuses until none is left). See `omni kb show releasing`.

**The history's version.** The newest event id of a product is the version the canon gate's
cached verdict is keyed by, so a persona change now makes the next canon check judge afresh, as a
glossary change does. That is wanted: personas are part of what agents read.

**Old kits.** Covered by `stances=2` and its test. A kit older than this PRD that *writes* a persona
does not exist (no write before it).

**The Legal entries:** L-GDPR-1: a persona's who and usage are workspace data; the new write goes
through the same member check as the page, and the reply names nothing outside the workspace. No
other entry touched.

**The locked laws** (all printed by `omni kb laws` for the files above, none changed by the design):

- BR-PRODUCT-28: a stranger could tie themselves to a team and see its work. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-63: an agent could read another team's private work. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-64: a person who left the team could still read its work through an agent. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-12: the terminal would act on answers changed after the fact. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-29: a stranger could read a team's questions and answers. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-39: a question could leak to the wrong people, or its owner could lose it. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-16: scores and history could change after the fact. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-15: unreviewed work would reach every user. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-59: a member could copy the workspace's paid AI key. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.

**The business laws** (`omni kb business-laws --spec`, domain product-knowledge):

- BL-PRODUCTKNOWLEDGE-1 (a non-owner only proposes a Legal or Glossary change): kept. Personas are
  neither; the persona kind is always applied, and Legal and Glossary changes are untouched.
- BL-PRODUCTKNOWLEDGE-2 (every Legal or Glossary change is recorded): kept, and extended to
  personas: every persona change, from the page, the terminal or the migration, is recorded with who
  made it and what the persona said before and after (Decision 10).
- BL-PRODUCTKNOWLEDGE-3 (a retired Legal entry is kept): kept, not touched.
- BL-PRODUCTKNOWLEDGE-4 (a merged knowledge change reaches the product): kept, not touched.

## Acceptance criteria

1. The persona drawer lists twenty-one trades, each drawn with its own portrait, then **Other…**.
2. Choosing Other… and typing `credit risk analyst` saves the persona with that trade, drawn with the
   generic portrait; typing `Credit` or `analyst-` shows the trade rule under the field and does not
   save.
3. After the migration, no persona's stance is `excited`, and the chip of each that was reads
   **Enthusiastic**.
4. `persona_add` and `persona_edit` given `excited` store `enthusiastic`; given `angry`, they refuse
   with `Stance: enthusiastic, neutral or skeptical.`
5. `GET /api/business` without `stances=2` sends `excited` for an enthusiastic persona; with it, sends
   `enthusiastic`. The v0.0.613 reader keeps every persona of the reply without it.
6. `omni business persona add --name Ada --stance skeptical --trade "data analyst" --who … --usage …`
   prints `added persona:Ada · <url>` and `omni business show` then lists Ada.
7. `omni business persona edit "Ada" --trade journalist` changes only the trade, keeps the portrait,
   and prints `edited persona:Ada · <url>`.
8. An edit naming no persona of the product exits 1 with `no persona named "<name>" in <product>`;
   one naming two exits 1 with the "several personas" line.
9. A missing flag, an edit with no field, or an unknown stance exits 2 with the usage line, which
   lists `enthusiastic, neutral, skeptical`.
10. `/omni:knowledge-add` has a Persona row: it shows the persona whole, asks Yes / Change / Cancel,
    and writes one persona per Yes with `omni business persona add|edit --json`.
11. Every `voice.json` in the repository still passes `omni check inbox`, and a new one may say
    `enthusiastic`.
12. Adding, editing, deleting or restoring a persona, on the page or from the terminal, appends one
    event to the product's knowledge history with who did it and the persona's fields before and
    after; the rename's events say `excited` before and `enthusiastic` after.
