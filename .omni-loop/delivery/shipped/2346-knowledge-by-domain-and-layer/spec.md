---
prd: 2346
title: Knowledge found by domain and layer
blocked-by: none
spec: file
phase0: server
---

# Knowledge found by domain and layer

**Date:** 2026-10-21 · **PRD:** #2346 · **Touches:** `kit` (config, knowledge registers, `omni kb
laws`, `omni kb graph`, `omni check`, the skills that read them, `/omni:invade`), `supabase` (one
migration), `apps/galaxy` (the product's Repositories tab), `docs/guide`, and this repository's own
knowledge folder.

## Problem

An agent asks the knowledge base what applies before it changes a file (`omni kb laws --paths
<file>`). The answer is decided by one regular expression per entry, its `Governs:` line, written by
hand. A test on 2026-10-21 ran five made-up changes through it:

| change | should find | found |
|---|---|---|
| let a person edit an answer, in `apps/galaxy/src/ask/ask.service.ts` | BR-PRODUCT-12 | only when a migration was in the list too |
| log the workspace AI key in clear, in `apps/galaxy/src/jev/` | BR-PRODUCT-59, L-GDPR-2 | nothing |
| an agent applies the override label, in `kit/plugin/skills/pr/` | BR-PRODUCT-3, BR-PRODUCT-5 | yes |
| the ask hook answers for the person, in `kit/lib/ask/hook.ts` | N-PRODUCT-7, N-PRODUCT-8 | yes |
| a notification tap opens another site, in `apps/galaxy/src/push/sw.ts` | N-PRODUCT-18 | nothing: it has no `Governs:` |

Four causes:

- **A rule points at its test, not at the code it protects.** BR-PRODUCT-12 governs
  `rounds-sql.test.ts` and `^supabase/migrations/`, never `apps/galaxy/src/ask/`.
- **One broad pattern pulls in everything.** Nine rules govern `^supabase/migrations/`, so one
  migration lists theme colours and fleet mascots beside the rule that matters.
- **All 20 locked laws print for any path**, whether or not they apply, so the one that matters
  reads like the rest.
- **ADRs are linked only by the PRD they came from** (`same-prd`), so an override-label rule brings
  the planner's ADRs, and an ADR is never found from a file.

16 entries have no `Governs:` at all (BR-PRODUCT-103 to 120, N-PRODUCT-18) and are never shown.

The words that would fix it are not shared either: a contract kind (`contracts.kinds`, PRD 1870)
and a repository's role in a product (`plan.targets[].role`, `product_repositories.role`) are any
word each repository picks, so `db` in one repository and `database` in another never meet.

## Solution

**Every file has a domain and layers, declared once per repository, optionally. Business rules,
invariants and laws belong to a domain; ADRs name layers. A lookup shows what applies to the files
first, then what is global, and nothing from other areas. The layer and role words are one canonical
list the kit ships.**

### 1. Canonical words

The kit ships two lists, each word with a one-line definition, documented on a new guide page
`docs/guide/knowledge-map.md`:

- **Layers (10):** `ui` (screens and components) · `api` (REST or RPC routes and their payloads)
  · `schema` (GraphQL or other typed contracts callers compile against) · `db` (stored shapes,
  migrations, row-level security) · `auth` (identity, sign-in, access) · `event` (webhooks, queues,
  messages between services) · `cli` (commands a person or an agent types) · `job` (cron, workers,
  background runs) · `infra` (deploy, environments, hosting) · `ci` (pipelines, hooks, checks).
- **Roles (9):** `api` · `web` · `mobile` · `ui` · `library` · `infra` · `plan` · `doc` ·
  `monorepo`, each with the layers it usually holds, as guidance only (`api` → api, schema, db,
  auth, event, job).

**Old words.** A fixed alias table maps the words in use today once: layers `rest → api`,
`graphql → schema`, `database → db`, `migration → db`; roles `back-end → api`, `backend → api`,
`front-end → web`, `frontend → web`, `docs → doc`. Any other old word is kept and flagged, never
refused on what already exists:

- `contracts.kinds` must be layers (the default stays `[api, db]`). An alias reads as its layer; any
  other word is a `not ok` line of `omni check config` naming it and the list, and `omni plan check`
  still accepts it until a person replaces it.
- Roles in `plan.targets[]` and on the Omni page must be canonical. The migration maps every alias in
  `product_repositories.role`; a role it cannot map stays and is flagged on the product's
  Repositories tab (`back-end-legacy is not a role: pick one`) and by `omni targets`.
  `product_repository_link()` refuses a new non-canonical role (22023, hint `role`). The tab's
  **Role** field becomes a select of the nine roles; a flagged old value shows as its first option,
  marked, until it is changed.

### 2. The map, in the repository's config, all optional

```yaml
layers:                          # NEW: canonical layer -> paths; a file may be in several
  db:   [^supabase/migrations/, ^supabase/checks/]
  cli:  [^kit/bin/]
  auth: [^apps/galaxy/src/auth/]
flow:
  areas:                         # EXISTS (PRD 1089): now read by the knowledge lookups too
    ask: { paths: [^kit/lib/ask/, ^apps/galaxy/src/ask/], knowledge: ask }
```

- `layers.<layer>` is a list of regular expressions over repository paths, written as a flow area's
  `paths` are. Its keys are canonical layers; any other key is refused by name.
- A file's **domain** is the `knowledge` folder of the first flow area whose `paths` match it, as a
  flow area already resolves. A file's **layers** are every layer whose paths match it.
- Nothing declared means nothing narrowed: every entry is global, and a lookup lists what it lists
  today.
- `omni check config` flags a `layers` or flow-area pattern that matches no tracked file, naming it,
  so a map gone stale shows red instead of hiding rules.

### 3. What each entry says

| entry | its domain | its layers | exceptions |
|---|---|---|---|
| rule, invariant, principle (`knowledge/<domain>/`) | its folder, as today | optional `Layers: db, auth` | `Governs:`, as today |
| ADR (`knowledge/adr/NNNN-*.md`) | optional `· **Domain:** ask` on its status line | `· **Layers:** db` on its status line | none |
| Legal entry (Omni page) | none: always global | none | none |

- An entry moved into another domain folder keeps its id through `Kept id:`, as the registers already
  allow, so locked laws, CODEOWNERS lines and tests that name an id are unchanged.
- `omni check knowledge` refuses a layer outside the canonical list and an ADR `Domain:` with no
  folder, naming the entry.
- A locked law no longer needs a `Governs:` line. It is **reachable** when its `Governs:` is set,
  when an area maps its domain, or when `layers` maps one of its layers; otherwise it is global,
  which is allowed. The check that today refuses a law with no `Governs:` refuses nothing in its
  place.

### 4. The lookup

`omni kb laws --paths <file>…` and `--slice <prd> <slice>` (and `kb graph --paths`) resolve each
file's domain and layers, then:

- An entry **applies** when its `Governs:` matches a file, or its domain is a file's domain, or its
  layers meet a file's layers.
- An entry is **global** when nothing narrows it: its domain is mapped by no area, it names no
  layer, and it has no `Governs:`. Every Legal entry is global.
- Everything else belongs to other areas and is not shown.

It prints, in this order:

```text
Applies here
law BR-PRODUCT-12 — An answer never changes after it is given. If broken: … (domain ask)
rule BR-PRODUCT-14 — … (domain ask)
adr ADR-0029 — The ask API answers each refusal with a standard HTTP code … (layer api)
Global
law N-PRODUCT-15 — Only a person merges into the main branch … 
legal L-GDPR-2 — Credentials are never stored or logged in clear …
14 locked laws of other areas: not shown (omni kb laws prints them all).
```

Each line says why it applies (`domain <d>`, `layer <l>`, `governs`). `omni kb laws` with no flag
prints every law, as today; `--area <domain>` lists that domain's entries. `--json` carries the same
groups (`applies`, `global`, `hidden`). The briefing still lists every locked law's id at session
start.

`omni kb graph` gains two edge kinds, `domain` and `layer`, from an entry to the files' area or
layer, and links an ADR to the rules of the same domain or layer; `same-prd` stays.

### 5. `/omni:invade` proposes the map

`/omni:invade` and `/omni:invade --refresh` learn the new shape, from evidence only:

- `layers:` paths for each canonical layer it can prove (a migrations folder is `db`, a `bin/` with
  a command parser is `cli`);
- a flow area with `knowledge: <domain>` for each business area it can name, and, for a register
  folder of more than 50 entries, its split into domain folders, each moved entry keeping its id
  with `Kept id:`, its text byte for byte;
- a `Layers:` line, and a `Domain:` when the ADR is about one area, on each ADR and rule it can place.

Everything it writes is proposed, in its one docs-only pull request. What it cannot place stays
global, with a `TODO(human)` line. It never rewrites what a person wrote (BR-PRODUCT-10): moving an
entry whole into a domain folder is not a rewrite. `/omni:mega-invade` copies each target's `layers`
key beside its `flow`, as it copies `flow` today.

### 6. This repository goes first

The last slice runs `/omni:invade --refresh` here. Its docs-only pull request is reviewed by a
person like any other; the five made-up changes above become a test that must pass on what it
proposes.

**The data.** One migration, dated after the newest on `main`:

- `update public.product_repositories set role = <alias target> where role in (<aliases>)`.
- `product_repository_link()` refuses a role outside the nine (22023, hint `role`), and still
  accepts `null`. A row keeping an old role is read as it is, flagged by the tab.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | config | `layers` | follows `contracts` ← kit/lib/config.ts:449 |
| vertuo-omni-loop | code | `CANONICAL_LAYERS`, `CANONICAL_ROLES`, `LAYER_ALIASES`, `ROLE_ALIASES` | follows `DEFAULT_CONTRACT_KINDS` ← kit/lib/config.ts:105 |
| vertuo-omni-loop | knowledge | `Layers:` | follows `Governs:` ← kit/lib/knowledge/registers.ts:163 |
| vertuo-omni-loop | knowledge | ADR `**Layers:**`, `**Domain:**` | follows `**PRD:**` ← .omni-loop/knowledge/adr/README.md (Format) |
| vertuo-omni-loop | graph | edge kinds `domain`, `layer` | follows `same-prd` ← kit/lib/knowledge/graph-schema.ts:26 |
| vertuo-omni-loop | database | migration `<date>_canonical_roles.sql` | no written convention: follows `20261129090000_product_repositories.sql` |
| vertuo-omni-loop | docs | `docs/guide/knowledge-map.md` | follows `docs/guide/flow.md` |

## Decisions

- **Domain → paths reuses `flow.areas`** (asked: the person chose it over a new `knowledge.domains`
  section or a file in each domain folder), and every part is optional: no area means a domain is
  global, no layer means an entry is global.
- **Domain is for business rules, layer is for ADRs** (the person's split): a rule may name layers,
  an ADR may name a domain, as exceptions.
- **Layers are the contract kinds, made canonical and exhaustive; the paths are the repository's**
  (asked). A file may be in several layers; it belongs to one domain, the first area that matches.
- **Roles are canonical too:** api, web, mobile, ui, library, infra, plan, doc, monorepo (the
  person's list).
- **One PRD for the vocabulary, the roles and the lookup** (asked: the person chose one over two).
- **Old words: known aliases mapped once, the rest kept and flagged** (asked), never refused on what
  already exists.
- **The lookup shows what applies first, then what is global** (the person's answer); other areas'
  laws are counted, not printed.
- **Legal entries stay global** (the person's answer); a domain on a Legal entry, in the UI, is later.
- **`/omni:invade --refresh` migrates this repository** (asked), so every other repository gets the
  same path.
- **The layer list is the fine-grained one, documented in the guide** (the person's answer).
- **The voice.** persona:B-E DEv objected: "Another map of paths to keep in sync with my code.
  Nobody will update it, so in six months the agent misses rules again and I am back to not trusting
  it." Settled `accepted`: `omni check config` flags a pattern that matches no tracked file, and
  `/omni:invade --refresh` proposes the map from evidence.
- **No proof video** (asked).

## User stories

- As an agent changing `apps/galaxy/src/ask/ask.service.ts`, `omni kb laws --paths` shows me
  BR-PRODUCT-12 under **Applies here**, and the ask ADRs, without a migration in the list.
- As an agent changing a migration, I see the `db` ADRs and the rules that name `db`, not every rule
  of the product.
- As a law owner, the law I locked reaches the files of its domain without my writing a regular
  expression.
- As a lead engineer, I read one page that defines each layer and role, the same in every repository
  of the product.
- As a workspace owner on a product's Repositories tab, I pick a repository's role from a list, and a
  role the list does not hold is flagged until I pick one.
- As a person setting up a repository, `/omni:invade --refresh` proposes the areas, the layers and
  the ADR tags in one pull request I review.

## Scope

In: the canonical lists and alias tables, the `layers` config key, flow areas read by the lookups,
`Layers:` on registers and ADRs, the lookup and its output (text and `--json`), the graph's two edge
kinds, `omni check config` and `omni check knowledge` changes, the skills' words where they quote
`kb laws` output, `/omni:invade` and `/omni:mega-invade`, the role migration, the Repositories tab's
role select, `docs/guide/knowledge-map.md`, this repository's refresh, `kit/dist` rebuilt.

Out: a domain on Legal entries, on the Omni page or elsewhere; showing layers on the Omni page's
knowledge view; changing what a flow area does for planning or merging; renaming any knowledge id.

## Test seams

Following `omni kb show testing`:

- **Resolver** (unit, `kit/lib/knowledge/`): file → domain and layers; entry → applies, global or
  hidden, for each of `Governs:`, domain, layer and none; nothing declared gives today's list.
- **Config** (unit, `kit/lib/config.test.ts`): `layers` keys refused outside the list; aliases
  read; an unknown contract kind flagged; a pattern matching no tracked file flagged.
- **Registers and check** (unit): `Layers:` parsed and checked; ADR status-line `Layers` and
  `Domain` parsed; a law with no `Governs:` accepted; a moved entry keeps its id.
- **The five made-up changes** (`kit/bin/kb.test.ts`, over a fixture knowledge folder with areas and
  layers): each finds its rule under **Applies here**, and none prints a locked law of another area.
- **Database** (`apps/galaxy/src/product-repositories/*-sql.test.ts`): aliases mapped, an unmapped
  role kept, a new non-canonical role refused, `null` still accepted.
- **Repositories tab** (render test): the role select lists the nine roles; a flagged old value is
  shown and marked.
- **Invade** (skill text test, `kit/test/plugin.test.ts`): the skill names `layers`, areas,
  `Kept id:` and the proposed state.

## Risks

- **Every skill reads `kb laws`.** Its output changes shape: the skills that quote it (brainstorm,
  plan, do-work, bug-fix, visual-fix, enforce) are updated in the same PRD, and `--json` keeps a
  `laws` array for older readers.
- **Moving entries between folders** must not read as a law losing its test: the base-branch
  comparison keys laws by id, which `Kept id:` keeps. A test covers a law moved between folders.
- **CODEOWNERS** lines follow the files that hold laws: `omni kb owners` is rerun when the refresh
  moves a law, in the same pull request.
- **The role migration runs on production:** it only maps the alias table and changes no other row;
  rolled back by reverting the migration's mapping from the alias table.
- **What merging publishes:** a kit release (`omni update` brings the new `kb laws` output and the
  checks), the migration, and the Repositories tab. Rolled back by reverting the feature PR; a
  repository with no `layers` and no knowledge areas behaves as today either way.
- **The locked laws the changed files fall under** (none of their meanings changes):
  - N-PRODUCT-15: an agent could merge into the main branch. Changing it needs @pierrederval or
    @dervalp to approve the pull request on GitHub. (The skills' wording changes under
    `kit/plugin/skills/`.)
  - N-PRODUCT-14 and BR-PRODUCT-6, N-PRODUCT-3: a law that loses its test would go unseen, or a
    risky change go unexplained. Changing them needs @pierrederval or @dervalp to approve the pull
    request on GitHub. (The base-branch law comparison under `kit/lib/outbox/` learns moved entries.)
  - BR-PRODUCT-12, 28, 29, 39, 59, 63, 64 and N-PRODUCT-16, through their `^supabase/migrations/`
    pattern: a new migration falls under them. Changing them needs @pierrederval or @dervalp to
    approve the pull request on GitHub. The migration touches only `product_repositories.role`.
  - The refresh slice moves locked laws into domain folders and adds `Layers:` lines: every law it
    moves needs @pierrederval or @dervalp to approve that pull request on GitHub.
- **The Legal entries:** none touched. They become global lines in the lookup's output; their text
  and owners do not change.

## Acceptance criteria

1. With `layers` and a flow area `ask` (`knowledge: ask`) declared, `omni kb laws --paths
   apps/galaxy/src/ask/ask.service.ts` prints BR-PRODUCT-12 under **Applies here**, marked
   `domain ask`.
2. With `layers.db` declared, a lookup on one migration file lists the `db` ADRs and the rules naming
   `db` under **Applies here**, and no rule of another domain that names no `db`.
3. A locked law of a domain no file of the lookup belongs to is not printed; the last line counts
   them.
4. A repository with no `layers` and no flow area with `knowledge` gets every entry under
   **Global**, the same entries as today.
5. Every Legal entry prints under **Global**.
6. `omni check config` refuses a `layers` key that is not a canonical layer, naming it and the list;
   reads `rest` as `api`; flags an unknown contract kind; flags a pattern matching no tracked file.
7. `omni check knowledge` refuses `Layers: database-ish` and accepts a locked law with no `Governs:`.
8. An entry moved into another domain folder with `Kept id:` keeps its id in `kb laws`, CODEOWNERS
   and the base-branch law comparison.
9. `kb graph --paths` shows `domain` and `layer` edges, and an ADR tagged `Layers: db` is reached
   from a migration file.
10. On the Omni page, `back-end` is stored as `api` after the migration; a new role `back-end` is
    refused; a role the table cannot map is shown flagged on the Repositories tab, whose Role field
    is a select of the nine roles.
11. `docs/guide/knowledge-map.md` defines every layer and role in one line each, with the alias
    table.
12. `/omni:invade --refresh` on this repository opens one docs-only pull request proposing `layers`,
    knowledge areas and ADR layers, and on its branch the five made-up changes of **Problem** each
    find their rule under **Applies here**.
