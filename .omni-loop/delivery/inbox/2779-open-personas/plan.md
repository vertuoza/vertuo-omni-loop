# Plan: Personas any product can describe

PRD #2779, specified in [`spec.md`](spec.md) beside this plan. It is built on the feature branch
`feat/open-personas` into `main` (the feature PR says `Closes #2779`), and each slice is a sub-PR
from `feat/open-personas--<slice>` into the feature branch (`Part of #2779`). One landing: the
migration and the app that reads its rows ship in the same merge (the spec's deploy order).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | Stance renamed enthusiastic end to end on the server, and the trade rule loosened: one migration (rows, both rules, `persona_fields()` taking excited, `persona_find()`), the database checks and types, `GET /api/business` with `stances=2` (excited for everyone else), the page's chip, the Voice tab and the import script reading both words | `supabase/migrations/` `supabase/checks/personas.sql` `supabase/checks/product_lookups.sql` `supabase/checks/business.sql` `supabase/database.types.ts` `apps/galaxy/src/business-api/` `apps/galaxy/src/business/personas` `apps/galaxy/src/business/PersonasSection.tsx` `apps/galaxy/src/business/BusinessScreen.tsx` `apps/galaxy/src/business/business.css` `apps/galaxy/src/business/load.test.ts` `apps/galaxy/src/business/schemas.test.ts` `apps/galaxy/src/business/business.boundary.test.ts` `apps/galaxy/src/dossier/page/voice` `apps/galaxy/src/dossier/page/VoicePane.tsx` `apps/galaxy/src/dossier/page/demo.ts` `apps/galaxy/src/dossier/page/dossier.css` `apps/galaxy/src/product-knowledge/personas/` `scripts/personas-import` | — | 1 | deep |
| s2 | The kit reads both stances: `omni business show` sends `stances=2` and takes excited or enthusiastic, `voice.json` takes both, the old-kit test proves the v0.0.613 reader keeps its personas, and the skills that write a voice say enthusiastic | `kit/bin/commands/business` `kit/lib/voice/` `kit/lib/product/` `kit/lib/help/entries.ts` `kit/plugin/skills/brainstorm/` `kit/plugin/skills/think-big/` | — | 1 | build |
| s3 | Six new trades with their own busts, the generic bust for any other trade, and the drawer's Other… field with its live check, on the Knowledge tab and Settings › Business | `packages/design/src/personas` `apps/galaxy/src/business/personas` `apps/galaxy/src/business/PersonasSection.tsx` `apps/galaxy/src/business/business.css` `apps/galaxy/src/product-knowledge/personas/` | s1 | 2 | build |
| s4 | `omni business persona add` and `edit` through `POST /api/knowledge/changes` kind `persona` (random portrait on add, kept on edit, edit by name with its 404 and 409), its help entries, and the Persona row of `/omni:knowledge-add` | `apps/galaxy/src/knowledge-api/` `kit/bin/commands/business` `kit/lib/help/entries.ts` `kit/plugin/skills/knowledge-add/` | s1, s2 | 2 | build |

**Shared ground.**

- `apps/galaxy/src/business/personas` (the model and its tests), `PersonasSection.tsx`,
  `business.css` and `apps/galaxy/src/product-knowledge/personas/`: s1 (the stance) and s3 (the
  trades). s3 is in wave 2, after s1 merged.
- `kit/bin/commands/business` (the command and its tests) and `kit/lib/help/entries.ts`: s2 (the
  read) and s4 (the write). s4 is in wave 2, after s2 merged.
- `kit/dist/` and `apps/omni-app/api/` are generated: no slice commits them, the wave rebuilds them.

## Per slice: done when

### s1 (deep: a data migration with a rename the running app and old kits read)

**s1** (`ui: yes`)
- One migration, dated after the newest on `main` (`node scripts/migration-order.ts`): no persona's
  stance is `excited` afterwards; the stance rule is `enthusiastic, neutral, skeptical`; the trade
  rule is `^[a-z]+([ -][a-z]+)*$`, at most 40 characters.
- `persona_add` and `persona_edit` given `excited` store `enthusiastic`; given `angry` they refuse
  with `Stance: enthusiastic, neutral or skeptical.`; `data analyst` and `credit-risk analyst` are
  stored, and `Data`, ` analyst`, `analyst-`, `a  b` and 41 letters refused with the new trade line.
- `persona_find(workspace, product, name)` returns the one live persona, raises P0002 for none and a
  distinct refusal for several, and refuses a non-member: all proven in `supabase/checks/personas.sql`.
- `supabase/database.types.ts` regenerated.
- `GET /api/business` with `stances=2` sends `enthusiastic`; without it sends `excited` for an
  enthusiastic persona, nothing else changed (`apps/galaxy/src/business-api/api.test.ts`).
- The page's chip reads Enthusiastic; the Voice tab and `scripts/personas-import.ts` take both words.

### s2

**s2**
- `omni business show` sends `stances=2` and reads `excited` and `enthusiastic`, and any trade text.
- `kit/bin/commands/business-compat.test.ts` keeps `business.ts` as shipped in v0.0.613 as a
  fixture and proves it keeps every persona of the reply sent without `stances=2` (an enthusiastic
  persona sent as excited, an Other trade with a space).
- `voice.json` reads both words; every `voice.json` in the repository passes `omni check inbox`.
- The brainstorm and think-big skills, and `omni help`, name the stances as enthusiastic, neutral,
  skeptical.

### s3

**s3** (`ui: yes`)
- The drawer's Trade select lists the twenty-one trades, then Other…; each of the twenty-one and the
  generic bust draws for every avatar in the ranges (`packages/design/src/personas.test.ts`).
- Every listed id passes the trade rule, exported once and used by the page's live check.
- Choosing Other… shows the Other trade field; `credit risk analyst` saves and draws with the generic
  bust on the card and in the picker; `Credit` or `analyst-` shows the rule line in red and Save
  keeps the drawer open (component tests).
- The draft screen `persona-drawer` matches what was built (`/omni:pixel-perfect review`).

### s4

**s4** (`ui: yes`)
- `POST /api/knowledge/changes` takes kind `persona`, add and edit: add with a random avatar for the
  trade; edit changes only the fields sent and keeps the avatar; 404 `no persona named "<name>" in
  <product>`; 409 for several of that name or several products and none named; 422 with the
  database's words; 401 signed out (`knowledge-api.controller.test.ts` and the service's tests).
- `omni business persona add …` prints `added persona:<name> · <url>`, `edit` prints
  `edited persona:<name> · <url>`, `--json` prints the reply; exit 2 for a missing flag, an edit with
  no field or an unknown stance, the usage line listing `enthusiastic, neutral, skeptical`; exit 1
  for a refusal, a sign-out or an unreachable page (through `main()` with a fake fetch).
- `/omni:knowledge-add` has the Persona row: shown whole, Yes / Change / Cancel, one persona per Yes,
  every missing field asked for.
